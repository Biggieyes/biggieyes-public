import * as React from "react";
import ValueRow from "../../components/ValueRow";
import "./TokenDexFlow.css";

const _formatDelta = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const TokenDexFlow = ({ snapshot, history = [] }) => {
  const latest = snapshot?.dex?.pair?.reserves ?? {};
  const previousSnapshot =
    history.length > 1 ? history[history.length - 2] : null;
  const previous = previousSnapshot?.dex?.pair?.reserves ?? {};

  const biggiDelta =
    typeof latest.biggiNumeric === "number" &&
    typeof previous.biggiNumeric === "number"
      ? latest.biggiNumeric - previous.biggiNumeric
      : null;
  const nativeDelta =
    typeof latest.nativeNumeric === "number" &&
    typeof previous.nativeNumeric === "number"
      ? latest.nativeNumeric - previous.nativeNumeric
      : null;

  const status =
    nativeDelta == null
      ? "balanced"
      : Math.abs(nativeDelta) < 0.01
        ? "balanced"
        : nativeDelta < 0
          ? "buy-pressure"
          : "sell-pressure";
  const statusLabel =
    status === "balanced"
      ? "Balanced"
      : status === "buy-pressure"
        ? "Buy pressure"
        : "Sell pressure";

  const rows = [
    {
      label: "Native delta",
      value: _formatDelta(nativeDelta),
      hint: "Change since last snapshot",
    },
    {
      label: "BIGGI delta",
      value: _formatDelta(biggiDelta),
      hint: "Pool BIGGI change",
    },
    {
      label: "Current price",
      value: snapshot?.dex?.price?.pair?.nativePerBiggi ?? "N/A",
      hint: "Pair spot",
    },
  ];

  return (
    <section className="token-dex-flow">
      <header>
        <h4>Token {"<->"} DEX flow</h4>
        <p>Reserve dynamics & pressure indicator</p>
      </header>
      <div className="token-dex-flow__diagram">
        <div className="token-dex-flow__node">BIGGI token</div>
        <div className={`token-dex-flow__arrow ${status}`}>
          <span>{statusLabel}</span>
          <small>
            {nativeDelta != null
              ? `${_formatDelta(nativeDelta)} native`
              : "Waiting for data"}
          </small>
        </div>
        <div className="token-dex-flow__node">DEX pair</div>
      </div>
      <div className="token-dex-flow__stats">
        {rows.map((row) => (
          <ValueRow key={row.label} {...row} />
        ))}
      </div>
    </section>
  );
};

export default TokenDexFlow;

