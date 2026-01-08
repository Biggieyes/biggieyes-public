import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./DRIPFLOW.css";

const DRIPFLOW = ({ FLOWs = [] }) => (
  <section className="DRIP-FLOW">
    <header className="DRIP-FLOW__header">
      <h3>DRIP FLOW</h3>
      <p>
        BIGGI passes from DRIPDistributor into DRIPLM and then to the reserve.
      </p>
    </header>
    <div className="DRIP-FLOW__rows">
      {FLOWs.map((FLOW) => (
        <ValueRow key={FLOW.label} {...FLOW} />
      ))}
    </div>
  </section>
);

export default DRIPFLOW;



