EvalLoop AI — Compare A vs B feature

NEW FILES
- app/compare/index.html       Page served at /app/compare (depending on existing Vercel routing; /app/compare/ is the directory URL)
- app/compare/compare.css      Compare page styles
- app/compare/compare.js       Compare page frontend
- api/evaluate/compare.js      New API route: POST /api/evaluate/compare
- JSON-SCHEMA.txt             Exact expected Groq JSON structure

DEPLOY
1. Add these new files to the repository. Do not replace any General Response files.
2. Keep GROQ_API_KEY configured in Vercel Environment Variables.
3. Commit and deploy.
4. Open /app/compare/ (or /app/compare if your Vercel setup rewrites directory URLs).
5. Verify the existing General Response page and /api/evaluate route are unchanged.

NOTES
- The API uses Groq model openai/gpt-oss-120b and temperature 0.
- It retries once after network, invalid JSON, or schema validation failures.
- The UI retains user inputs on failure and shows the requested generic error.
- Feedback is logged to the browser console only.
- The Compare feature does not write to a database.
