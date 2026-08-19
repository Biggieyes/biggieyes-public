// src/components/common/Loader.jsx
import * as React from "react";

export default function Loader({
  text = "Loading...",
  className = "",
  size = 24,
  color = "currentColor",
  "aria-live": ariaLive = "polite",
}) {
  return (
    <div
      className={`loader-container ${className}`}
      role="status"
      aria-busy="true"
      aria-live={ariaLive}
      aria-atomic="true"
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 50 50"
        style={{ animation: "spin 1s linear infinite", color }}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={color}
          strokeOpacity="0.2"
          strokeWidth="5"
        />
        <path
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          d="M45 25a20 20 0 0 1-20 20"
        />
      </svg>
      <span>{text}</span>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .loader-container span {
          font-size: 1rem;
          font-weight: 500;
          color: inherit;
        }
      `}</style>
    </div>
  );
}

