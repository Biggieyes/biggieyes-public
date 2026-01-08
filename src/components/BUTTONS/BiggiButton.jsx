import * as React from "react";

const BiggiButton = ({
  children,
  onClick,
  disabled,
  variant = "ghost",
  className = "",
  type = "button",
  ...props
}) => (
  <button
    type={type}
    className={`biggi-btn biggi-btn--${variant}${className ? ` ${className}` : ""}`}
    onClick={onClick}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
);

export default BiggiButton;
