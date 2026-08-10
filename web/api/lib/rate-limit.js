// In-memory sliding-window rate limiter keyed by user uid.
// NOTE: Vercel serverless instances are ephemeral; this is a best-effort
// per-instance limiter, not a global quota (zero-cost per AGENTS.md).
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 100; // per uid per window

const hits = new Map(); // uid -> number[] of request timestamps

function sweep(now) {
  if (hits.size > 10000) {
    for (const [uid, timestamps] of hits) {
      const recent = timestamps.filter((t) => now - t < WINDOW_MS);
      if (recent.length === 0) hits.delete(uid);
      else hits.set(uid, recent);
    }
  }
}

export function checkRateLimit(uid) {
  const now = Date.now();
  sweep(now);

  const timestamps = hits.get(uid) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(uid, recent);
    const retryAfterSeconds = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  hits.set(uid, recent);
  return { allowed: true };
}
