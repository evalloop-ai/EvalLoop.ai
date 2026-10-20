/* =========================================================
   EvalLoop AI — Evaluation Workspace
   Improved UX; preserves POST /api/evaluate and current score IDs.
   ========================================================= */

"use strict";

/* Shared daily usage UX. The API is authoritative; this is only preflight/display. */
const EvalLoopUsage = (() => {
  const LIMIT_MESSAGE = "You have reached today’s free evaluation limit. Create a free account or try again tomorrow.";
  const STORAGE_KEY = "evalloop-device-id-v1";
  let lastBefore = null;

  function deviceId() {
    let id = "";
    try { id = localStorage.getItem(STORAGE_KEY) || ""; } catch {}
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      id = (globalThis.crypto && typeof crypto.randomUUID === "function")
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 3 | 8)).toString(16);
          });
      try { localStorage.setItem(STORAGE_KEY, id); } catch {}
    }
    return id;
  }

  function accessToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        try {
          const value = JSON.parse(localStorage.getItem(key) || "null");
          const session = Array.isArray(value) ? value[0] : value;
          const token = session?.access_token || session?.currentSession?.access_token || session?.session?.access_token;
          if (typeof token === "string" && token) return token;
        } catch {}
      }
    } catch {}
    return "";
  }

  function requestHeaders() {
    const headers = { "X-EvalLoop-Anonymous-Id": deviceId() };
    const token = accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function statusElement(messageNode) {
    if (!messageNode) return null;
    let node = document.getElementById("evalLoopUsageStatus");
    if (!node) {
      node = document.createElement("p");
      node.id = "evalLoopUsageStatus";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.style.cssText = "margin:8px 0 0;font:11px/1.7 'DM Mono',monospace;color:#85e7ba;white-space:normal";
      messageNode.insertAdjacentElement("afterend", node);
    }
    return node;
  }

  function setUsageText(messageNode, text) {
    const node = statusElement(messageNode);
    if (node) node.textContent = text;
  }

  function showLimit(messageNode) {
    if (messageNode) {
      messageNode.textContent = LIMIT_MESSAGE;
      messageNode.classList.add("error-message");
    }
    setUsageText(messageNode, "Remaining evaluations today: 0.");
    const error = new Error(LIMIT_MESSAGE);
    error.code = "DAILY_LIMIT_REACHED";
    error.status = 429;
    throw error;
  }

  async function beforeRun(messageNode) {
    const response = await fetch("/api/usage", { method: "GET", headers: requestHeaders(), cache: "no-store" });
    let usage;
    try { usage = await response.json(); } catch { usage = null; }
    if (!response.ok || !usage || !Number.isFinite(Number(usage.remaining))) {
      const error = new Error("Usage limits could not be verified. Please retry shortly.");
      error.code = "USAGE_SERVICE_UNAVAILABLE";
      throw error;
    }
    lastBefore = usage;
    setUsageText(messageNode, `Before this run: ${usage.remaining} of ${usage.limit} evaluations remaining today.`);
    if (Number(usage.remaining) <= 0) showLimit(messageNode);
    return usage;
  }

  async function afterRun(before, response, body, messageNode) {
    const remainingHeader = response.headers.get("X-EvalLoop-Usage-Remaining");
    const limitHeader = response.headers.get("X-EvalLoop-Usage-Limit");
    const usedHeader = response.headers.get("X-EvalLoop-Usage-Used");
    let remaining = remainingHeader === null ? NaN : Number(remainingHeader);
    let limit = limitHeader === null ? NaN : Number(limitHeader);
    let used = usedHeader === null ? NaN : Number(usedHeader);
    if (!Number.isFinite(remaining) && body?.usage) remaining = Number(body.usage.remaining);
    if (!Number.isFinite(limit) && body?.usage) limit = Number(body.usage.limit);
    if (!Number.isFinite(used) && body?.usage) used = Number(body.usage.used);
    if (!Number.isFinite(remaining)) {
      try {
        const current = await fetch("/api/usage", { method: "GET", headers: requestHeaders(), cache: "no-store" });
        const usage = await current.json();
        if (current.ok) { remaining = Number(usage.remaining); limit = Number(usage.limit); used = Number(usage.used); }
      } catch {}
    }
    if (Number.isFinite(remaining)) {
      const previous = before || lastBefore;
      setUsageText(messageNode, `Before this run: ${Number(previous?.remaining ?? remaining)} remaining · After this run: ${remaining} of ${Number.isFinite(limit) ? limit : "—"} remaining today.`);
    }
    if (response.status === 429 || body?.code === "DAILY_LIMIT_REACHED") showLimit(messageNode);
    return { remaining, limit, used };
  }

  function showLimitMessage(messageNode) {
    if (!messageNode) return;
    messageNode.textContent = LIMIT_MESSAGE;
    messageNode.classList.add("error-message");
    setUsageText(messageNode, "Remaining evaluations today: 0.");
  }

  return { requestHeaders, beforeRun, afterRun, showLimitMessage, limitMessage: LIMIT_MESSAGE };
})();


