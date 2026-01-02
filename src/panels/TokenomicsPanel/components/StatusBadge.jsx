import * as React from "react";
import "./StatusBadge.css";

const StatusBadge = ({ status = "Unknown", tone = "default" }) => (
  <span className={`status-badge status-badge--${tone}`}>{status}</span>
);

export default StatusBadge;
