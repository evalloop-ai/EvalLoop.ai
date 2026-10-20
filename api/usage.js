import { getDailyUsage } from "./_lib/usage.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const usage = await getDailyUsage(req);
    res.setHeader("X-EvalLoop-Usage-Limit", String(usage.limit));
    res.setHeader("X-EvalLoop-Usage-Used", String(usage.used));
    res.setHeader("X-EvalLoop-Usage-Remaining", String(usage.remaining));
    res.setHeader("X-EvalLoop-Usage-Date", usage.date);
    return res.status(200).json(usage);
  } catch (error) {
    console.error("Usage status error:", error?.message || error);
    return res.status(error?.status || 503).json({
      error: error?.status === 401 ? error.message : "Usage limits could not be verified. Please try again shortly."
    });
  }
}
