import * as React from "react";

const Line = ({ label, value, tone = "default" }) => (
  <div className={`biggi-line biggi-line--${tone}`}>
    <span className="biggi-line-label">{label}:</span>
    <span className="biggi-line-value">{value || "--"}</span>
  </div>
);

export default React.memo(Line);
