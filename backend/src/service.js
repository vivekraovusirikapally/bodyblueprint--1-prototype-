// Business logic of the API: validation + orchestration, with no knowledge of HTTP or Express.
// Keeping it separate makes it easy to unit-test and to reuse behind another transport later.

import { LIMITS } from "../../shared/constants.js";
import { dateKey, daysBefore, isValidDateKey } from "../../shared/time.js";
import { validateLogEntry, validateProfile } from "../../shared/validation.js";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function createService(repo, clock = () => new Date()) {
  const latestAllowedDate = () => dateKey(daysBefore(-1, clock())); // allow "tomorrow" for timezone differences

  function assertDate(date, field = "date") {
    if (!isValidDateKey(date)) throw new ApiError(400, `${field} must be a real date written as YYYY-MM-DD.`);
    if (date > latestAllowedDate()) throw new ApiError(400, `${field} cannot be in the future.`);
  }

  return {
    getProfile() {
      const profile = repo.getProfile();
      if (!profile) throw new ApiError(404, "Profile not found.");
      return profile;
    },

    putProfile(body) {
      const checked = validateProfile(body);
      if (!checked.valid) throw new ApiError(400, "Invalid profile.", checked.errors);
      repo.saveProfile(checked.value);
      return checked.value;
    },

    listLogs({ from, to } = {}) {
      const end = to ?? dateKey(clock());
      const start = from ?? dateKey(daysBefore(89, clock()));
      assertDate(start, "from");
      assertDate(end, "to");
      if (start > end) throw new ApiError(400, "'from' must not be after 'to'.");
      const days = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1;
      if (days > LIMITS.maxLogDays) throw new ApiError(400, `Range too large (max ${LIMITS.maxLogDays} days).`);
      return repo.listLogs(start, end);
    },

    putLog(date, body) {
      assertDate(date);
      const checked = validateLogEntry(body);
      if (!checked.valid) throw new ApiError(400, "Invalid log entry.", checked.errors);
      return repo.upsertLog(date, checked.value);
    },

    /** Bulk upsert used by the front end to sync. Everything is validated first, then written atomically. */
    importState(body) {
      if (!isPlainObject(body)) throw new ApiError(400, "Body must be a JSON object.");
      const errors = {};
      let profile;
      if (body.profile !== undefined) {
        const p = validateProfile(body.profile);
        if (p.valid) profile = p.value;
        else errors.profile = p.errors;
      }
      const logs = {};
      if (body.logs !== undefined) {
        if (!isPlainObject(body.logs)) errors.logs = "logs must be an object keyed by date.";
        else if (Object.keys(body.logs).length > LIMITS.maxLogDays) errors.logs = `At most ${LIMITS.maxLogDays} days per request.`;
        else {
          for (const [date, entry] of Object.entries(body.logs)) {
            if (!isValidDateKey(date) || date > latestAllowedDate()) {
              errors[`logs.${date}`] = "Invalid or future date.";
              continue;
            }
            const e = validateLogEntry(entry);
            if (e.valid) logs[date] = e.value;
            else errors[`logs.${date}`] = e.errors;
          }
        }
      }
      if (Object.keys(errors).length) throw new ApiError(400, "Invalid state.", errors);
      repo.importState({ profile, logs });
      return { saved: { profile: Boolean(profile), logs: Object.keys(logs).length } };
    },

    clear() {
      repo.clear();
    },
  };
}
