import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { HealthProvider } from "./context/HealthContext.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary title="BodyBlueprint could not start">
      <HealthProvider>
        <App />
      </HealthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
