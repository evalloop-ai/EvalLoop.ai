-- EvalLoop AI History & Insights: safe performance indexes.
-- The dedicated tables already exist; these statements do not modify the
-- existing public.evaluations table or any evaluator prompts/APIs.
-- Run in Supabase SQL Editor if these indexes do not already exist.

create index if not exists evalloop_evaluation_runs_user_created_idx
  on public.evalloop_evaluation_runs (user_id, created_at desc);

create index if not exists evalloop_evaluation_runs_user_type_created_idx
  on public.evalloop_evaluation_runs (user_id, evaluation_type, created_at desc);

create index if not exists evalloop_evaluation_feedback_user_created_idx
  on public.evalloop_evaluation_feedback (user_id, created_at desc);

-- Expected existing columns used by the page:
-- evalloop_evaluation_runs:
--   id, user_id, evaluation_type, prompt, response, response_a, response_b,
--   reference_context, result (jsonb), model_used, created_at
-- evalloop_evaluation_feedback:
--   id, evaluation_id, user_id, rating, created_at, updated_at
--
-- Reads are made through GET /api/history with the Supabase session's access
-- token. Keep service-role credentials on the server only.
