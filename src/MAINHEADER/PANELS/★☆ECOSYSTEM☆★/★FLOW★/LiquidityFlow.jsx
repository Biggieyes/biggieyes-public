import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./LiquidityFlow.css";

const LiquidityFlow = ({ flows = [], activeSegment }) => (
  <section className="liquidity-flow">
    <header className="liquidity-flow__header">
      <h3>Liquidity flow</h3>
      <p>
        Breakdown of how funds are reserved, managed, and routed through the
        vault.
      </p>
    </header>
    {flows.length ? (
      <div className="liquidity-flow__rows">
        {flows.map((flow) => {
          const isActive = flow.segment && flow.segment === activeSegment;
          return (
            <ValueRow
              key={flow.label}
              className={isActive ? "is-active" : ""}
              {...flow}
            />
          );
        })}
      </div>
    ) : (
      <div className="liquidity-flow__empty">
        Flow metrics are not available yet.
      </div>
    )}
  </section>
);

export default LiquidityFlow;

