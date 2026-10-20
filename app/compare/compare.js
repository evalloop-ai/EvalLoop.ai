/* EvalLoop AI — Compare A vs B frontend */
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


const form = document.getElementById("compareForm");
const promptInput = document.getElementById("prompt");
const referenceInput = document.getElementById("reference");
const responseAInput = document.getElementById("responseA");
const responseBInput = document.getElementById("responseB");
const compareButton = document.getElementById("compareButton");
const formMessage = document.getElementById("formMessage");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const results = document.getElementById("results");
const resultState = document.getElementById("resultState");
const MAX_CHARS = 8000;
let isComparing = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error-message", isError);
}
function updateCounter(textarea, counterId) {
  const counter = document.getElementById(counterId);
  const count = textarea.value.length;
  counter.textContent = `${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  counter.classList.toggle("limit-near", count >= MAX_CHARS * .9 && count < MAX_CHARS);
  counter.classList.toggle("limit-reached", count >= MAX_CHARS);
}
[
  [promptInput, "promptCounter"],
  [referenceInput, "referenceCounter"],
  [responseAInput, "responseACounter"],
  [responseBInput, "responseBCounter"]
].forEach(([textarea, counterId]) => {
  textarea.maxLength = MAX_CHARS;
  textarea.addEventListener("input", () => updateCounter(textarea, counterId));
  updateCounter(textarea, counterId);
});

function showLoading() {
  emptyState.classList.add("hidden");
  results.classList.add("hidden");
  loadingState.classList.remove("hidden");
  resultState.textContent = "COMPARING";
  resultState.classList.remove("waiting");
}
function showError() {
  loadingState.classList.add("hidden");
  results.classList.add("hidden");
  emptyState.classList.remove("hidden");
  resultState.textContent = "ERROR";
  resultState.classList.add("waiting");
  showMessage("Comparison failed. Please try again.", true);
}
function winnerLabel(winner) {
  if (winner === "A") return "Response A";
  if (winner === "B") return "Response B";
  return "Tie";
}
function renderDimensions(dimensions) {
  const labels = [
    ["factuality", "Factuality"],
    ["relevance", "Relevance"],
    ["instruction_following", "Instruction Following"],
    ["completeness", "Completeness"],
    ["safety", "Safety"],
    ["clarity", "Clarity"]
  ];
  document.getElementById("dimensionRows").innerHTML = labels.map(([key, label]) => {
    const item = dimensions[key];
    const better = item.better;
    const betterClass = better === "A" ? "a" : better === "B" ? "b" : "tie";
    return `<tr>
      <td>${label}</td>
      <td class="score-cell">${item.a_score}/100</td>
      <td class="score-cell">${item.b_score}/100</td>
      <td><span class="better-pill ${betterClass}">${winnerLabel(better)}</span></td>
    </tr>`;
  }).join("");
}
function renderDifferences(items) {
  const list = document.getElementById("keyDifferences");
  if (!Array.isArray(items) || !items.length) {
    list.innerHTML = "<li>No significant differences were identified.</li>";
    return;
  }
  list.innerHTML = items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
}
function renderIssues(targetId, issues) {
  const container = document.getElementById(targetId);
  if (!Array.isArray(issues) || !issues.length) {
    container.innerHTML = '<p class="no-issues">No meaningful issues detected.</p>';
    return;
  }
  container.innerHTML = issues.map(issue => {
    const severity = ["low", "medium", "high"].includes(String(issue.severity).toLowerCase())
      ? String(issue.severity).toLowerCase() : "medium";
    return `<article class="issue">
      <span class="issue-marker"></span>
      <div class="issue-content">
        <strong>${escapeHtml(issue.title)}</strong>
        <span class="issue-severity ${severity}">${escapeHtml(severity)} severity</span>
        ${issue.quote ? `<div class="issue-quote"><strong>Quote:</strong> “${escapeHtml(issue.quote)}”</div>` : ""}
        <p class="issue-detail"><strong>Why it matters:</strong> ${escapeHtml(issue.why)}</p>
        <p class="issue-detail"><strong>Suggested fix:</strong> ${escapeHtml(issue.suggested_fix)}</p>
      </div>
    </article>`;
  }).join("");
}
function renderResults(data) {
  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  results.classList.remove("hidden");
  resultState.textContent = "COMPLETED";
  resultState.classList.remove("waiting");

  document.getElementById("winnerValue").textContent = winnerLabel(data.winner);
  document.getElementById("confidenceValue").textContent = data.confidence;
  renderDimensions(data.dimensions);
  renderDifferences(data.key_differences);
  renderIssues("issuesA", data.issues_a);
  renderIssues("issuesB", data.issues_b);
  document.getElementById("recommendationText").textContent =
    `${winnerLabel(data.recommended_response)} — ${data.recommendation}`;
  document.getElementById("improvementText").textContent =
    `What to improve: ${data.improvements}`;
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (isComparing) return;
  formMessage.classList.remove("error-message");

  const payload = {
    prompt: promptInput.value.trim(),
    reference: referenceInput.value.trim(),
    response_a: responseAInput.value.trim(),
    response_b: responseBInput.value.trim()
  };
  const required = [
    [payload.prompt, promptInput, "Please enter the original prompt."],
    [payload.response_a, responseAInput, "Please enter Response A."],
    [payload.response_b, responseBInput, "Please enter Response B."]
  ];
  for (const [value, input, message] of required) {
    if (!value) {
      showMessage(message, true);
      input.focus();
      return;
    }
  }
  if ([payload.prompt, payload.reference, payload.response_a, payload.response_b].some(value => value.length > MAX_CHARS)) {
    showMessage("Each field must be 8,000 characters or fewer.", true);
    return;
  }

  isComparing = true;
  compareButton.disabled = true;
  compareButton.querySelector("span:first-child").textContent = "Comparing responses…";
  showMessage("Comparing responses…");
  showLoading();

  try {
    const usageBefore = await EvalLoopUsage.beforeRun(formMessage);
    const response = await fetch("/api/evaluate/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...EvalLoopUsage.requestHeaders() },
      body: JSON.stringify(payload)
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error("invalid_response"); }
    await EvalLoopUsage.afterRun(usageBefore, response, data, formMessage);
    if (!response.ok || !data || data.ok !== true || !data.result) {
      const error = new Error(data?.error || "comparison_failed");
      error.status = response.status;
      error.code = data?.code || "";
      throw error;
    }
    renderResults(data.result);
    showMessage("Comparison completed.");
  } catch (error) {
    console.error("EvalLoop AI comparison failed:", error);
    if (error?.code === "DAILY_LIMIT_REACHED") EvalLoopUsage.showLimitMessage(formMessage);
    else if (error?.code === "USAGE_SERVICE_UNAVAILABLE") showMessage("Usage limits could not be verified. Please retry shortly.", true);
    else showError();
  } finally {
    isComparing = false;
    compareButton.disabled = false;
    compareButton.querySelector("span:first-child").textContent = "Compare Responses";
  }
});

document.getElementById("comparisonFeedback").addEventListener("click", event => {
  const button = event.target.closest("[data-feedback]");
  if (!button) return;
  document.querySelectorAll("[data-feedback]").forEach(item => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  document.getElementById("feedbackThanks").textContent = "Thanks for your feedback.";
  console.log("EvalLoop AI comparison feedback:", {
    rating: button.dataset.feedback,
    winner: document.getElementById("winnerValue").textContent,
    timestamp: new Date().toISOString()
  });
});
