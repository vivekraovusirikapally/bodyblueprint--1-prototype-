import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openDatabase } from "../src/db.js";
import { createRepository } from "../src/repository.js";
import { ApiError, createService } from "../src/service.js";

const NOW = new Date(2026, 10, 20, 12, 0, 0);
const good = { heightCm: 175, weightKg: 72, age: 27, sex: "male" };
let service;
beforeEach(() => {
  service = createService(createRepository(openDatabase(":memory:")), () => NOW);
});

const status = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err}`);
    return err;
  }
  assert.fail("expected an ApiError");
};

describe("profile", () => {
  it("404 before it exists, 400 for bad data, then round-trips with defaults", () => {
    assert.equal(status(() => service.getProfile()).status, 404);
    const bad = status(() => service.putProfile({ ...good, age: 3 }));
    assert.equal(bad.status, 400);
    assert.ok(bad.details.age);
    assert.equal(status(() => service.putProfile("nope")).status, 400);
    service.putProfile(good);
    assert.deepEqual(service.getProfile(), { ...good, unit: "metric", goal: "maintain", activity: "light" });
  });
});

describe("logs", () => {
  it("validates the date: real, not in the future", () => {
    assert.equal(status(() => service.putLog("2026-02-30", { waterMl: 1 })).status, 400);
    assert.equal(status(() => service.putLog("2026-11-25", { waterMl: 1 })).status, 400);
    assert.equal(status(() => service.putLog("../etc/passwd", { waterMl: 1 })).status, 400);
    assert.equal(service.putLog("2026-11-21", { waterMl: 1 }).waterMl, 1); // tomorrow is allowed (time zones)
  });
  it("validates the body", () => {
    assert.equal(status(() => service.putLog("2026-11-20", { waterMl: "lots" })).status, 400);
    assert.equal(status(() => service.putLog("2026-11-20", {})).status, 400);
    assert.equal(status(() => service.putLog("2026-11-20", { bed: "<script>" })).status, 400);
  });
  it("lists the last 90 days by default and honours from/to", () => {
    service.putLog("2026-11-20", { waterMl: 1 });
    service.putLog("2026-11-10", { waterMl: 2 });
    service.putLog("2026-05-01", { waterMl: 3 }); // older than 90 days
    assert.deepEqual(Object.keys(service.listLogs()), ["2026-11-10", "2026-11-20"]);
    assert.deepEqual(Object.keys(service.listLogs({ from: "2026-05-01", to: "2026-11-10" })), ["2026-05-01", "2026-11-10"]);
  });
  it("rejects inverted and oversized ranges", () => {
    assert.equal(status(() => service.listLogs({ from: "2026-11-20", to: "2026-11-01" })).status, 400);
    assert.equal(status(() => service.listLogs({ from: "2024-01-01", to: "2026-11-20" })).status, 400);
    assert.equal(status(() => service.listLogs({ from: "garbage" })).status, 400);
  });
});

describe("importState (sync)", () => {
  it("stores profile and logs together", () => {
    const out = service.importState({ profile: good, logs: { "2026-11-19": { waterMl: 100 }, "2026-11-20": { sleepHours: 8 } } });
    assert.deepEqual(out, { saved: { profile: true, logs: 2 } });
    assert.equal(service.getProfile().age, 27);
    assert.equal(Object.keys(service.listLogs()).length, 2);
  });
  it("writes nothing when any part is invalid", () => {
    const err = status(() => service.importState({ profile: good, logs: { "2026-11-19": { waterMl: 100 }, nope: { waterMl: 1 }, "2026-11-20": { waterMl: -4 } } }));
    assert.ok(err.details["logs.nope"]);
    assert.ok(err.details["logs.2026-11-20"]);
    assert.equal(status(() => service.getProfile()).status, 404);
  });
  it("rejects wrong shapes and too many days", () => {
    assert.equal(status(() => service.importState(null)).status, 400);
    assert.equal(status(() => service.importState({ logs: [] })).status, 400);
    const many = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`2025-01-${i}`, { waterMl: 1 }]));
    assert.equal(status(() => service.importState({ logs: many })).status, 400);
  });
  it("clear empties the store", () => {
    service.importState({ profile: good });
    service.clear();
    assert.equal(status(() => service.getProfile()).status, 404);
  });
});
