/* EvalLoop AI — shared daily evaluation quota enforcement.
 * Uses Supabase service-role credentials only on the server.
 */
export const DAILY_LIMIT_MESSAGE = "You have reached today’s free evaluation limit. Create a free account or try again tomorrow.";
const ANONYMOUS_LIMIT = 10;
const FREE_ACCOUNT_LIMIT = 35;

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const error = new Error("Usage enforcement is not configured.");
    error.status = 503;
    throw error;
  }
  return { url, serviceKey };
}

function bearerToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : "";
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveIdentity(req, cfg) {
  const token = bearerToken(req);
  if (token) {
    const response = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = new Error("Your session could not be verified. Please sign in again.");
      error.status = 401;
      throw error;
    }
    const user = await response.json();
    if (!isUuid(user?.id)) {
      const error = new Error("Your session could not be verified. Please sign in again.");
      error.status = 401;
      throw error;
    }
    return { type: "user", id: user.id, limit: FREE_ACCOUNT_LIMIT };
  }

  const anonymousId = req.headers?.["x-evalloop-anonymous-id"];
  if (!isUuid(anonymousId)) {
    const error = new Error("A valid device identifier is required to check daily usage.");
    error.status = 400;
    throw error;
  }
  return { type: "anonymous", id: anonymousId, limit: ANONYMOUS_LIMIT };
}

function usageHeaders(res, usage) {
  res.setHeader("X-EvalLoop-Usage-Limit", String(usage.limit));
  res.setHeader("X-EvalLoop-Usage-Used", String(usage.used));
  res.setHeader("X-EvalLoop-Usage-Remaining", String(usage.remaining));
  res.setHeader("X-EvalLoop-Usage-Date", usage.date);
  res.setHeader("Cache-Control", "no-store");
}

async function getCount(cfg, identity) {
  const date = new Date().toISOString().slice(0, 10);
  const query = new URLSearchParams({
    select: "evaluation_count",
    usage_date: `eq.${date}`,
    identity_type: `eq.${identity.type}`,
    identity_id: `eq.${identity.id}`,
    limit: "1"
  });
  const response = await fetch(`${cfg.url}/rest/v1/daily_evaluation_usage?${query}`, {
    headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }
  });
  if (!response.ok) throw new Error(`Could not read usage counter (${response.status}).`);
  const rows = await response.json();
  return { date, used: Number(rows?.[0]?.evaluation_count || 0) };
}

export async function getDailyUsage(req) {
  const cfg = config();
  const identity = await resolveIdentity(req, cfg);
  const { date, used } = await getCount(cfg, identity);
  return {
    identity_type: identity.type,
    limit: identity.limit,
    used,
    remaining: Math.max(0, identity.limit - used),
    date
  };
}

export async function reserveDailyEvaluation(req, res) {
  const cfg = config();
  const identity = await resolveIdentity(req, cfg);
  const response = await fetch(`${cfg.url}/rest/v1/rpc/consume_daily_evaluation`, {
    method: "POST",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_identity_type: identity.type,
      p_identity_id: identity.id,
      p_daily_limit: identity.limit
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Daily usage RPC failed:", response.status, detail.slice(0, 500));
    const error = new Error("Usage limits could not be verified. Please try again shortly.");
    error.status = 503;
    throw error;
  }
  const payload = await response.json();
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row.allowed !== "boolean") {
    const error = new Error("Usage limits could not be verified. Please try again shortly.");
    error.status = 503;
    throw error;
  }
  const usage = {
    identity_type: identity.type,
    limit: Number(row.daily_limit ?? identity.limit),
    used: Number(row.used_count ?? 0),
    remaining: Number(row.remaining_count ?? 0),
    date: String(row.usage_date || new Date().toISOString().slice(0, 10))
  };
  usageHeaders(res, usage);
  return { allowed: row.allowed, usage };
}