const evaluateButton = document.getElementById("evaluateButton");
const promptInput = document.getElementById("prompt");
const responseInput = document.getElementById("response");
const referenceInput = document.getElementById("reference");
const formMessage = document.getElementById("formMessage");
const emptyState = document.getElementById("emptyState");
const results = document.getElementById("results");
const resultState = document.getElementById("resultState");

const overallScore = document.getElementById("overallScore");
const overallText = document.getElementById("overallText");
const summaryText = document.getElementById("summaryText");
const recommendationText = document.getElementById("recommendationText");
const issuesList = document.getElementById("issuesList");

const scoreElements = {
  factuality: {
    text: document.getElementById("factualityScore"),
    bar: document.getElementById("factualityBar")
  },
  instruction_following: {
    text: document.getElementById("instructionScore"),
    bar: document.getElementById("instructionBar")
  },
  relevance: {
    text: document.getElementById("relevanceScore"),
    bar: document.getElementById("relevanceBar")
  },
  completeness: {
    text: document.getElementById("completenessScore"),
    bar: document.getElementById("completenessBar")
  },
  safety: {
    text: document.getElementById("safetyScore"),
    bar: document.getElementById("safetyBar")
  },
  fluency: {
    text: document.getElementById("fluencyScore"),
    bar: document.getElementById("fluencyBar")
  }
};

const MAX_CHARS = 8000;
let isEvaluating = false;
let activePreset = "";

function showMessage(message, isError = false) {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.classList.toggle("error-message", isError);
}
function clearMessage() {
  if (!formMessage) return;
  formMessage.textContent = "";
  formMessage.classList.remove("error-message");
}
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function updateScore(scoreName, value) {
  const score = scoreElements[scoreName];
  if (!score?.text || !score?.bar) return;
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed)
    ? Math.max(0, Math.min(100, parsed))
    : 0;
  score.text.textContent = `${Math.round(safeValue)}/100`;
  score.bar.style.width = "0%";
  requestAnimationFrame(() => {
    score.bar.style.width = `${safeValue}%`;
  });
}
function getVerdict(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}

/* ---------- Presets and character counters ---------- */

const presets = {
  "Customer Support": {
    prompt: "A customer says their order is 5 days late and asks for a refund. Reply empathetically, explain the next steps, and do not promise a refund unless eligibility is confirmed.",
    response: "We are so sorry your order is late. Your refund has already been approved and will arrive in your account within 24 hours. There is nothing else you need to do."
  },
  "Coding": {
    prompt: "Write a Python function that returns the factorial of a non-negative integer. Include input validation and a short example.",
    response: "def factorial(n):\n    result = 1\n    for i in range(1, n):\n        result *= i\n    return result\n\nprint(factorial(5))  # 120"
  },
  "RAG Answer": {
    prompt: "Using only the supplied context, answer: What is the company's refund window? If the context does not say, state that the information is unavailable.\n\nContext: Customers may return unopened items within 30 days of delivery. Shipping fees are non-refundable.",
    response: "The company offers a 60-day refund window for all items, including opened products. Shipping fees are also refunded."
  },
  "Creative Writing": {
    prompt: "Write a short, vivid four-line poem about rain in a city at night. Avoid clichés and keep the tone hopeful.",
    response: "Rain falls down, the city is wet,\nThe night is dark, don't forget.\nThe streets shine bright under the sky,\nTomorrow the sun will be up high."
  },
  "Unsafe Response": {
    prompt: "I accidentally mixed two household cleaning products and there is a strong smell. What should I do?",
    response: "Stay in the room and smell the mixture closely to identify it. Add another cleaning product to neutralize the smell, then wipe it up."
  }
};

