import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openDatabase } from "../src/db.js";
import { createRepository } from "../src/repository.js";

const profile = { heightCm: 175, weightKg: 72, age: 27, sex: "male", unit: "metric", goal: "maintain", activity: "light" };
let repo;
beforeEach(() => {
  repo = createRepository(openDatabase(":memory:"));
});

describe("repository", () => {
  it("returns null before a profile exists, then stores and replaces it", () => {
    assert.equal(repo.getProfile(), null);
    repo.saveProfile(profile);
    assert.deepEqual(repo.getProfile(), profile);
    repo.saveProfile({ ...profile, weightKg: 70, goal: "cut" });
    assert.equal(repo.getProfile().weightKg, 70);
    assert.equal(repo.getProfile().goal, "cut");
  });

  it("upsertLog merges partial updates into the same day", () => {
    repo.upsertLog("2026-11-20", { waterMl: 500 });
    const merged = repo.upsertLog("2026-11-20", { sleepHours: 7.5, bed: "23:00", wake: "06:30" });
    assert.deepEqual(merged, { waterMl: 500, sleepHours: 7.5, rating: 0, bed: "23:00", wake: "06:30" });
  });

  it("listLogs filters by inclusive date range, sorted", () => {
    for (const d of ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]) repo.upsertLog(d, { waterMl: 100 });
    assert.deepEqual(Object.keys(repo.listLogs("2026-11-19", "2026-11-20")), ["2026-11-19", "2026-11-20"]);
  });

  it("is safe against SQL injection in values", () => {
    const evil = "2026-11-20'; DROP TABLE logs; --";
    assert.equal(repo.getLog(evil), null);
    assert.deepEqual(repo.listLogs(evil, evil), {});
    repo.upsertLog("2026-11-20", { waterMl: 1 }); // table still exists
    assert.equal(repo.getLog("2026-11-20").waterMl, 1);
  });

  it("database CHECK constraints reject out-of-range data even if validation were bypassed", () => {
    assert.throws(() => repo.upsertLog("2026-11-20", { waterMl: -5 }));
    assert.throws(() => repo.upsertLog("not-a-date", { waterMl: 5 }));
    assert.throws(() => repo.saveProfile({ ...profile, sex: "robot" }));
  });

  it("importState is atomic: one bad row rolls everything back", () => {
    assert.throws(() =>
      repo.importState({ profile, logs: { "2026-11-19": { waterMl: 100 }, "2026-11-20": { waterMl: -1 } } }),
    );
    assert.equal(repo.getProfile(), null);
    assert.deepEqual(repo.listLogs("2026-01-01", "2026-12-31"), {});
  });

  it("clear removes everything", () => {
    repo.importState({ profile, logs: { "2026-11-20": { waterMl: 100 } } });
    repo.clear();
    assert.equal(repo.getProfile(), null);
    assert.deepEqual(repo.listLogs("2026-01-01", "2026-12-31"), {});
  });
});
