import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../../../shared/constants.js";
import { buildSeed } from "../seed.js";
import { LEGACY_STORAGE_KEY, STORAGE_KEY, loadState, sanitizeState, saveState } from "../storage.js";
import { logsToCsv } from "../export.js";

function fakeStorage(initial = {}, { failWrites = false } = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      if (failWrites) throw new DOMException("quota", "QuotaExceededError");
      data[k] = String(v);
    },
    data,
  };
}
const seed = () => buildSeed(new Date(2026, 10, 20));

describe("sanitizeState", () => {
  it("rejects non-objects", () => {
    for (const bad of [null, "x", 5, [], undefined]) expect(sanitizeState(bad)).toBeNull();
  });
  it("keeps valid fields, repairs invalid ones with defaults and drops bad dates/entries", () => {
    const state = sanitizeState({
      profile: { heightCm: 180, weightKg: "oops", age: 500, sex: "<b>x</b>", goal: "bulk", evil: 1 },
      logs: {
        "2026-11-20": { waterMl: 500, rating: 99, bed: "<script>alert(1)</script>" },
        "not-a-date": { waterMl: 1 },
        "2026-11-19": "garbage",
        "2026-11-18": {},
      },
    });
    expect(state.profile).toEqual({ ...DEFAULT_PROFILE, heightCm: 180, goal: "bulk" });
    expect(state.logs).toEqual({ "2026-11-20": { waterMl: 500 } });
  });
  it("keeps only the newest 400 days", () => {
    const logs = {};
    for (let i = 0; i < 450; i++) logs[new Date(2025, 0, 1 + i).toISOString().slice(0, 10)] = { waterMl: 100 };
    const out = sanitizeState({ profile: {}, logs });
    expect(Object.keys(out.logs)).toHaveLength(400);
  });
});

describe("loadState / saveState", () => {
  it("falls back to the seed when nothing is stored", () => {
    const { state, error } = loadState(seed, fakeStorage());
    expect(state.profile).toEqual(DEFAULT_PROFILE);
    expect(Object.keys(state.logs)).toHaveLength(14);
    expect(error).toBeNull();
  });
  it("round-trips saved data", () => {
    const storage = fakeStorage();
    const state = { profile: { ...DEFAULT_PROFILE, goal: "cut" }, logs: { "2026-11-20": { waterMl: 750 } } };
    expect(saveState(state, storage)).toEqual({ ok: true });
    expect(loadState(seed, storage).state).toEqual(state);
  });
  it("recovers from corrupted JSON with a message instead of crashing", () => {
    const { state, error } = loadState(seed, fakeStorage({ [STORAGE_KEY]: "{not json" }));
    expect(Object.keys(state.logs)).toHaveLength(14);
    expect(error).toMatch(/could not be read/);
  });
  it("recovers from valid JSON of the wrong shape", () => {
    expect(loadState(seed, fakeStorage({ [STORAGE_KEY]: "[1,2,3]" })).error).toMatch(/unexpected format/);
  });
  it("migrates the legacy v1 data (no activity field)", () => {
    const v1 = { profile: { heightCm: 170, weightKg: 65, age: 30, sex: "female", unit: "metric", goal: "maintain" }, logs: { "2026-11-20": { waterMl: 900 } } };
    const { state } = loadState(seed, fakeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(v1) }));
    expect(state.profile).toMatchObject({ heightCm: 170, sex: "female", activity: "light" });
    expect(state.logs["2026-11-20"].waterMl).toBe(900);
  });
  it("saveState reports quota/private-mode failures instead of throwing", () => {
    const r = saveState({ profile: {}, logs: {} }, fakeStorage({}, { failWrites: true }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/blocked saving/);
  });
  it("works when storage is unavailable", () => {
    expect(loadState(seed, undefined).state.profile).toEqual(DEFAULT_PROFILE);
  });
});

describe("CSV export", () => {
  it("writes a header and one sorted row per day", () => {
    const csv = logsToCsv({ "2026-11-20": { waterMl: 500, sleepHours: 7.5, rating: 4, weightKg: 72, bed: "23:00", wake: "06:30" }, "2026-11-19": { waterMl: 100 } });
    expect(csv.split("\n")).toEqual([
      "date,water_ml,sleep_hours,sleep_rating,weight_kg,bedtime,wake_time",
      "2026-11-19,100,,,,,",
      "2026-11-20,500,7.5,4,72,23:00,06:30",
      "",
    ]);
  });
  it("neutralises formulas that could have slipped into stored data", () => {
    expect(logsToCsv({ "2026-11-20": { bed: "=1+1" } })).toContain("'=1+1");
  });
});
