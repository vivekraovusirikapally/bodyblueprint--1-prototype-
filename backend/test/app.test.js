// End-to-end HTTP tests (needs `npm install` for Express). Starts the real app on a random port with an in-memory DB.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { createRepository } from "../src/repository.js";

const NOW = new Date(2026, 10, 20, 12);
const good = { heightCm: 175, weightKg: 72, age: 27, sex: "male" };
let server, base;

async function call(path, { method = "GET", body, headers = {}, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined || raw ? { "Content-Type": "application/json" } : {}), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  return { res, json: text ? JSON.parse(text) : null };
}

describe("HTTP API", () => {
  before(async () => {
    const app = createApp({ repo: createRepository(openDatabase(":memory:")), config: { rateLimit: { windowMs: 60_000, max: 1000 }, clock: () => NOW } });
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  it("GET /api/health", async () => {
    const { res, json } = await call("/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(json, { status: "ok" });
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  it("profile: 404, validation error, then success", async () => {
    assert.equal((await call("/api/profile")).res.status, 404);
    const bad = await call("/api/profile", { method: "PUT", body: { ...good, age: 1 } });
    assert.equal(bad.res.status, 400);
    assert.ok(bad.json.details.age);
    const ok = await call("/api/profile", { method: "PUT", body: good });
    assert.equal(ok.res.status, 200);
    assert.equal((await call("/api/profile")).json.profile.heightCm, 175);
  });

  it("logs: upsert, merge, list", async () => {
    await call("/api/logs/2026-11-20", { method: "PUT", body: { waterMl: 500 } });
    const { json } = await call("/api/logs/2026-11-20", { method: "PUT", body: { sleepHours: 7.5 } });
    assert.equal(json.log.waterMl, 500);
    assert.equal(json.log.sleepHours, 7.5);
    const list = await call("/api/logs?from=2026-11-01&to=2026-11-20");
    assert.deepEqual(Object.keys(list.json.logs), ["2026-11-20"]);
  });

  it("rejects malformed JSON, bad dates and unknown routes with clean JSON errors", async () => {
    const badJson = await call("/api/profile", { method: "PUT", raw: "{oops" });
    assert.equal(badJson.res.status, 400);
    assert.equal((await call("/api/logs/2026-02-30", { method: "PUT", body: { waterMl: 1 } })).res.status, 400);
    const missing = await call("/api/nope");
    assert.equal(missing.res.status, 404);
    assert.ok(!JSON.stringify(missing.json).includes("at "), "no stack traces");
  });

  it("rejects oversized bodies", async () => {
    const big = { logs: {}, pad: "x".repeat(200_000) };
    assert.equal((await call("/api/state", { method: "PUT", body: big })).res.status, 413);
  });

  it("state: bulk import then clear", async () => {
    const put = await call("/api/state", { method: "PUT", body: { profile: good, logs: { "2026-11-19": { waterMl: 100 } } } });
    assert.equal(put.res.status, 200);
    assert.equal((await call("/api/state", { method: "DELETE" })).res.status, 204);
    assert.equal((await call("/api/profile")).res.status, 404);
  });
});

describe("HTTP API with an API key", () => {
  let secured, url;
  before(async () => {
    const app = createApp({ repo: createRepository(openDatabase(":memory:")), config: { apiKey: "k3y", clock: () => NOW } });
    secured = app.listen(0, "127.0.0.1");
    await new Promise((r) => secured.once("listening", r));
    url = `http://127.0.0.1:${secured.address().port}`;
  });
  after(() => secured.close());

  it("keeps /health public but requires the key elsewhere", async () => {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    assert.equal((await fetch(`${url}/api/profile`)).status, 401);
    assert.equal((await fetch(`${url}/api/profile`, { headers: { "x-api-key": "k3y" } })).status, 404); // authorised, just no profile yet
  });
});

describe("rate limiting over HTTP", () => {
  it("returns 429 after the limit", async () => {
    const app = createApp({ repo: createRepository(openDatabase(":memory:")), config: { rateLimit: { windowMs: 60_000, max: 3 } } });
    const s = app.listen(0, "127.0.0.1");
    await new Promise((r) => s.once("listening", r));
    const u = `http://127.0.0.1:${s.address().port}/api/health`;
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(u)).status);
    s.close();
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  });
});
