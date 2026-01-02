// src/components/panels/InfoPanel.jsx
import * as React from "react";

export default function InfoPanel({ children }) {
  return (
    <section
      className="biggi-card biggi-skin"   // stejný wrapper jako ostatní panely
      role="region"
      aria-label="Info panel"
      tabIndex={-1}
      style={{ padding: 16 }}             // padding jako u ostatních panelů
    >
      {children}
    </section>
  );
}
