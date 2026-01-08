import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./DripFlow.css";

const DripFlow = ({ flows = [] }) => (
  <section className="drip-flow">
    <header className="drip-flow__header">
      <h3>Drip flow</h3>
      <p>
        BIGGI passes from DripDistributor into DripLM and then to the reserve.
      </p>
    </header>
    <div className="drip-flow__rows">
      {flows.map((flow) => (
        <ValueRow key={flow.label} {...flow} />
      ))}
    </div>
  </section>
);

export default DripFlow;

