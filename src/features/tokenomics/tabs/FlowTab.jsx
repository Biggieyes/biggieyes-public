import * as React from "react";
import { formatEther, formatUnits } from "ethers";

import Card from "../components/Card";
import Line from "../components/Line";
import AddressLine from "../components/AddressLine";
import styles from "../styles/BiggiToken.module.css";
import { explorerLink } from "../utils/format";

function formatNative(value) {
  if (value == null) return "--";
  try {
    const formatted = formatEther(value);
    return `${Number(formatted).toFixed(4)} POL`;
  } catch {
    return "--";
  }
}

function formatToken(value, decimals = 18) {
  if (value == null) return "--";
  try {
    const formatted = formatUnits(value, decimals);
    return `${Number(formatted).toFixed(4)} BIGGI`;
  } catch {
    return "--";
  }
}

function pctFromBps(bps) {
  if (bps == null) return "--";
  const n = Number(bps) / 100;
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "--";
}

function FlowTab({ snapshot, loading, error }) {
  const splits = snapshot?.intendedSplits?.nativeFromMint;
  const tokenSplits = snapshot?.intendedSplits?.tokenInitial;

  const addrs = snapshot?.addresses || {};
  const meta = snapshot?.tokenMeta || {};
  const live = snapshot?.liveBalances || {};
  const d = meta?.decimals ?? 18;

  const nativeSplitRows = [
    { label: "DEV (direct)", value: splits ? pctFromBps(splits.devBps) : "--" },
    {
      label: "CollectionRewards",
      value: splits ? pctFromBps(splits.collectionRewardsBps) : "--",
    },
    { label: "Reserve", value: splits ? pctFromBps(splits.reserveBps) : "--" },
    { label: "Buyback", value: splits ? pctFromBps(splits.buybackBps) : "--" },
    {
      label: "Community",
      value: splits ? pctFromBps(splits.communityCenterBps) : "--",
    },
    { label: "Treasury", value: splits ? pctFromBps(splits.treasuryBps) : "--" },
  ];

  const tokenSplitRows = [
    { label: "Reserve", value: tokenSplits ? `${tokenSplits.reservePct}%` : "--" },
    {
      label: "TokenRewards",
      value: tokenSplits ? `${tokenSplits.tokenRewardsPct}%` : "--",
    },
    {
      label: "DRIP Distributor",
      value: tokenSplits ? `${tokenSplits.dripDistributorPct}%` : "--",
    },
  ];

  return (
    <div className={styles.ecoFlowGrid}>
      <Card
        title="FLOW SNAPSHOT"
        subtitle="Compact split view for native mint routing and initial BIGGI allocation"
      >
        {loading ? <div className="biggi-muted">Loading...</div> : null}
        {error ? <div className="biggi-muted">{String(error?.message || error)}</div> : null}

        <div className={styles.ecoFlowTwoCols}>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>Native split (from mint)</div>
            {nativeSplitRows.map((row) => (
              <Line key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>Token allocation (initial)</div>
            {tokenSplitRows.map((row) => (
              <Line key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </div>
      </Card>

      <Card title="LIVE BALANCES" subtitle="Current on-chain balances of the key contracts">
        <div className={styles.ecoFlowTwoCols}>
          <div>
            <div className={styles.ecoMiniTitle}>Native (POL)</div>
            <Line label="Reserve" value={formatNative(live?.native?.reserve)} />
            <Line label="Buyback" value={formatNative(live?.native?.buyback)} />
            <Line label="Treasury" value={formatNative(live?.native?.treasury)} />
            <Line label="Community" value={formatNative(live?.native?.communityCenter)} />
            <Line label="CollectionRewards" value={formatNative(live?.native?.collectionRewards)} />
          </div>

          <div>
            <div className={styles.ecoMiniTitle}>BIGGI</div>
            <Line label="Reserve" value={formatToken(live?.token?.reserve, d)} />
            <Line label="TokenRewards" value={formatToken(live?.token?.tokenRewards, d)} />
            <Line label="DRIP Distributor" value={formatToken(live?.token?.dripDistributor, d)} />
            <Line label="Treasury" value={formatToken(live?.token?.treasury, d)} />
            <Line label="Buyback" value={formatToken(live?.token?.buyback, d)} />
          </div>
        </div>
      </Card>

      <Card title="CONTRACTS" subtitle="Addresses used in this panel">
        <AddressLine label="BIGGI Token" address={meta?.address} href={explorerLink(meta?.address)} />
        <AddressLine label="Distributor" address={addrs?.distributor} href={explorerLink(addrs?.distributor)} />
        <AddressLine label="Reserve" address={addrs?.reserve} href={explorerLink(addrs?.reserve)} />
        <AddressLine label="Buyback" address={addrs?.BUYBACK} href={explorerLink(addrs?.BUYBACK)} />
        <AddressLine label="Treasury" address={addrs?.treasury} href={explorerLink(addrs?.treasury)} />
        <AddressLine label="Community" address={addrs?.communityCenter} href={explorerLink(addrs?.communityCenter)} />
        <AddressLine label="CollectionRewards" address={addrs?.collectionRewards} href={explorerLink(addrs?.collectionRewards)} />
        <AddressLine label="TokenRewards" address={addrs?.tokenREWARDS} href={explorerLink(addrs?.tokenREWARDS)} />
        <AddressLine label="DRIP Distributor" address={addrs?.DRIPDistributor} href={explorerLink(addrs?.DRIPDistributor)} />
      </Card>
    </div>
  );
}

export default React.memo(FlowTab);
