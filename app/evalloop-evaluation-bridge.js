
/* =========================================================
   EvalLoop AI — Evaluation History Bridge
   File: app/evalloop-evaluation-bridge.js

   Does not modify the evaluator prompt, API, or result format.
   ========================================================= */

(() => {
  "use strict";

  const HISTORY_API = "/api/history";

  const SUPABASE_URL =
    "https://vonknmobshxkhbewdoie.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_J_eboKnioENyrRqnp8uTkg_5I9rrE8t";

  let supabaseClient = null;
  let currentEvaluationId = null;
  let currentSavePromise = Promise.resolve(null);
  let lastFeedbackRating = null;

  /* ---------------------------------------------------------
     1. Initialize Supabase authentication
     --------------------------------------------------------- */

  async function initializeSupabase() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error("Supabase library could not load."));
        document.head.appendChild(script);
      });
    }

    if (!window.supabase?.createClient) {
      throw new Error("Supabase client is unavailable.");
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return supabaseClient;
  }

  async function getAccessToken() {
    const client = await initializeSupabase();
    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    return data?.session?.access_token || null;
  }

  /* ---------------------------------------------------------
     2. Save a completed General Response evaluation
     --------------------------------------------------------- */

  async function saveEvaluation(input, result) {
    const token = await getAccessToken();

    if (!token) {
      console.info(
        "EvalLoop History: Sign in to save this evaluation."
      );
      return null;
    }

    const response = await fetch(HISTORY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        evaluation_type: "general",
        prompt: input.prompt || "",
        response: input.response || "",
        reference_context:
          input.reference || input.reference_context || "",
        result,
        model_used: "groq"
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "Could not save evaluation history."
      );
    }

    const savedId =
      data.id ||
      data.evaluation?.id ||
      data.run?.id ||
      data.data?.id ||
      null;

    if (savedId) {
      currentEvaluationId = savedId;
    }

    console.info("EvalLoop History: Evaluation saved.");

    return savedId;
  }

  /* ---------------------------------------------------------
     3. Observe the existing evaluator API without changing
        its request or response
     --------------------------------------------------------- */

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (...args) {
    const request = args[0];
    const options = args[1] || {};

    const url =
      typeof request === "string"
        ? request
        : request instanceof URL
          ? request.href
          : request?.url || "";

    const method = (
      options.method ||
      request?.method ||
      "GET"
    ).toUpperCase();

    const isGeneralEvaluation =
      method === "POST" &&
      /\/api\/evaluate(?:\?|$)/.test(url);

    let input = null;

    if (isGeneralEvaluation) {
      try {
        const body =
          options.body ??
          (request instanceof Request
            ? await request.clone().text()
            : null);

        input = typeof body === "string"
          ? JSON.parse(body)
          : null;
      } catch (error) {
        console.warn(
          "EvalLoop History: Could not read evaluation input.",
          error
        );
      }
    }

    // Call the original API exactly as before.
    const response = await originalFetch(...args);

    if (isGeneralEvaluation && response.ok && input) {
      // Never consume or modify the response used by app.js.
      const resultPromise = response.clone()
        .json()
        .then(result => {
          currentEvaluationId = null;
          lastFeedbackRating = null;

          currentSavePromise = saveEvaluation(input, result)
            .catch(error => {
              console.error(
                "EvalLoop History: Save failed.",
                error
              );
              return null;
            });

          return currentSavePromise;
        })
        .catch(error => {
          console.error(
            "EvalLoop History: Could not read evaluation result.",
            error
          );
          return null;
        });

      // Saving runs independently; the evaluator receives
      // its original Response immediately.
      void resultPromise;
    }

    return response;
  };

  /* ---------------------------------------------------------
     4. Persist thumbs-up / thumbs-down feedback
     --------------------------------------------------------- */

  async function submitFeedback(rating, panel) {
    try {
      // If the evaluation was just completed, allow its save
      // operation to finish before sending feedback.
      await currentSavePromise;

      if (!currentEvaluationId) {
        const message = panel?.querySelector(".feedback-thanks");

        if (message) {
          message.textContent =
            "Sign in and run a new evaluation to save feedback.";
        }

        return;
      }

      const token = await getAccessToken();

      if (!token) {
        throw new Error("Please sign in to submit feedback.");
      }

      const response = await fetch(HISTORY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "feedback",
          evaluation_id: currentEvaluationId,
          rating
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save feedback."
        );
      }

      lastFeedbackRating = rating;

      const message = panel?.querySelector(".feedback-thanks");

      if (message) {
        message.textContent = "Thanks for your feedback.";
      }

      console.info("EvalLoop History: Feedback saved.");
    } catch (error) {
      console.error(
        "EvalLoop History: Feedback failed.",
        error
      );

      const message = panel?.querySelector(".feedback-thanks");

      if (message) {
        message.textContent =
          error.message || "Feedback could not be saved.";
      }
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-feedback]");

    if (!button) return;

    const panel = button.closest(".feedback-panel");

    // Only handle the General Response feedback panel.
    if (!panel || panel.id === "comparisonFeedback") return;

    const rating = button.dataset.feedback;

    if (rating !== "up" && rating !== "down") return;

    // Prevent the existing app.js feedback handler from also
    // handling this click and displaying a misleading success.
    event.stopImmediatePropagation();

    panel.querySelectorAll("[data-feedback]").forEach(item => {
      item.setAttribute(
        "aria-pressed",
        String(item === button)
      );
    });

    const message = panel.querySelector(".feedback-thanks");

    if (message) {
      message.textContent = "Saving feedback…";
    }

    void submitFeedback(rating, panel);
  }, true);

  /* ---------------------------------------------------------
     5. Startup
     --------------------------------------------------------- */

  initializeSupabase().catch(error => {
    console.error(
      "EvalLoop History: Authentication initialization failed.",
      error
    );
  });

  console.info("EvalLoop AI History Bridge loaded.");
})();
