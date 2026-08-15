import * as React from "react";
import "./ValueRow.css";

const isAddressLike = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    /^0x[0-9a-fA-F]{40}$/.test(trimmed) ||
    /^0x[0-9a-fA-F]{4,}\.\.\.[0-9a-fA-F]{4}$/.test(trimmed)
  );
};

const ValueRow = ({
  label,
  value,
  hint,
  href,
  hrefLabel = "Explore",
  className = "",
}) => {
  const isPercentHint = typeof hint === "string" && hint.trim().endsWith("%");
  const parsedPercent = isPercentHint ? Number.parseFloat(hint) : null;
  const percentDisplay =
    isPercentHint && Number.isFinite(parsedPercent)
      ? `${parsedPercent.toFixed(1)} %`
      : hint;

  const hintClassNames = [
    isAddressLike(hint) ? "is-address" : "",
    isPercentHint ? "is-percent" : "",
    isPercentHint && Number.isFinite(parsedPercent) && parsedPercent < 0
      ? "negative"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hintTitle = isPercentHint ? "Podíl z aktuálního snapshotu" : undefined;

  return (
    <div className={`value-row ${className}`}>
      <span className="value-row__label">{label}</span>
      <div className="value-row__value">
        <span className={isAddressLike(value) ? "is-address" : undefined}>
          {value}
        </span>
        {hint && (
          <small
            className={hintClassNames}
            title={hintTitle}
            aria-label={hintTitle}
          >
            {percentDisplay}
          </small>
        )}
        {href ? (
          <a
            className="value-row__link"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {hrefLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default ValueRow;

