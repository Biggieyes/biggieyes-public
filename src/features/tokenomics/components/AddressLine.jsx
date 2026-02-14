import * as React from "react";
import { shortAddr } from "../utils/format";

const AddressLine = ({ label, address, displayValue, href }) => {
  const targetValue = displayValue ?? shortAddr(address);
  return (
    <div className="biggi-address-line">
      <span className="biggi-address-label">{label}:</span>
      <span className="biggi-address-value">
        <span>{targetValue || "--"}</span>
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