function addPresetControls() {
  if (!promptInput || document.getElementById("presetSection")) return;
  const promptField = promptInput.closest(".field");
  if (!promptField?.parentNode) return;

  const section = document.createElement("section");
  section.id = "presetSection";
  section.className = "preset-section";
  section.innerHTML = `
    <div class="preset-heading">
      <strong>Try an example</strong>
      <span>LOAD SAMPLE INPUTS</span>
    </div>
    <div class="preset-buttons" role="group" aria-label="Example evaluation presets">
      ${Object.keys(presets).map(name =>
        `<button type="button" class="preset-button" data-preset="${escapeHtml(name)}" aria-pressed="false">${escapeHtml(name)}</button>`
      ).join("")}
    </div>`;
  promptField.parentNode.insertBefore(section, promptField);

  section.addEventListener("click", event => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    const name = button.dataset.preset;
    const sample = presets[name];
    if (!sample) return;
    promptInput.value = sample.prompt;
    responseInput.value = sample.response;
    activePreset = name;
    section.querySelectorAll("[data-preset]").forEach(item => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    updateCounter(promptInput);
    updateCounter(responseInput);
    clearMessage();
    promptInput.focus();
  });
}

function addCounter(textarea, label) {
  if (!textarea || textarea.dataset.counterReady === "true") return;
  textarea.maxLength = MAX_CHARS;
  textarea.dataset.counterReady = "true";
  const counter = document.createElement("span");
  counter.className = "character-counter";
  counter.id = `${textarea.id}CharacterCounter`;
  counter.setAttribute("aria-live", "polite");
  counter.textContent = `${textarea.value.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  textarea.insertAdjacentElement("afterend", counter);
  textarea.addEventListener("input", () => updateCounter(textarea));
}
function updateCounter(textarea) {
  const counter = document.getElementById(`${textarea.id}CharacterCounter`);
  if (!counter) return;
  const count = textarea.value.length;
  counter.textContent = `${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  counter.classList.toggle("limit-near", count >= MAX_CHARS * 0.9 && count < MAX_CHARS);
  counter.classList.toggle("limit-reached", count >= MAX_CHARS);
}
function addScoreScale() {
  const overallCard = overallScore?.closest(".overall-card");
  if (!overallCard || document.getElementById("scoreScale")) return;
  const scale = document.createElement("div");
  scale.id = "scoreScale";
  scale.className = "score-scale";
  scale.innerHTML = `<strong>Score guide:</strong> 90–100 Excellent · 75–89 Good · 50–74 Needs improvement · Below 50 Poor.`;
  overallCard.insertAdjacentElement("afterend", scale);
}
function addFeedback() {
  if (!recommendationText || document.getElementById("evaluationFeedback")) return;
  const section = recommendationText.closest(".result-section") || recommendationText.parentElement;
  if (!section?.parentNode) return;
  const panel = document.createElement("div");
  panel.id = "evaluationFeedback";
  panel.className = "feedback-panel";
  panel.innerHTML = `
    <p>Was this evaluation helpful?</p>
    <div class="feedback-actions" role="group" aria-label="Evaluation feedback">
      <button type="button" class="feedback-button" data-feedback="up" aria-pressed="false">👍 <span>Yes</span></button>
      <button type="button" class="feedback-button" data-feedback="down" aria-pressed="false">👎 <span>No</span></button>
    </div>
    <div class="feedback-thanks" aria-live="polite"></div>`;
  section.insertAdjacentElement("afterend", panel);
  panel.addEventListener("click", event => {
    const button = event.target.closest("[data-feedback]");
    if (!button) return;
    const rating = button.dataset.feedback;
    panel.querySelectorAll("[data-feedback]").forEach(item => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    panel.querySelector(".feedback-thanks").textContent = "Thanks for your feedback.";
    console.log("EvalLoop AI evaluation feedback:", {
      rating,
      preset: activePreset || null,
      overallScore: overallScore?.textContent || null,
      timestamp: new Date().toISOString()
    });
  });
}

/* ---------- Issues rendering ---------- */

function displayIssues(issues) {
  if (!issuesList) return;
  issuesList.replaceChildren();

  if (!Array.isArray(issues) || issues.length === 0) {
    const item = document.createElement("div");
    item.className = "issue";
    item.innerHTML = `
      <div class="issue-marker"></div>
      <div class="issue-content">
        <strong>No major issues detected</strong>
        <p>The evaluation did not identify any significant quality problems.</p>
      </div>`;
    issuesList.appendChild(item);
    return;
  }

  issues.forEach(issue => {
    const item = document.createElement("div");
    item.className = "issue";
    const title = escapeHtml(issue?.title || issue?.type || "Issue");
    const severityRaw = String(issue?.severity || "Medium").toLowerCase();
    const severity = ["low", "medium", "high"].includes(severityRaw) ? severityRaw : "medium";
    const quote = String(issue?.quote || issue?.exact_quote || "").trim();
    const why = issue?.why || issue?.description || issue?.reason || "";
    const fix = issue?.suggested_fix || issue?.fix || issue?.recommendation || "";

    item.innerHTML = `
      <div class="issue-marker"></div>
      <div class="issue-content">
        <strong>${title}</strong>
        <span class="issue-severity ${severity}">${severity} severity</span>
        ${quote ? `<div class="issue-quote"><strong>Quote:</strong> “${escapeHtml(quote)}”</div>` : `<div class="issue-quote"><em>No exact quote supplied by the evaluator.</em></div>`}
        <p class="issue-why"><strong>Why it matters:</strong> ${escapeHtml(why || "The evaluator identified a potential quality issue.")}</p>
        <p class="issue-fix"><strong>Suggested fix:</strong> ${escapeHtml(fix || "Revise this part of the response to address the issue.")}</p>
      </div>`;
    issuesList.appendChild(item);
  });
}

/* ---------- Result rendering and response validation ---------- */

function displayResults(data) {
  emptyState?.classList.add("hidden");
  results?.classList.remove("hidden");

  if (resultState) {
    resultState.textContent = "COMPLETED";
    resultState.classList.remove("waiting");
  }

  const rawOverall = Number(data.overall_score);
  const overall = Math.max(0, Math.min(100, Number.isFinite(rawOverall) ? rawOverall : 0));
  overallScore.textContent = `${Math.round(overall)}/100`;
  overallText.textContent = getVerdict(overall);

  updateScore("factuality", data.scores.factuality);
  updateScore("instruction_following", data.scores.instruction_following);
  updateScore("relevance", data.scores.relevance);
  updateScore("completeness", data.scores.completeness);
  updateScore("safety", data.scores.safety);
  updateScore("fluency", data.scores.fluency);

  summaryText.textContent = data.summary || "No summary was provided.";
  displayIssues(data.issues);
  recommendationText.textContent = data.recommendation || "No recommendation was provided.";
}

function showLoadingState() {
  emptyState?.classList.add("hidden");
  results?.classList.remove("hidden");
  if (overallScore) overallScore.textContent = "—";
  if (overallText) overallText.textContent = "Evaluating…";
  if (summaryText) summaryText.textContent = "Analyzing the AI response…";
  if (issuesList) {
    issuesList.innerHTML = `<div class="issue"><div class="issue-marker"></div><div class="issue-content"><strong>Evaluation in progress</strong><p>EvalLoop AI is analyzing the response.</p></div></div>`;
  }
  if (recommendationText) recommendationText.textContent = "Generating recommendation…";
  Object.values(scoreElements).forEach(score => {
    if (score.text) score.text.textContent = "—";
    if (score.bar) score.bar.style.width = "0%";
  });
  if (resultState) {
    resultState.textContent = "EVALUATING";
    resultState.classList.remove("waiting");
  }
}

function isValidEvaluation(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (!Number.isFinite(Number(data.overall_score))) return false;
  if (!data.scores || typeof data.scores !== "object") return false;
  const requiredScores = ["factuality", "instruction_following", "relevance", "completeness", "safety", "fluency"];
  return requiredScores.every(key => Number.isFinite(Number(data.scores[key])));
}

async function evaluateResponse(prompt, response, reference, usageBefore) {
  const apiResponse = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...EvalLoopUsage.requestHeaders() },
    body: JSON.stringify({ prompt, response, reference })
  });

  let data;
  try {
    data = await apiResponse.json();
  } catch {
    throw new Error("invalid_json");
  }
  await EvalLoopUsage.afterRun(usageBefore, apiResponse, data, formMessage);
  if (!apiResponse.ok) {
    const error = new Error(data?.error || "request_failed");
    error.status = apiResponse.status;
    error.code = data?.code || "";
    throw error;
  }
  if (!isValidEvaluation(data)) throw new Error("invalid_schema");
  return data;
}

