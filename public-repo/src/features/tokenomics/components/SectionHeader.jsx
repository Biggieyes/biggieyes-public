import * as React from "react";

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div className="rewards-grid__section-header" style={{ "--section-accent": accent }}>
    <span className="rewards-grid__section-title">{label}</span>
    <span className="rewards-grid__section-line" />
  </div>
);

export default React.memo(SectionHeader);
