import * as React from "react";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 10,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: 6,
  color: "#cfd6e6",
  fontSize: 13,
};

const warningStyle = {
  border: "1px solid rgba(255, 200, 0, 0.4)",
  background: "#1a1710",
  color: "#ffd166",
  borderRadius: 10,
  padding: 10,
  fontWeight: 700,
  fontSize: 13,
};

export default function SecurityBox() {
  return (
    <section style={cardStyle}>
      <h3 style={titleStyle}>Security</h3>
      <ul style={listStyle}>
        <li>? Contracts verified</li>
        <li>? Chainlink VRF randomness</li>
        <li>? Supply caps enforced</li>
        <li>? Reserve bucket accounting</li>
        <li>? LP stored in Vault</li>
        <li>? Pausable enabled</li>
        <li>? Owner roles visible on-chain</li>
      </ul>
      <div style={warningStyle}>
        ? External audit not completed (testnet phase)
      </div>
    </section>
  );
}
