import * as React from "react";

import Card from "../components/Card";
import Line from "../components/Line";
import AddressLine from "../components/AddressLine";
import styles from "../styles/BiggiToken.module.css";
import { explorerLink } from "../utils/format";
import {
  isAddress,
  pickAddress,
  shortAddress,
  summarizeAddresses,
} from "../utils/panelFormatting.js";
import {
  formatNativeDisplay,
  formatTokenDisplay,
  pickFormatted,
} from "../utils/amountFormatting.js";

export function formatFlowNative(value) {
  return formatNativeDisplay(value, 4);
}

export function formatFlowToken(value, decimals = 18) {
  return formatTokenDisplay(value, decimals, 4);
}

function buildAddressCheck(label, addresses = []) {
  const valid = addresses.filter((address) => isAddress(address));
  const unique = [];
  const seen = new Set();

  for (const address of valid) {
    const normalized = String(address).toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(address);
  }

  if (!unique.length) {
    return {
      label,
      detail: "--",
      status: "No data",
      toneClass: styles.ecoStatusWarn,
    };
  }

  if (unique.length === 1) {
    return {
      label,
      detail: summarizeAddresses(unique),
      status: valid.length > 1 ? "Aligned" : "Observed",
      toneClass: valid.length > 1 ? styles.ecoStatusOk : styles.ecoStatusWarn,
    };
  }

  return {
    label,
    detail: summarizeAddresses(unique),
    status: "Mismatch",
    toneClass: styles.ecoStatusWarn,
  };
}

