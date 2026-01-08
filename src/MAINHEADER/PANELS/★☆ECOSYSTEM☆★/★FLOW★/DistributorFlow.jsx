import * as React from "react";
import ValueRow from "../components/ValueRow";
import "./DistributorFlow.css";

const DistributorFlow = ({ flows = [] }) => (
  <section className="distributor-flow">
    <header>
      <h3>Distributor native split</h3>
      <p>Where the collected POL/native funds end up.</p>
    </header>
    <div className="distributor-flow__rows">
      {flows.map((flow) => (
        <ValueRow
          key={flow.label}
          label={flow.label}
          value={flow.amount}
          hint={flow.hint}
        />
      ))}
    </div>
  </section>
);

export default DistributorFlow;

