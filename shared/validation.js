// Input validation + sanitisation. Used by the forms (UI), by the localStorage loader, and by the API.
// Rule of thumb: never trust input. Everything is checked against an allow-list and coerced to a known type,
// so unexpected keys, wrong types, NaN/Infinity and out-of-range numbers never reach the rest of the app.

import { DEFAULT_PROFILE, GOALS, ACTIVITY_LEVELS, LIMITS, SEXES, UNITS } from "./constants.js";
import { cmToIn, inToCm, kgToLbs, lbsToKg } from "./units.js";
import { isValidTime, minutesBetween } from "./time.js";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Convert user input to a finite number, or NaN. Accepts numbers and numeric strings only. */
export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Check one numeric field. Returns { ok, value } or { ok:false, error }. */
function checkNumber(raw, { label, min, max, integer = false, unit = "" }) {
  const n = toNumber(raw);
  const suffix = unit ? ` ${unit}` : "";
  if (Number.isNaN(n)) return { ok: false, error: `${label} is required and must be a number.` };
  if (integer && !Number.isInteger(n)) return { ok: false, error: `${label} must be a whole number.` };
  if (n < min || n > max) return { ok: false, error: `${label} must be between ${min} and ${max}${suffix}.` };
  return { ok: true, value: n };
}

function checkEnum(raw, allowed, label) {
  return allowed.includes(raw) ? { ok: true, value: raw } : { ok: false, error: `${label} must be one of: ${allowed.join(", ")}.` };
}

const result = (errors, value) => ({ valid: Object.keys(errors).length === 0, errors, value });

// ---------------------------------------------------------------- profile

const PROFILE_FIELDS = {
  heightCm: (v) => checkNumber(v, { label: "Height", ...LIMITS.heightCm, unit: "cm" }),
  weightKg: (v) => checkNumber(v, { label: "Weight", ...LIMITS.weightKg, unit: "kg" }),
  age: (v) => checkNumber(v, { label: "Age", ...LIMITS.age, integer: true, unit: "years" }),
  sex: (v) => checkEnum(v, SEXES, "Sex"),
  unit: (v) => checkEnum(v, UNITS, "Unit"),
  goal: (v) => checkEnum(v, GOALS, "Goal"),
  activity: (v) => checkEnum(v, Object.keys(ACTIVITY_LEVELS), "Activity level"),
};
const REQUIRED_PROFILE_FIELDS = ["heightCm", "weightKg", "age", "sex"];

/**
 * Validate a profile (metric values).
 * - full mode (default): required fields must be present, optional ones fall back to defaults.
 * - partial mode: only the supplied fields are checked and returned.
 * Unknown keys are dropped.
 */
export function validateProfile(input, { partial = false } = {}) {
  if (!isPlainObject(input)) return result({ _: "Profile must be a JSON object." }, {});
  const errors = {};
  const value = {};
  for (const [key, check] of Object.entries(PROFILE_FIELDS)) {
    const supplied = input[key] !== undefined;
    if (!supplied) {
      if (!partial && REQUIRED_PROFILE_FIELDS.includes(key)) errors[key] = `${key} is required.`;
      else if (!partial) value[key] = DEFAULT_PROFILE[key];
      continue;
    }
    const r = check(input[key]);
    if (r.ok) value[key] = key === "heightCm" || key === "weightKg" ? round1(r.value) : r.value;
    else errors[key] = r.error;
  }
  return result(errors, value);
}

const formatRange = (limit, convert, unit) => `${Math.ceil(convert(limit.min))} and ${Math.floor(convert(limit.max))} ${unit}`;

/**
 * Validate the Body form as typed by the user (display units). Returns the metric profile fields in `value`
 * and error messages written in the user's unit, keyed by form field name (height, weight, age, sex).
 */
