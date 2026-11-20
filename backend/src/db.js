// SQLite connection + schema (Node's built-in node:sqlite, so there is no native module to compile).
// Limits in the CHECK constraints come from shared/constants.js: the database enforces the same rules as the API.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ACTIVITY_LEVELS, GOALS, LIMITS, SEXES, UNITS } from "../../shared/constants.js";

const list = (values) => values.map((v) => `'${v}'`).join(", ");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  height_cm  REAL    NOT NULL CHECK (height_cm BETWEEN ${LIMITS.heightCm.min} AND ${LIMITS.heightCm.max}),
  weight_kg  REAL    NOT NULL CHECK (weight_kg BETWEEN ${LIMITS.weightKg.min} AND ${LIMITS.weightKg.max}),
  age        INTEGER NOT NULL CHECK (age BETWEEN ${LIMITS.age.min} AND ${LIMITS.age.max}),
  sex        TEXT    NOT NULL CHECK (sex IN (${list(SEXES)})),
  unit       TEXT    NOT NULL CHECK (unit IN (${list(UNITS)})),
  goal       TEXT    NOT NULL CHECK (goal IN (${list(GOALS)})),
  activity   TEXT    NOT NULL CHECK (activity IN (${list(Object.keys(ACTIVITY_LEVELS))})),
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  date        TEXT    PRIMARY KEY CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  water_ml    INTEGER NOT NULL DEFAULT 0 CHECK (water_ml BETWEEN ${LIMITS.waterMl.min} AND ${LIMITS.waterMl.max}),
  sleep_hours REAL    NOT NULL DEFAULT 0 CHECK (sleep_hours BETWEEN ${LIMITS.sleepHours.min} AND ${LIMITS.sleepHours.max}),
  rating      INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN ${LIMITS.rating.min} AND ${LIMITS.rating.max}),
  weight_kg   REAL    CHECK (weight_kg IS NULL OR weight_kg BETWEEN ${LIMITS.weightKg.min} AND ${LIMITS.weightKg.max}),
  bed         TEXT    NOT NULL DEFAULT '',
  wake        TEXT    NOT NULL DEFAULT '',
  updated_at  TEXT    NOT NULL
);
`;

/** Open (and create if needed) the database. Use ":memory:" for tests. */
export function openDatabase(file = ":memory:") {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}
