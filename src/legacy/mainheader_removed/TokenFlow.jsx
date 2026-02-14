import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./TokenFLOW.css";

const TokenFLOW = ({ FLOWs = [] }) => (
  <section className="token-FLOW">
    <header>
      <h3>BIGGI token distribution</h3>
      <p>How BIGGI is routed after leaving the distributor.</p>
    </header>
    <div className="token-FLOW__rows">
      {FLOWs.map((FLOW) => (
        <ValueRow
          key={FLOW.label}
          label={FLOW.label}
          value={FLOW.amount}
          hint={FLOW.hint}
        />
      ))}
    </div>
  </section>
);

export default TokenFLOW;


