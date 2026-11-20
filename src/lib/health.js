// All the maths lives here so the components stay small and every formula can be unit-tested.
// Everything is stored in metric (kg, cm, ml). Imperial is only for display.

import {
  ACTIVITY_LEVELS,
  BMI_BANDS,
  MIN_CALORIES,
  SCORE_WEIGHTS,
  SLEEP_TARGET,
  WATER_ML_PER_KG,
} from "../../shared/constants.js";
import { minutesBetween } from "../../shared/time.js";

export { KG_PER_LB, CM_PER_IN, lbsToKg, kgToLbs, inToCm, cmToIn } from "../../shared/units.js";
export { dateKey, todayKey } from "../../shared/time.js";

const isPositive = (n) => Number.isFinite(n) && n > 0;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Body Mass Index = kg / m^2. Returns 0 when the inputs are missing or invalid. */
export function calcBmi(weightKg, heightCm) {
  if (!isPositive(weightKg) || !isPositive(heightCm)) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Basal metabolic rate (kcal/day), Mifflin-St Jeor. Returns 0 for invalid inputs. */
export function calcBmr({ weightKg, heightCm, age, sex } = {}) {
  if (!isPositive(weightKg) || !isPositive(heightCm) || !isPositive(age)) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "female" ? base - 161 : base + 5;
}

/** WHO adult BMI category with a display colour. */
export function whoCategory(bmi) {
  if (!isPositive(bmi)) return { label: "Unknown", color: "#9ca3af" };
  if (bmi < BMI_BANDS.underweightBelow) return { label: "Underweight", color: "#3b82f6" };
  if (bmi < BMI_BANDS.overweightBelow) return { label: "Normal", color: "#22c55e" };
  if (bmi < BMI_BANDS.obeseFrom) return { label: "Overweight", color: "#f59e0b" };
  return { label: "Obese", color: "#ef4444" };
}

/** The weight range (kg) that keeps BMI inside the WHO "normal" band for a given height. */
export function healthyWeightRange(heightCm) {
  if (!isPositive(heightCm)) return null;
  const m2 = (heightCm / 100) ** 2;
  return {
    minKg: Math.round(BMI_BANDS.underweightBelow * m2 * 10) / 10,
    maxKg: Math.round(BMI_BANDS.normalMax * m2 * 10) / 10,
  };
}

/** Daily water goal: about 35 ml per kg, rounded to the nearest 50 ml. */
export function waterGoal(weightKg) {
  if (!isPositive(weightKg)) return 0;
  return Math.round((weightKg * WATER_ML_PER_KG) / 50) * 50;
}

/** Hours slept between "HH:MM" bedtime and wake time (handles past midnight). 0 if invalid. */
export function sleepHoursBetween(bed, wake) {
  return Math.round((minutesBetween(bed, wake) / 60) * 10) / 10;
}

// ---- sub-scores: each metric becomes 0-100 by how far it is from its target

export function bmiSubScore(bmi) {
  if (!isPositive(bmi)) return 0;
  if (bmi >= BMI_BANDS.underweightBelow && bmi <= BMI_BANDS.normalMax) return 100;
  const distance = bmi < BMI_BANDS.underweightBelow ? BMI_BANDS.underweightBelow - bmi : bmi - BMI_BANDS.normalMax;
  return clamp(100 - distance * 10);
}

export function waterSubScore(ml, goal) {
  if (!isPositive(goal) || !Number.isFinite(ml)) return 0;
  return clamp((ml / goal) * 100);
}

export function sleepSubScore(hours) {
  if (!isPositive(hours)) return 0;
  if (hours >= SLEEP_TARGET.min && hours <= SLEEP_TARGET.max) return 100;
  if (hours < SLEEP_TARGET.min) return clamp((hours / SLEEP_TARGET.min) * 100);
  return clamp(100 - (hours - SLEEP_TARGET.max) * 15); // oversleeping costs a bit too
}

/** Weighted wellness score (BMI 30%, hydration 35%, sleep 35%) plus the three sub-scores. */
export function wellnessScore({ bmi, waterMl, goalMl, sleepHours }) {
  const parts = {
    bmi: bmiSubScore(bmi),
    water: waterSubScore(waterMl, goalMl),
    sleep: sleepSubScore(sleepHours),
  };
  const total = Math.round(parts.bmi * SCORE_WEIGHTS.bmi + parts.water * SCORE_WEIGHTS.water + parts.sleep * SCORE_WEIGHTS.sleep);
  return { total, parts };
}

export function scoreLabel(score) {
  if (score >= 85) return "Optimal Balance";
  if (score >= 70) return "Doing Well";
  if (score >= 50) return "Needs Attention";
  return "Low - Take It Easy";
}

/** Rule based advice. First rules look at combinations, then single metrics. */
export function buildAdvice({ bmi, waterMl, goalMl, sleepHours }) {
  const tips = [];
  const waterLow = waterMl < goalMl * 0.75;
  const sleepLow = sleepHours > 0 && sleepHours < SLEEP_TARGET.min;
  const category = whoCategory(bmi).label;

  if (sleepLow && waterLow) {
    tips.push({ tone: "warn", text: "Short sleep and low water together can leave you drained. Rest earlier tonight and sip water steadily through the day." });
  } else if (sleepLow) {
    tips.push({ tone: "warn", text: "Sleep deficit detected: increase water intake to offset fatigue, and aim for 7-9 hours tonight." });
  } else if (waterLow) {
    const pct = goalMl > 0 ? Math.round((waterMl / goalMl) * 100) : 0;
    tips.push({ tone: "warn", text: `You are at ${pct}% of your water goal. A glass now and one with each meal gets you close.` });
  }
  if (sleepHours > SLEEP_TARGET.max) {
    tips.push({ tone: "info", text: "More than 9 hours of sleep is a lot. If you often feel groggy anyway, a consistent wake time can help." });
  }
  if (category === "Underweight") {
    tips.push({ tone: "info", text: "Your BMI is in the underweight band. Regular balanced meals with enough protein are a good general starting point." });
  } else if (category === "Overweight" || category === "Obese") {
    tips.push({ tone: "info", text: "Your BMI is above the normal band. Short daily walks and good sleep both support healthy weight management." });
  }
  if (!waterLow && !sleepLow && sleepHours > 0) {
    tips.push({ tone: "good", text: "Hydration and sleep targets met! Maintain physical activity to match BMR baseline." });
  }
  if (tips.length === 0) {
    tips.push({ tone: "info", text: "Log your water and sleep for today to get personalised tips." });
  }
  return tips;
}

/**
 * Daily calorie target: BMR x activity multiplier, minus 400 to cut or plus 300 to bulk.
 * The result is never lower than a safe minimum, and `floored` says when that safety net kicked in.
 */
export function calorieTargetDetail(bmr, goal = "maintain", activity = "light", sex = "male") {
  if (!isPositive(bmr)) return { kcal: 0, floored: false };
  const multiplier = (ACTIVITY_LEVELS[activity] ?? ACTIVITY_LEVELS.light).multiplier;
  const maintain = bmr * multiplier;
  const raw = goal === "cut" ? maintain - 400 : goal === "bulk" ? maintain + 300 : maintain;
  const floor = MIN_CALORIES[sex] ?? MIN_CALORIES.female;
  const kcal = Math.round(Math.max(raw, floor));
  return { kcal, floored: raw < floor };
}

export const calorieTarget = (...args) => calorieTargetDetail(...args).kcal;

/** Simple starting-point macro split: protein by body weight, fat 25% of calories, carbs the rest. */
export function macroTargets(kcal, weightKg, goal = "maintain") {
  if (!isPositive(kcal) || !isPositive(weightKg)) return { proteinG: 0, fatG: 0, carbsG: 0 };
  const proteinG = Math.round(weightKg * (goal === "cut" ? 2.0 : 1.6));
  const fatG = Math.round((kcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}
