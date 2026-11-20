import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In production builds, add a strict Content-Security-Policy. (Not in dev: Vite's hot reload needs inline scripts.)
function cspPlugin(mode) {
  const api = process.env.VITE_API_URL;
  const apiOrigin = api && /^https?:\/\//.test(api) ? ` ${new URL(api).origin}` : "";
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self'${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "inject-csp",
    transformIndexHtml: (html) =>
      mode === "production" ? html.replace("</title>", `</title>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`) : html,
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cspPlugin(mode)],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}", "shared/**/*.test.js"],
    env: { VITE_API_URL: "off" },
    css: false,
    coverage: { provider: "v8", include: ["shared/**", "src/lib/**", "src/components/**"], exclude: ["**/*.test.*"] },
  },
}));
