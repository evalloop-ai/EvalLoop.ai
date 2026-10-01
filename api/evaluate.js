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
     * Get the user's evaluation input.
     */

    const {
      prompt,
      response,
      reference
    } = req.body || {};


    /*
     * Check required fields.
     */

    if (!prompt || !response) {

      return res.status(400).json({
        error: "Prompt and AI response are required."
      });

    }


    /*
     * Check that the Groq API key exists.
     *
     * This comes from Vercel Environment Variables.
     */

    const apiKey =
      process.env.GROQ_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error: "GROQ_API_KEY is not configured."
      });

    }


    /*
     * Create the evaluation instructions.
     */

    const systemPrompt = `
You are EvalLoop AI, an expert AI response evaluator.

Your job is to evaluate an AI-generated response against
the original user prompt.

Evaluate these dimensions:

1. Factuality
2. Instruction Following
3. Relevance
4. Completeness
5. Safety
6. Fluency

Use a score from 0 to 100 for every dimension.

Be evidence-based.
Do not invent facts.
If there is not enough information to verify something,
explain the uncertainty.

Return ONLY valid JSON.

Use exactly this structure:

{
  "overall_score": 0,
  "overall_text": "",
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
      "type": "",
      "description": ""
    }
  ],
  "summary": "",
  "recommendation": ""
}

Important:

- Scores must be numbers from 0 to 100.
- overall_score should represent the overall quality.
- issues should contain only meaningful issues.
- If there are no meaningful issues, return an empty array.
- Do not use Markdown.
- Do not put JSON inside code fences.
`;


    /*
     * Add optional reference/context.
     */

    const referenceSection =
      reference
        ? `
REFERENCE / CONTEXT:

${reference}
`
        : `
REFERENCE / CONTEXT:

No reference or additional context was provided.
`;


    /*
     * Build the user message.
     */

    const userPrompt = `
ORIGINAL USER PROMPT:

${prompt}


AI-GENERATED RESPONSE:

${response}

${referenceSection}

Evaluate the AI-generated response now.
Return ONLY the JSON object.
`;


    /*
     * Send request to Groq.
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

          /*
           * We will start with this Groq model.
           */

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
     * Check Groq response.
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
     * Convert Groq response to JSON.
     */

    const groqData =
      await groqResponse.json();


    /*
     * Extract the model's answer.
     */

    const content =
      groqData?.choices?.[0]?.message?.content;


    if (!content) {

      return res.status(502).json({
        error: "Groq returned an empty response."
      });

    }


    /*
     * Remove possible Markdown code fences.
     */

    const cleanedContent =
      content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();


    /*
     * Convert the model output into a real JSON object.
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
     * Send evaluation back to the browser.
     */

    return res.status(200).json(
      evaluation
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
