import { useState } from "react";
import { ACTIVITY_LEVELS } from "../../shared/constants.js";
import { toNumber, validateProfileForm } from "../../shared/validation.js";
import { useHealth } from "../context/HealthContext.jsx";
import {
  calcBmi, calcBmr, calorieTargetDetail, cmToIn, healthyWeightRange, inToCm, kgToLbs, lbsToKg, macroTargets, whoCategory,
} from "../lib/health.js";

// BMI 10..40 mapped onto a half circle
function Gauge({ bmi, color }) {
  const clamped = Math.max(10, Math.min(40, bmi || 10));
  const toRad = (v) => ((((v - 10) / 30) * 180 - 180) * Math.PI) / 180;
  const cx = 110, cy = 110;
  const needleX = cx + 80 * Math.cos(toRad(clamped));
  const needleY = cy + 80 * Math.sin(toRad(clamped));

  const arc = (a, b, stroke) => {
    const x1 = cx + 95 * Math.cos(toRad(a)), y1 = cy + 95 * Math.sin(toRad(a));
    const x2 = cx + 95 * Math.cos(toRad(b)), y2 = cy + 95 * Math.sin(toRad(b));
    return <path d={`M ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2}`} stroke={stroke} strokeWidth="14" fill="none" />;
  };

  return (
    <svg viewBox="0 0 220 130" className="gauge" role="img" aria-label={bmi ? `BMI gauge showing ${bmi.toFixed(1)}` : "BMI gauge"}>
      {arc(10, 18.5, "#3b82f6")}
      {arc(18.5, 25, "#22c55e")}
      {arc(25, 30, "#f59e0b")}
      {arc(30, 40, "#ef4444")}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--text)" />
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="14" fill={color} fontWeight="700">
        {bmi ? bmi.toFixed(1) : "--"}
      </text>
    </svg>
  );
}

/** Stored metric values -> strings for the form inputs, in the chosen unit. */
function formFromProfile(profile) {
  const imperial = profile.unit === "imperial";
  return {
    height: imperial ? cmToIn(profile.heightCm).toFixed(1) : String(profile.heightCm),
    weight: imperial ? kgToLbs(profile.weightKg).toFixed(1) : String(profile.weightKg),
    age: String(profile.age),
    sex: profile.sex,
  };
}

