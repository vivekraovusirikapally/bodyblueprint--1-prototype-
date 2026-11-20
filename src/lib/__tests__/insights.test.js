import { describe, expect, it } from "vitest";
import { averages, hydrationStreak, lastDays, loggingStreak, weightChange } from "../insights.js";

const TODAY = new Date(2026, 10, 20); // 20 Nov 2026

describe("lastDays", () => {
  it("returns n keys, oldest first, ending today", () => {
    const days = lastDays(3, TODAY);
    expect(days).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
  });
});

describe("averages", () => {
  const logs = {
    "2026-11-20": { waterMl: 2000, sleepHours: 8, weightKg: 70 },
    "2026-11-19": { waterMl: 1000, sleepHours: 6, weightKg: 71 },
    "2026-11-01": { waterMl: 9999, sleepHours: 1, weightKg: 99 }, // outside the window
  };
  it("averages only days inside the window and ignores missing values", () => {
    expect(averages(logs, 7, TODAY)).toEqual({ daysLogged: 2, sleepHours: 7, waterMl: 1500, weightKg: 70.5 });
  });
  it("returns nulls when there is no data", () => {
    expect(averages({}, 7, TODAY)).toEqual({ daysLogged: 0, sleepHours: null, waterMl: null, weightKg: null });
  });
});

describe("streaks", () => {
  it("counts consecutive logged days ending today", () => {
    const logs = { "2026-11-20": { waterMl: 1 }, "2026-11-19": { sleepHours: 7 }, "2026-11-18": { waterMl: 5 }, "2026-11-16": { waterMl: 5 } };
    expect(loggingStreak(logs, TODAY)).toBe(3);
  });
  it("does not break the streak when today is not logged yet", () => {
    const logs = { "2026-11-19": { waterMl: 1 }, "2026-11-18": { waterMl: 1 } };
    expect(loggingStreak(logs, TODAY)).toBe(2);
  });
  it("is 0 with no logs and stops at the first gap", () => {
    expect(loggingStreak({}, TODAY)).toBe(0);
    expect(loggingStreak({ "2026-11-20": { waterMl: 1 }, "2026-11-18": { waterMl: 1 } }, TODAY)).toBe(1);
  });
  it("hydration streak needs the full goal", () => {
    const logs = { "2026-11-20": { waterMl: 2500 }, "2026-11-19": { waterMl: 2499 } };
    expect(hydrationStreak(logs, 2500, TODAY)).toBe(1);
  });
});

describe("weightChange", () => {
  it("compares first and last weigh-in in the window", () => {
    const logs = { "2026-11-14": { weightKg: 72 }, "2026-11-17": { weightKg: 71.5 }, "2026-11-20": { weightKg: 71 } };
    expect(weightChange(logs, 7, TODAY)).toEqual({ from: 72, to: 71, delta: -1 });
  });
  it("needs at least two weigh-ins", () => {
    expect(weightChange({ "2026-11-20": { weightKg: 71 } }, 7, TODAY)).toBeNull();
    expect(weightChange({}, 7, TODAY)).toBeNull();
  });
});
