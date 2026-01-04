import * as React from "react";
import StatCard from "../components/StatCard";
import ValueRow from "../components/ValueRow";
import LineChart from "../charts/LineChart";
import StatusBadge from "../components/StatusBadge";
import BuybackFlow from "../flow/BuybackFlow";
import { mapBuybackSnapshotToFlowRows } from "../../../services/tokenomics/buybackTreasury.mappers";
import { explorerBaseFor } from "../../../utils/explorer";
import "./BuybackTreasuryTab.css";

const BuybackTreasuryTab = ({ snapshot, nativeSeries, biggiSeries, treasurySeries, isLoading, error }) => {
  const statusLabel = snapshot?.derived?.statusLabel ?? (isLoading ? "Loading" : "Waiting");
  const statusTone = snapshot?.derived?.statusTone ?? "default";
  const explorerBase = explorerBaseFor(80002) || "https://amoy.polygonscan.com";
  const shortAddr = (addr) => (typeof addr === "string" && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr || "--");
  const isAddress = (addr) => typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
  const exploreHref = (addr) => (isAddress(addr) ? `${explorerBase}/address/${addr}` : null);

  const flows = mapBuybackSnapshotToFlowRows(snapshot);

  const stats = [
    {
      label: "Last buyback",
      value: snapshot?.buyback?.lastBuybackLabel ?? "N/A",
      accent: "primary",
    },
    {
      label: "Native spent",
      value: snapshot?.buyback?.totalNativeSpent ?? "--",
      hint: snapshot?.buyback?.nativeBalance ?? "--",
    },
    {
      label: "BIGGI bought",
      value: snapshot?.buyback?.totalBiggiAcquired ?? "--",
      hint: snapshot?.buyback?.biggiBalance ?? "--",
    },
  ];

  return (
  <section className="buyback-tab">
    <header className="buyback-tab__header">
      <div>
        <p className="buyback-tab__eyebrow">BUYBACK AGENT / TREASURY</p>
        <h2>Buyback telemetry</h2>
        </div>
        <StatusBadge status={statusLabel} tone={statusTone} />
      </header>

    <div className="buyback-tab__meta">
      <span>Updated {snapshot?.tsLabel ?? "N/A"}</span>
      <span>{nativeSeries?.length ? `${nativeSeries.length} snapshots` : "No history yet"}</span>
    </div>

    <div className="buyback-tab__stats buyback-tab__stats--top">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>

    <div className="buyback-tab__charts">
      <div className="buyback-tab__chart-card">
        <header>
          <h4>Native spent</h4>
          <p>Buyback native spend over time.</p>
        </header>
        <LineChart points={nativeSeries} />
      </div>
      <div className="buyback-tab__chart-card">
        <header>
          <h4>BIGGI acquired</h4>
          <p>Total BIGGI minted/bought by the agent.</p>
        </header>
        <LineChart points={biggiSeries} />
      </div>
      <div className="buyback-tab__chart-card buyback-tab__chart-card--wide">
        <header>
          <h4>Treasury balance</h4>
          <p>BIGGI held by Treasury.</p>
        </header>
        <LineChart points={treasurySeries} />
      </div>
    </div>

      {error ? <div className="buyback-tab__alert">{error.message || "Unable to refresh buyback data."}</div> : null}

      <div className="buyback-tab__split">
        <div className="buyback-tab__column">
          <div className="buyback-tab__panel">
            <h3>Buyback agent</h3>
            <ValueRow label="Router" value={snapshot?.buyback?.routerShort ?? shortAddr(snapshot?.buyback?.router)} href={exploreHref(snapshot?.buyback?.router)} />
            <ValueRow label="Wrapped native" value={shortAddr(snapshot?.buyback?.wrappedNative)} href={exploreHref(snapshot?.buyback?.wrappedNative)} />
            <ValueRow label="Policy" value={shortAddr(snapshot?.buyback?.policy)} href={exploreHref(snapshot?.buyback?.policy)} />
            <ValueRow label="Auto buyback" value={snapshot?.buyback?.autoBuybackEnabled ? "Enabled" : "Manual"} />
            <div className="buyback-tab__flow">
              <BuybackFlow flows={flows} />
            </div>
          </div>
          <div className="buyback-tab__panel">
            <h3>Treasury view</h3>
            <ValueRow label="Treasury" value={snapshot?.treasury?.shortAddress ?? shortAddr(snapshot?.treasury?.address)} href={exploreHref(snapshot?.treasury?.address)} />
            <ValueRow label="Reserve" value={shortAddr(snapshot?.treasury?.reserve)} href={exploreHref(snapshot?.treasury?.reserve)} />
            <ValueRow label="TokenRewards" value={shortAddr(snapshot?.treasury?.tokenRewards)} href={exploreHref(snapshot?.treasury?.tokenRewards)} />
            <ValueRow label="Total native in" value={snapshot?.treasury?.totalMaticReceived ?? "--"} hint={`Distributor: ${snapshot?.treasury?.totalMaticFromDistributor ?? "--"}`} />
            <ValueRow label="Total BIGGI in" value={snapshot?.treasury?.totalBiggiReceived ?? "--"} />
          </div>
        </div>
      </div>
  </section>
);
};

export default BuybackTreasuryTab;
