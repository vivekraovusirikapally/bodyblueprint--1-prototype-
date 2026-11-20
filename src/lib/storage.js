// Saving and loading app state from localStorage.
// Loading never trusts what it reads: the data is validated and cleaned, so a corrupted or hand-edited
// value cannot crash the app or inject unexpected content.

import { DEFAULT_PROFILE, LIMITS } from "../../shared/constants.js";
import { isValidDateKey } from "../../shared/time.js";
import { cleanLogEntry, validateProfile } from "../../shared/validation.js";

export const STORAGE_KEY = "bodyblueprint:v2";
export const LEGACY_STORAGE_KEY = "bodyblueprint:v1";

/** Turn any value into a valid { profile, logs } state, or null if it is not even an object. */
export function sanitizeState(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

  // Profile: keep every valid field, fall back to the default for the rest.
  const checked = validateProfile(raw.profile ?? {}, { partial: true });
  const profile = { ...DEFAULT_PROFILE };
  for (const key of Object.keys(checked.value)) profile[key] = checked.value[key];
  // Invalid fields are reported in `checked.errors` and are simply absent from `checked.value`.

  // Logs: keep valid dates, clean each entry, then keep only the newest N days.
  const logs = {};
  const source = raw.logs && typeof raw.logs === "object" && !Array.isArray(raw.logs) ? raw.logs : {};
  for (const date of Object.keys(source).filter(isValidDateKey).sort().reverse().slice(0, LIMITS.maxLogDays)) {
    const entry = cleanLogEntry(source[date]);
    if (Object.keys(entry).length > 0) logs[date] = entry;
  }
  return { profile, logs };
}

/**
 * Load state. Tries the current key, then the legacy v1 key (migration), then falls back to `makeSeed()`.
 * Returns { state, error } where `error` explains a recoverable problem (for example corrupted JSON).
 */
export function loadState(makeSeed, storage = globalThis.localStorage) {
  let error = null;
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const saved = storage?.getItem(key);
      if (!saved) continue;
      const state = sanitizeState(JSON.parse(saved));
      if (state) return { state, error };
      error = "Saved data had an unexpected format and was replaced with fresh data.";
    } catch {
      error = "Saved data could not be read and was replaced with fresh data.";
    }
  }
  return { state: makeSeed(), error };
}

/** Save state. Never throws: returns { ok } or { ok:false, error } (private mode, quota exceeded, ...). */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch {
    return { ok: false, error: "Your browser blocked saving. Changes will be lost when you close this tab." };
  }
}
