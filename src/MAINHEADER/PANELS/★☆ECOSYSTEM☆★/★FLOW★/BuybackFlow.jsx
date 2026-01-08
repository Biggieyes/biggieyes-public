import * as React from "react";

import "./BuybackFlow.css";

const BuybackFlow = ({ flows = [] }) => (
  <section className="buyback-flow">
    <header className="buyback-flow__header">
      <h3>Buyback flow</h3>
      <p>Snapshot of native spend and the BIGGI path to Treasury.</p>
    </header>
    <div className="buyback-flow__rows">
      {flows.map((flow) => (
        <div key={flow.label} className="buyback-flow-row">{flow.label}: {flow.value}</div>
      ))}
    </div>
  </section>
);

export default BuybackFlow;