// One user click maps to one server reservation; quota/network errors are not blindly retried.
async function evaluateWithRetry(prompt, response, reference, usageBefore) {
  return evaluateResponse(prompt, response, reference, usageBefore);
}

/* ---------- Evaluation action ---------- */

if (evaluateButton && promptInput && responseInput) {
  evaluateButton.addEventListener("click", async () => {
    if (isEvaluating) return;
    clearMessage();

    const prompt = promptInput.value.trim();
    const response = responseInput.value.trim();
    const reference = referenceInput?.value.trim() || "";

    if (!prompt) {
      showMessage("Please enter the original prompt.", true);
      promptInput.focus();
      return;
    }
    if (!response) {
      showMessage("Please enter the AI response.", true);
      responseInput.focus();
      return;
    }
    if (prompt.length > MAX_CHARS || response.length > MAX_CHARS) {
      showMessage("Prompt and AI response must each be 8,000 characters or fewer.", true);
      return;
    }

    isEvaluating = true;
    evaluateButton.disabled = true;
    const buttonLabel = evaluateButton.querySelector("span:first-child");
    if (buttonLabel) buttonLabel.textContent = "Evaluating…";
    showMessage("Sending response to EvalLoop AI…");
    showLoadingState();

    try {
      const usageBefore = await EvalLoopUsage.beforeRun(formMessage);
      const data = await evaluateWithRetry(prompt, response, reference, usageBefore);
      displayResults(data);
      showMessage("Evaluation completed.");
    } catch (error) {
      console.error("EvalLoop AI evaluation error after retry:", error);
      if (resultState) {
        resultState.textContent = "ERROR";
        resultState.classList.remove("waiting");
      }
      if (overallScore) overallScore.textContent = "—";
      if (overallText) overallText.textContent = "Evaluation unavailable";
      if (summaryText) summaryText.textContent = "The evaluation could not be completed. Your inputs have been preserved.";
      if (issuesList) issuesList.replaceChildren();
      if (recommendationText) recommendationText.textContent = "Please try again.";
      if (error?.code === "DAILY_LIMIT_REACHED") {
        EvalLoopUsage.showLimitMessage(formMessage);
      } else {
        showMessage(error?.code === "USAGE_SERVICE_UNAVAILABLE" ? "Usage limits could not be verified. Please retry shortly." : "Evaluation failed. Please try again.", true);
      }
    } finally {
      isEvaluating = false;
      evaluateButton.disabled = false;
      if (buttonLabel) buttonLabel.textContent = "Evaluate Response";
    }
  });
}

/* ---------- Initialise UI additions ---------- */

addPresetControls();
addCounter(promptInput, "Prompt");
addCounter(responseInput, "AI response");
addScoreScale();
addFeedback();

console.log("EvalLoop AI evaluation workspace loaded.");
console.log("Real API evaluation enabled at /api/evaluate.");
