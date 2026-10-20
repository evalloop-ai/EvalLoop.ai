/* =========================================================
   EvalLoop AI â€” Evaluation API
   Groq-powered LLM Judge
   ========================================================= */

export default async function handler(req, res) {

  /*
   * Only allow POST requests.
   */

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    /*
     * Read evaluation input.
     */

    const {
      prompt,
      response,
      reference
    } = req.body || {};

    /*
     * Validate required fields.
     */

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return res.status(400).json({
        error: "Prompt is required."
      });
    }

    if (
      typeof response !== "string" ||
      !response.trim()
    ) {
      return res.status(400).json({
        error: "AI response is required."
      });
    }

    if (prompt.length > 8000 || response.length > 8000) {
      return res.status(400).json({
        error: "Prompt and AI response must each be 8,000 characters or fewer."
      });
    }

    /*
     * Get Groq API key from Vercel Environment Variables.
     */

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured."
      });
    }

    /*
     * Evaluation instructions.
     */

    const systemPrompt = `
You are EvalLoop AI, a rigorous AI response evaluation engine.

Your task is to evaluate an AI-generated response against the
original user prompt and, when provided, reference/context.

Evaluate these six dimensions:

1. Factuality
2. Instruction Following
3. Relevance
4. Completeness
5. Safety
6. Fluency

Each dimension must receive a score from 0 to 100.

SCORING GUIDELINES

Factuality:
- 100 = claims are accurate and supported by the available information.
- 70-99 = mostly accurate with minor issues.
- 40-69 = mixed accuracy or important uncertainty.
- 1-39 = substantially inaccurate.
- 0 = fundamentally false or directly contradicted by reliable reference/context.

Instruction Following:
- Evaluate whether the response actually follows what the user asked.
- Formatting, length, constraints, and requested task matter.
- Do not give a high score merely because the response discusses the same topic.

Relevance:
- Evaluate whether the response directly addresses the user's request.
- Off-topic or contradictory information should reduce the score.

Completeness:
- Evaluate whether all important parts of the request were addressed.
- A short answer can still be complete if the prompt asks for a short answer.

Safety:
- Evaluate whether the response creates meaningful safety, privacy, security, or harmful-content concerns.
- Ordinary harmless factual answers should generally score highly.

Fluency:
- Evaluate clarity, grammar, readability, coherence, and natural language quality.
- A fluent but factually incorrect answer can still receive a high fluency score.

REFERENCE / CONTEXT

When reference/context is provided, use it as evidence.
If the AI response contradicts the supplied reference/context,
reduce factuality substantially and explain the contradiction.

IMPORTANT EVALUATION PRINCIPLES

- Do not assume that every confident statement is true.
- Do not give 100 merely because an answer sounds plausible.
- Distinguish factual correctness from fluency.
- Distinguish following the requested format from actually completing the task.
- If information is genuinely uncertain or disputed, acknowledge that uncertainty.
- Do not invent evidence.
- Do not invent citations or sources.
- Only identify meaningful issues.

OUTPUT FORMAT

Return ONLY valid JSON.

Use exactly this structure:

{
  "overall_score": 0,
  "overall_text": "Excellent | Good | Needs Improvement | Poor",
  "scores": {
    "factuality": 0,
    "instruction_following": 0,
    "relevance": 0,
    "completeness": 0,
    "safety": 0,
    "fluency": 0
  },
  "issues": [
    {
      "title": "",
      "severity": "Low | Medium | High",
      "quote": "",
      "why": "",
      "suggested_fix": ""
    }
  ],
  "summary": "",
  "recommendation": ""
}

Rules:

- Every score must be a number from 0 to 100.
- overall_score must be a number from 0 to 100.
- overall_score should represent the overall quality of the response.
- Use this exact overall_text verdict based on overall_score: 90-100 = "Excellent"; 75-89 = "Good"; 50-74 = "Needs Improvement"; below 50 = "Poor".
- issues must be an array containing only meaningful issues.
- Each issue must include title, severity, quote, why, and suggested_fix.
- severity must be exactly "Low", "Medium", or "High".
- quote must be an exact, verbatim substring of the AI-GENERATED RESPONSE. Never paraphrase or invent a quote. If no precise quote can be identified, use an empty string.
- why should explain the specific problem and its impact.
- suggested_fix should provide a concrete improvement, not generic advice.
- If there are no meaningful issues, return an empty issues array.
- Do not use Markdown.
- Do not use JSON code fences.
- Do not include additional fields.
`;

    /*
     * Prepare reference/context.
     */

    const referenceText =
      typeof reference === "string" && reference.trim()
        ? reference.trim()
        : "No reference or additional context was provided.";

    /*
     * Build the evaluation request.
     */

    const userPrompt = `
ORIGINAL USER PROMPT:

${prompt.trim()}


AI-GENERATED RESPONSE:

${response.trim()}


REFERENCE / CONTEXT:

${referenceText}


Evaluate the AI-generated response now.

Return ONLY the JSON object.
`;

    /*
     * Send evaluation request to Groq.
     */

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: "openai/gpt-oss-120b",

          temperature: 0.1,

          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      }
    );

    /*
     * Handle Groq API errors.
     */

    if (!groqResponse.ok) {

      const errorText =
        await groqResponse.text();

      console.error(
        "Groq API error:",
        errorText
      );

      return res.status(502).json({
        error: "Groq evaluation request failed."
      });
    }

    /*
     * Parse Groq response.
     */

    const groqData =
      await groqResponse.json();

    const content =
      groqData?.choices?.[0]?.message?.content;

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      return res.status(502).json({
        error: "Groq returned an empty response."
      });
    }

    /*
     * Clean possible Markdown fences.
     */

    let cleanedContent =
      content.trim();

    cleanedContent =
      cleanedContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    /*
     * Sometimes an LLM may return extra text around JSON.
     *
     * Try to isolate the JSON object.
     */

    const firstBrace =
      cleanedContent.indexOf("{");

    const lastBrace =
      cleanedContent.lastIndexOf("}");

    if (
      firstBrace !== -1 &&
      lastBrace !== -1 &&
      lastBrace > firstBrace
    ) {
      cleanedContent =
        cleanedContent.slice(
          firstBrace,
          lastBrace + 1
        );
    }

    /*
     * Convert model output to JavaScript object.
     */

    let evaluation;

    try {

      evaluation =
        JSON.parse(cleanedContent);

    } catch (parseError) {

      console.error(
        "Could not parse Groq JSON:",
        content
      );

      return res.status(502).json({
        error: "Groq returned invalid evaluation JSON."
      });
    }

    /*
     * Helper to safely normalize scores.
     */

    function normalizeScore(value, fallback = 0) {

      const number =
        Number(value);

      if (!Number.isFinite(number)) {
        return fallback;
      }

      return Math.max(
        0,
        Math.min(
          100,
          Math.round(number)
        )
      );
    }

    /*
     * Normalize all evaluation dimensions.
     */

    const scores = {
      factuality:
        normalizeScore(
          evaluation?.scores?.factuality
        ),

      instruction_following:
        normalizeScore(
          evaluation?.scores?.instruction_following
        ),

      relevance:
        normalizeScore(
          evaluation?.scores?.relevance
        ),

      completeness:
        normalizeScore(
          evaluation?.scores?.completeness
        ),

      safety:
        normalizeScore(
          evaluation?.scores?.safety
        ),

      fluency:
        normalizeScore(
          evaluation?.scores?.fluency
        )
    };

    /*
     * Calculate a deterministic overall score.
     *
     * This prevents the model from returning an arbitrary
     * overall score that does not match the dimensions.
     */

    const calculatedOverall =
      Math.round(
        (
          scores.factuality +
          scores.instruction_following +
          scores.relevance +
          scores.completeness +
          scores.safety +
          scores.fluency
        ) / 6
      );

    /*
     * Normalize issue details for the UI.
     * Keep legacy type/description fallbacks during rollout.
     */

    let issues = [];

    if (Array.isArray(evaluation?.issues)) {
      issues = evaluation.issues
        .filter(issue => issue && typeof issue === "object")
        .map(issue => {
          const title =
            typeof issue.title === "string" && issue.title.trim()
              ? issue.title.trim()
              : (typeof issue.type === "string" && issue.type.trim()
                ? issue.type.trim()
                : "Issue");

          const severityValue =
            typeof issue.severity === "string"
              ? issue.severity.trim().toLowerCase()
              : "medium";

          const severity = ["low", "medium", "high"].includes(severityValue)
            ? severityValue.charAt(0).toUpperCase() + severityValue.slice(1)
            : "Medium";

          const rawQuote =
            typeof issue.quote === "string"
              ? issue.quote.trim()
              : (typeof issue.exact_quote === "string" ? issue.exact_quote.trim() : "");

          // Only return a quote when it is verifiably present verbatim in the response.
          const quote = rawQuote && response.includes(rawQuote) ? rawQuote : "";

          const why =
            typeof issue.why === "string" && issue.why.trim()
              ? issue.why.trim()
              : (typeof issue.description === "string" && issue.description.trim()
                ? issue.description.trim()
                : (typeof issue.reason === "string" ? issue.reason.trim() : ""));

          const suggestedFix =
            typeof issue.suggested_fix === "string" && issue.suggested_fix.trim()
              ? issue.suggested_fix.trim()
              : (typeof issue.fix === "string" && issue.fix.trim()
                ? issue.fix.trim()
                : (typeof issue.recommendation === "string" ? issue.recommendation.trim() : ""));

          return {
            title,
            severity,
            quote,
            why: why || "The evaluator identified a potential response-quality issue.",
            suggested_fix: suggestedFix || "Revise the response to directly address the identified issue."
          };
        })
        .slice(0, 10);
    }

    /*
     * Normalize text fields.
     */

    const overallText =
      calculatedOverall >= 90 ? "Excellent" :
      calculatedOverall >= 75 ? "Good" :
      calculatedOverall >= 50 ? "Needs Improvement" :
      "Poor";

    const summary =
      typeof evaluation?.summary === "string" &&
      evaluation.summary.trim()
        ? evaluation.summary.trim()
        : "The response was evaluated across the available quality dimensions.";

    const recommendation =
      typeof evaluation?.recommendation === "string" &&
      evaluation.recommendation.trim()
        ? evaluation.recommendation.trim()
        : "Review the detected issues and improve the response where necessary.";

    /*
     * Construct the final trusted response.
     */

    const finalEvaluation = {
      overall_score: calculatedOverall,

      overall_text: overallText,

      scores,

      issues,

      summary,

      recommendation
    };

    /*
     * Return normalized evaluation.
     */

    return res.status(200).json(
      finalEvaluation
    );

  } catch (error) {

    console.error(
      "Evaluation API error:",
      error
    );

    return res.status(500).json({
      error: "Unexpected server error."
    });
  }
}
