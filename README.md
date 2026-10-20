# EvalLoop AI History & Insights — reference UI match

This revision uses the supplied EvalLoop AI page's exact shared stylesheet, announcement bar, sticky navigation, typography, and footer as its visual foundation. It keeps the evaluation workflows and APIs unchanged.

Files: `history/index.html`, `history.css`, `history.js`, `history-indexes.sql`.

Install by copying `history/index.html` into the `history/` folder and placing `history.css` and `history.js` at the project root. Preserve existing Vercel routes and API handlers. The three action links use `/app/general-response`, `/app/compare`, and `/app/safety`.

The page calls `GET /api/history` with the Supabase session access token. The endpoint must return the signed-in user's saved evaluation rows, including each stored `result` JSON. The frontend supports arrays under `runs`, `evaluations`, `history`, `items`, `data`, or `results`.

No new table is required. Run the optional index SQL only if those indexes do not exist. Never put the service-role or Groq keys in frontend code.
