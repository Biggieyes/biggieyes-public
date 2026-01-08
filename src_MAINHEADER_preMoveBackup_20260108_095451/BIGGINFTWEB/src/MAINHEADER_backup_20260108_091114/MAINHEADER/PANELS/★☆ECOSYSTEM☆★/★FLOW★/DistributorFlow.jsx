import * as React from "react";
import ValueRow from "../components/ValueRow";
import "./DistributorFLOW.css";

const DistributorFLOW = ({ FLOWs = [] }) => (
  <section className="distributor-FLOW">
    <header>
      <h3>Distributor native split</h3>
      <p>Where the collected POL/native funds end up.</p>
    </header>
    <div className="distributor-FLOW__rows">
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

export default DistributorFLOW;


