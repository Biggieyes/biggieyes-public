import React from 'react';
const HeroStat = ({ label, value }) => (
  <div className="biggi-hero__stat">
    <span className="biggi-hero__label">{label}</span>
    <span className="biggi-hero__value">{value}</span>
  </div>
);
export default HeroStat;
