// Small, dependency-free security middleware (headers, rate limiting, CORS allow-list, optional API key).

import crypto from "node:crypto";

/** Defensive headers. The API only returns JSON, so the CSP forbids loading anything. */
export function securityHeaders(_req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store",
  });
  next();
}

/** Fixed-window rate limiter per client IP. */
export function rateLimiter({ windowMs = 60_000, max = 120, now = Date.now } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k); // keep memory bounded
    const key = req.ip || "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    return next();
  };
}

/** CORS only for explicitly allowed origins (none by default: the Vite proxy makes dev same-origin). */
export function cors(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
        Vary: "Origin",
      });
      if (req.method === "OPTIONS") return res.status(204).end();
    }
    return next();
  };
}

const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();

/** Optional shared-secret check (set API_KEY to enable). Constant-time comparison. */
export function requireApiKey(key) {
  if (!key) return (_req, _res, next) => next();
  const expected = digest(key);
  return (req, res, next) => {
    const given = req.headers["x-api-key"];
    if (typeof given === "string" && crypto.timingSafeEqual(digest(given), expected)) return next();
    return res.status(401).json({ error: "Missing or invalid API key." });
  };
}
