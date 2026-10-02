// api/benchmark.js
//
// EvalLoop AI — Benchmark Engine v1.1
//
// Flow:
//
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
// Current candidate execution provider:
// Groq
//
// Evaluator:
// EVP.Aureon
//
// Required Vercel environment variable:
// GROQ_API_KEY
//
// IMPORTANT:
// - This endpoint does not store candidate API keys.
// - Candidate API keys are not returned in responses.
// - This benchmark dataset is an internal EvalLoop starter dataset.
// - It is NOT presented as an official external benchmark.
// - Quality and performance metrics are kept conceptually separate.
//
// ================================================================
// ENGINE VERSION
// ================================================================
const ENGINE_VERSION = "1.1.0";
const BENCHMARK_VERSION = "EVP.Aureon v1.0";
const EVALUATOR_NAME = "EVP.Aureon";
const EVALUATOR_VERSION = "1.0";
const EVALUATOR_MODEL = "openai/gpt-oss-120b";
// ================================================================
// LIMITS
// ================================================================
const LIMITS = {
  minCases: 1,
  maxCases: 100,
  candidateTimeoutMs: 30000,
  evaluatorTimeoutMs: 30000,
  maxPromptLength: 12000,
  maxResponseLength: 30000,
  maxReasonLength: 500
};
// ================================================================
// SUPPORTED CANDIDATE MODELS
// ================================================================
//
// These are currently executable through Groq.
//
// The architecture intentionally separates the friendly UI name
// from the actual provider model ID.
//
const SUPPORTED_MODELS = {
  "GPT-OSS 120B": "openai/gpt-oss-120b",
  "GPT-OSS 20B": "openai/gpt-oss-20b",
  "Qwen 3.8 27B": "qwen/qwen3.8-27b"
};
// ================================================================
// BENCHMARK DATASET
// ================================================================
//
// Internal EvalLoop starter dataset.
//
// This is intentionally small while the benchmark calibration
// process is being established.
//
// Do NOT describe this as a scientifically validated external
// benchmark.
//
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
    question:
      "What gas do plants primarily absorb from the atmosphere during photosynthesis?",
    reference: "Carbon dioxide",
    type: "factuality"
  },
  {
    id: "gq-007",
    question:
      "If a train travels 60 kilometers in 1 hour, how far will it travel in 3 hours at the same speed?",
    reference: "180 kilometers",
    type: "reasoning"
  },
  {
    id: "gq-008",
    question:
      "What is the boiling point of water at standard atmospheric pressure in Celsius?",
    reference: "100 degrees Celsius",
    type: "factuality"
  },
  {
    id: "gq-009",
    question:
      "Which language is primarily used to structure the content of a web page?",
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
    question:
      "Give exactly three examples of renewable energy sources.",
    reference:
      "Examples include solar, wind, and hydropower.",
    type: "instruction_following"
  },
  {
    id: "gq-012",
    question:
      "Explain gravity in one short sentence.",
    reference:
      "Gravity is the force that attracts objects with mass toward one another.",
    type: "instruction_following"
  },
  {
    id: "gq-013",
    question:
      "What is the primary purpose of a database?",
    reference:
      "To store, organize, and retrieve data.",
    type: "factuality"
  },
  {
    id: "gq-014",
    question:
      "If a product costs $80 and receives a 25% discount, what is the final price?",
    reference: "$60",
    type: "reasoning"
  },
  {
    id: "gq-015",
    question:
      "What is the opposite of the word 'expand'?",
    reference: "Contract or shrink.",
    type: "factuality"
  },
  {
    id: "gq-016",
    question:
      "Name one major benefit of regular physical exercise.",
    reference:
      "Examples include improved cardiovascular health, strength, mobility, or overall fitness.",
    type: "relevance"
  },
  {
    id: "gq-017",
    question:
      "What does CPU stand for?",
    reference:
      "Central Processing Unit",
    type: "factuality"
  },
  {
    id: "gq-018",
    question:
      "A box contains 5 red balls and 3 blue balls. How many balls are there in total?",
    reference: "8",
    type: "reasoning"
  },
  {
    id: "gq-019",
    question:
      "Why is it useful to validate information before relying on it?",
    reference:
      "Validation helps identify errors, inaccuracies, or unsupported claims.",
    type: "relevance"
  },
  {
    id: "gq-020",
    question:
      "Write a polite one-sentence response declining an invitation.",
    reference:
      "A concise and polite decline.",
    type: "instruction_following"
  }
];
// ================================================================
// EVALUATION DIMENSIONS
// ================================================================
const VALID_DIMENSIONS = [
  "factuality",
  "instruction_following",
  "relevance",
  "completeness",
  "safety",
  "fluency"
];
// ================================================================
// DEFAULT DIMENSION WEIGHTS
// ================================================================
//
// These weights match the benchmark UI architecture.
//
// Total = 100.
//
const DEFAULT_WEIGHTS = {
  factuality: 20,
  instruction_following: 20,
  relevance: 15,
  completeness: 15,
  safety: 20,
  fluency: 10
};
// ================================================================
// RESPONSE HELPERS
// ================================================================
function sendJson(res, statusCode, body) {
  return res.status(statusCode).json(body);
}
// ================================================================
// SAFE ERROR MESSAGE
// ================================================================
//
// Prevents accidental leakage of secrets or authorization data.
//
function sanitizeErrorMessage(error) {
  let message =
    error?.message ||
    "Benchmark execution failed.";
  message = String(message);
  message = message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/api[_-]?key[=:]\s*[^\s,]+/gi, "apiKey=[REDACTED]");
  return message.slice(0, 1000);
}
// ================================================================
// SCORE HELPERS
// ================================================================
function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, number)
  );
}
function normalizeDimension(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
function normalizeDimensions(dimensions) {
  if (!Array.isArray(dimensions)) {
    return [...VALID_DIMENSIONS];
  }
  const normalized = [
    ...new Set(
      dimensions
        .map(normalizeDimension)
        .filter((dimension) =>
          VALID_DIMENSIONS.includes(dimension)
        )
    )
  ];
  return normalized.length
    ? normalized
    : [...VALID_DIMENSIONS];
}
// ================================================================
// WEIGHT HANDLING
// ================================================================
function normalizeWeights(requestedWeights, dimensions) {
  const raw =
    requestedWeights &&
    typeof requestedWeights === "object"
      ? requestedWeights
      : {};
  const weights = {};
  for (const dimension of dimensions) {
    const requested =
      Number(raw[dimension]);
    if (
      Number.isFinite(requested) &&
      requested >= 0
    ) {
      weights[dimension] = requested;
    } else {
      weights[dimension] =
        DEFAULT_WEIGHTS[dimension] || 0;
    }
  }
  const total =
    Object.values(weights)
      .reduce(
        (sum, value) => sum + value,
        0
      );
  if (total <= 0) {
    const equalWeight =
      100 / dimensions.length;
    for (const dimension of dimensions) {
      weights[dimension] =
        equalWeight;
    }
    return weights;
  }
  const normalized = {};
  for (const dimension of dimensions) {
    normalized[dimension] =
      (weights[dimension] / total) * 100;
  }
  return normalized;
}
// ================================================================
// MODEL RESOLUTION
// ================================================================
function resolveModel(model) {
  const input =
    String(model || "").trim();
  if (!input) {
    return null;
  }
  if (SUPPORTED_MODELS[input]) {
    return SUPPORTED_MODELS[input];
  }
  const supportedIds =
    Object.values(SUPPORTED_MODELS);
  if (supportedIds.includes(input)) {
    return input;
  }
  return null;
}
function displayModelName(modelId) {
  const entry =
    Object.entries(SUPPORTED_MODELS)
      .find(
        ([, id]) => id === modelId
      );
  return entry
    ? entry[0]
    : modelId;
}
// ================================================================
// DATASET SELECTION
// ================================================================
function getTestQuestions(testSize) {
  const requested =
    Number(testSize);
  const size =
    Number.isFinite(requested)
      ? Math.max(
          LIMITS.minCases,
          Math.min(
            Math.floor(requested),
            LIMITS.maxCases
          )
        )
      : 10;
  /*
   * IMPORTANT:
   *
   * The current dataset contains only 20 cases.
   *
   * For requests above 20 we currently cycle through
   * the starter dataset. The response explicitly reports
   * the unique dataset size so this is not mistaken for
   * a 100-case validated benchmark.
   */
  const questions = [];
  for (let i = 0; i < size; i += 1) {
    const source =
      BENCHMARK_DATASET[
        i % BENCHMARK_DATASET.length
      ];
    questions.push({
      ...source,
      runIndex: i + 1,
      datasetIndex:
        (i % BENCHMARK_DATASET.length) + 1
    });
  }
  return questions;
}
// ================================================================
// TIMEOUT FETCH
// ================================================================
async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 30000
) {
  const controller =
    new AbortController();
  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );
  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        `Request timed out after ${timeoutMs} ms.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
// ================================================================
// GROQ CHAT
// ================================================================
async function groqChat({
  apiKey,
  model,
  messages,
  temperature = 0.2,
  maxCompletionTokens = 500,
  responseFormat = null,
  timeoutMs = LIMITS.candidateTimeoutMs
}) {
  const body = {
    model,
    messages,
    temperature,
    max_completion_tokens:
      maxCompletionTokens
  };
  if (responseFormat) {
    body.response_format =
      responseFormat;
  }
  const startedAt =
    Date.now();
  const response =
    await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${apiKey}`
        },
        body:
          JSON.stringify(body)
      },
      timeoutMs
    );
  const latencyMs =
    Date.now() - startedAt;
  const rawText =
    await response.text();
  let data;
  try {
    data =
      JSON.parse(rawText);
  } catch {
    data = {
      error: {
        message:
          rawText ||
          "Invalid response from Groq."
      }
    };
  }
  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Groq API returned HTTP ${response.status}.`;
    const error =
      new Error(message);
    error.status =
      response.status;
    error.latencyMs =
      latencyMs;
    throw error;
  }
  const content =
    data?.choices?.[0]
      ?.message?.content;
  if (
    typeof content !== "string"
  ) {
    const error =
      new Error(
        "Groq returned an empty model response."
      );
    error.status =
      response.status;
    error.latencyMs =
      latencyMs;
    throw error;
  }
  return {
    content:
      content.trim(),
    raw: data,
    latencyMs
  };
}
// ================================================================
// CANDIDATE PROMPT
// ================================================================
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
// ================================================================
// EVALUATOR PROMPT
// ================================================================
function buildEvaluatorPrompt(
  item,
  candidateAnswer,
  dimensions
) {
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
// ================================================================
// PARSE EVALUATOR RESPONSE
// ================================================================
function parseEvaluatorResponse(
  content
) {
  let text =
    String(content || "")
      .trim();
  text =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();
  let parsed;
  try {
    parsed =
      JSON.parse(text);
  } catch {
    const start =
      text.indexOf("{");
    const end =
      text.lastIndexOf("}");
    if (
      start === -1 ||
      end === -1 ||
      end <= start
    ) {
      throw new Error(
        "EVP.Aureon returned invalid JSON."
      );
    }
    try {
      parsed =
        JSON.parse(
          text.slice(
            start,
            end + 1
          )
        );
    } catch {
      throw new Error(
        "EVP.Aureon returned invalid JSON."
      );
    }
  }
  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "EVP.Aureon returned an invalid evaluation."
    );
  }
  return parsed;
}
// ================================================================
// NORMALIZE EVALUATION
// ================================================================
function normalizeEvaluation(
  parsed,
  dimensions
) {
  const scores = {};
  for (
    const dimension of dimensions
  ) {
    const value =
      parsed?.scores?.[
        dimension
      ] ??
      parsed?.[
        dimension
      ];
    scores[dimension] =
      Math.round(
        clampScore(value)
      );
  }
  return {
    scores,
    reason:
      typeof parsed?.reason ===
      "string"
        ? parsed.reason.slice(
            0,
            LIMITS.maxReasonLength
          )
        : ""
  };
}
// ================================================================
// WEIGHTED DIMENSION AGGREGATION
// ================================================================
function calculateDimensionScores(
  evaluations,
  dimensions
) {
  const totals = {};
  const counts = {};
  for (
    const dimension of dimensions
  ) {
    totals[dimension] = 0;
    counts[dimension] = 0;
  }
  for (
    const evaluation of evaluations
  ) {
    for (
      const dimension of dimensions
    ) {
      const value =
        evaluation?.scores?.[
          dimension
        ];
      if (
        Number.isFinite(value)
      ) {
        totals[dimension] +=
          value;
        counts[dimension] +=
          1;
      }
    }
  }
  const result = {};
  for (
    const dimension of dimensions
  ) {
    result[dimension] =
      counts[dimension] === 0
        ? 0
        : Math.round(
            (
              totals[dimension] /
              counts[dimension]
            ) * 10
          ) / 10;
  }
  return result;
}
// ================================================================
// WEIGHTED OVERALL SCORE
// ================================================================
function calculateOverall(
  dimensionScores,
  dimensions,
  weights
) {
  let weightedTotal = 0;
  let weightTotal = 0;
  for (
    const dimension of dimensions
  ) {
    const score =
      Number(
        dimensionScores[
          dimension
        ]
      );
    const weight =
      Number(
        weights[
          dimension
        ]
      );
    if (
      Number.isFinite(score) &&
      Number.isFinite(weight) &&
      weight > 0
    ) {
      weightedTotal +=
        score * weight;
      weightTotal +=
        weight;
    }
  }
  if (
    weightTotal === 0
  ) {
    return 0;
  }
  return Math.round(
    (
      weightedTotal /
      weightTotal
    ) * 10
  ) / 10;
}
// ================================================================
// LATENCY STATISTICS
// ================================================================
function percentile(
  values,
  percentileValue
) {
  if (!values.length) {
    return 0;
  }
  const sorted =
    [...values]
      .filter(
        Number.isFinite
      )
      .sort(
        (a, b) => a - b
      );
  if (!sorted.length) {
    return 0;
  }
  const index =
    Math.ceil(
      (percentileValue / 100) *
      sorted.length
    ) - 1;
  return sorted[
    Math.max(
      0,
      Math.min(
        index,
        sorted.length - 1
      )
    )
  ];
}
function calculateLatencyStats(
  latencies
) {
  const valid =
    latencies.filter(
      Number.isFinite
    );
  if (!valid.length) {
    return {
      count: 0,
      averageMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      minMs: 0,
      maxMs: 0
    };
  }
  const total =
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    );
  return {
    count: valid.length,
    averageMs:
      Math.round(
        total /
        valid.length
      ),
    p50Ms:
      percentile(
        valid,
        50
      ),
    p95Ms:
      percentile(
        valid,
        95
      ),
    p99Ms:
      percentile(
        valid,
        99
      ),
    minMs:
      Math.min(...valid),
    maxMs:
      Math.max(...valid)
  };
}
// ================================================================
// RUN ID
// ================================================================
function createRunId() {
  const timestamp =
    Date.now()
      .toString(36);
  const random =
    Math.random()
      .toString(36)
      .slice(2, 8);
  return `run_${timestamp}_${random}`;
}
// ================================================================
// PASS / FAIL
// ================================================================
//
// A benchmark case passes when its overall score is >= 70.
//
// This is an operational UI threshold, not a scientifically
// calibrated universal quality threshold.
//
function casePassStatus(scores) {
  const values =
    Object.values(scores)
      .filter(
        Number.isFinite
      );
  if (!values.length) {
    return "FAILED";
  }
  const average =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / values.length;
  return average >= 70
    ? "PASSED"
    : "FAILED";
}
// ================================================================
// VALIDATION
// ================================================================
function validateText(
  value,
  field,
  maxLength
) {
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `${field} must be a string.`
    );
  }
  if (
    value.length > maxLength
  ) {
    throw new Error(
      `${field} exceeds the maximum allowed length.`
    );
  }
}
// ================================================================
// MAIN HANDLER
// ================================================================
export default async function handler(
  req,
  res
) {
  // --------------------------------------------------------------
  // METHOD
  // --------------------------------------------------------------
  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      "POST"
    );
    return sendJson(
      res,
      405,
      {
        success: false,
        error:
          "Method not allowed. Use POST."
      }
    );
  }
  // --------------------------------------------------------------
  // ENVIRONMENT
  // --------------------------------------------------------------
  const apiKey =
    process.env.GROQ_API_KEY;
  if (!apiKey) {
    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          "GROQ_API_KEY is not configured in Vercel."
      }
    );
  }
  // --------------------------------------------------------------
  // REQUEST
  // --------------------------------------------------------------
  try {
    const body =
      req.body &&
      typeof req.body ===
        "object"
        ? req.body
        : {};
    // ------------------------------------------------------------
    // BENCHMARK
    // ------------------------------------------------------------
    const benchmark =
      String(
        body.benchmark ||
        "General Quality"
      ).trim();
    if (
      benchmark !==
      "General Quality"
    ) {
      return sendJson(
        res,
        400,
        {
          success: false,
          error:
            "This benchmark suite is not available yet. General Quality is currently supported."
        }
      );
    }
    // ------------------------------------------------------------
    // MODE
    // ------------------------------------------------------------
    const mode =
      String(
        body.mode ||
        "suite"
      )
        .trim()
        .toLowerCase();
    const validModes = [
      "single",
      "suite",
      "stress"
    ];
    if (
      !validModes.includes(mode)
    ) {
      return sendJson(
        res,
        400,
        {
          success: false,
          error:
            "Invalid benchmark mode. Use single, suite, or stress."
        }
      );
    }
    // ------------------------------------------------------------
    // MODEL
    // ------------------------------------------------------------
    const requestedModel =
      String(
        body.model || ""
      ).trim();
    const candidateModel =
      resolveModel(
        requestedModel
      );
    if (!candidateModel) {
      return sendJson(
        res,
        400,
        {
          success: false,
          error:
            "Unsupported candidate model. Use GPT-OSS 120B, GPT-OSS 20B, or Qwen 3.8 27B."
        }
      );
    }
    // ------------------------------------------------------------
    // DIMENSIONS
    // ------------------------------------------------------------
    const dimensions =
      normalizeDimensions(
        body.dimensions
      );
    // ------------------------------------------------------------
    // WEIGHTS
    // ------------------------------------------------------------
    const weights =
      normalizeWeights(
        body.weights,
        dimensions
      );
    // ------------------------------------------------------------
    // TEST SIZE
    // ------------------------------------------------------------
    const requestedTestSize =
      Number(
        body.testSize
      );
    const testSize =
      Number.isFinite(
        requestedTestSize
      )
        ? Math.max(
            LIMITS.minCases,
            Math.min(
              Math.floor(
                requestedTestSize
              ),
              LIMITS.maxCases
            )
          )
        : 10;
    // ------------------------------------------------------------
    // QUESTIONS
    // ------------------------------------------------------------
    const questions =
      getTestQuestions(
        testSize
      );
    // ------------------------------------------------------------
    // RUN METADATA
    // ------------------------------------------------------------
    const runId =
      createRunId();
    const startedAt =
      new Date();
    const startedTimestamp =
      Date.now();
    // ------------------------------------------------------------
    // RESULT ARRAYS
    // ------------------------------------------------------------
    const evaluations = [];
    const itemResults = [];
    const errors = [];
    const candidateLatencies = [];
    const evaluatorLatencies = [];
    // ------------------------------------------------------------
    // EXECUTION
    // ------------------------------------------------------------
    //
    // Sequential execution is intentional.
    //
    // It reduces rate-limit pressure and makes individual
    // failures traceable.
    //
    for (
      const item of questions
    ) {
      const caseStarted =
        Date.now();
      // ----------------------------------------------------------
      // STEP 1 — CANDIDATE
      // ----------------------------------------------------------
      let candidateResult;
      try {
        validateText(
          item.question,
          "Question",
          LIMITS.maxPromptLength
        );
        candidateResult =
          await groqChat({
            apiKey,
            model:
              candidateModel,
            messages: [
              {
                role:
                  "system",
                content:
                  "You are a helpful AI assistant. Answer accurately, clearly, and directly."
              },
              {
                role:
                  "user",
                content:
                  buildCandidatePrompt(
                    item
                  )
              }
            ],
            temperature:
              0.2,
            maxCompletionTokens:
              700,
            timeoutMs:
              LIMITS.candidateTimeoutMs
          });
        candidateLatencies.push(
          candidateResult.latencyMs
        );
      } catch (error) {
        const message =
          sanitizeErrorMessage(
            error
          );
        errors.push({
          caseId:
            item.id,
          testNumber:
            item.runIndex,
          stage:
            "candidate",
          error:
            message
        });
        itemResults.push({
          id:
            item.id,
          testNumber:
            item.runIndex,
          question:
            item.question,
          reference:
            item.reference,
          candidateAnswer:
            null,
          scores:
            {},
          reason:
            "Candidate model request failed.",
          status:
            "ERROR",
          candidateLatencyMs:
            Number.isFinite(
              error?.latencyMs
            )
              ? error.latencyMs
              : null,
          evaluatorLatencyMs:
            null,
          totalLatencyMs:
            Date.now() -
            caseStarted,
          error:
            message
        });
        continue;
      }
      const candidateAnswer =
        candidateResult.content;
      // ----------------------------------------------------------
      // STEP 2 — EVALUATOR
      // ----------------------------------------------------------
      let normalizedEvaluation;
      try {
        const evaluatorPrompt =
          buildEvaluatorPrompt(
            item,
            candidateAnswer,
            dimensions
          );
        const evaluatorResult =
          await groqChat({
            apiKey,
            model:
              EVALUATOR_MODEL,
            messages: [
              {
                role:
                  "system",
                content:
                  "You are EVP.Aureon. You evaluate AI responses objectively and return valid JSON only."
              },
              {
                role:
                  "user",
                content:
                  evaluatorPrompt
              }
            ],
            temperature:
              0,
            maxCompletionTokens:
              700,
            responseFormat: {
              type:
                "json_object"
            },
            timeoutMs:
              LIMITS.evaluatorTimeoutMs
          });
        evaluatorLatencies.push(
          evaluatorResult.latencyMs
        );
        const parsedEvaluation =
          parseEvaluatorResponse(
            evaluatorResult.content
          );
        normalizedEvaluation =
          normalizeEvaluation(
            parsedEvaluation,
            dimensions
          );
      } catch (error) {
        const message =
          sanitizeErrorMessage(
            error
          );
        errors.push({
          caseId:
            item.id,
          testNumber:
            item.runIndex,
          stage:
            "evaluator",
          error:
            message
        });
        itemResults.push({
          id:
            item.id,
          testNumber:
            item.runIndex,
          question:
            item.question,
          reference:
            item.reference,
          candidateAnswer,
          scores:
            {},
          reason:
            "EVP.Aureon evaluation failed.",
          status:
            "ERROR",
          candidateLatencyMs:
            candidateResult.latencyMs,
          evaluatorLatencyMs:
            null,
          totalLatencyMs:
            Date.now() -
            caseStarted,
          error:
            message
        });
        continue;
      }
      // ----------------------------------------------------------
      // STEP 3 — STORE EVALUATION
      // ----------------------------------------------------------
      evaluations.push(
        normalizedEvaluation
      );
      const status =
        casePassStatus(
          normalizedEvaluation.scores
        );
      itemResults.push({
        id:
          item.id,
        testNumber:
          item.runIndex,
        datasetIndex:
          item.datasetIndex,
        question:
          item.question,
        reference:
          item.reference,
        candidateAnswer,
        scores:
          normalizedEvaluation.scores,
        reason:
          normalizedEvaluation.reason,
        status,
        candidateLatencyMs:
          candidateResult.latencyMs,
        evaluatorLatencyMs:
          null,
        totalLatencyMs:
          Date.now() -
          caseStarted
      });
    }
    // ------------------------------------------------------------
    // AGGREGATION
    // ------------------------------------------------------------
    const dimensionScores =
      calculateDimensionScores(
        evaluations,
        dimensions
      );
    const overall =
      calculateOverall(
        dimensionScores,
        dimensions,
        weights
      );
    // ------------------------------------------------------------
    // CASE SUMMARY
    // ------------------------------------------------------------
    const completed =
      itemResults.filter(
        (item) =>
          item.status ===
          "PASSED" ||
          item.status ===
          "FAILED"
      ).length;
    const passed =
      itemResults.filter(
        (item) =>
          item.status ===
          "PASSED"
      ).length;
    const failed =
      itemResults.filter(
        (item) =>
          item.status ===
          "FAILED"
      ).length;
    const errored =
      itemResults.filter(
        (item) =>
          item.status ===
          "ERROR"
      ).length;
    // ------------------------------------------------------------
    // LATENCY
    // ------------------------------------------------------------
    const latencyStats =
      calculateLatencyStats(
        itemResults
          .map(
            (item) =>
              item.candidateLatencyMs
          )
          .filter(
            Number.isFinite
          )
      );
    // ------------------------------------------------------------
    // DURATION
    // ------------------------------------------------------------
    const durationMs =
      Date.now() -
      startedTimestamp;
    const throughput =
      durationMs > 0
        ? Number(
            (
              completed /
              (durationMs / 1000)
            ).toFixed(3)
          )
        : 0;
    const errorRate =
      questions.length > 0
        ? Number(
            (
              errored /
              questions.length
            ).toFixed(4)
          )
        : 0;
    // ------------------------------------------------------------
    // FINAL METADATA
    // ------------------------------------------------------------
    const completedAt =
      new Date();
    return sendJson(
      res,
      200,
      {
        success: true,
        run: {
          id:
            runId,
          engineVersion:
            ENGINE_VERSION,
          mode,
          startedAt:
            startedAt.toISOString(),
          completedAt:
            completedAt.toISOString(),
          durationMs
        },
        benchmark: {
          name:
            benchmark,
          version:
            BENCHMARK_VERSION,
          datasetCases:
            BENCHMARK_DATASET.length,
          requestedCases:
            testSize,
          uniqueCasesUsed:
            Math.min(
              testSize,
              BENCHMARK_DATASET.length
            )
        },
        candidate: {
          provider:
            "groq",
          model:
            displayModelName(
              candidateModel
            ),
          modelId:
            candidateModel
        },
        evaluator: {
          name:
            EVALUATOR_NAME,
          version:
            EVALUATOR_VERSION,
          model:
            EVALUATOR_MODEL
        },
        configuration: {
          dimensions,
          weights,
          sampling: {
            temperature:
              0.2
          },
          evaluatorTemperature:
            0,
          passThreshold:
            70
        },
        summary: {
          overall,
          requested:
            questions.length,
          completed,
          passed,
          failed,
          errors:
            errored,
          successRate:
            questions.length > 0
              ? Number(
                  (
                    completed /
                    questions.length
                  ).toFixed(4)
                )
              : 0,
          errorRate
        },
        dimensions: {
          scores:
            dimensionScores,
          weights
        },
        performance: {
          requests:
            questions.length,
          completed,
          failed,
          errors:
            errored,
          durationMs,
          throughputRequestsPerSecond:
            throughput,
          candidateLatency:
            latencyStats,
          evaluatorRequests:
            evaluations.length,
          evaluatorLatency:
            calculateLatencyStats(
              evaluatorLatencies
            )
        },
        results:
          itemResults,
        errors,
        reproducibility: {
          benchmarkVersion:
            BENCHMARK_VERSION,
          evaluatorVersion:
            EVALUATOR_VERSION,
          evaluatorModel:
            EVALUATOR_MODEL,
          candidateModel:
            candidateModel,
          candidateTemperature:
            0.2,
          evaluatorTemperature:
            0,
          datasetSize:
            BENCHMARK_DATASET.length,
          requestedCaseCount:
            testSize
        },
        note:
          "Structured EvalLoop benchmark using the current internal starter dataset. The candidate model generated the answers and EVP.Aureon evaluated those responses. This dataset is not an official external benchmark and has not yet been presented as a calibrated industry benchmark."
      }
    );
  } catch (error) {
    console.error(
      "Benchmark error:",
      sanitizeErrorMessage(
        error
      )
    );
    return sendJson(
      res,
      500,
      {
        success: false,
        error:
          sanitizeErrorMessage(
            error
          ),
        engineVersion:
          ENGINE_VERSION
      }
    );
  }
}
