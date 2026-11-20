import { useHealth } from "../context/HealthContext.jsx";
import { calcBmi, waterGoal, wellnessScore } from "../lib/health.js";

/** Today's BMI, water goal, sleep and wellness score, derived from the shared state. */
export function useTodayScore() {
  const { profile, today } = useHealth();
  const bmi = calcBmi(profile.weightKg, profile.heightCm);
  const goalMl = waterGoal(profile.weightKg);
  const result = wellnessScore({ bmi, waterMl: today.waterMl, goalMl, sleepHours: today.sleepHours });
  return { ...result, bmi, goalMl, waterMl: today.waterMl, sleepHours: today.sleepHours };
}
