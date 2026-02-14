import * as React from "react";

import "./BUYBACKFLOW.css";

const BUYBACKFLOW = ({ FLOWs = [] }) => (
  <section className="BUYBACK-FLOW">
    <header className="BUYBACK-FLOW__header">
      <h3>BUYBACK FLOW</h3>
      <p>Snapshot of native spend and the BIGGI path to Treasury.</p>
    </header>
    <div className="BUYBACK-FLOW__rows">
      {FLOWs.map((FLOW) => (
        <div key={FLOW.label} className="BUYBACK-FLOW-row">{FLOW.label}: {FLOW.value}</div>
      ))}
    </div>
  </section>
);

export default BUYBACKFLOW;



