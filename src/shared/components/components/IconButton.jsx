// src/components/common/IconButton.jsx
import * as React from "react";

export default function IconButton({
  src,
  alt,
  onClick,
  className = "mini-icon",
  title,
  disabled = false,
  style,
}) {
  const handleKey = React.useCallback(
    (e) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(e);
      }
    },
    [disabled, onClick],
  );

  return (
    <img
      src={src}
      alt={alt}
      title={title || alt}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={className}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : handleKey}
      style={
        disabled
          ? { opacity: 0.6, pointerEvents: "none", ...style }
          : { cursor: "pointer", ...style }
      }
    />
  );
}

