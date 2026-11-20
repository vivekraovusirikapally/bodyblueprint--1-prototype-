// Small, dependency-free date and time helpers shared by the UI and the API.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Format a Date as a local "YYYY-MM-DD" key. */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const todayKey = () => dateKey(new Date());

/** The date `n` days before `from` (local time, DST safe). */
export function daysBefore(n, from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() - n);
}

/** True only for real calendar dates written as YYYY-MM-DD (rejects 2026-02-30, "abc", etc.). */
export function isValidDateKey(value) {
  if (typeof value !== "string") return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 2000 || y > 2100) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** True for a 24-hour "HH:MM" string. */
export const isValidTime = (value) => typeof value === "string" && TIME_RE.test(value);

/**
 * Minutes between bedtime and wake time, handling sleep that crosses midnight.
 * Returns 0 when either time is missing/invalid or when both are identical.
 */
export function minutesBetween(bed, wake) {
  if (!isValidTime(bed) || !isValidTime(wake)) return 0;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  const diff = wh * 60 + wm - (bh * 60 + bm);
  if (diff === 0) return 0;
  return diff < 0 ? diff + 24 * 60 : diff;
}
