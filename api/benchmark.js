// api/benchmark.js
//
// EvalLoop AI — Benchmark Engine
//
// Flow:
// Benchmark Dataset
//      ↓
// Candidate Model
//      ↓
// Candidate Responses
//      ↓
// EVP.Aureon Evaluator
//      ↓
// Dimension Scores
//      ↓
// Aggregate Benchmark
//
// NOTE:
// This first production version executes candidate models available
// through the Groq API. The evaluator is EVP.Aureon.
//
// Environment variable required in Vercel:
// GROQ_API_KEY

const EVALUATOR_MODEL = "openai/gpt-oss-120b";
const EVALUATOR_NAME = "EVP.Aureon";

// Models currently supported by this benchmark endpoint.
// The UI can send either the friendly name or the actual model ID.
const SUPPORTED_MODELS = {
  "GPT-OSS 120B": "openai/gpt-oss-120b",
  "GPT-OSS 20B": "openai/gpt-oss-20b",
  "Qwen 3.8 27B": "qwen/qwen3.8-27b"
};

// Initial structured benchmark dataset.
// These are EvalLoop's internal benchmark questions.
// They are NOT presented as an official external benchmark.
const BENCHMARK_DATASET = [
  {
    id: "gq-001",
    question: "What is the capital city of France?",
    reference: "Paris",
    type: "factuality"
  },
  {
    id: "gq-002",
    question: "Who wrote Romeo and Juliet?",
    reference: "William Shakespeare",
    type: "factuality"
  },
  {
    id: "gq-003",
    question: "What planet is known as the Red Planet?",
    reference: "Mars",
    type: "factuality"
  },
  {
    id: "gq-004",
    question: "What is 12 multiplied by 8?",
    reference: "96",
    type: "reasoning"
  },
  {
    id: "gq-005",
    question: "Name the largest ocean on Earth.",
    reference: "Pacific Ocean",
    type: "factuality"
  },
  {
    id: "gq-006",
    question: "What gas do plants primarily absorb from the atmosphere during photosynthesis?",
    reference: "Carbon dioxide",
    type: "factuality"
  },
  {
    id: "gq-007",
    question: "If a train travels 60 kilometers in 1 hour, how far will it travel in 3 hours at the same speed?",
    reference: "180 kilometers",
    type: "reasoning"
  },
  {
    id: "gq-008",
    question: "What is the boiling point of water at standard atmospheric pressure in Celsius?",
    reference: "100 degrees Celsius",
    type: "factuality"
  },
  {
    id: "gq-009",
    question: "Which language is primarily used to structure the content of a web page?",
    reference: "HTML",
    type: "factuality"
  },
  {
    id: "gq-010",
    question: "What is the square root of 144?",
    reference: "12",
    type: "reasoning"
  },
  {
    id: "gq-011",
    question: "Give exactly three examples of renewable energy sources.",
    reference: "Examples include solar, wind, and hydropower.",
    type: "instruction_following"
  },
  {
    id: "gq-012",
    question: "Explain gravity in one short sentence.",
    reference: "Gravity is the force that attracts objects with mass toward one another.",
    type: "instruction_following"
  },
  {
    id: "gq-013",
    question: "What is the primary purpose of a database?",
    reference: "To store, organize, and retrieve data.",
    type: "factuality"
  },
  {
    id: "gq-014",
    question: "If a product costs $80 and receives a 25% discount, what is the final price?",
    reference: "$60",
    type: "reasoning"
  },
  {
    id: "gq-015",
    question: "What is the opposite of the word 'expand'?",
    reference: "Contract or shrink.",
    type: "factuality"
  },
  {
    id: "gq-016",
    question: "Name one major benefit of regular physical exercise.",
    reference: "Examples include improved cardiovascular health, strength, mobility, or overall fitness.",
    type: "relevance"
  },
  {
    id: "gq-017",
    question: "What does CPU stand for?",
    reference: "Central Processing Unit",
    type: "factuality"
  },
  {
    id: "gq-018",
    question: "A box contains 5 red balls and 3 blue balls. How many balls are there in total?",
    reference: "8",
    type: "reasoning"
  },
  {
    id: "gq-019",
    question: "Why is it useful to validate information before relying on it?",
    reference: "Validation helps identify errors, inaccuracies, or unsupported claims.",
    type: "relevance"
  },
  {
    id: "gq-020",
    question: "Write a polite one-sentence response declining an invitation.",
    reference: "A concise and polite decline.",
    type: "instruction_following"
  }
];

const VALID_DIMENSIONS = [
  "factuality",
  "instruction_following",
  "relevance",
  "completeness",
  "safety",
  "fluency"
];

function sendJson(res, statusCode, body) {
  res.status(statusCode).json(body);
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
}

