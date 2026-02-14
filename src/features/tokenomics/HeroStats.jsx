import * as React from "react";
const isPresent = (value) => value !== null && value !== undefined && value !== "";

const HeroStats = ({ items = [], className = "" }) => {
  const visible = (items || []).filter(
    (item) => item && isPresent(item.value) && isPresent(item.label),
  );
  if (!visible.length) return null;

  return (
    <div className={`biggi-hero ${className}`.trim()}>
      {visible.map((item) => (
        <div
          key={item.key || item.label}
          className={`biggi-hero__stat ${item.tone ? `tone-${item.tone}` : ""}`.trim()}
        >
          <div className="biggi-hero__value">{item.value}</div>
          <div className="biggi-hero__label">{item.label}</div>
          {isPresent(item.sub) ? (
            <div className="biggi-hero__sub">{item.sub}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default React.memo(HeroStats);