function FlowTab({
  snapshot,
  buybackSnapshot,
  dripSnapshot,
  liquiditySnapshot,
  tokenDexSnapshot,
  loading,
  error,
}) {
  const addrs = snapshot?.addresses || {};
  const meta = snapshot?.tokenMeta || {};
  const live = snapshot?.liveBalances || {};
  const native = live?.native || {};
  const tokenDecimals =
    tokenDexSnapshot?.token?.decimals ?? meta?.decimals ?? 18;
  const distributorAddress =
    addrs?.distributor ||
    addrs?.MULTI_COLLECTION_DISTRIBUTOR ||
    addrs?.DISTRIBUTOR ||
    dripSnapshot?.distributor?.address;
  const buybackAddress =
    addrs?.buyback ||
    addrs?.BUYBACK ||
    addrs?.BUYBACK_AGENT ||
    buybackSnapshot?.BUYBACK?.address ||
    dripSnapshot?.DRIPLM?.buybackAgent;
  const communityDisplay =
    native?.communityPoolBalance ??
    native?.communityEffective ??
    native?.communityCenter;
  const buy = buybackSnapshot?.BUYBACK || {};
  const treasury = buybackSnapshot?.treasury || {};
  const dripDistributor = dripSnapshot?.distributor || {};
  const dripLm = dripSnapshot?.DRIPLM || {};
  const reserve = liquiditySnapshot?.reserve || {};
  const pair = tokenDexSnapshot?.dex?.pair || {};
  const pairReserves = pair?.reserves || {};
  const reserveAddress = pickAddress(
    addrs?.reserve,
    liquiditySnapshot?.reserve?.address,
    tokenDexSnapshot?.token?.reserveAddress,
    dripSnapshot?.DRIPLM?.reserve,
  );
  const treasuryAddress = pickAddress(
    addrs?.treasury,
    buybackSnapshot?.treasury?.address,
    liquiditySnapshot?.treasury?.address,
  );
  const dripDistributorAddress = pickAddress(
    addrs?.DRIPDistributor,
    addrs?.DRIP_DISTRIBUTOR,
    dripSnapshot?.distributor?.address,
    tokenDexSnapshot?.token?.DRIPDistributorAddress,
  );
  const tokenRewardsAddress = pickAddress(
    addrs?.tokenREWARDS,
    addrs?.TOKEN_REWARDS,
    tokenDexSnapshot?.token?.tokenREWARDSAddress,
  );
  const routerAddress = pickAddress(
    tokenDexSnapshot?.dex?.routerAddress,
    tokenDexSnapshot?.dex?.router?.routerAddress,
    buybackSnapshot?.BUYBACK?.router,
    dripSnapshot?.DRIPLM?.router,
    liquiditySnapshot?.manager?.router,
  );
  const pairAddress = pickAddress(
    tokenDexSnapshot?.dex?.pair?.address,
    tokenDexSnapshot?.dex?.pairAddress,
  );
  const pickTokenDisplay = (...values) =>
    pickFormatted((value) => formatFlowToken(value, tokenDecimals), ...values);
  const pickNativeDisplay = (...values) =>
    pickFormatted(formatFlowNative, ...values);

  const pairBiggiDisplay = pickTokenDisplay(pairReserves?.token);
  const pairNativeDisplay = pickNativeDisplay(pairReserves?.native);
  const tradableSummary = [
    { label: "Pair BIGGI", value: pairBiggiDisplay },
    { label: "Pair POL", value: pairNativeDisplay },
    { label: "Pair", value: shortAddress(pairAddress) },
  ];

  const standbySummary = [
    {
      label: "Reserve waiting",
      value: pickTokenDisplay(reserve.waitingBiggi),
    },
    {
      label: "DEX refill",
      value: pickTokenDisplay(reserve.dexRefillBiggi),
    },
    {
      label: "Reserve BIGGI",
      value: pickTokenDisplay(live?.token?.reserve, reserve.biggiBalance),
    },
  ];

  const treasurySummary = [
    {
      label: "BIGGI acquired",
      value: pickTokenDisplay(buy.totalBiggiAcquired),
    },
    {
      label: "Treasury BIGGI",
      value: pickTokenDisplay(live?.token?.treasury, treasury.biggiBalance),
    },
    {
      label: "Treasury POL",
      value: pickNativeDisplay(native?.treasury, treasury.maticBalance),
    },
  ];

  const dripSummary = [
    {
      label: "Distributor BIGGI",
      value: pickTokenDisplay(
        live?.token?.dripDistributor,
        dripDistributor.balance,
        dripDistributor.tokenBalance,
      ),
    },
    {
      label: "Sold on DEX",
      value: pickTokenDisplay(dripLm.totalSoldTokens),
    },
    {
      label: "Native forwarded",
      value: pickNativeDisplay(
        dripLm.totalNativeForwarded,
        dripLm.nativeBalance,
      ),
    },
  ];

  const biggiLifecycleRows = [
    {
      label: "BUYBACK acquired",
      value: pickTokenDisplay(buy.totalBiggiAcquired),
    },
    {
      label: "Treasury BIGGI live",
      value: pickTokenDisplay(live?.token?.treasury, treasury.biggiBalance),
    },
    {
      label: "Reserve BIGGI live",
      value: pickTokenDisplay(live?.token?.reserve, reserve.biggiBalance),
    },
    {
      label: "Reserve waiting",
      value: pickTokenDisplay(reserve.waitingBiggi),
    },
    {
      label: "Reserve DEX refill",
      value: pickTokenDisplay(reserve.dexRefillBiggi),
    },
    {
      label: "DRIP distributor live",
      value: pickTokenDisplay(
        live?.token?.dripDistributor,
        dripDistributor.balance,
        dripDistributor.tokenBalance,
      ),
    },
    {
      label: "TokenRewards live",
      value: pickTokenDisplay(
        live?.token?.tokenRewards,
        tokenDexSnapshot?.token?.balances?.tokenREWARDS,
      ),
    },
    {
      label: "DEX pair BIGGI tradable",
      value: pairBiggiDisplay,
    },
  ];

  const nativeLifecycleRows = [
    {
      label: "BUYBACK native in",
      value: pickNativeDisplay(
        native?.buybackTotalReceived,
        buy.totalNativeReceived,
      ),
    },
    {
      label: "BUYBACK native spent",
      value: pickNativeDisplay(buy.totalNativeSpent),
    },
    {
      label: "Treasury POL live",
      value: pickNativeDisplay(native?.treasury, treasury.maticBalance),
    },
    {
      label: "Reserve POL live",
      value: pickNativeDisplay(native?.reserve, reserve.maticBalance),
    },
    {
      label: "Reserve POL total in",
      value: pickNativeDisplay(reserve.totalMaticReceived),
    },
    {
      label: "DRIPLM native forwarded",
      value: pickNativeDisplay(dripLm.totalNativeForwarded),
    },
    {
      label: "DRIPLM native live",
      value: pickNativeDisplay(dripLm.nativeBalance),
    },
    {
      label: "DEX pair POL tradable",
      value: pairNativeDisplay,
    },
  ];

  const connectionChecks = [
    buildAddressCheck("Treasury address", [
      addrs?.treasury,
      buybackSnapshot?.treasury?.address,
      liquiditySnapshot?.treasury?.address,
    ]),
    buildAddressCheck("Reserve address", [
      addrs?.reserve,
      liquiditySnapshot?.reserve?.address,
      tokenDexSnapshot?.token?.reserveAddress,
      dripSnapshot?.DRIPLM?.reserve,
    ]),
    buildAddressCheck("BUYBACK address", [
      addrs?.buyback,
      addrs?.BUYBACK,
      addrs?.BUYBACK_AGENT,
      buybackSnapshot?.BUYBACK?.address,
      dripSnapshot?.DRIPLM?.buybackAgent,
    ]),
    buildAddressCheck("DRIP distributor", [
      addrs?.DRIPDistributor,
      addrs?.DRIP_DISTRIBUTOR,
      dripSnapshot?.distributor?.address,
      tokenDexSnapshot?.token?.DRIPDistributorAddress,
    ]),
    buildAddressCheck("TokenRewards", [
      addrs?.tokenREWARDS,
      addrs?.TOKEN_REWARDS,
      tokenDexSnapshot?.token?.tokenREWARDSAddress,
    ]),
    buildAddressCheck("Router", [
      tokenDexSnapshot?.dex?.routerAddress,
      buybackSnapshot?.BUYBACK?.router,
      dripSnapshot?.DRIPLM?.router,
      liquiditySnapshot?.manager?.router,
    ]),
  ];

  return (
    <div className={styles.ecoFlowGrid}>
      <Card
        title="LIVE BALANCES"
        subtitle="Current on-chain balances and routed native totals of the key contracts"
      >
        {loading ? <div className="biggi-muted">Loading...</div> : null}
        {error ? (
          <div className="biggi-muted">{String(error?.message || error)}</div>
        ) : null}
        <div className={styles.ecoFlowTwoCols}>
          <div>
            <div className={styles.ecoMiniTitle}>Native (POL)</div>
            <Line label="Reserve" value={formatFlowNative(native?.reserve)} />
            <Line
              label="Buyback total in"
              value={formatFlowNative(native?.buybackTotalReceived)}
            />
            <Line label="Treasury" value={formatFlowNative(native?.treasury)} />
            <Line
              label="Community"
              value={formatFlowNative(communityDisplay)}
            />
            <Line
              label="CollectionRewards"
              value={formatFlowNative(native?.collectionRewards)}
            />
          </div>

          <div>
            <div className={styles.ecoMiniTitle}>BIGGI</div>
            <Line
              label="Reserve"
              value={formatFlowToken(live?.token?.reserve, tokenDecimals)}
            />
            <Line
              label="TokenRewards"
              value={formatFlowToken(live?.token?.tokenRewards, tokenDecimals)}
            />
            <Line
              label="DRIP Distributor"
              value={formatFlowToken(
                live?.token?.dripDistributor,
                tokenDecimals,
              )}
            />
            <Line
              label="Treasury"
              value={formatFlowToken(live?.token?.treasury, tokenDecimals)}
            />
            <Line
              label="Buyback"
              value={formatFlowToken(live?.token?.buyback, tokenDecimals)}
            />
          </div>
        </div>
      </Card>

      <Card
        title="SYSTEM LIFECYCLE"
        subtitle="Real routing between BUYBACK, Treasury, Reserve, DRIP, TokenRewards, and live DEX liquidity"
      >
        <div className={styles.ecoFlowTwoCols}>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>Tradable DEX liquidity</div>
            {tradableSummary.map((item) => (
              <Line key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>Reserve standby buckets</div>
            {standbySummary.map((item) => (
              <Line key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>BUYBACK to Treasury</div>
            {treasurySummary.map((item) => (
              <Line key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <div className={styles.ecoFlowSplitCard}>
            <div className={styles.ecoMiniTitle}>DRIP route</div>
            {dripSummary.map((item) => (
              <Line key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
        <div className={styles.ecoTables}>
          <div className={styles.ecoTable}>
            <div className={styles.ecoTableHeader}>BIGGI lifecycle</div>
            {biggiLifecycleRows.map((row) => (
              <div key={row.label} className={styles.ecoTableRow}>
                <span className={styles.ecoTableLabel}>{row.label}</span>
                <span className={styles.ecoTableValue}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.ecoTable}>
            <div className={styles.ecoTableHeader}>Native lifecycle</div>
            {nativeLifecycleRows.map((row) => (
              <div key={row.label} className={styles.ecoTableRow}>
                <span className={styles.ecoTableLabel}>{row.label}</span>
                <span className={styles.ecoTableValue}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.ecoTable}>
            <div className={styles.ecoTableHeader}>Connection checks</div>
            {connectionChecks.map((row) => (
              <div
                key={row.label}
                className={`${styles.ecoTableRow} ${styles.ecoTableRowThree}`}
              >
                <span className={styles.ecoTableLabel}>{row.label}</span>
                <span className={styles.ecoTableValue}>{row.detail}</span>
                <span className={`${styles.ecoTableStatus} ${row.toneClass}`}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="CONTRACTS" subtitle="Addresses used in this panel">
        <AddressLine
          label="BIGGI Token"
          address={meta?.address}
          href={explorerLink(meta?.address)}
        />
        <AddressLine
          label="Distributor"
          address={distributorAddress}
          href={explorerLink(distributorAddress)}
        />
        <AddressLine
          label="Reserve"
          address={reserveAddress}
          href={explorerLink(reserveAddress)}
        />
        <AddressLine
          label="Buyback"
          address={buybackAddress}
          href={explorerLink(buybackAddress)}
        />
        <AddressLine
          label="Treasury"
          address={treasuryAddress}
          href={explorerLink(treasuryAddress)}
        />
        <AddressLine
          label="Community"
          address={addrs?.communityCenter}
          href={explorerLink(addrs?.communityCenter)}
        />
        <AddressLine
          label="CollectionRewards"
          address={addrs?.collectionRewards}
          href={explorerLink(addrs?.collectionRewards)}
        />
        <AddressLine
          label="TokenRewards"
          address={tokenRewardsAddress}
          href={explorerLink(tokenRewardsAddress)}
        />
        <AddressLine
          label="DRIP Distributor"
          address={dripDistributorAddress}
          href={explorerLink(dripDistributorAddress)}
        />
        <AddressLine
          label="DRIPLM"
          address={dripLm.address}
          href={explorerLink(dripLm.address)}
        />
        <AddressLine
          label="Router"
          address={routerAddress}
          href={explorerLink(routerAddress)}
        />
        <AddressLine
          label="DEX Pair"
          address={pairAddress}
          href={explorerLink(pairAddress)}
        />
      </Card>
    </div>
  );
}

export default React.memo(FlowTab);
