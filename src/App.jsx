import { useState } from "react";
import { useHealth } from "./context/HealthContext.jsx";
import { useTheme } from "./hooks/useTheme.js";
import Advice from "./components/Advice.jsx";
import Calculator from "./components/Calculator.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Insights from "./components/Insights.jsx";
import ScoreRing from "./components/ScoreRing.jsx";
import SleepLogger from "./components/SleepLogger.jsx";
import Trends from "./components/Trends.jsx";
import WaterLogger from "./components/WaterLogger.jsx";

const tabs = ["Today", "Body", "Trends"];
const SYNC_LABEL = {
  local: "Saved on this device",
  connecting: "Connecting...",
  synced: "Synced to server",
  offline: "Offline: saved on this device",
  error: "Sync problem: saved on this device",
};

export default function App() {
  const [tab, setTab] = useState("Today");
  const { resetAll, epoch, notice, syncStatus } = useHealth();
  const [theme, toggleTheme] = useTheme();

  const onTabKey = (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    setTab(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]);
  };

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div>
          <h1>BodyBlueprint</h1>
          <p className="muted">One place for your body metrics, water and sleep.</p>
        </div>
        <div className="row wrap">
          <nav className="tabs" role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
            {tabs.map((t) => (
              <button
                key={t} role="tab" id={`tab-${t}`} aria-selected={t === tab} aria-controls="main" tabIndex={t === tab ? 0 : -1}
                className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          <button className="ghost" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {notice && <p className="tip warn" role="status">{notice}</p>}

      <ErrorBoundary resetKeys={[tab]}>
        <main id="main" role="tabpanel" aria-labelledby={`tab-${tab}`} className="grid" key={`${tab}-${epoch}`}>
          {tab === "Today" && (
            <>
              <ScoreRing />
              <Advice />
              <WaterLogger />
              <SleepLogger />
            </>
          )}
          {tab === "Body" && <Calculator />}
          {tab === "Trends" && (
            <>
              <Insights />
              <Trends theme={theme} />
            </>
          )}
        </main>
      </ErrorBoundary>

      <footer className="muted small">
        <p>
          Educational wellness information only, loosely based on WHO guidelines. This is not medical advice.
          Please talk to a doctor about any health concerns.
        </p>
        <p className="status" role="status">{SYNC_LABEL[syncStatus]}</p>
        <button className="link" onClick={() => window.confirm("Reset to the sample data?") && resetAll()}>
          Reset demo data
        </button>
      </footer>
    </div>
  );
}
