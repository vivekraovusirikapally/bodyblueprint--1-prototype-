import { useEffect, useMemo, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { useHealth } from "../context/HealthContext.jsx";
import { lastDays } from "../lib/insights.js";

Chart.register(...registerables);

const cssVar = (name, fallback) =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

export default function Trends({ theme }) {
  const { logs } = useHealth();
  const canvas = useRef(null);

  // last 7 days, oldest first
  const rows = useMemo(
    () =>
      lastDays(7).map((k) => ({
        label: k.slice(5),
        sleep: logs[k]?.sleepHours || null,
        water: logs[k]?.waterMl ? logs[k].waterMl / 1000 : null,
        weight: logs[k]?.weightKg || null,
      })),
    [logs],
  );

  useEffect(() => {
    if (!canvas.current) return undefined;
    const text = cssVar("--muted", "#6b7280");
    const grid = cssVar("--track", "#e5e7eb");
    const scale = (title, extra = {}) => ({ title: { display: true, text: title, color: text }, ticks: { color: text }, grid: { color: grid }, ...extra });

    let chart;
    try {
      chart = new Chart(canvas.current, {
        type: "line",
        data: {
          labels: rows.map((r) => r.label),
          datasets: [
            { label: "Sleep (h)", data: rows.map((r) => r.sleep), borderColor: "#6366f1", yAxisID: "y", tension: 0.3, spanGaps: true },
            { label: "Water (L)", data: rows.map((r) => r.water), borderColor: "#0ea5e9", yAxisID: "y1", tension: 0.3, spanGaps: true },
            { label: "Weight (kg)", data: rows.map((r) => r.weight), borderColor: "#f97316", yAxisID: "y2", tension: 0.3, spanGaps: true },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { labels: { color: text } } },
          scales: {
            x: { ticks: { color: text }, grid: { color: grid } },
            y: scale("Sleep (h)", { position: "left", min: 0, max: 10 }),
            y1: scale("Water (L)", { position: "right", min: 0, max: 4, grid: { drawOnChartArea: false } }),
            y2: scale("Weight (kg)", { position: "right", grid: { drawOnChartArea: false } }),
          },
        },
      });
    } catch (err) {
      console.error("Could not draw the trend chart:", err);
    }
    return () => chart?.destroy();
  }, [rows, theme]);

  return (
    <section className="card wide" aria-labelledby="trends-title">
      <h2 id="trends-title">7-day trends</h2>
      <canvas ref={canvas} role="img" aria-label="Line chart of the last 7 days of sleep, water and weight. A data table follows." />
      <p className="muted small">Gaps mean nothing was logged that day.</p>
      <details>
        <summary>View the data as a table</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Sleep (h)</th><th>Water (L)</th><th>Weight (kg)</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td><td>{r.sleep ?? "-"}</td><td>{r.water ?? "-"}</td><td>{r.weight ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
