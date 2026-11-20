import { SCORE_WEIGHTS } from "../../shared/constants.js";
import { scoreLabel } from "../lib/health.js";
import { useTodayScore } from "../hooks/useTodayScore.js";

const pct = (w) => `${Math.round(w * 100)}%`;

export default function ScoreRing() {
  const { total, parts } = useTodayScore();
  const r = 60;
  const circ = 2 * Math.PI * r;
  const color = total >= 85 ? "#22c55e" : total >= 70 ? "#84cc16" : total >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <section className="card center" aria-labelledby="score-title">
      <h2 id="score-title">Wellness index</h2>
      <svg viewBox="0 0 150 150" className="ring" role="img" aria-label={`Wellness score ${total} out of 100`}>
        <circle cx="75" cy="75" r={r} stroke="var(--track)" strokeWidth="12" fill="none" />
        <circle cx="75" cy="75" r={r} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - total / 100)}
          transform="rotate(-90 75 75)" style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s" }} />
        <text x="75" y="85" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text)">{total}</text>
      </svg>
      <p className="bold">{total}/100 - {scoreLabel(total)}</p>
      <div className="bars">
        <Bar label={`BMI (${pct(SCORE_WEIGHTS.bmi)})`} value={parts.bmi} />
        <Bar label={`Hydration (${pct(SCORE_WEIGHTS.water)})`} value={parts.water} />
        <Bar label={`Sleep (${pct(SCORE_WEIGHTS.sleep)})`} value={parts.sleep} />
      </div>
    </section>
  );
}

function Bar({ label, value }) {
  const v = Math.round(value);
  return (
    <div className="bar">
      <span className="small">{label}</span>
      <div className="track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
        <div className="fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
