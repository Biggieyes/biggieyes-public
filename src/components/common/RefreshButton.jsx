// src/components/common/RefreshButton.jsx
import * as React from "react";
import "./RefreshButton.css";

export default function RefreshButton({ onClick, children = "Refresh reveal" }) {
  return (
    <button className="refresh-button" onClick={onClick}>
      {children}
    </button>
  );
}
