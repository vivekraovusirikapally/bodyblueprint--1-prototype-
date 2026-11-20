// CSV export of the user's logs. Cells are sanitised so a spreadsheet can never run injected formulas.

import { csvCell } from "../../shared/validation.js";

const HEADER = ["date", "water_ml", "sleep_hours", "sleep_rating", "weight_kg", "bedtime", "wake_time"];

/** Build a CSV string (oldest day first). */
export function logsToCsv(logs) {
  const rows = Object.keys(logs)
    .sort()
    .map((date) => {
      const e = logs[date] ?? {};
      return [date, e.waterMl, e.sleepHours, e.rating, e.weightKg, e.bed, e.wake].map(csvCell).join(",");
    });
  return [HEADER.join(","), ...rows].join("\n") + "\n";
}

/** Trigger a browser download of text content. */
export function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
