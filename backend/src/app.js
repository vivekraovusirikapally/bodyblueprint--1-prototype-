// Express wiring: routes -> service -> repository -> SQLite.
//
//   GET    /api/health
//   GET    /api/profile          PUT /api/profile
//   GET    /api/logs?from&to     PUT /api/logs/:date
//   PUT    /api/state            DELETE /api/state

import express from "express";
import { ApiError, createService } from "./service.js";
import { cors, rateLimiter, requireApiKey, securityHeaders } from "./security.js";

export function createApp({ repo, config = {} }) {
  const { apiKey = "", corsOrigins = [], rateLimit = { windowMs: 60_000, max: 120 }, clock } = config;
  const service = createService(repo, clock);
  const app = express();

  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(cors(corsOrigins));
  app.use(rateLimiter(rateLimit));
  app.use(express.json({ limit: "100kb" })); // big enough for 400 days of logs, small enough to stop abuse

  // Health check is public so uptime monitors and the UI can ping it without a key.
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", requireApiKey(apiKey));

  const handle = (fn) => (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };

  app.get("/api/profile", handle((_req, res) => res.json({ profile: service.getProfile() })));
  app.put("/api/profile", handle((req, res) => res.json({ profile: service.putProfile(req.body) })));

  app.get("/api/logs", handle((req, res) => {
    const { from, to } = req.query;
    res.json({ logs: service.listLogs({ from: typeof from === "string" ? from : undefined, to: typeof to === "string" ? to : undefined }) });
  }));
  app.put("/api/logs/:date", handle((req, res) => res.json({ date: req.params.date, log: service.putLog(req.params.date, req.body) })));

  app.put("/api/state", handle((req, res) => res.json(service.importState(req.body))));
  app.delete("/api/state", handle((_req, res) => {
    service.clear();
    res.status(204).end();
  }));

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

  // Central error handler: clean JSON, never a stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
