import * as React from "react";

const LiveToggle = ({
  isLive = true,
  onToggle,
  lastUpdatedLabel,
  className = "",
}) => {
  const handleClick = React.useCallback(() => {
    if (typeof onToggle === "function") onToggle(!isLive);
  }, [onToggle, isLive]);

  return (
    <div className={`biggi-toolbar biggi-toolbar--solo ${className}`.trim()}>
      <button
        type="button"
        className={`tab-button ${isLive ? "active" : ""}`}
        onClick={handleClick}
      >
        {isLive ? "LIVE" : "PAUSED"}
      </button>
      {lastUpdatedLabel ? (
        <div className="biggi-value mono">{lastUpdatedLabel}</div>
      ) : null}
    </div>
  );
};

export default React.memo(LiveToggle);

