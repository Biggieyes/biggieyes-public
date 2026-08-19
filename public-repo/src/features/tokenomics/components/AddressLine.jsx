import * as React from "react";
import { shortAddr } from "../utils/format";

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const AddressLine = ({ label, address, displayValue, href }) => {
  const targetValue = displayValue ?? shortAddr(address);
  return (
    <div className="biggi-address-line">
      <span className="biggi-address-label">{label}:</span>
      <span className="biggi-address-value">
        <span className="biggi-address-main" title={address || undefined}>
          {hasValue(targetValue) ? targetValue : "--"}
        </span>
        {href && (
          <a className="biggi-address-link" href={href} target="_blank" rel="noreferrer">
            Explorer
          </a>
        )}
      </span>
    </div>
  );
};

export default React.memo(AddressLine);
