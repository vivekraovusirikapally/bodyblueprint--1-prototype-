// Tiny client for the optional Express/SQLite back end. The app is local-first: if the API is not
// reachable it keeps working from localStorage, and `status` in the header says so.

const RAW = import.meta.env?.VITE_API_URL;
export const API_BASE = RAW === undefined || RAW === "" ? "/api" : RAW;
const TIMEOUT_MS = 4000;

async function request(path, { method = "GET", body, allow404 = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${method} ${path} failed with ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  enabled: API_BASE !== "off",
  async health() {
    const data = await request("/health");
    if (data?.status !== "ok") throw new Error("Unexpected /health response");
    return data;
  },
  async getProfile() {
    const data = await request("/profile", { allow404: true });
    return data ? data.profile : null;
  },
  async getLogs() {
    const data = await request("/logs");
    return data.logs ?? {};
  },
  putState: (state) => request("/state", { method: "PUT", body: state }),
  clearState: () => request("/state", { method: "DELETE" }),
};
