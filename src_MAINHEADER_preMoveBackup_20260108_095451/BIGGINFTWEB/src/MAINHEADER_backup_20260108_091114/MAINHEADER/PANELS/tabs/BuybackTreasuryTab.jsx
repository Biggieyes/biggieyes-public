import * as React from "react";
import StatCard from "../components/StatCard";
import ValueRow from "../components/ValueRow";
import LineChart from "../charts/LineChart";
import StatusBadge from "../components/StatusBadge";
import BUYBACKFLOW from "../ECOSYSTEM/â…FLOWâ…/BUYBACKFLOW.jsx";
import { mapBUYBACKSnapshotToFLOWRows } from "../../../services/tokenomics/BUYBACKTreasury.mappers";
import { explorerBaseFor } from "../../../utils/explorer";
import "./BUYBACKTreasuryTab.css";

const BUYBACKTreasuryTab = ({
  snapshot,
  nativeSeries,
  biggiSeries,
  treasurySeries,
  isLoading,
  error,
}) => {
  const statusLabel =
    snapshot?.derived?.statusLabel ?? (isLoading ? "Loading" : "Waiting");
  const statusTone = snapshot?.derived?.statusTone ?? "default";
  const explorerBase = explorerBaseFor(80002) || "https://amoy.polygonscan.com";
  const shortAddr = (addr) =>
    typeof addr === "string" && addr.length > 12
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : addr || "--";
  const isAddress = (addr) =>
    typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
  const exploreHref = (addr) =>
    isAddress(addr) ? `${explorerBase}/address/${addr}` : null;

  const FLOWs = mapBUYBACKSnapshotToFLOWRows(snapshot);

  const stats = [
    {
      label: "Last BUYBACK",
      value: snapshot?.BUYBACK?.lastBUYBACKLabel ?? "N/A",
      accent: "primary",
    },
    {
      label: "Native spent",
      value: snapshot?.BUYBACK?.totalNativeSpent ?? "--",
      hint: snapshot?.BUYBACK?.nativeBalance ?? "--",
    },
    {
      label: "BIGGI bought",
      value: snapshot?.BUYBACK?.totalBiggiAcquired ?? "--",
      hint: snapshot?.BUYBACK?.biggiBalance ?? "--",
    },
  ];

  return (
    <section className="BUYBACK-tab">
      <header className="BUYBACK-tab__header">
        <div>
          <p className="BUYBACK-tab__eyebrow">BUYBACK AGENT / TREASURY</p>
          <h2>BUYBACK telemetry</h2>
        </div>
        <StatusBadge status={statusLabel} tone={statusTone} />
      </header>

      <div className="BUYBACK-tab__meta">
        <span>Updated {snapshot?.tsLabel ?? "N/A"}</span>
        <span>
          {nativeSeries?.length
            ? `${nativeSeries.length} snapshots`
            : "No history yet"}
        </span>
      </div>

      <div className="BUYBACK-tab__stats BUYBACK-tab__stats--top">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="BUYBACK-tab__charts">
        <div className="BUYBACK-tab__chart-card">
          <header>
            <h4>Native spent</h4>
            <p>BUYBACK native spend over time.</p>
          </header>
          <LineChart points={nativeSeries} />
        </div>
        <div className="BUYBACK-tab__chart-card">
          <header>
            <h4>BIGGI acquired</h4>
            <p>Total BIGGI minted/bought by the agent.</p>
          </header>
          <LineChart points={biggiSeries} />
        </div>
        <div className="BUYBACK-tab__chart-card BUYBACK-tab__chart-card--wide">
          <header>
            <h4>Treasury balance</h4>
            <p>BIGGI held by Treasury.</p>
          </header>
          <LineChart points={treasurySeries} />
        </div>
      </div>

      {error ? (
        <div className="BUYBACK-tab__alert">
          {error.message || "Unable to refresh BUYBACK data."}
        </div>
      ) : null}

      <div className="BUYBACK-tab__split">
        <div className="BUYBACK-tab__column">
          <div className="BUYBACK-tab__panel">
            <h3>BUYBACK agent</h3>
            <ValueRow
              label="Router"
              value={
                snapshot?.BUYBACK?.routerShort ??
                shortAddr(snapshot?.BUYBACK?.router)
              }
              href={exploreHref(snapshot?.BUYBACK?.router)}
            />
            <ValueRow
              label="Wrapped native"
              value={shortAddr(snapshot?.BUYBACK?.wrappedNative)}
              href={exploreHref(snapshot?.BUYBACK?.wrappedNative)}
            />
            <ValueRow
              label="POLICY"
              value={shortAddr(snapshot?.BUYBACK?.POLICY)}
              href={exploreHref(snapshot?.BUYBACK?.POLICY)}
            />
            <ValueRow
              label="Auto BUYBACK"
              value={
                snapshot?.BUYBACK?.autoBUYBACKEnabled ? "Enabled" : "Manual"
              }
            />
            <div className="BUYBACK-tab__FLOW">
              <BUYBACKFLOW FLOWs={FLOWs} />
            </div>
          </div>
          <div className="BUYBACK-tab__panel">
            <h3>Treasury view</h3>
            <ValueRow
              label="Treasury"
              value={
                snapshot?.treasury?.shortAddress ??
                shortAddr(snapshot?.treasury?.address)
              }
              href={exploreHref(snapshot?.treasury?.address)}
            />
            <ValueRow
              label="Reserve"
              value={shortAddr(snapshot?.treasury?.reserve)}
              href={exploreHref(snapshot?.treasury?.reserve)}
            />
            <ValueRow
              label="TokenREWARDS"
              value={shortAddr(snapshot?.treasury?.tokenREWARDS)}
              href={exploreHref(snapshot?.treasury?.tokenREWARDS)}
            />
            <ValueRow
              label="Total native in"
              value={snapshot?.treasury?.totalMaticReceived ?? "--"}
              hint={`Distributor: ${snapshot?.treasury?.totalMaticFromDistributor ?? "--"}`}
            />
            <ValueRow
              label="Total BIGGI in"
              value={snapshot?.treasury?.totalBiggiReceived ?? "--"}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default BUYBACKTreasuryTab;







