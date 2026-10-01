/* =========================================================
   EvalLoop AI — Evaluation Workspace
   Real API Evaluation
   ========================================================= */


/* ---------------------------------------------------------
   1. GET HTML ELEMENTS
   --------------------------------------------------------- */

const evaluateButton =
  document.getElementById("evaluateButton");

const promptInput =
  document.getElementById("prompt");

const responseInput =
  document.getElementById("response");

const referenceInput =
  document.getElementById("reference");

const formMessage =
  document.getElementById("formMessage");

const emptyState =
  document.getElementById("emptyState");

const results =
  document.getElementById("results");

const resultState =
  document.getElementById("resultState");


/* ---------------------------------------------------------
   2. RESULT ELEMENTS
   --------------------------------------------------------- */

const overallScore =
  document.getElementById("overallScore");

const overallText =
  document.getElementById("overallText");

const summaryText =
  document.getElementById("summaryText");

const recommendationText =
  document.getElementById("recommendationText");

const issuesList =
  document.getElementById("issuesList");


/* ---------------------------------------------------------
   3. SCORE ELEMENTS
   --------------------------------------------------------- */

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


/* ---------------------------------------------------------
   4. MESSAGE HELPERS
   --------------------------------------------------------- */

function showMessage(message) {

  formMessage.textContent = message;

}


function clearMessage() {

  formMessage.textContent = "";

}


/* ---------------------------------------------------------
   5. HTML ESCAPING
   --------------------------------------------------------- */

function escapeHtml(value) {

  return String(value)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}


/* ---------------------------------------------------------
   6. UPDATE SCORE
   --------------------------------------------------------- */

function updateScore(scoreName, value) {

  const score =
    scoreElements[scoreName];

  if (!score) {
    return;
  }

  const safeValue = Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );

  score.text.textContent =
    `${safeValue}/100`;

  score.bar.style.width = "0%";

  requestAnimationFrame(() => {

    score.bar.style.width =
      `${safeValue}%`;

  });

}


/* ---------------------------------------------------------
   7. DISPLAY ISSUES
   --------------------------------------------------------- */

function displayIssues(issues) {

  issuesList.innerHTML = "";

  if (
    !Array.isArray(issues) ||
    issues.length === 0
  ) {

    issuesList.innerHTML = `
      <div class="issue">

        <div class="issue-marker"></div>

        <div class="issue-content">

          <strong>
            No major issues detected
          </strong>

          <p>
            The evaluation did not identify
            any significant quality problems.
          </p>

        </div>

      </div>
    `;

    return;
  }


  issues.forEach(issue => {

    const issueElement =
      document.createElement("div");

    issueElement.className =
      "issue";


    const type =
      escapeHtml(
        issue?.type ||
        "Issue"
      );


    const description =
      escapeHtml(
        issue?.description ||
        ""
      );


    issueElement.innerHTML = `

      <div class="issue-marker"></div>

      <div class="issue-content">

        <strong>
          ${type}
        </strong>

        <p>
          ${description}
        </p>

      </div>

    `;


    issuesList.appendChild(
      issueElement
    );

  });

}


/* ---------------------------------------------------------
   8. DISPLAY RESULTS
   --------------------------------------------------------- */

function displayResults(data) {

  /*
   * Hide empty state.
   */

  emptyState.classList.add(
    "hidden"
  );


  /*
   * Show results.
   */

  results.classList.remove(
    "hidden"
  );


  /*
   * Update result state.
   */

  if (resultState) {

    resultState.textContent =
      "COMPLETED";

    resultState.classList.remove(
      "waiting"
    );

  }


  /*
   * Overall score.
   */

  const overall =
    Math.max(
      0,
      Math.min(
        100,
        Number(data?.overall_score) || 0
      )
    );


  overallScore.textContent =
    `${overall}/100`;


  /*
   * Overall explanation.
   */

  overallText.textContent =
    data?.overall_text ||
    "Evaluation completed.";


  /*
   * Individual scores.
   */

  updateScore(
    "factuality",
    data?.scores?.factuality
  );


  updateScore(
    "instruction_following",
    data?.scores?.instruction_following
  );


  updateScore(
    "relevance",
    data?.scores?.relevance
  );


  updateScore(
    "completeness",
    data?.scores?.completeness
  );


  updateScore(
    "safety",
    data?.scores?.safety
  );


  updateScore(
    "fluency",
    data?.scores?.fluency
  );


  /*
   * Summary.
   */

  summaryText.textContent =
    data?.summary ||
    "No summary was provided.";


  /*
   * Issues.
   */

  displayIssues(
    data?.issues
  );


  /*
   * Recommendation.
   */

  recommendationText.textContent =
    data?.recommendation ||
    "No recommendation was provided.";

}


