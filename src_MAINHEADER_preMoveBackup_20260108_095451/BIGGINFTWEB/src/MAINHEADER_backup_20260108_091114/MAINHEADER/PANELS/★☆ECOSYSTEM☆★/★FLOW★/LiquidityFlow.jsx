import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./LiquidityFLOW.css";

const LiquidityFLOW = ({ FLOWs = [], activeSegment }) => (
  <section className="liquidity-FLOW">
    <header className="liquidity-FLOW__header">
      <h3>Liquidity FLOW</h3>
      <p>
        Breakdown of how funds are reserved, managed, and routed through the
        vault.
      </p>
    </header>
    {FLOWs.length ? (
      <div className="liquidity-FLOW__rows">
        {FLOWs.map((FLOW) => {
          const isActive = FLOW.segment && FLOW.segment === activeSegment;
          return (
            <ValueRow
              key={FLOW.label}
              className={isActive ? "is-active" : ""}
              {...FLOW}
            />
          );
        })}
      </div>
    ) : (
      <div className="liquidity-FLOW__empty">
        FLOW metrics are not available yet.
      </div>
    )}
  </section>
);

export default LiquidityFLOW;


