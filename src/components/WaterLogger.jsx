import { useState } from "react";
import { LIMITS } from "../../shared/constants.js";
import { validateWaterAmount } from "../../shared/validation.js";
import { useHealth } from "../context/HealthContext.jsx";
import { waterGoal } from "../lib/health.js";

export default function WaterLogger() {
  const { profile, today, addWater } = useHealth();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const goal = waterGoal(profile.weightKg);
  const pct = goal ? Math.min(100, Math.round((today.waterMl / goal) * 100)) : 0;
  const atCap = today.waterMl >= LIMITS.waterMl.max;

  const addCustom = (e) => {
    e.preventDefault();
    const checked = validateWaterAmount(custom);
    if (!checked.valid) return setError(checked.errors.amount);
    setError("");
    setCustom("");
    addWater(checked.value);
  };

  return (
    <section className="card" aria-labelledby="water-title">
      <h2 id="water-title">Water intake</h2>
      <div className="row">
        <div className="glass" role="img" aria-label={`${pct}% of daily goal`}>
          <div className="water" style={{ height: `${pct}%` }} />
        </div>
        <div>
          <p className="big" aria-live="polite">{today.waterMl} <span className="muted">/ {goal} ml</span></p>
          <p className="muted">{pct}% of your goal (about 35 ml per kg)</p>
        </div>
      </div>
      <div className="row wrap">
        <button className="primary" onClick={() => addWater(250)} disabled={atCap}>+250 ml</button>
        <button className="primary" onClick={() => addWater(500)} disabled={atCap}>+500 ml</button>
        <button className="ghost" onClick={() => addWater(-250)} disabled={today.waterMl === 0}>Undo 250</button>
      </div>
      <form onSubmit={addCustom} noValidate className="inline-form">
        <label>Custom amount (ml)
          <input
            type="number" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)}
            aria-invalid={Boolean(error)} aria-describedby={error ? "water-error" : undefined}
          />
        </label>
        <button className="ghost" type="submit">Add</button>
      </form>
      {error && <p id="water-error" className="field-error" role="alert">{error}</p>}
    </section>
  );
}