export default function Calculator() {
  const { profile, saveProfile, setUnit } = useHealth();
  const imperial = profile.unit === "imperial";

  // The form edits display values (strings). We validate + convert to metric when saving.
  const [form, setForm] = useState(() => formFromProfile(profile));
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  // Switching units converts what is typed (using the old unit); falls back to the saved value if it is not a number.
  const toggleUnit = (unit) => {
    if (unit === profile.unit) return;
    const typedHeight = toNumber(form.height);
    const typedWeight = toNumber(form.weight);
    const heightCm = Number.isNaN(typedHeight) ? profile.heightCm : imperial ? inToCm(typedHeight) : typedHeight;
    const weightKg = Number.isNaN(typedWeight) ? profile.weightKg : imperial ? lbsToKg(typedWeight) : typedWeight;
    setUnit(unit);
    setErrors({});
    setForm({
      ...form,
      height: unit === "imperial" ? cmToIn(heightCm).toFixed(1) : String(Math.round(heightCm * 10) / 10),
      weight: unit === "imperial" ? kgToLbs(weightKg).toFixed(1) : String(Math.round(weightKg * 10) / 10),
    });
  };

  const submit = (e) => {
    e.preventDefault();
    const checked = validateProfileForm(form, profile.unit);
    setErrors(checked.errors);
    setSaved(false);
    if (!checked.valid) return;
    saveProfile(checked.value);
    setSaved(true);
  };

  const bmi = calcBmi(profile.weightKg, profile.heightCm);
  const bmr = Math.round(calcBmr(profile));
  const cat = whoCategory(bmi);
  const range = healthyWeightRange(profile.heightCm);

  const field = (name, label, props) => (
    <label>{label}
      <input
        name={name} value={form[name]} onChange={change} aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined} {...props}
      />
      {errors[name] && <span id={`${name}-error`} className="field-error" role="alert">{errors[name]}</span>}
    </label>
  );

  return (
    <>
      <section className="card" aria-labelledby="calc-title">
        <div className="row between">
          <h2 id="calc-title">BMI &amp; BMR calculator</h2>
          <div className="seg" role="group" aria-label="Units">
            <button type="button" className={!imperial ? "on" : ""} aria-pressed={!imperial} onClick={() => toggleUnit("metric")}>kg / cm</button>
            <button type="button" className={imperial ? "on" : ""} aria-pressed={imperial} onClick={() => toggleUnit("imperial")}>lbs / in</button>
          </div>
        </div>
        <form onSubmit={submit} className="form" noValidate>
          {field("height", `Height (${imperial ? "in" : "cm"})`, { type: "number", step: "0.1", inputMode: "decimal" })}
          {field("weight", `Weight (${imperial ? "lbs" : "kg"})`, { type: "number", step: "0.1", inputMode: "decimal" })}
          {field("age", "Age", { type: "number", inputMode: "numeric" })}
          <label>Biological sex
            <select name="sex" value={form.sex} onChange={change}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <button className="primary" type="submit">Calculate</button>
        </form>
        {saved && <p className="muted small" role="status">Saved.</p>}
      </section>

      <section className="card center" aria-labelledby="result-title">
        <h2 id="result-title">Your result</h2>
        <Gauge bmi={bmi} color={cat.color} />
        <p className="badge" style={{ background: cat.color }}>{cat.label}</p>
        <div className="legend">
          {["Underweight", "Normal", "Overweight", "Obese"].map((l) => (
            <span key={l} className={l === cat.label ? "bold" : "muted"}>{l}</span>
          ))}
        </div>
        {range && <p className="muted small">A BMI in the normal band is about {range.minKg}-{range.maxKg} kg at your height.</p>}
        <p className="big">{bmr.toLocaleString()} <span className="muted">kcal/day BMR</span></p>
      </section>

      <CalorieCard bmr={bmr} />
    </>
  );
}

function CalorieCard({ bmr }) {
  const { profile, saveProfile } = useHealth();
  const goals = [["cut", "Cut"], ["maintain", "Maintain"], ["bulk", "Bulk"]];
  const { kcal, floored } = calorieTargetDetail(bmr, profile.goal, profile.activity, profile.sex);
  const macros = macroTargets(kcal, profile.weightKg, profile.goal);
  const multiplier = ACTIVITY_LEVELS[profile.activity]?.multiplier ?? ACTIVITY_LEVELS.light.multiplier;

  return (
    <section className="card" aria-labelledby="cal-title">
      <h2 id="cal-title">Calorie target</h2>
      <div className="seg" role="group" aria-label="Goal">
        {goals.map(([id, label]) => (
          <button key={id} type="button" className={profile.goal === id ? "on" : ""} aria-pressed={profile.goal === id} onClick={() => saveProfile({ goal: id })}>{label}</button>
        ))}
      </div>
      <div className="form single">
        <label>Activity level
          <select value={profile.activity} onChange={(e) => saveProfile({ activity: e.target.value })}>
            {Object.entries(ACTIVITY_LEVELS).map(([id, a]) => <option key={id} value={id}>{a.label}</option>)}
          </select>
        </label>
      </div>
      <p className="big">{kcal.toLocaleString()} <span className="muted">kcal/day</span></p>
      <p className="small">Starting macros: <strong>{macros.proteinG} g</strong> protein, <strong>{macros.carbsG} g</strong> carbs, <strong>{macros.fatG} g</strong> fat.</p>
      {floored && <p className="tip warn">Target raised to a safe minimum. Please do not eat below this without medical supervision.</p>}
      <p className="muted small">BMR x {multiplier} for your activity level, minus 400 to cut or plus 300 to bulk. A rough starting point only.</p>
    </section>
  );
}
