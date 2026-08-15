import * as React from "react";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 12,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

const nodeStyle = {
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0f1116",
  color: "#e8ecf6",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 700,
  textAlign: "center",
  minWidth: 140,
};

const arrowStyle = {
  color: "#9aa3b2",
  fontWeight: 800,
  letterSpacing: "0.08em",
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const FlowRow = ({ from, to }) => (
  <div style={rowStyle}>
    <div style={nodeStyle}>{from}</div>
    <div style={arrowStyle}>to</div>
    <div style={nodeStyle}>{to}</div>
  </div>
);

export default function TokenomicsFlow() {
  return (
    <section style={cardStyle}>
      <h3 style={titleStyle}>Tokenomics Flow</h3>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gap: 6,
            justifyItems: "center",
          }}
        >
          <div style={nodeStyle}>Ticket mint</div>
          <div style={arrowStyle}>v</div>
          <div style={nodeStyle}>TicketHub</div>
          <div style={arrowStyle}>v</div>
          <div style={nodeStyle}>Distributor</div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <FlowRow from="Distributor" to="Reserve" />
          <FlowRow from="Distributor" to="Buyback" />
          <FlowRow from="Distributor" to="Treasury" />
          <FlowRow from="Distributor" to="CollectionRewards" />
          <FlowRow from="Distributor" to="CommunityCenter" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <FlowRow from="Buyback" to="Treasury" />
          <FlowRow from="Treasury" to="TokenRewards + Reserve + DRIP" />
          <FlowRow from="Reserve" to="LiquidityManager" />
          <FlowRow from="LiquidityManager" to="LiquidityVault" />
        </div>
      </div>
    </section>
  );
}
