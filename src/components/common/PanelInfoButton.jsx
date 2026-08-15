import * as React from "react";

function PanelInfoButton({
  onClick,
  ariaLabel = "Open panel info",
  className = "",
  title = "Info",
}) {
  const buttonClassName = [
    "panel-info-btn",
    "biggi-btn",
    "biggi-btn--ghost",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={buttonClassName}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
    >
      <span aria-hidden="true">i</span>
    </button>
  );
}

export default React.memo(PanelInfoButton);
