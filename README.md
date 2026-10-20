# EvalLoop AI — History & Insights

## Files
- `history/index.html` — page markup
- `history.css` — responsive styles
- `history.js` — Supabase session check, `/api/history` query, KPI calculations, Chart.js line chart, dimension averages, filters, and saved-result detail dialog
- `history-indexes.sql` — optional indexes for the existing dedicated history tables

## Add to the project
Copy `history/index.html` into the repository's `history/index.html`, and copy `history.css` and `history.js` to the project root. This gives the page `/history` or `/history/` on Vercel. If your project uses a custom routing configuration, add a rewrite from `/history` to `/history/index.html` without replacing existing rewrites.

## API contract
The page calls `GET /api/history` with `Authorization: Bearer <Supabase access token>`. The endpoint should return the authenticated user's saved rows, either as an array or in one of these array properties: `runs`, `evaluations`, `history`, `items`, `data`, or `results`. Each row should include the saved `result` JSON object and columns from `evalloop_evaluation_runs`.

This package intentionally does not replace `api/history.js`: the route is already used to save evaluations and feedback. Keep its POST behavior unchanged. If GET currently uses a different response envelope, adjust only `getRunArray()` in `history.js` to match the existing GET response.

## Existing tables
No new table is required. Run `history-indexes.sql` only if you want the recommended indexes and they are not already present. Do not change `public.evaluations`.

## Important
The page uses only the Supabase publishable key in the browser. Never place `SUPABASE_SERVICE_ROLE_KEY` or `GROQ_API_KEY` in frontend files.
