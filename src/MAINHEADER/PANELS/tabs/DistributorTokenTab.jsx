import * as React from "react";
import "../TokenomicsPanel.css";
import StatCard from "../components/StatCard";
import DestinationsTable from "../components/DestinationsTable";
import LineChart from "../charts/LineChart";
import TokenFlow from "../★☆ECOSYSTEM☆★/★FLOW★/TokenFlow.jsx";
import useDistributorHistory from "../../../hooks/tokenomics/useDistributorHistory";
import { ADDR } from "../../../utils/addresses";
import { explorerBaseFor } from "../../../utils/explorer";
import "./DistributorTokenTab.css";

const toNumber = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const formatAmount = (value, unit, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })} ${unit}`.trim();
};

const formatMaybeAmount = (value, unit, digits = 2) => {
  const num = toNumber(value);
  if (num != null) return formatAmount(num, unit, digits);
  if (value == null || value === "") return "--";
  const raw = String(value).trim();
  return raw.includes(unit) ? raw : `${raw} ${unit}`;
};

const shortAddr = (value) => {
  if (!value) return "--";
  const raw = String(value);
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
};

const shareOf = (value, total) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0)
    return "--";
  return `${((value / total) * 100).toFixed(1)}%`;
};

const DistributorTokenTab = ({
  distributorData,
  tokenSnapshot,
  buybackSnapshot,
  buybackFallback,
  dripAvailable,
  tokenTotalSupply,
}) => {
  const { points: distributorHistory } = useDistributorHistory(distributorData);

  const nativeTotals = React.useMemo(() => {
    const pendingReserve = toNumber(distributorData?.pendingReserve);
    const pendingTreasury = toNumber(distributorData?.pendingTreasury);
    const pendingBuyback = toNumber(distributorData?.pendingBuybackAgent);
    const pendingCollection = toNumber(
      distributorData?.pendingCollectionRewards,
    );
    const pendingCommunity = toNumber(distributorData?.pendingCommunityCenter);

    const sumPending = [
      pendingReserve,
      pendingTreasury,
      pendingBuyback,
      pendingCollection,
      pendingCommunity,
    ]
      .filter((val) => Number.isFinite(val))
      .reduce((acc, val) => acc + val, 0);

    const totalPendingRaw = toNumber(distributorData?.totalPending);
    const totalPending = Number.isFinite(totalPendingRaw)
      ? totalPendingRaw
      : sumPending;

    return {
      totalPending,
      totalReceived: toNumber(
        distributorData?.totalReceived ?? distributorData?.totalDistributed,
      ),
    };
  }, [distributorData]);

  const tokenBalances = React.useMemo(() => {
    const reserve = tokenSnapshot?.token?.balances?.reserveNumeric ?? null;
    const dripDistributor =
      tokenSnapshot?.token?.balances?.dripDistributorNumeric ?? null;
    const tokenRewards =
      tokenSnapshot?.token?.balances?.tokenRewardsNumeric ?? null;
    const treasury = tokenSnapshot?.token?.balances?.treasuryNumeric ?? null;
    const buyback =
      buybackSnapshot?.buyback?.biggiBalanceNumeric ??
      toNumber(buybackSnapshot?.buyback?.biggiBalance) ??
      toNumber(buybackFallback);

    const total = [reserve, dripDistributor, tokenRewards, treasury, buyback]
      .filter((val) => Number.isFinite(val))
      .reduce((acc, val) => acc + val, 0);

    return {
      reserve,
      dripDistributor,
      tokenRewards,
      treasury,
      buyback,
      total,
    };
  }, [tokenSnapshot, buybackSnapshot, buybackFallback]);

  const tokenCapTotal = React.useMemo(() => {
    const capFromSnapshot = toNumber(
      tokenSnapshot?.token?.capNumeric ?? tokenSnapshot?.token?.cap,
    );
    const totalSupplyFromSnapshot = toNumber(
      tokenSnapshot?.token?.totalSupplyNumeric ??
        tokenSnapshot?.token?.totalSupply,
    );
    const totalSupplyProp = toNumber(tokenTotalSupply);
    return (
      capFromSnapshot ??
      totalSupplyFromSnapshot ??
      totalSupplyProp ??
      tokenBalances.total
    );
  }, [tokenSnapshot, tokenTotalSupply, tokenBalances.total]);

  const biggiDestinations = React.useMemo(() => {
    const { total, reserve, dripDistributor, tokenRewards, treasury, buyback } =
      tokenBalances;
    return [
      {
        label: "Reserve",
        amount: formatAmount(reserve, "BIGGI"),
        share: shareOf(reserve, total),
      },
      {
        label: "Drip Distributor",
        amount: formatAmount(dripDistributor, "BIGGI"),
        share: shareOf(dripDistributor, total),
      },
      {
        label: "TokenRewards",
        amount: formatAmount(tokenRewards, "BIGGI"),
        share: shareOf(tokenRewards, total),
      },
      {
        label: "Treasury",
        amount: formatAmount(treasury, "BIGGI"),
        share: shareOf(treasury, total),
      },
      {
        label: "Buyback",
        amount: formatAmount(buyback, "BIGGI"),
        share: shareOf(buyback, total),
      },
    ];
  }, [tokenBalances]);

  const tokenCapDestinations = React.useMemo(() => {
    const { reserve, dripDistributor, tokenRewards, treasury, buyback } =
      tokenBalances;
    const capTotal = tokenCapTotal;
    return [
      {
        label: "Reserve (cap)",
        amount: formatAmount(reserve, "BIGGI"),
        share: shareOf(reserve, capTotal),
      },
      {
        label: "Drip Distributor (cap)",
        amount: formatAmount(dripDistributor, "BIGGI"),
        share: shareOf(dripDistributor, capTotal),
      },
      {
        label: "TokenRewards (cap)",
        amount: formatAmount(tokenRewards, "BIGGI"),
        share: shareOf(tokenRewards, capTotal),
      },
      {
        label: "Treasury (cap)",
        amount: formatAmount(treasury, "BIGGI"),
        share: shareOf(treasury, capTotal),
      },
      {
        label: "Buyback (cap)",
        amount: formatAmount(buyback, "BIGGI"),
        share: shareOf(buyback, capTotal),
      },
    ].filter((item) => item.amount !== "--" || item.share !== "--");
  }, [tokenBalances, tokenCapTotal]);

  const tokenHooks = React.useMemo(() => {
    const hooks = tokenSnapshot?.token?.addresses || {};
    const explorerBase =
      explorerBaseFor(80002) || "https://amoy.polygonscan.com";
    const linkFor = (address) =>
      address ? `${explorerBase}/address/${address}` : null;
    return [
      {
        label: "BIGGI token",
        address: tokenSnapshot?.token?.address || ADDR.BIGGI,
      },
      { label: "Reserve hook", address: hooks.reserve || ADDR.RESERVE },
      {
        label: "DripDistributor hook",
        address: hooks.dripDistributor || ADDR.DRIP_DISTRIBUTOR,
      },
      {
        label: "TokenRewards hook",
        address: hooks.tokenRewards || ADDR.TOKEN_REWARDS,
      },
      { label: "Treasury", address: ADDR.TREASURY },
      { label: "Distributor", address: ADDR.DISTRIBUTOR },
    ].map((item) => ({
      ...item,
      href: linkFor(item.address),
    }));
  }, [tokenSnapshot]);

  const historyPoints = distributorHistory;

  return (
    <section className="distributor-token-tab">
      <div className="distributor-token-tab__header">
        <h3>DISTRIBUTOR TO BIGGI ECOSYSTEM</h3>
        <p>Transparent flow from the distributor to core modules.</p>
      </div>
      <div className="distributor-token-tab__grid">
        <StatCard
          label="Distributor native pool"
          value={formatAmount(nativeTotals.totalPending, "POL")}
          hint="Pending distribution"
          accent="primary"
          tone="native"
        />
        <StatCard
          label="Total received"
          value={formatAmount(nativeTotals.totalReceived, "POL")}
          hint="Lifetime"
          tone="native"
        />
        <StatCard
          label="BIGGI available to mint"
          value={formatMaybeAmount(dripAvailable, "BIGGI")}
          hint="Cap / reserve"
          tone="token"
        />
        <StatCard
          label="Total BIGGI supply"
          value={formatMaybeAmount(tokenTotalSupply, "BIGGI")}
          hint="Tokenomics"
          accent="secondary"
          tone="token"
        />
      </div>
      <div className="distributor-token-tab__content">
        <div className="distributor-token-tab__column">
          <DestinationsTable
            title="BIGGI token cap distribution"
            items={tokenCapDestinations}
          />
          <TokenFlow
            flows={biggiDestinations.map((item) => ({
              label: item.label,
              amount: item.amount,
              hint: item.share,
            }))}
          />
        </div>
        <div className="distributor-token-tab__column">
          <div className="distributor-token-tab__chart-wrap">
            <header>
              <h4>Distributor total received</h4>
              <span>On-chain total received over time</span>
            </header>
            <LineChart points={historyPoints} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DistributorTokenTab;

