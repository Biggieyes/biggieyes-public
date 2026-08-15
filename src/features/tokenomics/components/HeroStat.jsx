import * as React from "react";

const HeroStat = ({ label, value, tone = "default" }) => (
  <div className={`biggi-hero__stat ${tone ? `tone-${tone}` : ""}`}>
    <div className="biggi-hero__value">{value}</div>
    <div className="biggi-hero__label">{label}</div>
  </div>
);

export default React.memo(HeroStat);
