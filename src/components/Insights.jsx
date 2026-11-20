import { useHealth } from "../context/HealthContext.jsx";
import { downloadText, logsToCsv } from "../lib/export.js";
import { todayKey, waterGoal } from "../lib/health.js";
import { averages, hydrationStreak, loggingStreak, weightChange } from "../lib/insights.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Insights() {
  const { logs, profile } = useHealth();
  const goal = waterGoal(profile.weightKg);
  const week = averages(logs, 7);
  const change = weightChange(logs, 7);
  const streaks = { logging: loggingStreak(logs), hydration: hydrationStreak(logs, goal) };

  const exportCsv = () => downloadText(`bodyblueprint-${todayKey()}.csv`, logsToCsv(logs));

  return (
    <section className="card" aria-labelledby="insights-title">
      <h2 id="insights-title">Weekly insights</h2>
      <dl className="stats">
        <div><dt>Logging streak</dt><dd>{plural(streaks.logging, "day")}</dd></div>
        <div><dt>Hydration streak</dt><dd>{plural(streaks.hydration, "day")}</dd></div>
        <div><dt>Avg sleep</dt><dd>{week.sleepHours === null ? "-" : `${week.sleepHours} h`}</dd></div>
        <div><dt>Avg water</dt><dd>{week.waterMl === null ? "-" : `${(week.waterMl / 1000).toFixed(1)} L`}</dd></div>
        <div><dt>Days logged</dt><dd>{week.daysLogged} / 7</dd></div>
        <div>
          <dt>Weight change</dt>
          <dd>{change ? `${change.delta > 0 ? "+" : ""}${change.delta} kg` : "-"}</dd>
        </div>
      </dl>
      <p className="muted small">Hydration streak counts days you reached your current daily water goal.</p>
      <button className="ghost" onClick={exportCsv}>Download my data (CSV)</button>
    </section>
  );
}
