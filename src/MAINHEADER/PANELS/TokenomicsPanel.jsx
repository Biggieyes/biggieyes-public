import * as React from "react";
import LiquidityTab from "./tabs/LiquidityTab";
import TokenDexTab from "./tabs/TokenDexTab";
import useLiquiditySnapshot from "../../hooks/tokenomics/useLiquiditySnapshot";
import useLiquidityHistory from "../../hooks/tokenomics/useLiquidityHistory";
import useTokenDexSnapshot from "../../hooks/tokenomics/useTokenDexSnapshot";
import useTokenDexHistory from "../../hooks/tokenomics/useTokenDexHistory";
import "./TokenomicsPanel.css";

const SEGMENTS = [
  { id: "reserve", label: "Reserve" },
  { id: "lm", label: "Liquidity Manager" },
  { id: "vault", label: "Vault" },
];

const TokenomicsPanel = () => {
  const [activeSegment, setActiveSegment] = React.useState("reserve");
  const { snapshot, loading, error } = useLiquiditySnapshot();
  const { history, chartPoints } = useLiquidityHistory(snapshot);
  const {
    snapshot: tokenDexSnapshot,
    loading: tokenDexLoading,
    error: tokenDexError,
  } = useTokenDexSnapshot();
  const { history: tokenDexHistory } = useTokenDexHistory(tokenDexSnapshot);

  return (
    <section className="tokenomics-panel">
      <header className="tokenomics-panel__header">
        <div>
          <p className="tokenomics-panel__eyebrow">Reserve / LM / Vault</p>
          <h2>Liquidity nerves</h2>
        </div>
        <span className="tokenomics-panel__ts">
          Updated {snapshot?.tsLabel ?? "N/A"}
        </span>
      </header>

      <div className="tokenomics-panel__tabs">
        {SEGMENTS.map((segment) => (
          <button
            key={segment.id}
            className={`tokenomics-panel__tab${segment.id === activeSegment ? " is-active" : ""}`}
            onClick={() => setActiveSegment(segment.id)}
            type="button"
          >
            {segment.label}
          </button>
        ))}
      </div>

      <LiquidityTab
        snapshot={snapshot}
        history={history}
        chartPoints={chartPoints}
        isLoading={loading}
        error={error}
        activeSegment={activeSegment}
      />
      <TokenDexTab
        snapshot={tokenDexSnapshot}
        history={tokenDexHistory}
        isLoading={tokenDexLoading}
        error={tokenDexError}
      />
    </section>
  );
};

export default TokenomicsPanel;