/* ---------------------------------------------------------
   9. RESET RESULTS FOR NEW EVALUATION
   --------------------------------------------------------- */

function showLoadingState() {

  emptyState.classList.add(
    "hidden"
  );

  results.classList.remove(
    "hidden"
  );


  overallScore.textContent =
    "—";


  overallText.textContent =
    "EvalLoop AI is evaluating the response...";


  summaryText.textContent =
    "Analyzing the AI response...";


  issuesList.innerHTML = `
    <div class="issue">

      <div class="issue-marker"></div>

      <div class="issue-content">

        <strong>
          Evaluation in progress
        </strong>

        <p>
          EvalLoop AI is analyzing the response.
        </p>

      </div>

    </div>
  `;


  recommendationText.textContent =
    "Generating recommendation...";


  Object.values(scoreElements)
    .forEach(score => {

      score.text.textContent =
        "—";

      score.bar.style.width =
        "0%";

    });


  if (resultState) {

    resultState.textContent =
      "EVALUATING";

    resultState.classList.remove(
      "waiting"
    );

  }

}


/* ---------------------------------------------------------
   10. CALL EVALLOOP API
   --------------------------------------------------------- */

async function evaluateResponse(
  prompt,
  response,
  reference
) {

  const apiResponse =
    await fetch(
      "/api/evaluate",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          prompt,
          response,
          reference
        })
      }
    );


  /*
   * Try to read JSON.
   */

  let data;

  try {

    data =
      await apiResponse.json();

  } catch {

    throw new Error(
      "The evaluation API returned an invalid response."
    );

  }


  /*
   * Handle HTTP errors.
   */

  if (!apiResponse.ok) {

    throw new Error(
      data?.error ||
      `Evaluation failed with status ${apiResponse.status}.`
    );

  }


  /*
   * Make sure we actually received
   * an evaluation object.
   */

  if (
    !data ||
    typeof data !== "object"
  ) {

    throw new Error(
      "The evaluation API returned an empty result."
    );

  }


  return data;

}


/* ---------------------------------------------------------
   11. BUTTON CLICK
   --------------------------------------------------------- */

evaluateButton.addEventListener(
  "click",
  async () => {

    clearMessage();


    /*
     * Get user input.
     */

    const prompt =
      promptInput.value.trim();

    const response =
      responseInput.value.trim();

    const reference =
      referenceInput.value.trim();


    /*
     * Validate prompt.
     */

    if (!prompt) {

      showMessage(
        "Please enter the original prompt."
      );

      promptInput.focus();

      return;

    }


    /*
     * Validate AI response.
     */

    if (!response) {

      showMessage(
        "Please enter the AI response."
      );

      responseInput.focus();

      return;

    }


    /*
     * Start loading state.
     */

    evaluateButton.disabled =
      true;

    evaluateButton.querySelector(
      "span:first-child"
    ).textContent =
      "Evaluating with Groq...";


    showMessage(
      "Sending response to EvalLoop AI..."
    );


    showLoadingState();


    try {

      /*
       * Call our Vercel API.
       */

      const data =
        await evaluateResponse(
          prompt,
          response,
          reference
        );


      /*
       * Display real evaluation.
       */

      displayResults(data);


      showMessage(
        "Evaluation completed."
      );


    } catch (error) {

      console.error(
        "EvalLoop AI evaluation error:",
        error
      );


      /*
       * Show error state.
       */

      if (resultState) {

        resultState.textContent =
          "ERROR";

        resultState.classList.remove(
          "waiting"
        );

      }


      overallScore.textContent =
        "Error";


      overallText.textContent =
        error?.message ||
        "Evaluation failed.";


      summaryText.textContent =
        "EvalLoop AI could not complete the evaluation.";


      issuesList.innerHTML = `

        <div class="issue">

          <div class="issue-marker"></div>

          <div class="issue-content">

            <strong>
              Evaluation Error
            </strong>

            <p>
              ${escapeHtml(
                error?.message ||
                "Unknown evaluation error."
              )}
            </p>

          </div>

        </div>

      `;


      recommendationText.textContent =
        "Check the API configuration and try again.";


      showMessage(
        error?.message ||
        "Evaluation failed."
      );

    } finally {

      /*
       * Re-enable button.
       */

      evaluateButton.disabled =
        false;


      evaluateButton.querySelector(
        "span:first-child"
      ).textContent =
        "Evaluate Response";

    }

  }
);


/* ---------------------------------------------------------
   12. INITIAL STATE
   --------------------------------------------------------- */

console.log(
  "EvalLoop AI evaluation workspace loaded."
);

console.log(
  "Real API evaluation enabled."
);
