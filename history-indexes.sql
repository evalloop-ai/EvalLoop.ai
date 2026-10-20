-- Optional indexes for the existing dedicated EvalLoop history tables.
-- No new tables or changes to public.evaluations are required.
create index if not exists evalloop_evaluation_runs_user_created_idx
  on public.evalloop_evaluation_runs (user_id, created_at desc);
create index if not exists evalloop_evaluation_runs_user_type_created_idx
  on public.evalloop_evaluation_runs (user_id, evaluation_type, created_at desc);
create index if not exists evalloop_evaluation_feedback_user_created_idx
  on public.evalloop_evaluation_feedback (user_id, created_at desc);
