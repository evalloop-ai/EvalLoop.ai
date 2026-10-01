/* =========================================================
   EvalLoop AI — Evaluation Workspace
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
   4. SHOW MESSAGE
   --------------------------------------------------------- */

function showMessage(message) {

  formMessage.textContent = message;

}



/* ---------------------------------------------------------
   5. CLEAR MESSAGE
   --------------------------------------------------------- */

function clearMessage() {

  formMessage.textContent = "";

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

  score.text.textContent =
    `${value}/100`;

  setTimeout(() => {

    score.bar.style.width =
      `${value}%`;

  }, 100);

}



/* ---------------------------------------------------------
   7. DISPLAY ISSUES
   --------------------------------------------------------- */

function displayIssues(issues) {

  issuesList.innerHTML = "";

  if (!issues || issues.length === 0) {

    issuesList.innerHTML = `
      <div class="issue">

        <div class="issue-marker"></div>

        <div class="issue-content">

          <strong>No major issues detected</strong>

          <p>
            The evaluation did not identify any
            significant quality problems.
          </p>

        </div>

      </div>
    `;

    return;
  }


  issues.forEach(issue => {

    const issueElement =
      document.createElement("div");

    issueElement.className = "issue";

    issueElement.innerHTML = `

      <div class="issue-marker"></div>

      <div class="issue-content">

        <strong>
          ${issue.type || "Issue"}
        </strong>

        <p>
          ${issue.description || ""}
        </p>

      </div>

    `;

    issuesList.appendChild(issueElement);

  });

}



/* ---------------------------------------------------------
   8. DISPLAY RESULTS
   --------------------------------------------------------- */

function displayResults(data) {

  /*
    Hide the empty state.
  */

  emptyState.classList.add("hidden");


  /*
    Show results.
  */

  results.classList.remove("hidden");


  /*
    Overall score.
  */

  const overall =
    Number(data.overall_score || 0);

  overallScore.textContent =
    `${overall}/100`;


  /*
    Overall explanation.
  */

  overallText.textContent =
    data.overall_text ||
    "Evaluation completed.";


  /*
    Individual scores.
  */

  updateScore(
    "factuality",
    Number(data.scores?.factuality || 0)
  );


  updateScore(
    "instruction_following",
    Number(data.scores?.instruction_following || 0)
  );


  updateScore(
    "relevance",
    Number(data.scores?.relevance || 0)
  );


  updateScore(
    "completeness",
    Number(data.scores?.completeness || 0)
  );


  updateScore(
    "safety",
    Number(data.scores?.safety || 0)
  );


  updateScore(
    "fluency",
    Number(data.scores?.fluency || 0)
  );


  /*
    Summary.
  */

  summaryText.textContent =
    data.summary ||
    "No summary was provided.";


  /*
    Issues.
  */

  displayIssues(
    data.issues || []
  );


  /*
    Recommendation.
  */

  recommendationText.textContent =
    data.recommendation ||
    "No recommendation was provided.";

}



/* ---------------------------------------------------------
   9. DEMO EVALUATION
   ---------------------------------------------------------

   IMPORTANT:

   This is NOT connected to Groq or Gemini yet.

   We are using fake evaluation data temporarily
   so we can test the interface.

   We will remove this later.
--------------------------------------------------------- */

function runDemoEvaluation() {

  const demoResult = {

    overall_score: 94,

    overall_text:
      "Strong response with minor opportunities for improvement.",

    scores: {

      factuality: 96,

      instruction_following: 95,

      relevance: 94,

      completeness: 89,

      safety: 98,

      fluency: 97

    },

    issues: [

      {

        type: "Completeness",

        description:
          "One requested detail could have been explained more explicitly."

      },

      {

        type: "Relevance",

        description:
          "A small portion of the response could be more directly focused on the user's request."

      }

    ],

    summary:
      "The response is accurate, relevant and well written. It follows the main instruction and does not contain obvious safety concerns.",

    recommendation:
      "Add the missing detail and make the less relevant portion more concise."

  };


  displayResults(demoResult);

}



/* ---------------------------------------------------------
   10. BUTTON CLICK
   --------------------------------------------------------- */

evaluateButton.addEventListener(
  "click",
  () => {

    clearMessage();


    /*
      Get user input.
    */

    const prompt =
      promptInput.value.trim();

    const response =
      responseInput.value.trim();

    const reference =
      referenceInput.value.trim();


    /*
      Validate Prompt.
    */

    if (!prompt) {

      showMessage(
        "Please enter the original prompt."
      );

      promptInput.focus();

      return;
    }


    /*
      Validate AI Response.
    */

    if (!response) {

      showMessage(
        "Please enter the AI response."
      );

      responseInput.focus();

      return;
    }


    /*
      Reference is optional.
    */

    console.log("Prompt:", prompt);

    console.log(
      "AI Response:",
      response
    );

    console.log(
      "Reference:",
      reference
    );


    /*
      Show temporary status.
    */

    showMessage(
      "Running evaluation..."
    );


    evaluateButton.disabled = true;

    evaluateButton.style.opacity =
      "0.6";


    /*
      Temporary delay.

      Later this will be replaced with
      the real API request to:

      /api/evaluate
    */

    setTimeout(() => {

      runDemoEvaluation();


      showMessage(
        "Demo evaluation completed."
      );


      evaluateButton.disabled = false;

      evaluateButton.style.opacity =
        "1";

    }, 900);

  }
);



/* ---------------------------------------------------------
   11. INITIAL STATE
   --------------------------------------------------------- */

console.log(
  "EvalLoop AI evaluation workspace loaded."
);
