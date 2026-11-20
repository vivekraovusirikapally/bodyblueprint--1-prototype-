import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cors, rateLimiter, requireApiKey, securityHeaders } from "../src/security.js";

function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: undefined, ended: false };
  res.set = (k, v) => {
    if (typeof k === "object") Object.assign(res.headers, k);
    else res.headers[k] = v;
    return res;
  };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  res.end = () => ((res.ended = true), res);
  return res;
}
const run = (mw, req = {}, res = fakeRes()) => {
  let nexted = false;
  mw({ headers: {}, ip: "1.2.3.4", method: "GET", ...req }, res, () => (nexted = true));
  return { res, nexted };
};

describe("securityHeaders", () => {
  it("sets defensive headers", () => {
    const { res, nexted } = run(securityHeaders);
    assert.ok(nexted);
    assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(res.headers["X-Frame-Options"], "DENY");
    assert.match(res.headers["Content-Security-Policy"], /default-src 'none'/);
  });
});

describe("rateLimiter", () => {
  it("blocks after max requests per window, per IP, and resets afterwards", () => {
    let t = 1000;
    const mw = rateLimiter({ windowMs: 1000, max: 2, now: () => t });
    assert.ok(run(mw).nexted);
    assert.ok(run(mw).nexted);
    const blocked = run(mw);
    assert.equal(blocked.nexted, false);
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.headers["Retry-After"], "1");
    assert.ok(run(mw, { ip: "9.9.9.9" }).nexted); // another client is unaffected
    t += 1001;
    assert.ok(run(mw).nexted); // new window
  });
});

describe("requireApiKey", () => {
  it("is a no-op when no key is configured", () => {
    assert.ok(run(requireApiKey("")).nexted);
  });
  it("accepts the right key and rejects missing/wrong ones", () => {
    const mw = requireApiKey("s3cret");
    assert.ok(run(mw, { headers: { "x-api-key": "s3cret" } }).nexted);
    for (const headers of [{}, { "x-api-key": "wrong" }, { "x-api-key": "s3cret " }]) {
      const out = run(mw, { headers });
      assert.equal(out.nexted, false);
      assert.equal(out.res.statusCode, 401);
    }
  });
});

describe("cors", () => {
  const mw = cors(["http://localhost:5173"]);
  it("allows listed origins only", () => {
    const ok = run(mw, { headers: { origin: "http://localhost:5173" } });
    assert.equal(ok.res.headers["Access-Control-Allow-Origin"], "http://localhost:5173");
    const bad = run(mw, { headers: { origin: "https://evil.example" } });
    assert.equal(bad.res.headers["Access-Control-Allow-Origin"], undefined);
  });
  it("answers preflight requests for allowed origins", () => {
    const out = run(mw, { method: "OPTIONS", headers: { origin: "http://localhost:5173" } });
    assert.equal(out.res.statusCode, 204);
    assert.equal(out.nexted, false);
  });
});
