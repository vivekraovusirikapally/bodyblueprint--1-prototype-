// Derived statistics for the Trends tab: averages, streaks and weight change.
// Every function takes `today` as a parameter so it is deterministic and easy to test.

import { dateKey, daysBefore } from "../../shared/time.js";
import { waterSubScore } from "./health.js";

const MAX_STREAK_LOOKBACK = 365;

/** Date keys for the last `n` days (oldest first, ending today). */
export function lastDays(n, today = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(dateKey(daysBefore(i, today)));
  return keys;
}

const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

/** Average sleep (h), water (ml) and weight (kg) over the last `n` days, ignoring days without data. */
export function averages(logs, n = 7, today = new Date()) {
  const days = lastDays(n, today).map((k) => logs[k]).filter(Boolean);
  const pick = (field) => days.map((d) => d[field]).filter((v) => Number.isFinite(v) && v > 0);
  return {
    daysLogged: days.filter((d) => d.waterMl > 0 || d.sleepHours > 0).length,
    sleepHours: round1(avg(pick("sleepHours"))),
    waterMl: avg(pick("waterMl")) === null ? null : Math.round(avg(pick("waterMl"))),
    weightKg: round1(avg(pick("weightKg"))),
  };
}

/** Count consecutive days (ending today, or yesterday if today is still empty) that satisfy `qualifies`. */
function streak(logs, qualifies, today) {
  let count = 0;
  for (let i = 0; i < MAX_STREAK_LOOKBACK; i++) {
    const entry = logs[dateKey(daysBefore(i, today))];
    if (entry && qualifies(entry)) count++;
    else if (i === 0) continue; // today may simply not be logged yet; do not break the streak
    else break;
  }
  return count;
}

/** Days in a row with any water or sleep logged. */
export const loggingStreak = (logs, today = new Date()) => streak(logs, (e) => e.waterMl > 0 || e.sleepHours > 0, today);

/** Days in a row where water intake reached the daily goal. */
export const hydrationStreak = (logs, goalMl, today = new Date()) =>
  streak(logs, (e) => waterSubScore(e.waterMl, goalMl) >= 100, today);

/** Weight change across the last `n` days (first vs last logged weight). Null if fewer than two weigh-ins. */
export function weightChange(logs, n = 7, today = new Date()) {
  const weights = lastDays(n, today).map((k) => logs[k]?.weightKg).filter((w) => Number.isFinite(w) && w > 0);
  if (weights.length < 2) return null;
  const from = weights[0];
  const to = weights[weights.length - 1];
  return { from, to, delta: Math.round((to - from) * 10) / 10 };
}