export function validateProfileForm(form, unit = "metric") {
  const imperial = unit === "imperial";
  const errors = {};
  const value = {};

  const height = toNumber(form?.height);
  const heightCm = imperial ? inToCm(height) : height;
  if (Number.isNaN(height)) errors.height = "Height is required and must be a number.";
  else if (heightCm < LIMITS.heightCm.min - 1e-9 || heightCm > LIMITS.heightCm.max + 1e-9) {
    errors.height = `Height must be between ${imperial ? formatRange(LIMITS.heightCm, cmToIn, "in") : `${LIMITS.heightCm.min} and ${LIMITS.heightCm.max} cm`}.`;
  } else value.heightCm = round1(heightCm);

  const weight = toNumber(form?.weight);
  const weightKg = imperial ? lbsToKg(weight) : weight;
  if (Number.isNaN(weight)) errors.weight = "Weight is required and must be a number.";
  else if (weightKg < LIMITS.weightKg.min - 1e-9 || weightKg > LIMITS.weightKg.max + 1e-9) {
    errors.weight = `Weight must be between ${imperial ? formatRange(LIMITS.weightKg, kgToLbs, "lbs") : `${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg`}.`;
  } else value.weightKg = round1(weightKg);

  const age = checkNumber(form?.age, { label: "Age", ...LIMITS.age, integer: true, unit: "years" });
  if (age.ok) value.age = age.value;
  else errors.age = age.error;

  const sex = checkEnum(form?.sex, SEXES, "Sex");
  if (sex.ok) value.sex = sex.value;
  else errors.sex = sex.error;

  return result(errors, value);
}

// ---------------------------------------------------------------- water

/** Validate one water addition (ml). */
export function validateWaterAmount(raw) {
  const r = checkNumber(raw, { label: "Amount", ...LIMITS.waterStepMl, integer: true, unit: "ml" });
  return r.ok ? result({}, r.value) : result({ amount: r.error }, null);
}

// ---------------------------------------------------------------- sleep

/** Validate the sleep form: bedtime, wake time and rating. */
export function validateSleepEntry({ bed, wake, rating } = {}) {
  const errors = {};
  if (!isValidTime(bed)) errors.bed = "Enter a valid bedtime.";
  if (!isValidTime(wake)) errors.wake = "Enter a valid wake time.";
  if (!errors.bed && !errors.wake) {
    const mins = minutesBetween(bed, wake);
    if (mins === 0) errors.wake = "Bedtime and wake time cannot be the same.";
    else if (mins > LIMITS.maxSleepSpanHours * 60) {
      errors.wake = `That is more than ${LIMITS.maxSleepSpanHours} hours of sleep. Please double-check the times.`;
    }
  }
  const r = checkNumber(rating ?? 0, { label: "Rating", ...LIMITS.rating, integer: true });
  if (!r.ok) errors.rating = r.error;
  return result(errors, errors.bed || errors.wake || errors.rating ? null : { bed, wake, rating: r.value, sleepHours: round1(minutesBetween(bed, wake) / 60) });
}

// ---------------------------------------------------------------- day log

const timeOrEmpty = (label) => (v) =>
  v === "" || isValidTime(v) ? { ok: true, value: v } : { ok: false, error: `${label} must be HH:MM (24-hour) or empty.` };

const LOG_FIELDS = {
  waterMl: (v) => checkNumber(v, { label: "waterMl", ...LIMITS.waterMl, integer: true, unit: "ml" }),
  sleepHours: (v) => checkNumber(v, { label: "sleepHours", ...LIMITS.sleepHours, unit: "hours" }),
  rating: (v) => checkNumber(v, { label: "rating", ...LIMITS.rating, integer: true }),
  weightKg: (v) => checkNumber(v, { label: "weightKg", ...LIMITS.weightKg, unit: "kg" }),
  bed: timeOrEmpty("bed"),
  wake: timeOrEmpty("wake"),
};

/** Strict validation of one day's log (used by the API). Unknown keys are ignored. */
export function validateLogEntry(input) {
  if (!isPlainObject(input)) return result({ _: "Log entry must be a JSON object." }, {});
  const errors = {};
  const value = {};
  for (const [key, check] of Object.entries(LOG_FIELDS)) {
    if (input[key] === undefined) continue;
    const r = check(input[key]);
    if (r.ok) value[key] = key === "sleepHours" || key === "weightKg" ? round1(r.value) : r.value;
    else errors[key] = r.error;
  }
  if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) errors._ = "No valid fields supplied.";
  return result(errors, value);
}

/** Lenient version: keep every valid field and silently drop the rest (used when loading saved data). */
export function cleanLogEntry(input) {
  if (!isPlainObject(input)) return {};
  const out = {};
  for (const [key, check] of Object.entries(LOG_FIELDS)) {
    if (input[key] === undefined) continue;
    const r = check(input[key]);
    if (r.ok) out[key] = key === "sleepHours" || key === "weightKg" ? round1(r.value) : r.value;
  }
  return out;
}

// ---------------------------------------------------------------- output safety

/** Escape text for safe insertion into HTML (defence in depth; React already escapes by default). */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Make a value safe for a CSV cell: neutralise spreadsheet formulas and quote when needed. */
export function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
