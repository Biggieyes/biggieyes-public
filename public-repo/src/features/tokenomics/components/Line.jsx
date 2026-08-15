import * as React from "react";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const Line = ({ label, value, tone = "default" }) => (
  <div className={`biggi-line biggi-line--${tone}`}>
    <span className="biggi-line-label">{label}:</span>
    <span className="biggi-line-value">{hasValue(value) ? value : "--"}</span>
  </div>
);

export default React.memo(Line);
