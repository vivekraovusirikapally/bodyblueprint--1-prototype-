import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
import { createRepository } from "./repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "127.0.0.1"; // local only unless you opt in
const dbFile = process.env.DB_PATH || path.join(here, "..", "data", "bodyblueprint.db");

const db = openDatabase(dbFile);
const app = createApp({
  repo: createRepository(db),
  config: {
    apiKey: process.env.API_KEY || "",
    corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  },
});

const server = app.listen(port, host, () => console.log(`BodyBlueprint API listening on http://${host}:${port} (db: ${dbFile})`));

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
