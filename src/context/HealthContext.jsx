import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LIMITS } from "../../shared/constants.js";
import { cleanLogEntry, validateProfile } from "../../shared/validation.js";
import { api } from "../lib/api.js";
import { todayKey } from "../lib/health.js";
import { buildSeed } from "../lib/seed.js";
import { loadState, sanitizeState, saveState } from "../lib/storage.js";

const HealthContext = createContext(null);

const emptyDay = { waterMl: 0, sleepHours: 0, rating: 0, bed: "", wake: "" };
const SYNC_DAYS = 90;
const SYNC_DEBOUNCE_MS = 600;

/** The slice of state sent to the server: profile plus the most recent days of logs. */
function toSyncPayload(state) {
  const keys = Object.keys(state.logs).sort().reverse().slice(0, SYNC_DAYS);
  return { profile: state.profile, logs: Object.fromEntries(keys.map((k) => [k, state.logs[k]])) };
}

/**
 * Shared app state (profile + daily logs).
 * - Persists to localStorage (validated on load).
 * - If the Express API is reachable, mirrors the state to SQLite; otherwise it quietly stays local-only.
 */
export function HealthProvider({ children, sync = api.enabled }) {
  const [boot] = useState(() => loadState(buildSeed));
  const [state, setState] = useState(boot.state);
  const [notice, setNotice] = useState(boot.error);
  const [syncStatus, setSyncStatus] = useState(sync ? "connecting" : "local");
  const [epoch, setEpoch] = useState(0); // bumps on reset so forms re-read their initial values
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Persist locally on every change.
  useEffect(() => {
    const result = saveState(state);
    setNotice((prev) => (result.ok ? (prev && prev.startsWith("Your browser") ? null : prev) : result.error));
  }, [state]);

  // One-time handshake with the API.
  useEffect(() => {
    if (!sync) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        const remoteProfile = await api.getProfile();
        if (cancelled) return;
        if (remoteProfile) {
          const merged = sanitizeState({ profile: remoteProfile, logs: await api.getLogs() });
          if (!cancelled && merged) setState(merged);
        } else {
          await api.putState(toSyncPayload(stateRef.current));
        }
        if (!cancelled) setSyncStatus("synced");
      } catch (err) {
        console.warn("API unavailable, continuing with local data only:", err.message);
        if (!cancelled) setSyncStatus("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sync]);

  // Debounced push of later changes.
  useEffect(() => {
    if (!sync || (syncStatus !== "synced" && syncStatus !== "error")) return undefined;
    const id = setTimeout(async () => {
      try {
        await api.putState(toSyncPayload(state));
        setSyncStatus("synced");
      } catch (err) {
        console.warn("Sync failed:", err.message);
        setSyncStatus("error");
      }
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [state, sync, syncStatus]);

  const today = { ...emptyDay, ...(state.logs[todayKey()] || {}) };

  /** Merge a patch (or a function of today's entry) into today's log. Invalid fields are ignored. */
  const updateToday = useCallback((patch) => {
    setState((prev) => {
      const key = todayKey();
      const current = { ...emptyDay, ...(prev.logs[key] || {}) };
      const change = typeof patch === "function" ? patch(current) : patch;
      return { ...prev, logs: { ...prev.logs, [key]: { ...current, ...cleanLogEntry(change) } } };
    });
  }, []);

  const saveProfile = useCallback((patch) => {
    const checked = validateProfile(patch, { partial: true });
    if (!checked.valid) return checked;
    setState((prev) => {
      const next = { ...prev, profile: { ...prev.profile, ...checked.value } };
      // only touch today's weight when the weight itself changed
      if (checked.value.weightKg !== undefined) {
        const key = todayKey();
        next.logs = { ...prev.logs, [key]: { ...emptyDay, ...(prev.logs[key] || {}), weightKg: checked.value.weightKg } };
      }
      return next;
    });
    return checked;
  }, []);

  const addWater = useCallback(
    (ml) => updateToday((cur) => ({ waterMl: Math.min(LIMITS.waterMl.max, Math.max(0, cur.waterMl + ml)) })),
    [updateToday],
  );

  const resetAll = useCallback(() => {
    setState(buildSeed());
    setEpoch((e) => e + 1);
    if (sync) api.clearState().catch(() => {});
  }, [sync]);

  const value = useMemo(
    () => ({
      profile: state.profile,
      logs: state.logs,
      today,
      notice,
      syncStatus,
      epoch,
      saveProfile,
      addWater,
      saveSleep: updateToday,
      setUnit: (unit) => saveProfile({ unit }),
      resetAll,
    }),
    // `today` is derived from state.logs, so state is the only real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, notice, syncStatus, epoch, saveProfile, addWater, updateToday, resetAll],
  );
  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useHealth = () => {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used inside <HealthProvider>");
  return ctx;
};
