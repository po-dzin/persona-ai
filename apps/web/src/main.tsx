import React from "react";
import { createRoot } from "react-dom/client";

const flow = [
  "Onboarding",
  "Upload",
  "Style Pick",
  "Credit Check",
  "Paywall",
  "Processing",
  "Result",
  "History",
];

function App() {
  return (
    <main style={{ fontFamily: "system-ui", margin: "24px auto", maxWidth: 900, padding: 12 }}>
      <h1>Live Photo App — Vertical Slice MVP</h1>
      <p>Mini App + Web, tariffs 5/20/50, 1 free generation.</p>
      <section>
        <h2>Flow</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {flow.map((step) => (
            <span
              key={step}
              style={{ border: "1px solid #d0d7de", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}
            >
              {step}
            </span>
          ))}
        </div>
      </section>
      <section style={{ marginTop: 16 }}>
        <h2>Locked UX copy</h2>
        <ul>
          <li>SLA: 40–180 sec</li>
          <li>Free: 1 generation / user_id</li>
          <li>Retention: source 48h, result 30d</li>
        </ul>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
