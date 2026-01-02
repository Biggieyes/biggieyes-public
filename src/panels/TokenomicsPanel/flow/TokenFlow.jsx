import * as React from "react";
import ValueRow from "../components/ValueRow";
import "./TokenFlow.css";

const TokenFlow = ({ flows = [] }) => (
  <section className="token-flow">
    <header>
      <h3>BIGGI token distribution</h3>
      <p>How BIGGI is routed after leaving the distributor.</p>
    </header>
    <div className="token-flow__rows">
      {flows.map((flow) => (
        <ValueRow key={flow.label} label={flow.label} value={flow.amount} hint={flow.hint} />
      ))}
    </div>
  </section>
);

export default TokenFlow;
