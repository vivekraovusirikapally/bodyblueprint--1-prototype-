import { describe, expect, it } from "vitest";
import {
  bmiSubScore, buildAdvice, calcBmi, calcBmr, calorieTarget, calorieTargetDetail, healthyWeightRange, kgToLbs, lbsToKg,
  macroTargets, scoreLabel, sleepHoursBetween, sleepSubScore, waterGoal, waterSubScore, wellnessScore, whoCategory,
} from "../health.js";

describe("BMI", () => {
  it("calculates weight / height^2", () => {
    expect(calcBmi(72, 175)).toBeCloseTo(23.51, 2);
    expect(calcBmi(100, 200)).toBe(25);
  });
  it.each([[0, 175], [72, 0], [NaN, 175], [72, undefined], [-1, 170]])("returns 0 for invalid input (%j, %j)", (w, h) => {
    expect(calcBmi(w, h)).toBe(0);
  });
  it("classifies using WHO bands, including the exact boundaries", () => {
    expect(whoCategory(18.4).label).toBe("Underweight");
    expect(whoCategory(18.5).label).toBe("Normal");
    expect(whoCategory(24.99).label).toBe("Normal");
    expect(whoCategory(25).label).toBe("Overweight");
    expect(whoCategory(29.9).label).toBe("Overweight");
    expect(whoCategory(30).label).toBe("Obese");
    expect(whoCategory(0).label).toBe("Unknown");
  });
  it("healthyWeightRange matches the normal BMI band", () => {
    const r = healthyWeightRange(175);
    expect(r.minKg).toBeCloseTo(56.7, 1);
    expect(r.maxKg).toBeCloseTo(76.3, 1);
    expect(healthyWeightRange(0)).toBeNull();
  });
});

describe("BMR (Mifflin-St Jeor)", () => {
  it("matches hand-calculated values for both sexes", () => {
    expect(calcBmr({ weightKg: 72, heightCm: 175, age: 27, sex: "male" })).toBeCloseTo(1683.75, 2);
    expect(calcBmr({ weightKg: 60, heightCm: 165, age: 30, sex: "female" })).toBeCloseTo(1320.25, 2);
  });
  it("returns 0 for missing data", () => {
    expect(calcBmr({})).toBe(0);
    expect(calcBmr()).toBe(0);
  });
});

describe("unit conversion", () => {
  it("round-trips", () => {
    expect(kgToLbs(lbsToKg(160))).toBeCloseTo(160, 10);
    expect(lbsToKg(2.20462)).toBeCloseTo(1, 3);
  });
});

describe("water", () => {
  it("goal is 35 ml/kg rounded to the nearest 50", () => {
    expect(waterGoal(72)).toBe(2500);
    expect(waterGoal(60)).toBe(2100);
    expect(waterGoal(0)).toBe(0);
    expect(waterGoal(NaN)).toBe(0);
  });
  it("sub-score is proportional and capped at 100", () => {
    expect(waterSubScore(1250, 2500)).toBe(50);
    expect(waterSubScore(5000, 2500)).toBe(100);
    expect(waterSubScore(100, 0)).toBe(0);
  });
});

describe("sleep", () => {
  it("handles sleep that crosses midnight", () => {
    expect(sleepHoursBetween("23:00", "06:30")).toBe(7.5);
    expect(sleepHoursBetween("22:15", "05:45")).toBe(7.5);
  });
  it("handles same-day naps and bad input", () => {
    expect(sleepHoursBetween("13:00", "14:30")).toBe(1.5);
    expect(sleepHoursBetween("07:00", "07:00")).toBe(0);
    expect(sleepHoursBetween("", "07:00")).toBe(0);
  });
  it("sub-score: 100 for 7-9 h, scaled below, penalised above", () => {
    expect(sleepSubScore(7)).toBe(100);
    expect(sleepSubScore(9)).toBe(100);
    expect(sleepSubScore(3.5)).toBe(50);
    expect(sleepSubScore(10)).toBe(85);
    expect(sleepSubScore(0)).toBe(0);
    expect(sleepSubScore(24)).toBe(0);
  });
});

