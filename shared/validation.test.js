import { describe, expect, it } from "vitest";
import { LIMITS } from "./constants.js";
import {
  cleanLogEntry, csvCell, escapeHtml, toNumber, validateLogEntry, validateProfile, validateProfileForm,
  validateSleepEntry, validateWaterAmount,
} from "./validation.js";

describe("toNumber", () => {
  it("accepts numbers and numeric strings", () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber(" 72.5 ")).toBe(72.5);
  });
  it.each([["", NaN], ["abc", NaN], [null, NaN], [undefined, NaN], [Infinity, NaN], [NaN, NaN], [[], NaN], ["1e999", NaN]])(
    "rejects %j",
    (input) => expect(toNumber(input)).toBeNaN(),
  );
});

describe("validateProfile", () => {
  const good = { heightCm: 175, weightKg: 72, age: 27, sex: "male" };

  it("accepts a valid profile and fills optional defaults", () => {
    const r = validateProfile(good);
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({ ...good, unit: "metric", goal: "maintain", activity: "light" });
  });
  it("reports every missing required field", () => {
    expect(Object.keys(validateProfile({}).errors).sort()).toEqual(["age", "heightCm", "sex", "weightKg"]);
  });
  it.each([
    ["heightCm", LIMITS.heightCm.min - 1], ["heightCm", LIMITS.heightCm.max + 1], ["weightKg", 0], ["weightKg", -5],
    ["age", 9], ["age", 101], ["age", 27.5], ["sex", "robot"], ["unit", "stones"], ["goal", "shred"], ["activity", "couch"],
  ])("rejects %s = %j", (key, value) => {
    expect(validateProfile({ ...good, [key]: value }).errors[key]).toBeTruthy();
  });
  it("accepts numeric strings (form input) and rounds weight to 0.1", () => {
    expect(validateProfile({ ...good, weightKg: "72.46" }).value.weightKg).toBe(72.5);
  });
  it("drops unknown keys (allow-list)", () => {
    expect(validateProfile({ ...good, isAdmin: true, __proto__: { x: 1 } }).value).not.toHaveProperty("isAdmin");
  });
  it("rejects non-objects", () => {
    for (const bad of [null, "x", 5, [], undefined]) expect(validateProfile(bad).valid).toBe(false);
  });
  it("partial mode only checks supplied fields", () => {
    expect(validateProfile({ goal: "cut" }, { partial: true })).toMatchObject({ valid: true, value: { goal: "cut" } });
    expect(validateProfile({ goal: "nope" }, { partial: true }).valid).toBe(false);
  });
});

describe("validateProfileForm", () => {
  it("converts imperial input to metric", () => {
    const r = validateProfileForm({ height: "68.9", weight: "158.7", age: "27", sex: "male" }, "imperial");
    expect(r.valid).toBe(true);
    expect(r.value.heightCm).toBeCloseTo(175, 0);
    expect(r.value.weightKg).toBeCloseTo(72, 0);
  });
  it("writes error messages in the user's unit", () => {
    const r = validateProfileForm({ height: "5", weight: "5", age: "27", sex: "male" }, "imperial");
    expect(r.errors.height).toMatch(/in\.$/);
    expect(r.errors.weight).toMatch(/lbs\.$/);
  });
  it("flags empty and non-numeric fields", () => {
    const r = validateProfileForm({ height: "", weight: "abc", age: "", sex: "male" });
    expect(Object.keys(r.errors).sort()).toEqual(["age", "height", "weight"]);
  });
});

describe("validateWaterAmount", () => {
  it("accepts 1..2000 whole ml", () => {
    expect(validateWaterAmount("250")).toMatchObject({ valid: true, value: 250 });
  });
  it.each(["", "0", "-5", "2001", "12.5", "abc"])("rejects %j", (v) => expect(validateWaterAmount(v).valid).toBe(false));
});

describe("validateSleepEntry", () => {
  it("accepts a normal night that crosses midnight", () => {
    expect(validateSleepEntry({ bed: "23:00", wake: "06:30", rating: 4 }).value).toMatchObject({ sleepHours: 7.5, rating: 4 });
  });
  it("rejects identical times, bad times and absurdly long sleep", () => {
    expect(validateSleepEntry({ bed: "07:00", wake: "07:00" }).errors.wake).toMatch(/same/);
    expect(validateSleepEntry({ bed: "25:00", wake: "07:00" }).errors.bed).toBeTruthy();
    expect(validateSleepEntry({ bed: "", wake: "07:00" }).errors.bed).toBeTruthy();
    expect(validateSleepEntry({ bed: "23:00", wake: "22:00" }).errors.wake).toMatch(/16 hours/);
  });
  it("rejects bad ratings", () => {
    expect(validateSleepEntry({ bed: "23:00", wake: "07:00", rating: 6 }).errors.rating).toBeTruthy();
  });
});

describe("log entries", () => {
  it("validateLogEntry keeps valid fields and reports invalid ones", () => {
    expect(validateLogEntry({ waterMl: 1500, sleepHours: 7.25 }).value).toEqual({ waterMl: 1500, sleepHours: 7.3 });
    expect(validateLogEntry({ waterMl: -1 }).errors.waterMl).toBeTruthy();
    expect(validateLogEntry({ bed: "<script>" }).errors.bed).toBeTruthy();
    expect(validateLogEntry({}).errors._).toBeTruthy();
    expect(validateLogEntry("x").valid).toBe(false);
  });
  it("cleanLogEntry silently drops bad fields and unknown keys", () => {
    expect(cleanLogEntry({ waterMl: 500, rating: 99, bed: "<img onerror=x>", evil: 1 })).toEqual({ waterMl: 500 });
    expect(cleanLogEntry(null)).toEqual({});
  });
});

describe("output safety helpers", () => {
  it("escapeHtml neutralises markup", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;");
  });
  it("csvCell blocks formula injection and quotes special characters", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(undefined)).toBe("");
  });
});
