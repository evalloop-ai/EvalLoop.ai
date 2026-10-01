const promptInput = document.getElementById("prompt");
const responseInput = document.getElementById("response");
const referenceInput = document.getElementById("reference");
const evaluateButton = document.getElementById("evaluateButton");

const resultsSection = document.getElementById("results");

const overallScore = document.getElementById("overallScore");
const overallText = document.getElementById("overallText");

const factualityScore = document.getElementById("factualityScore");
const instructionScore = document.getElementById("instructionScore");
const relevanceScore = document.getElementById("relevanceScore");
const completenessScore = document.getElementById("completenessScore");
const safetyScore = document.getElementById("safetyScore");
const fluencyScore = document.getElementById("fluencyScore");

const summaryText = document.getElementById("summaryText");
const issuesList = document.getElementById("issuesList");
const recommendationText = document.getElementById("recommendationText");


/*
 * Evaluate button
 */

evaluateButton.addEventListener("click", async () => {

  const prompt = promptInput.value.trim();
  const response = responseInput.value.trim();
  const reference = referenceInput.value.trim();


  /*
   * Validate required fields.
   */

  if (!prompt || !response) {

    alert("Please enter both the Prompt and AI Response.");

    return;
  }


  /*
   * Disable button while evaluation is running.
   */

  evaluateButton.disabled = true;
  evaluateButton.textContent = "Evaluating with Groq...";


  /*
   * Show results area.
   */

  resultsSection.style.display = "block";


  /*
   * Update loading text.
   */

  overallScore.textContent = "—";
  overallText.textContent = "EvalLoop AI is evaluating the response...";

  summaryText.textContent = "Analyzing the AI response...";

  issuesList.innerHTML = `
    <div class="issue-item">
      Evaluation in progress...
    </div>
  `;

  recommendationText.textContent = "Generating recommendation...";


  try {

    /*
     * Send the evaluation request to our Vercel API.
     */

    const apiResponse = await fetch("/api/evaluate", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        prompt: prompt,
        response: response,
        reference: reference
      })

    });


    /*
     * Convert API response to JSON.
     */

    const data = await apiResponse.json();


    /*
     * Handle backend errors.
     */

    if (!apiResponse.ok) {

      throw new Error(
        data?.error ||
        "Evaluation request failed."
      );

    }


    /*
     * Display the real Groq evaluation.
     */

    displayResults(data);


  } catch (error) {

    console.error(
      "Evaluation error:",
      error
    );


    /*
     * Show error to the user.
     */

    overallScore.textContent = "Error";

    overallText.textContent =
      error.message ||
      "Something went wrong while evaluating the response.";

    summaryText.textContent =
      "EvalLoop AI could not complete the evaluation.";

    issuesList.innerHTML = `
      <div class="issue-item">
        ${escapeHtml(
          error.message ||
          "Evaluation failed."
        )}
      </div>
    `;

    recommendationText.textContent =
      "Please try again. If the problem continues, check the Vercel deployment and Groq configuration.";

  } finally {

    /*
     * Re-enable button.
     */

    evaluateButton.disabled = false;
    evaluateButton.textContent = "Evaluate Response";

  }

});


/*
 * Display evaluation results.
 */

function displayResults(data) {

  /*
   * Overall score
   */

  overallScore.textContent =
    `${data.overall_score ?? "—"}/100`;

  overallText.textContent =
    data.overall_text ||
    "Evaluation completed.";


  /*
   * Individual scores
   */

  factualityScore.textContent =
    `${data.scores?.factuality ?? "—"}`;

  instructionScore.textContent =
    `${data.scores?.instruction_following ?? "—"}`;

  relevanceScore.textContent =
    `${data.scores?.relevance ?? "—"}`;

  completenessScore.textContent =
    `${data.scores?.completeness ?? "—"}`;

  safetyScore.textContent =
    `${data.scores?.safety ?? "—"}`;

  fluencyScore.textContent =
    `${data.scores?.fluency ?? "—"}`;


  /*
   * Summary
   */

  summaryText.textContent =
    data.summary ||
    "No summary was returned.";


  /*
   * Issues
   */

  issuesList.innerHTML = "";


  if (
    !Array.isArray(data.issues) ||
    data.issues.length === 0
  ) {

    issuesList.innerHTML = `
      <div class="issue-item">
        No meaningful issues detected.
      </div>
    `;

  } else {

    data.issues.forEach(issue => {

      const issueElement =
        document.createElement("div");

      issueElement.className =
        "issue-item";

      issueElement.innerHTML = `
        <div class="issue-type">
          ${escapeHtml(issue.type || "Issue")}
        </div>

        <div class="issue-description">
          ${escapeHtml(
            issue.description ||
            ""
          )}
        </div>
      `;

      issuesList.appendChild(
        issueElement
      );

    });

  }


  /*
   * Recommendation
   */

  recommendationText.textContent =
    data.recommendation ||
    "No recommendation was returned.";

}


/*
 * Basic HTML escaping.
 *
 * This prevents model-generated text from
 * being interpreted as HTML.
 */

function escapeHtml(value) {

  return String(value)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}
