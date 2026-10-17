# EvalLoop AI Workspace — functional foundation

This package adds a working Supabase-backed workspace for datasets, evaluation configurations, runs, case-level results, analysis, comparison, safety scans, and workspace settings. It keeps the existing `/app/general_response.html` AI Response tool separate and links to it from the workspace.

## Package layout
- `app/index.html` — workspace application shell
- `workspace-v2.js` — auth, CRUD, import/export parsing, evaluation engine, persisted run/result workflow, analysis and settings
- `workspace-v2.css` — responsive workspace-specific styles
- `style.css` — original EvalLoop AI visual system extracted from the supplied Overview page
- `sql/001_workspace_schema.sql` — eight `el_*` tables, indexes, workspace provisioning, and RLS policies

## Deploy
1. Apply `sql/001_workspace_schema.sql` in the Supabase SQL Editor for the project already configured in the app.
2. Upload `style.css` and `workspace-v2.css` to the site's root, `workspace-v2.js` to the site's root, and `app/index.html` to `/app/index.html`.
3. Verify `/login/` is the correct existing sign-in route and that the project allows your site origin in Supabase Auth URL settings.
4. Sign in, create a dataset, import JSON/CSV cases, create an evaluation, then run it. Run results are written to `el_runs` and `el_run_results`.

## Case format
JSON array example:
```json
[
  {"input":{"prompt":"What is 2 + 2?"},"expected_output":"4","actual_output":"4"},
  {"input":{"prompt":"Say hello"},"actual_output":"Hello!"}
]
```
CSV headers can include `input`, `prompt`, `expected_output`, `expected`, `actual_output`, `output`, `response`, or `metadata`. Remaining columns are preserved in the case input.

## Evaluation behavior
Checks include response present, exact expected-output match, required terms, forbidden/safety terms, and maximum output length. Scores are deterministic and persisted per case. **This foundation scores supplied responses; it does not call an LLM to generate responses or claim semantic understanding.** The Safety Evaluation view is a literal term scan, not a complete safety classifier. Model Comparison evaluates two pasted candidates using the same selected checks; its comparison is currently session-only.

## Security notes
The frontend uses the Supabase publishable key from the supplied source; it does not include a service-role secret. The SQL applies RLS to all workspace data tables. The provisioning function supports existing authenticated users and a trigger provisions new users. Test migration and policies in a staging project before production, particularly if this Supabase project already has a separate workspace membership model.

## Preserved behavior
The existing `/app/general_response.html` is not overwritten. The workspace links to that page so its current functionality remains intact. This package uses the `/app/` route for the new workspace shell.