describe("wellness score", () => {
  it("bmi sub-score is 100 in the normal band and drops 10 per unit outside", () => {
    expect(bmiSubScore(22)).toBe(100);
    expect(bmiSubScore(17.5)).toBe(90);
    expect(bmiSubScore(34.9)).toBe(0);
    expect(bmiSubScore(0)).toBe(0);
  });
  it("applies the 30/35/35 weights (README demo script lands in the 90s)", () => {
    const bmi = calcBmi(72, 175);
    const { total, parts } = wellnessScore({ bmi, waterMl: 2000, goalMl: waterGoal(72), sleepHours: 7.5 });
    expect(parts).toEqual({ bmi: 100, water: 80, sleep: 100 });
    expect(total).toBe(93);
  });
  it("is 0 with nothing logged and an invalid BMI", () => {
    expect(wellnessScore({ bmi: 0, waterMl: 0, goalMl: 0, sleepHours: 0 }).total).toBe(0);
  });
  it("labels bands", () => {
    expect(scoreLabel(90)).toBe("Optimal Balance");
    expect(scoreLabel(70)).toBe("Doing Well");
    expect(scoreLabel(50)).toBe("Needs Attention");
    expect(scoreLabel(49)).toBe("Low - Take It Easy");
  });
});

describe("advice engine", () => {
  const base = { bmi: 22, goalMl: 2500 };
  it("celebrates when targets are met", () => {
    expect(buildAdvice({ ...base, waterMl: 2500, sleepHours: 8 })[0].tone).toBe("good");
  });
  it("combines low sleep + low water into one warning", () => {
    const tips = buildAdvice({ ...base, waterMl: 500, sleepHours: 5 });
    expect(tips[0].text).toMatch(/Short sleep and low water/);
  });
  it("warns separately for low sleep or low water", () => {
    expect(buildAdvice({ ...base, waterMl: 2500, sleepHours: 5 })[0].text).toMatch(/Sleep deficit/);
    expect(buildAdvice({ ...base, waterMl: 1000, sleepHours: 8 })[0].text).toMatch(/40%/);
  });
  it("adds BMI and oversleep notes", () => {
    const text = buildAdvice({ bmi: 17, waterMl: 2500, goalMl: 2500, sleepHours: 10 }).map((t) => t.text).join(" ");
    expect(text).toMatch(/underweight/);
    expect(text).toMatch(/More than 9 hours/);
    expect(buildAdvice({ bmi: 31, waterMl: 2500, goalMl: 2500, sleepHours: 8 }).some((t) => /above the normal band/.test(t.text))).toBe(true);
  });
  it("prompts to log data when nothing is logged and water goal is unknown", () => {
    expect(buildAdvice({ bmi: 22, waterMl: 0, goalMl: 0, sleepHours: 0 })[0].text).toMatch(/Log your water/);
  });
  it("never divides by zero", () => {
    expect(() => buildAdvice({ bmi: 22, waterMl: 0, goalMl: 0, sleepHours: 0 })).not.toThrow();
  });
});

describe("calorie target", () => {
  const bmr = 1683.75;
  it("defaults to the light multiplier (1.375)", () => {
    expect(calorieTarget(bmr, "maintain")).toBe(2315);
    expect(calorieTarget(bmr, "cut")).toBe(1915);
    expect(calorieTarget(bmr, "bulk")).toBe(2615);
  });
  it("uses the chosen activity level", () => {
    expect(calorieTarget(bmr, "maintain", "sedentary")).toBe(2021);
    expect(calorieTarget(bmr, "maintain", "athlete")).toBe(3199);
    expect(calorieTarget(bmr, "maintain", "unknown-level")).toBe(2315);
  });
  it("never goes below a safe minimum and says so", () => {
    expect(calorieTargetDetail(1100, "cut", "sedentary", "female")).toEqual({ kcal: 1200, floored: true });
    expect(calorieTargetDetail(1100, "cut", "sedentary", "male")).toEqual({ kcal: 1500, floored: true });
    expect(calorieTargetDetail(bmr, "cut").floored).toBe(false);
  });
  it("returns 0 for an invalid BMR", () => {
    expect(calorieTarget(0)).toBe(0);
  });
  it("macro split adds up to roughly the calorie target", () => {
    const m = macroTargets(2315, 72, "maintain");
    expect(m.proteinG).toBe(115);
    const kcal = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
    expect(Math.abs(kcal - 2315)).toBeLessThan(10);
    expect(macroTargets(0, 72)).toEqual({ proteinG: 0, fatG: 0, carbsG: 0 });
  });
});