function normalizeDimension(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeDimensions(dimensions) {
  if (!Array.isArray(dimensions)) {
    return [];
  }

  return [...new Set(
    dimensions
      .map(normalizeDimension)
      .filter((dimension) => VALID_DIMENSIONS.includes(dimension))
  )];
}

function resolveModel(model) {
  const input = String(model || "").trim();

  if (!input) {
    return null;
  }

  if (SUPPORTED_MODELS[input]) {
    return SUPPORTED_MODELS[input];
  }

  const supportedIds = Object.values(SUPPORTED_MODELS);

  if (supportedIds.includes(input)) {
    return input;
  }

  return null;
}

function displayModelName(modelId) {
  const entry = Object.entries(SUPPORTED_MODELS)
    .find(([, id]) => id === modelId);

  return entry ? entry[0] : modelId;
}

function getTestQuestions(testSize) {
  const size = Math.max(1, Math.min(Number(testSize) || 10, 100));

  const questions = [];

  for (let i = 0; i < size; i += 1) {
    questions.push(
      BENCHMARK_DATASET[i % BENCHMARK_DATASET.length]
    );
  }

  return questions.map((item, index) => ({
    ...item,
    runIndex: index + 1
  }));
}

async function groqChat({
  apiKey,
  model,
  messages,
  temperature = 0.2,
  maxCompletionTokens = 500,
  responseFormat = null
}) {
  const body = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxCompletionTokens
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }
  );

  const rawText = await response.text();

  let data;

  try {
    data = JSON.parse(rawText);
  } catch {
    data = {
      error: {
        message: rawText || "Invalid response from Groq."
      }
    };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Groq API returned HTTP ${response.status}.`;

    throw new Error(message);
  }

  const content =
    data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Groq returned an empty model response.");
  }

  return {
    content: content.trim(),
    raw: data
  };
}

function buildCandidatePrompt(item) {
  return [
    "You are the candidate AI model being evaluated by EvalLoop AI.",
    "",
    "Answer the user's question directly.",
    "Do not mention this benchmark.",
    "Do not mention EvalLoop AI.",
    "Do not claim that you are being evaluated.",
    "",
    `Question: ${item.question}`
  ].join("\n");
}

function buildEvaluatorPrompt(item, candidateAnswer, dimensions) {
  return `
You are EVP.Aureon, the evaluation engine of EvalLoop AI.

Evaluate the candidate AI response against the benchmark question and reference answer.

IMPORTANT:
- Evaluate only the candidate response.
- Do not reward the response simply because it sounds confident.
- Use the reference answer as evidence where applicable.
- Scores must reflect the actual response.
- Do not invent missing information.
- Return ONLY valid JSON.
- Every requested dimension must receive an integer score from 0 to 100.

BENCHMARK QUESTION:
${item.question}

REFERENCE ANSWER:
${item.reference}

CANDIDATE RESPONSE:
${candidateAnswer}

REQUESTED DIMENSIONS:
${dimensions.join(", ")}

SCORING GUIDANCE:

factuality:
100 = fully correct and supported
80 = mostly correct with minor issue
50 = mixed or partially correct
20 = substantially incorrect
0 = completely incorrect

instruction_following:
100 = follows all explicit instructions
80 = follows most instructions
50 = partially follows instructions
20 = largely ignores instructions
0 = does not follow the request

relevance:
100 = directly addresses the question
80 = mostly relevant with minor unnecessary content
50 = partially relevant
20 = mostly off-topic
0 = does not address the question

completeness:
100 = fully addresses what was requested
80 = minor omission
50 = important omission
20 = major omission
0 = essentially unanswered

safety:
100 = clearly safe and appropriate
80 = minor concern
50 = notable concern
20 = serious concern
0 = clearly unsafe

fluency:
100 = clear, natural, coherent, and well-written
80 = minor language problems
50 = noticeable clarity problems
20 = difficult to understand
0 = unintelligible

Return this exact JSON structure:

{
  "scores": {
    "factuality": 0,
    "instruction_following": 0,
    "relevance": 0,
    "completeness": 0,
    "safety": 0,
    "fluency": 0
  },
  "reason": "One short sentence explaining the main evaluation."
}
`;
}

function parseEvaluatorResponse(content) {
  let text = String(content || "").trim();

  // Remove markdown code fences if a model adds them.
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to recover the first JSON object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("EVP.Aureon returned invalid JSON.");
    }

    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("EVP.Aureon returned invalid JSON.");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("EVP.Aureon returned an invalid evaluation.");
  }

  return parsed;
}

function normalizeEvaluation(parsed, dimensions) {
  const scores = {};

  for (const dimension of VALID_DIMENSIONS) {
    if (!dimensions.includes(dimension)) {
      continue;
    }

    const value =
      parsed?.scores?.[dimension] ??
      parsed?.[dimension];

    scores[dimension] = Math.round(clampScore(value));
  }

  return {
    scores,
    reason:
      typeof parsed?.reason === "string"
        ? parsed.reason.slice(0, 500)
        : ""
  };
}

function calculateDimensionScores(evaluations, dimensions) {
  const totals = {};
  const counts = {};

  for (const dimension of dimensions) {
    totals[dimension] = 0;
    counts[dimension] = 0;
  }

  for (const evaluation of evaluations) {
    for (const dimension of dimensions) {
      const value = evaluation?.scores?.[dimension];

      if (Number.isFinite(value)) {
        totals[dimension] += value;
        counts[dimension] += 1;
      }
    }
  }

  const result = {};

  for (const dimension of dimensions) {
    if (counts[dimension] === 0) {
      result[dimension] = 0;
    } else {
      result[dimension] =
        Math.round(
          (totals[dimension] / counts[dimension]) * 10
        ) / 10;
    }
  }

  return result;
}

function calculateOverall(dimensionScores, dimensions) {
  const values = dimensions
    .map((dimension) => Number(dimensionScores[dimension]))
    .filter(Number.isFinite);

  if (!values.length) {
    return 0;
  }

  const average =
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  return Math.round(average * 10) / 10;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return sendJson(res, 405, {
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      success: false,
      error: "GROQ_API_KEY is not configured in Vercel."
    });
  }

  try {
    const body = req.body || {};

    const benchmark =
      String(body.benchmark || "General Quality").trim();

    const requestedModel =
      String(body.model || "").trim();

    const candidateModel = resolveModel(requestedModel);

    if (!candidateModel) {
      return sendJson(res, 400, {
        success: false,
        error:
          "Unsupported candidate model. Use GPT-OSS 120B, GPT-OSS 20B, or Qwen 3.8 27B."
      });
    }

    const dimensions = normalizeDimensions(body.dimensions);

    if (!dimensions.length) {
      return sendJson(res, 400, {
        success: false,
        error: "Select at least one evaluation dimension."
      });
    }

    const testSize = Math.max(
      1,
      Math.min(Number(body.testSize) || 10, 100)
    );

    if (benchmark !== "General Quality") {
      return sendJson(res, 400, {
        success: false,
        error:
          "This benchmark suite is not available yet. General Quality is currently supported."
      });
    }

    const questions = getTestQuestions(testSize);

    const evaluations = [];
    const itemResults = [];

    /*
     * Run candidate → evaluator sequentially.
     *
     * Sequential execution is intentional for the first version:
     * it reduces the chance of hitting API rate limits and makes
     * failures easier to identify.
     */
    for (const item of questions) {
      // ------------------------------------------------------------
      // STEP 1 — Candidate model answers the benchmark question.
      // ------------------------------------------------------------

      const candidateResult = await groqChat({
        apiKey,
        model: candidateModel,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant. Answer accurately, clearly, and directly."
          },
          {
            role: "user",
            content: buildCandidatePrompt(item)
          }
        ],
        temperature: 0.2,
        maxCompletionTokens: 700
      });

      const candidateAnswer = candidateResult.content;

      // ------------------------------------------------------------
      // STEP 2 — EVP.Aureon evaluates the actual candidate answer.
      // ------------------------------------------------------------

      const evaluatorPrompt =
        buildEvaluatorPrompt(
          item,
          candidateAnswer,
          dimensions
        );

      const evaluatorResult = await groqChat({
        apiKey,
        model: EVALUATOR_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are EVP.Aureon. You evaluate AI responses objectively and return valid JSON only."
          },
          {
            role: "user",
            content: evaluatorPrompt
          }
        ],
        temperature: 0,
        maxCompletionTokens: 700,
        responseFormat: {
          type: "json_object"
        }
      });

      const parsedEvaluation =
        parseEvaluatorResponse(
          evaluatorResult.content
        );

      const normalizedEvaluation =
        normalizeEvaluation(
          parsedEvaluation,
          dimensions
        );

      evaluations.push(normalizedEvaluation);

      itemResults.push({
        id: item.id,
        testNumber: item.runIndex,
        question: item.question,
        reference: item.reference,
        candidateAnswer,
        scores: normalizedEvaluation.scores,
        reason: normalizedEvaluation.reason
      });
    }

    // --------------------------------------------------------------
    // STEP 3 — Aggregate all candidate evaluations.
    // --------------------------------------------------------------

    const dimensionScores =
      calculateDimensionScores(
        evaluations,
        dimensions
      );

    const overall =
      calculateOverall(
        dimensionScores,
        dimensions
      );

    const generatedAt =
      new Date().toISOString();

    return sendJson(res, 200, {
      success: true,

      benchmark,

      engine: EVALUATOR_NAME,

      evaluatorModel: EVALUATOR_MODEL,

      model: displayModelName(candidateModel),

      modelId: candidateModel,

      testSize: questions.length,

      dimensions,

      overall,

      dimensionScores,

      results: itemResults,

      generatedAt,

      note:
        "Structured EvalLoop benchmark using the current internal dataset. The candidate model generated the answers and EVP.Aureon evaluated those responses. This is not an official external benchmark dataset."
    });

  } catch (error) {
    console.error("Benchmark error:", error);

    return sendJson(res, 500, {
      success: false,
      error:
        error?.message ||
        "Benchmark execution failed."
    });
  }
}
