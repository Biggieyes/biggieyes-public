import * as React from "react";
import ValueRow from "../components/ValueRow";
import "./BuybackFlow.css";

const BuybackFlow = ({ flows = [] }) => (
  <section className="buyback-flow">
    <header className="buyback-flow__header">
      <h3>Buyback flow</h3>
      <p>Snapshot of native spend and the BIGGI path to Treasury.</p>
    </header>
    <div className="buyback-flow__rows">
      {flows.map((flow) => (
        <ValueRow key={flow.label} {...flow} />
      ))}
    </div>
  </section>
);

export default BuybackFlow;
