import { useState } from "react";
import { validateSleepEntry } from "../../shared/validation.js";
import { useHealth } from "../context/HealthContext.jsx";
import { sleepHoursBetween } from "../lib/health.js";

export default function SleepLogger() {
  const { today, saveSleep } = useHealth();
  const [bed, setBed] = useState(today.bed || "23:00");
  const [wake, setWake] = useState(today.wake || "06:30");
  const [rating, setRating] = useState(today.rating || 0);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const hours = sleepHoursBetween(bed, wake);

  const save = () => {
    const checked = validateSleepEntry({ bed, wake, rating });
    setErrors(checked.errors);
    setSaved(checked.valid);
    if (checked.valid) saveSleep(checked.value);
  };

  const edit = (setter) => (e) => {
    setter(e.target.value);
    setSaved(false);
  };

  return (
    <section className="card" aria-labelledby="sleep-title">
      <h2 id="sleep-title">Sleep</h2>
      <div className="form">
        <label>Bedtime
          <input type="time" value={bed} onChange={edit(setBed)} aria-invalid={Boolean(errors.bed)} />
          {errors.bed && <span className="field-error" role="alert">{errors.bed}</span>}
        </label>
        <label>Wake time
          <input type="time" value={wake} onChange={edit(setWake)} aria-invalid={Boolean(errors.wake)} />
          {errors.wake && <span className="field-error" role="alert">{errors.wake}</span>}
        </label>
      </div>
      <p className="big">{hours} <span className="muted">hours</span></p>
      <div className="stars" role="radiogroup" aria-label="Restfulness">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={n === rating}
            className={n <= rating ? "star on" : "star"} aria-label={`${n} stars`}
            onClick={() => { setRating(n); setSaved(false); }}
          >
            ★
          </button>
        ))}
      </div>
      <button className="primary" onClick={save}>Save sleep</button>
      {saved && <p className="muted small" role="status">Saved.</p>}
      {today.sleepHours > 0 && <p className="muted small">Logged today: {today.sleepHours} h</p>}
    </section>
  );
}
