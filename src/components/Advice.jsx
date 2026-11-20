import { buildAdvice } from "../lib/health.js";
import { useTodayScore } from "../hooks/useTodayScore.js";

export default function Advice() {
  const { bmi, waterMl, goalMl, sleepHours } = useTodayScore();
  const tips = buildAdvice({ bmi, waterMl, goalMl, sleepHours });
  return (
    <section className="card" aria-labelledby="advice-title">
      <h2 id="advice-title">Advice for today</h2>
      {tips.map((t) => (
        <div key={t.text} className={`tip ${t.tone}`}>{t.text}</div>
      ))}
      <p className="muted small">General educational wellness tips only, not medical advice.</p>
    </section>
  );
}
