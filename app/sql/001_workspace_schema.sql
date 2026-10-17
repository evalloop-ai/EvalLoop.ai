-- EvalLoop AI workspace foundation. Eight app tables, isolated by workspace RLS.
create extension if not exists pgcrypto;

create table if not exists public.el_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.el_workspace_members (
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);
create table if not exists public.el_datasets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  source_type text not null default 'manual',
  row_count integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.el_dataset_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  dataset_id uuid not null references public.el_datasets(id) on delete cascade,
  case_index integer not null,
  input jsonb not null default '{}'::jsonb,
  expected_output text,
  actual_output text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(dataset_id,case_index)
);
create table if not exists public.el_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  evaluation_type text not null default 'quality' check (evaluation_type in ('quality','safety','comparison','custom')),
  config jsonb not null default '{"checks":[{"type":"has_output","weight":1}]}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.el_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  evaluation_id uuid not null references public.el_evaluations(id) on delete restrict,
  dataset_id uuid not null references public.el_datasets(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  total_cases integer not null default 0,
  passed_cases integer not null default 0,
  score numeric(6,2),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.el_run_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.el_workspaces(id) on delete cascade,
  run_id uuid not null references public.el_runs(id) on delete cascade,
  dataset_row_id uuid references public.el_dataset_rows(id) on delete set null,
  case_index integer not null,
  input jsonb not null default '{}'::jsonb,
  expected_output text,
  actual_output text,
  score numeric(6,2) not null default 0,
  passed boolean not null default false,
  checks jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique(run_id,case_index)
);
create table if not exists public.el_workspace_settings (
  workspace_id uuid primary key references public.el_workspaces(id) on delete cascade,
  preferences jsonb not null default '{"defaultEvaluationType":"quality","retentionDays":90}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists el_datasets_workspace_created_idx on public.el_datasets(workspace_id,created_at desc);
create index if not exists el_dataset_rows_dataset_idx on public.el_dataset_rows(dataset_id,case_index);
create index if not exists el_evaluations_workspace_created_idx on public.el_evaluations(workspace_id,created_at desc);
create index if not exists el_runs_workspace_created_idx on public.el_runs(workspace_id,created_at desc);
create index if not exists el_run_results_run_idx on public.el_run_results(run_id,case_index);

-- Existing users can provision their own workspace; new users are provisioned automatically below.
create or replace function public.el_ensure_workspace()
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare wid uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select workspace_id into wid from public.el_workspace_members where user_id = uid order by created_at limit 1;
  if wid is null then
    insert into public.el_workspaces(name,owner_id) values ('My workspace',uid) returning id into wid;
    insert into public.el_workspace_members(workspace_id,user_id,role) values (wid,uid,'owner');
    insert into public.el_workspace_settings(workspace_id,updated_by) values (wid,uid) on conflict do nothing;
  end if;
  return wid;
end; $$;
grant execute on function public.el_ensure_workspace() to authenticated;

create or replace function public.el_provision_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare wid uuid; display_name text;
begin
  display_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),'My workspace');
  insert into public.el_workspaces(name,owner_id) values (display_name || '''s workspace',new.id) returning id into wid;
  insert into public.el_workspace_members(workspace_id,user_id,role) values (wid,new.id,'owner');
  insert into public.el_workspace_settings(workspace_id,updated_by) values (wid,new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists el_auth_user_provision_workspace on auth.users;
create trigger el_auth_user_provision_workspace after insert on auth.users for each row execute procedure public.el_provision_new_user();

create or replace function public.el_is_workspace_member(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.el_workspace_members m where m.workspace_id = wid and m.user_id = auth.uid());
$$;

alter table public.el_workspaces enable row level security;
alter table public.el_workspace_members enable row level security;
alter table public.el_datasets enable row level security;
alter table public.el_dataset_rows enable row level security;
alter table public.el_evaluations enable row level security;
alter table public.el_runs enable row level security;
alter table public.el_run_results enable row level security;
alter table public.el_workspace_settings enable row level security;

drop policy if exists el_workspaces_read on public.el_workspaces;
create policy el_workspaces_read on public.el_workspaces for select to authenticated using (public.el_is_workspace_member(id));
drop policy if exists el_workspaces_update on public.el_workspaces;
create policy el_workspaces_update on public.el_workspaces for update to authenticated using (public.el_is_workspace_member(id)) with check (public.el_is_workspace_member(id));
drop policy if exists el_members_read on public.el_workspace_members;
create policy el_members_read on public.el_workspace_members for select to authenticated using (public.el_is_workspace_member(workspace_id));

do $$ declare t text; begin
  foreach t in array array['el_datasets','el_dataset_rows','el_evaluations','el_runs','el_run_results','el_workspace_settings'] loop
    execute format('drop policy if exists %I on public.%I',t || '_member_all',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.el_is_workspace_member(workspace_id)) with check (public.el_is_workspace_member(workspace_id))',t || '_member_all',t);
  end loop;
end $$;

-- Explicit grants complement RLS; policies remain the data-access boundary.
grant select, update on public.el_workspaces to authenticated;
grant select on public.el_workspace_members to authenticated;
grant select, insert, update, delete on public.el_datasets to authenticated;
grant select, insert, update, delete on public.el_dataset_rows to authenticated;
grant select, insert, update, delete on public.el_evaluations to authenticated;
grant select, insert, update, delete on public.el_runs to authenticated;
grant select, insert, update, delete on public.el_run_results to authenticated;
grant select, insert, update, delete on public.el_workspace_settings to authenticated;
grant execute on function public.el_is_workspace_member(uuid) to authenticated;
