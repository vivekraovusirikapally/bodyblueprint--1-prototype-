// Data-access layer. ALL SQL lives here and every statement is parameterised (no string concatenation
// with user input), which rules out SQL injection.

const nowIso = () => new Date().toISOString();

const profileFromRow = (r) => ({
  heightCm: r.height_cm, weightKg: r.weight_kg, age: r.age, sex: r.sex, unit: r.unit, goal: r.goal, activity: r.activity,
});

function logFromRow(r) {
  const entry = { waterMl: r.water_ml, sleepHours: r.sleep_hours, rating: r.rating };
  if (r.weight_kg !== null) entry.weightKg = r.weight_kg;
  if (r.bed) entry.bed = r.bed;
  if (r.wake) entry.wake = r.wake;
  return entry;
}

export function createRepository(db) {
  const q = {
    getProfile: db.prepare("SELECT * FROM profile WHERE id = 1"),
    upsertProfile: db.prepare(`
      INSERT INTO profile (id, height_cm, weight_kg, age, sex, unit, goal, activity, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET height_cm = excluded.height_cm, weight_kg = excluded.weight_kg, age = excluded.age,
        sex = excluded.sex, unit = excluded.unit, goal = excluded.goal, activity = excluded.activity, updated_at = excluded.updated_at`),
    getLog: db.prepare("SELECT * FROM logs WHERE date = ?"),
    listLogs: db.prepare("SELECT * FROM logs WHERE date BETWEEN ? AND ? ORDER BY date"),
    upsertLog: db.prepare(`
      INSERT INTO logs (date, water_ml, sleep_hours, rating, weight_kg, bed, wake, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET water_ml = excluded.water_ml, sleep_hours = excluded.sleep_hours, rating = excluded.rating,
        weight_kg = excluded.weight_kg, bed = excluded.bed, wake = excluded.wake, updated_at = excluded.updated_at`),
    clearLogs: db.prepare("DELETE FROM logs"),
    clearProfile: db.prepare("DELETE FROM profile"),
  };

  const saveProfile = (p) => {
    q.upsertProfile.run(p.heightCm, p.weightKg, p.age, p.sex, p.unit, p.goal, p.activity, nowIso());
  };

  /** Merge `patch` into the day's existing entry (or defaults) and store it. Returns the stored entry. */
  const upsertLog = (date, patch) => {
    const row = q.getLog.get(date);
    const current = row ? logFromRow(row) : { waterMl: 0, sleepHours: 0, rating: 0 };
    const m = { ...current, ...patch };
    q.upsertLog.run(date, m.waterMl, m.sleepHours, m.rating, m.weightKg ?? null, m.bed ?? "", m.wake ?? "", nowIso());
    return logFromRow(q.getLog.get(date));
  };

  /** Run `fn` inside a transaction: all-or-nothing. */
  const transaction = (fn) => {
    db.exec("BEGIN");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };

  return {
    getProfile() {
      const row = q.getProfile.get();
      return row ? profileFromRow(row) : null;
    },
    saveProfile,
    getLog(date) {
      const row = q.getLog.get(date);
      return row ? logFromRow(row) : null;
    },
    listLogs(from, to) {
      return Object.fromEntries(q.listLogs.all(from, to).map((r) => [r.date, logFromRow(r)]));
    },
    upsertLog,
    /** Store a profile and/or many logs atomically. */
    importState({ profile, logs = {} }) {
      transaction(() => {
        if (profile) saveProfile(profile);
        for (const [date, entry] of Object.entries(logs)) upsertLog(date, entry);
      });
    },
    clear() {
      transaction(() => {
        q.clearLogs.run();
        q.clearProfile.run();
      });
    },
  };
}
