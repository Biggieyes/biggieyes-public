import * as React from "react";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 8,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

export default function FounderBox() {
  return (
    <section style={cardStyle}>
      <h3 style={titleStyle}>Founder</h3>
      <div style={{ fontSize: 13, color: "#cfd6e6" }}>
        Placeholder: founder disclosure pending.
      </div>
    </section>
  );
}
