import sample from "../data/sample.json";
import { DEFAULT_PROFILE } from "../../shared/constants.js";
import { dateKey, daysBefore } from "../../shared/time.js";

/** First launch / reset: the last 14 days filled in with the sample student data. */
export function buildSeed(today = new Date()) {
  const logs = {};
  sample.forEach((row) => {
    logs[dateKey(daysBefore(row.daysAgo, today))] = {
      waterMl: row.waterMl,
      sleepHours: row.sleepHours,
      rating: row.rating,
      weightKg: row.weightKg,
    };
  });
  return { profile: { ...DEFAULT_PROFILE }, logs };
}
