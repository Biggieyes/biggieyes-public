import * as React from "react";
import "./StatCard.css";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const isAddressLike = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    /^0x[0-9a-fA-F]{40}$/.test(trimmed) ||
    /^0x[0-9a-fA-F]{4,}\.\.\.[0-9a-fA-F]{4}$/.test(trimmed)
  );
};

const StatCard = ({ label, value, hint, accent, tone }) => {
  const className = [
    "stat-card",
    accent ? `stat-card--${accent}` : null,
    tone ? `stat-card--${tone}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const valueClassName = [
    "stat-card__value",
    isAddressLike(value) ? "is-address" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const hintClassName = [
    "stat-card__hint",
    isAddressLike(hint) ? "is-address" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
      <div className="stat-card__label">{label}</div>
      <div className={valueClassName}>{value}</div>
      {hasValue(hint) ? <div className={hintClassName}>{hint}</div> : null}
    </article>
  );
};

export default StatCard;

