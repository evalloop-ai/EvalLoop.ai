/* EvalLoop AI — Compare A vs B frontend */
"use strict";

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
    const response = await fetch("/api/evaluate/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error("invalid_response"); }
    if (!response.ok || !data || data.ok !== true || !data.result) {
      throw new Error("comparison_failed");
    }
    renderResults(data.result);
    const historySave = window.evalLoopSaveEvaluation
      ? await window.evalLoopSaveEvaluation({
          evaluation_type: "compare",
          prompt: payload.prompt,
          response_a: payload.response_a,
          response_b: payload.response_b,
          reference_context: payload.reference || null,
          result: data.result,
          model_used: data.model_used || data.model || "openai/gpt-oss-120b"
        })
      : { saved: false, reason: "history_connection_unavailable" };
    if (historySave.saved) {
      showMessage("Comparison completed and saved to History & Insights.");
    } else if (historySave.reason === "not_signed_in") {
      showMessage("Comparison completed, but it was not saved. Sign in, then run a new evaluation.", true);
    } else {
      showMessage(`Comparison completed, but saving to History & Insights failed: ${historySave.error || historySave.reason || "unknown error"}`, true);
    }
  } catch (error) {
    console.error("EvalLoop AI comparison failed:", error);
    showError();
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
  if (window.evalLoopSaveFeedback) {
    window.evalLoopSaveFeedback(button.dataset.feedback).then(result => {
      if (result.saved) document.getElementById("feedbackThanks").textContent = "Thanks — your feedback was saved.";
    });
  }
  console.log("EvalLoop AI comparison feedback:", {
    rating: button.dataset.feedback,
    winner: document.getElementById("winnerValue").textContent,
    timestamp: new Date().toISOString()
  });
});
