import { describe, expect, it } from "vitest";
import { dateKey, daysBefore, isValidDateKey, isValidTime, minutesBetween } from "./time.js";

describe("dates", () => {
  it("formats local date keys with zero padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("daysBefore crosses month and year boundaries", () => {
    expect(dateKey(daysBefore(1, new Date(2026, 0, 1)))).toBe("2025-12-31");
    expect(dateKey(daysBefore(0, new Date(2026, 5, 15)))).toBe("2026-06-15");
  });
  it.each(["2026-02-28", "2024-02-29"])("accepts %s", (d) => expect(isValidDateKey(d)).toBe(true));
  it.each(["2026-02-30", "2026-13-01", "26-01-01", "2026-1-1", "abc", "", null, 20260101, "1999-12-31"])(
    "rejects %j",
    (d) => expect(isValidDateKey(d)).toBe(false),
  );
});

describe("times", () => {
  it("validates HH:MM", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    for (const t of ["24:00", "7:30", "12:60", "", null, "12:30:00"]) expect(isValidTime(t)).toBe(false);
  });
  it("minutesBetween handles midnight and identical times", () => {
    expect(minutesBetween("23:00", "06:30")).toBe(450);
    expect(minutesBetween("22:00", "23:00")).toBe(60);
    expect(minutesBetween("07:00", "07:00")).toBe(0);
    expect(minutesBetween("", "07:00")).toBe(0);
  });
});
