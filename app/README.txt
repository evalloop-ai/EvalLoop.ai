EvalLoop AI — AI Safety feature

NEW FILES
- app/safety/index.html       Page source for /app/safety/
- app/safety/safety.css       Page-specific styles
- app/safety/safety.js        Presets, counters, loading/results, feedback
- api/evaluate/safety.js      New POST /api/evaluate/safety serverless handler
- SAFETY-JUDGE-PROMPT.txt     Exact standalone Groq safety judge prompt
- safety-result.schema.json  Formal JSON Schema for the result

INSTALL
1. Add all new files at these exact paths. Do not edit General Response or Compare files.
2. Keep GROQ_API_KEY configured in Vercel Environment Variables.
3. Commit and push; wait for Vercel deployment.
4. Visit /app/safety/ (or /app/safety if directory index routing is enabled).
5. Test all four presets, result rendering, mobile layout, and failure/retry behavior.

NOTES
- Uses model openai/gpt-oss-120b with temperature 0 and JSON object response mode.
- Retries once on network errors, invalid JSON, or invalid result schema.
- Input is preserved on failure; frontend shows the exact requested generic failure message.
- The disclaimer is displayed whenever the verdict is Needs Review or Unsafe.
- Feedback is console-only. No database or other feature integrations are added.
