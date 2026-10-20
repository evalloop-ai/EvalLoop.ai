const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RUNS_TABLE = "evalloop_evaluation_runs";
const FEEDBACK_TABLE = "evalloop_evaluation_feedback";

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function getBearerToken(req) {
  const header = req.headers?.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function restQuery(params) {
  return new URLSearchParams(params).toString();
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || "Supabase request failed."
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;

  const user = await response.json();
  return user?.id ? { user, token } : null;
}

function isValidType(type) {
  return ["general", "compare", "safety"].includes(type);
}

function validFeedback(evaluation_id, rating) {
  return typeof evaluation_id === "string" &&
    /^[0-9a-f-]{36}$/i.test(evaluation_id) &&
    ["up", "down"].includes(rating);
}

async function saveFeedback(evaluation_id, rating, userId) {
  const lookup = restQuery({
    select: "id",
    id: `eq.${evaluation_id}`,
    user_id: `eq.${userId}`,
    limit: "1"
  });
  const owned = await supabaseRequest(`/rest/v1/${RUNS_TABLE}?${lookup}`);
  if (!owned?.length) return null;

  const saved = await supabaseRequest(
    `/rest/v1/${FEEDBACK_TABLE}?on_conflict=evaluation_id,user_id`,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        evaluation_id,
        user_id: userId,
        rating,
        updated_at: new Date().toISOString()
      })
    }
  );
  return saved?.[0] || null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, PATCH, OPTIONS");
    return res.status(204).end();
  }
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, OPTIONS");
    return send(res, 405, { error: "Method not allowed." });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return send(res, 500, {
      error: "Supabase server environment variables are not configured."
    });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return send(res, 401, {
        error: "Please sign in to access evaluation history."
      });
    }
    const userId = auth.user.id;

    if (req.method === "POST") {
      const body = req.body || {};
      if (body.action === "feedback") {
        const { evaluation_id, rating } = body;
        if (!validFeedback(evaluation_id, rating)) {
          return send(res, 400, {
            error: "A valid evaluation_id and rating ('up' or 'down') are required."
          });
        }
        const feedback = await saveFeedback(evaluation_id, rating, userId);
        if (!feedback) return send(res, 404, { error: "Evaluation not found." });
        return send(res, 200, { feedback });
      }

      const {
        evaluation_type,
        prompt = null,
        response = null,
        response_a = null,
        response_b = null,
        reference_context = null,
        result,
        model_used = "unknown"
      } = body;

      if (!isValidType(evaluation_type)) {
        return send(res, 400, {
          error: "evaluation_type must be general, compare, or safety."
        });
      }
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return send(res, 400, { error: "A valid evaluation result object is required." });
      }
      if (
        (evaluation_type === "general" && (!prompt || !response)) ||
        (evaluation_type === "compare" && (!prompt || !response_a || !response_b)) ||
        (evaluation_type === "safety" && (!prompt || !response))
      ) {
        return send(res, 400, {
          error: "The prompt and required response fields are missing."
        });
      }

      const saved = await supabaseRequest(`/rest/v1/${RUNS_TABLE}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          evaluation_type,
          prompt,
          response,
          response_a,
          response_b,
          reference_context,
          result,
          model_used
        })
      });
      return send(res, 201, { evaluation: saved?.[0] || null });
    }

    if (req.method === "GET") {
      const id = req.query?.id;
      if (id) {
        const query = restQuery({
          select: "*",
          id: `eq.${id}`,
          user_id: `eq.${userId}`,
          limit: "1"
        });
        const rows = await supabaseRequest(`/rest/v1/${RUNS_TABLE}?${query}`);
        if (!rows?.length) return send(res, 404, { error: "Evaluation not found." });

        const feedbackQuery = restQuery({
          select: "rating,created_at,updated_at",
          evaluation_id: `eq.${id}`,
          user_id: `eq.${userId}`,
          limit: "1"
        });
        const feedback = await supabaseRequest(`/rest/v1/${FEEDBACK_TABLE}?${feedbackQuery}`);
        return send(res, 200, {
          evaluation: rows[0],
          feedback: feedback?.[0] || null
        });
      }

      const requestedLimit = Number(req.query?.limit) || 25;
      const limit = Math.min(Math.max(requestedLimit, 1), 100);
      const query = restQuery({
        select: "id,evaluation_type,prompt,response,response_a,response_b,result,model_used,created_at",
        user_id: `eq.${userId}`,
        order: "created_at.desc",
        limit: String(limit)
      });
      const evaluations = await supabaseRequest(`/rest/v1/${RUNS_TABLE}?${query}`);
      return send(res, 200, { evaluations: evaluations || [] });
    }

    if (req.method === "PATCH") {
      const { evaluation_id, rating } = req.body || {};
      if (!validFeedback(evaluation_id, rating)) {
        return send(res, 400, {
          error: "A valid evaluation_id and rating ('up' or 'down') are required."
        });
      }
      const feedback = await saveFeedback(evaluation_id, rating, userId);
      if (!feedback) return send(res, 404, { error: "Evaluation not found." });
      return send(res, 200, { feedback });
    }
  } catch (error) {
    console.error("EvalLoop history API error:", error.message);
    return send(res, error.status || 500, {
      error: error.status && error.status < 500
        ? error.message
        : "Could not complete the history request. Check server logs."
    });
  }
}
