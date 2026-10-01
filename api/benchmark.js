export default async function handler(req, res) {
  /*
   * EvalLoop AI
   * Benchmark API
   *
   * This endpoint runs a set of benchmark cases through
   * the existing Groq evaluation model.
   *
   * Existing /api/evaluate is NOT modified.
   */

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured."
      });
    }

    const {
      benchmark = "General Quality",
      model = "Benchmark System",
      testSize = 10,
      dimensions = [
        "factuality",
        "instruction_following",
        "relevance",
        "completeness",
        "safety",
        "fluency"
      ]
    } = req.body || {};

    const safeTestSize = Math.min(
      Math.max(Number(testSize) || 10, 1),
      100
    );

    /*
     * Initial benchmark dataset.
     *
     * These are structured evaluation cases.
     * They are not claimed to represent an official
     * industry benchmark dataset.
     */

    const benchmarkCases = [
      {
        id: 1,
        prompt:
          "What is the capital of France?",
        reference:
          "The capital of France is Paris."
      },
      {
        id: 2,
        prompt:
          "Who wrote Romeo and Juliet?",
        reference:
          "William Shakespeare wrote Romeo and Juliet."
      },
      {
        id: 3,
        prompt:
          "What planet is known as the Red Planet?",
        reference:
          "Mars is commonly known as the Red Planet."
      },
      {
        id: 4,
        prompt:
          "What is 12 multiplied by 8?",
        reference:
          "12 multiplied by 8 equals 96."
      },
      {
        id: 5,
        prompt:
          "What gas do humans primarily breathe in to survive?",
        reference:
          "Humans primarily breathe oxygen for respiration."
      },
      {
        id: 6,
        prompt:
          "What is the largest ocean on Earth?",
        reference:
          "The Pacific Ocean is the largest ocean on Earth."
      },
      {
        id: 7,
        prompt:
          "What is the boiling point of water at standard atmospheric pressure?",
        reference:
          "Water boils at 100 degrees Celsius at standard atmospheric pressure."
      },
      {
        id: 8,
        prompt:
          "What is the chemical symbol for gold?",
        reference:
          "The chemical symbol for gold is Au."
      },
      {
        id: 9,
        prompt:
          "How many continents are commonly recognized on Earth?",
        reference:
          "Seven continents are commonly recognized."
      },
      {
        id: 10,
        prompt:
          "What is the first month of the year?",
        reference:
          "January is the first month of the year."
      },
      {
        id: 11,
        prompt:
          "What is the square root of 144?",
        reference:
          "The square root of 144 is 12."
      },
      {
        id: 12,
        prompt:
          "Which language is primarily spoken in Brazil?",
        reference:
          "Portuguese is the primary language spoken in Brazil."
      },
      {
        id: 13,
        prompt:
          "How many days are there in a standard week?",
        reference:
          "There are seven days in a standard week."
      },
      {
        id: 14,
        prompt:
          "What is the closest star to Earth?",
        reference:
          "The Sun is the closest star to Earth."
      },
      {
        id: 15,
        prompt:
          "What is 100 divided by 4?",
        reference:
          "100 divided by 4 equals 25."
      },
      {
        id: 16,
        prompt:
          "Which organ pumps blood through the human body?",
        reference:
          "The heart pumps blood through the human body."
      },
      {
        id: 17,
        prompt:
          "What is the freezing point of water in Celsius?",
        reference:
          "Water freezes at 0 degrees Celsius under standard conditions."
      },
      {
        id: 18,
        prompt:
          "Which planet is closest to the Sun?",
        reference:
          "Mercury is the planet closest to the Sun."
      },
      {
        id: 19,
        prompt:
          "How many sides does a triangle have?",
        reference:
          "A triangle has three sides."
      },
      {
        id: 20,
        prompt:
          "What is the largest mammal?",
        reference:
          "The blue whale is the largest mammal."
      }
    ];

    const selectedCases =
      benchmarkCases.slice(
        0,
        Math.min(
          safeTestSize,
          benchmarkCases.length
        )
      );

    /*
     * For test sizes above the initial dataset,
     * repeat cases deterministically rather than
     * pretending that additional unique benchmark
     * questions exist.
     */

    while (
      selectedCases.length < safeTestSize
    ) {
      selectedCases.push(
        benchmarkCases[
          selectedCases.length %
          benchmarkCases.length
        ]
      );
    }

    const normalizedDimensions =
      Array.isArray(dimensions)
        ? dimensions
        : [
            "factuality",
            "instruction_following",
            "relevance",
            "completeness",
            "safety",
            "fluency"
          ];

    const results = [];

    /*
     * Process cases sequentially.
     *
     * This keeps the implementation simple and
     * avoids creating a large burst of API requests.
     */

    for (const testCase of selectedCases) {

      const evaluationPrompt = `
You are EVP.Aureon, the general-purpose evaluation engine
for EvalLoop AI.

Evaluate the following AI response against the user's prompt
and reference answer.

USER PROMPT:
${testCase.prompt}

REFERENCE ANSWER:
${testCase.reference}

The candidate system being benchmarked is:
${model}

Important:
There is no candidate response supplied by the benchmark
client yet. Generate an evaluation target by answering the
user prompt yourself first, then evaluate that generated
answer against the reference.

Return ONLY valid JSON.

Use this exact structure:

{
  "factuality": 0,
  "instruction_following": 0,
  "relevance": 0,
  "completeness": 0,
  "safety": 0,
  "fluency": 0
}

Each score must be an integer from 0 to 100.

Definitions:

factuality:
Whether the answer is factually correct.

instruction_following:
Whether the answer directly follows the requested task.

relevance:
Whether the answer stays focused on the question.

completeness:
Whether the answer adequately addresses the question.

safety:
Whether the response is appropriately safe and policy compliant.

fluency:
Whether the response is clear, readable, and natural.
`;

      const response =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model:
                "openai/gpt-oss-120b",

              messages: [
                {
                  role: "system",
                  content:
                    "You are a precise AI evaluation engine. Return only valid JSON."
                },
                {
                  role: "user",
                  content:
                    evaluationPrompt
                }
              ],

              temperature: 0,

              max_tokens: 500
            })
          }
        );


      if (!response.ok) {

        const errorText =
          await response.text();

        throw new Error(
          `Groq API error: ${response.status} ${errorText}`
        );

      }


      const data =
        await response.json();


      const content =
        data?.choices?.[0]?.message?.content;


      if (!content) {

        throw new Error(
          "No evaluation response returned."
        );

      }


      /*
       * Extract JSON even if the model accidentally
       * wraps it in markdown.
       */

      let parsed;

      try {

        const cleaned =
          content
            .replace(
              /```json/gi,
              ""
            )
            .replace(
              /```/g,
              ""
            )
            .trim();


        const jsonMatch =
          cleaned.match(
            /\{[\s\S]*\}/
          );


        if (!jsonMatch) {
          throw new Error(
            "No JSON object found."
          );
        }


        parsed =
          JSON.parse(
            jsonMatch[0]
          );

      } catch (parseError) {

        throw new Error(
          "The evaluation model returned invalid JSON."
        );

      }


      const scores = {};

      for (
        const dimension
        of normalizedDimensions
      ) {

        const key =
          String(dimension)
            .toLowerCase()
            .replace(
              /[\s-]+/g,
              "_"
            );


        let score =
          Number(
            parsed[key]
          );


        if (
          !Number.isFinite(score)
        ) {
          score = 0;
        }


        score =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(score)
            )
          );


        scores[key] =
          score;

      }


      const scoreValues =
        Object.values(scores);


      const overall =
        scoreValues.length
          ? Math.round(
              scoreValues.reduce(
                (
                  total,
                  value
                ) =>
                  total + value,
                0
              ) /
              scoreValues.length
            )
          : 0;


      results.push({

        id: testCase.id,

        prompt:
          testCase.prompt,

        scores,

        overall

      });

    }


    /*
     * Aggregate benchmark results.
     */

    const dimensionAverages =
      {};


    for (
      const dimension
      of normalizedDimensions
    ) {

      const key =
        String(dimension)
          .toLowerCase()
          .replace(
            /[\s-]+/g,
            "_"
          );


      const values =
        results
          .map(
            result =>
              result.scores[key]
          )
          .filter(
            value =>
              Number.isFinite(value)
          );


      dimensionAverages[key] =
        values.length
          ? Math.round(
              values.reduce(
                (
                  total,
                  value
                ) =>
                  total + value,
                0
              ) /
              values.length
            )
          : 0;

    }


    const overallValues =
      results.map(
        result =>
          result.overall
      );


    const overall =
      overallValues.length
        ? Math.round(
            overallValues.reduce(
              (
                total,
                value
              ) =>
                total + value,
              0
            ) /
            overallValues.length
          )
        : 0;


    return res.status(200).json({

      success: true,

      benchmark,

      engine:
        "EVP.Aureon",

      model,

      testSize:
        selectedCases.length,

      dimensions:
        normalizedDimensions,

      overall,

      dimensionScores:
        dimensionAverages,

      results,

      generatedAt:
        new Date().toISOString(),

      note:
        "This benchmark currently uses EvalLoop AI's initial structured benchmark dataset. It is not presented as an official external benchmark dataset."

    });

  } catch (error) {

    console.error(
      "Benchmark error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Benchmark execution failed."

    });

  }
}
