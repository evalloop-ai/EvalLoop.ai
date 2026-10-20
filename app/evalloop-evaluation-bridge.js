/* EvalLoop AI — shared history bridge for Compare and Safety.
 * Uses the same Supabase session and POST /api/history endpoint as History & Insights.
 */
(() => {
  "use strict";
  const SUPABASE_URL = "https://vonknmobshxkhbewdoie.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_J_eboKnioENyrRqnp8uTkg_5I9rrE8t";
  const STORAGE_KEY = "sb-vonknmobshxkhbewdoie-auth-token";
  let clientPromise;
  let lastSavedEvaluationId = null;

  async function getClient() {
    if (window.evalLoopSupabase?.auth) return window.evalLoopSupabase;
    if (!window.supabase?.createClient) throw new Error("Supabase JS did not load on this page.");
    if (!clientPromise) {
      clientPromise = Promise.resolve(window.supabase.createClient(
        SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
        { auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      ));
      clientPromise.then(client => { window.evalLoopSupabase = client; });
    }
    return clientPromise;
  }

  async function getAccessToken() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  async function postHistory(body) {
    const token = await getAccessToken();
    if (!token) return { saved: false, reason: "not_signed_in" };
    const response = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error || data?.message || `History request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return { saved: true, data };
  }

  window.evalLoopSaveEvaluation = async function (evaluation) {
    lastSavedEvaluationId = null;
    window.evalLoopLastSavedEvaluationId = null;
    try {
      const response = await postHistory(evaluation);
      if (!response.saved) return response;
      const id = response.data?.evaluation?.id;
      if (!id) throw new Error("History API returned success without a saved evaluation ID.");
      lastSavedEvaluationId = id;
      window.evalLoopLastSavedEvaluationId = id;
      return { saved: true, id };
    } catch (error) {
      console.error("EvalLoop history save failed:", error);
      return { saved: false, reason: "save_failed", error: error.message };
    }
  };

  window.evalLoopSaveFeedback = async function (rating) {
    if (!lastSavedEvaluationId) return { saved: false, reason: "no_saved_evaluation" };
    try {
      const response = await postHistory({ action: "feedback", evaluation_id: lastSavedEvaluationId, rating });
      return { saved: Boolean(response.saved && response.data?.feedback) };
    } catch (error) {
      console.error("EvalLoop feedback save failed:", error);
      return { saved: false, reason: "save_failed", error: error.message };
    }
  };
})();
