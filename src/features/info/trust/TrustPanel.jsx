import * as React from "react";

import ContractsTable from "./components/ContractsTable.jsx";
import TokenomicsFlow from "./components/TokenomicsFlow.jsx";
import TrustLiveStats from "./components/LiveStats.jsx";
import SecurityBox from "./components/SecurityBox.jsx";
import DevTransparency from "./components/DevTransparency.jsx";
import FounderBox from "./components/FounderBox.jsx";

const wrapperStyle = {
  display: "grid",
  gap: 14,
};

const disclaimerStyle = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  background: "#151821",
  padding: 16,
  color: "#ffe800",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  lineHeight: 1.5,
};

export default function TrustPanel() {
  return (
    <div style={wrapperStyle}>
      <TrustLiveStats />
      <ContractsTable />
      <TokenomicsFlow />
      <SecurityBox />
      <DevTransparency />
      <FounderBox />

      <section style={disclaimerStyle}>
        MAINNET DEPLOYMENT. TRANSACTIONS USE REAL POL AND MUST BE CHECKED IN
        THE WALLET BEFORE CONFIRMATION.
      </section>
    </div>
  );
}
