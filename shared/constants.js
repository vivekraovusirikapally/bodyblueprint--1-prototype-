// Single source of truth for limits and defaults.
// Imported by BOTH the React front end and the Express back end so the two tiers can never disagree.

export const SCHEMA_VERSION = 2;

export const LIMITS = Object.freeze({
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 20, max: 400 },
  age: { min: 10, max: 100 },
  waterMl: { min: 0, max: 10000 },
  waterStepMl: { min: 1, max: 2000 },
  sleepHours: { min: 0, max: 24 },
  rating: { min: 0, max: 5 },
  /** A bedtime/wake pair longer than this is almost certainly a typo (e.g. 23:00 -> 22:00). */
  maxSleepSpanHours: 16,
  /** Maximum number of day-logs accepted/kept (about 13 months). */
  maxLogDays: 400,
});

export const SEXES = Object.freeze(["male", "female"]);
export const UNITS = Object.freeze(["metric", "imperial"]);
export const GOALS = Object.freeze(["cut", "maintain", "bulk"]);

export const ACTIVITY_LEVELS = Object.freeze({
  sedentary: { label: "Sedentary (desk job, little exercise)", multiplier: 1.2 },
  light: { label: "Light (1-3 workouts a week)", multiplier: 1.375 },
  moderate: { label: "Moderate (3-5 workouts a week)", multiplier: 1.55 },
  active: { label: "Active (6-7 workouts a week)", multiplier: 1.725 },
  athlete: { label: "Very active (physical job or 2x training)", multiplier: 1.9 },
});

export const DEFAULT_PROFILE = Object.freeze({
  heightCm: 175,
  weightKg: 72,
  age: 27,
  sex: "male",
  unit: "metric",
  goal: "maintain",
  activity: "light",
});

// Wellness score weights from the brief: BMI 30%, hydration 35%, sleep 35%.
export const SCORE_WEIGHTS = Object.freeze({ bmi: 0.3, water: 0.35, sleep: 0.35 });

// WHO adult BMI bands.
export const BMI_BANDS = Object.freeze({ underweightBelow: 18.5, normalMax: 24.9, overweightBelow: 25, obeseFrom: 30 });

export const SLEEP_TARGET = Object.freeze({ min: 7, max: 9 });
export const WATER_ML_PER_KG = 35;

/** Never recommend a calorie target below these (common safe minimums for unsupervised dieting). */
export const MIN_CALORIES = Object.freeze({ male: 1500, female: 1200 });
