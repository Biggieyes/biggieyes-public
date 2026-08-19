// src/features/tokenomics/EcosystemPanel.jsx
// BIGGI ECOSYSTEM — view-only tokenomics dashboard

import * as React from "react";
import { formatUnits } from "ethers";

import styles from "./styles/BiggiToken.module.css";

import { useWeb3 } from "@/providers/Web3Provider";

import useFlowSnapshot from "@/hooks/tokenomics/useFlowSnapshot";
import useBUYBACKTreasurySnapshot from "@/hooks/tokenomics/useBUYBACKTreasurySnapshot";
import useBUYBACKTreasuryHistory from "@/hooks/tokenomics/useBuybackTreasuryHistory";
import useDRIPSnapshot from "@/hooks/tokenomics/useDRIPSnapshot";
import useDRIPHistory from "@/hooks/tokenomics/useDripHistory";
import useLiquiditySnapshot from "@/hooks/tokenomics/useLiquiditySnapshot";
import useLiquidityHistory from "@/hooks/tokenomics/useLiquidityHistory";
import useTokenDexSnapshot from "@/hooks/tokenomics/useTokenDexSnapshot";
import useTokenDexHistory from "@/hooks/tokenomics/useTokenDexHistory";
import useDistributorSnapshot from "@/hooks/tokenomics/useDistributorSnapshot";
import useDistributorHistory from "@/hooks/tokenomics/useDistributorHistory";
import usePolicySnapshot from "@/hooks/tokenomics/usePolicySnapshot";
import { toNumberSafe } from "@/hooks/tokenomics/_utils";
import resolveBuybackSnapshot from "./utils/resolveBuybackSnapshot";

import EcosystemErrorBoundary from "./components/EcosystemErrorBoundary.jsx";
import HeroStats from "./HeroStats.jsx";
import TabsBar from "./TabsBar.jsx";
import Card from "./components/Card.jsx";
import MainnetDataRail from "./components/MainnetDataRail.jsx";
import { shortAddr, explorerLink, isAddress } from "./utils/format";
import { ADDR } from "@/shared/utils/addresses.js";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";

const FlowTab = React.lazy(() => import("./tabs/FlowTab.jsx"));
const PolicyTab = React.lazy(() => import("./tabs/PolicyTab.jsx"));
const BUYBACKTreasuryTab = React.lazy(
  () => import("./tabs/BUYBACKTreasuryTab.jsx"),
);
const DRIPTab = React.lazy(() => import("./tabs/DRIPTab.jsx"));
const HistoryTab = React.lazy(() => import("./tabs/HistoryTab.jsx"));
const DistributorTokenTab = React.lazy(
  () => import("./tabs/DistributorTokenTab.jsx"),
);
const TokenomicsPanel = React.lazy(() => import("./sections/TokenomicsPanel.jsx"));
const TransparencyTab = React.lazy(() => import("./tabs/TransparencyTab.jsx"));

const TABS = [
  { key: "flow", label: "FLOW" },
  { key: "distributor", label: "DISTRIBUTOR" },
  { key: "buyback", label: "BUYBACK" },
  { key: "drip", label: "DRIP" },
  { key: "liquidity", label: "RESERVE / LM" },
  { key: "dex", label: "TOKEN / DEX" },
  { key: "history", label: "HISTORY" },
  { key: "transparency", label: "TRANSPARENCY" },
  { key: "policy", label: "POLICY" },
];

const TAB_META = {
  flow: {
    title: "FLOW",
    subtitle:
      "Trace how mint revenue, liquidity routing, buyback logic, and reward streams move across the ecosystem before any transaction is signed.",
    accent: "#ffe800",
    accentSoft: "rgba(255, 232, 0, 0.22)",
    accentGlow: "rgba(255, 232, 0, 0.36)",
  },
  distributor: {
    title: "DISTRIBUTOR",
    subtitle:
      "Inspect multi-collection distribution rails, reward splits, and live allocation status for community and collection buckets.",
    accent: "#5ddcff",
    accentSoft: "rgba(93, 220, 255, 0.22)",
    accentGlow: "rgba(93, 220, 255, 0.36)",
  },
  buyback: {
    title: "BUYBACK",
    subtitle:
      "Review buyback routing, treasury impact, and executed swap outcomes through the live buyback control surface.",
    accent: "#ff8a00",
    accentSoft: "rgba(255, 138, 0, 0.22)",
    accentGlow: "rgba(255, 138, 0, 0.36)",
  },
  drip: {
    title: "DRIP",
    subtitle:
      "Monitor DRIP balances, reward schedule pressure, and distributor-linked emissions in the current snapshot.",
    accent: "#27d9d2",
    accentSoft: "rgba(39, 217, 210, 0.22)",
    accentGlow: "rgba(39, 217, 210, 0.36)",
  },
  liquidity: {
    title: "RESERVE / LM",
    subtitle:
      "Track reserve balances, liquidity manager state, vault exposure, and supporting pool history from one section.",
    accent: "#6bee5b",
    accentSoft: "rgba(107, 238, 91, 0.22)",
    accentGlow: "rgba(107, 238, 91, 0.36)",
  },
  policy: {
    title: "POLICY",
    subtitle:
      "Read the active on-chain policy limits, slippage rules, deadlines, and safety parameters that guide the protocol.",
    accent: "#ff5da2",
    accentSoft: "rgba(255, 93, 162, 0.22)",
    accentGlow: "rgba(255, 93, 162, 0.36)",
  },
  dex: {
    title: "TOKEN / DEX",
    subtitle:
      "Compare token supply, derived price, LP health, and DEX reserve structure in the BIGGI trading layer.",
    accent: "#b584ff",
    accentSoft: "rgba(181, 132, 255, 0.22)",
    accentGlow: "rgba(181, 132, 255, 0.36)",
  },
  history: {
    title: "HISTORY",
    subtitle:
      "Browse recent buyback, liquidity manager, and DRIP timeline events for a fast operational audit trail.",
    accent: "#f7d400",
    accentSoft: "rgba(247, 212, 0, 0.22)",
    accentGlow: "rgba(247, 212, 0, 0.36)",
  },
  transparency: {
    title: "TRANSPARENCY",
    subtitle:
      "Open the full verifiable balance sheet, address wiring, and subsystem snapshots for end-to-end on-chain transparency.",
    accent: "#8fe8ff",
    accentSoft: "rgba(143, 232, 255, 0.22)",
    accentGlow: "rgba(143, 232, 255, 0.36)",
  },
};

const FLOW_INTERVAL = 12_000;
const BUYBACK_INTERVAL = 15_000;
const POLICY_INTERVAL = 18_000;
const DRIP_INTERVAL = 15_000;
const LIQUIDITY_INTERVAL = 16_000;
const DEX_INTERVAL = 15_000;
const DISTRIBUTOR_INTERVAL = 15_000;
const HISTORY_LIMIT = 72;
const HISTORY_MIN_INTERVAL = 10_000;
const FLOW_DELAY = 0;
const TOKEN_DEX_DELAY = 250;
const LIQUIDITY_DELAY = 500;
const BUYBACK_DELAY = 750;
const POLICY_DELAY = 875;
const DRIP_DELAY = 1000;
const DISTRIBUTOR_DELAY = 1250;
const REFRESH_GAP_MS = 1100;
const SNAPSHOT_CACHE_TTL_MS = 60_000;
const SNAPSHOT_COMPARE_IGNORE_KEYS = ["ts", "tsLabel"];

export default function EcosystemPanel({
  autoOpenInfo = false,
  onActiveSectionChange,
}) {
  const { chainId, account } = useWeb3();
  const snapshotScope = chainId ?? "unknown";
  const [active, setActive] = React.useState("flow");
  const activeTabMeta = TAB_META[active] || TAB_META.flow;
  const renderedTab = React.useDeferredValue(active);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const autoInfoOpened = React.useRef(false);
  const [wiringOpen, setWiringOpen] = React.useState(false);
  const isLive = true;
  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      setInfoOpen(true);
      autoInfoOpened.current = true;
    }
  }, [autoOpenInfo]);

  React.useEffect(() => {
    onActiveSectionChange?.(activeTabMeta);
  }, [activeTabMeta, onActiveSectionChange]);

  const handleTabChange = React.useCallback((next) => {
    const run =
      typeof React.startTransition === "function"
        ? React.startTransition
        : (fn) => fn();
    run(() => setActive(next));
  }, []);

  const isFlowFocused =
    active === "flow" || active === "transparency" || wiringOpen;
  const isDistributorFocused =
    active === "distributor" || active === "transparency" || wiringOpen;
  const needsDistributorHistory =
    active === "distributor" || active === "transparency";
  const needsBuybackHistory =
    active === "buyback" || active === "history" || active === "transparency";
  const needsDripHistory =
    active === "drip" || active === "history" || active === "transparency";
  const needsLiquidityHistory =
    active === "liquidity" || active === "history" || active === "transparency";
  const needsDexHistory = active === "dex" || active === "transparency";
  const isPolicyFocused = active === "policy" || active === "transparency";

  const isBuybackFocused =
    needsBuybackHistory || active === "distributor" || wiringOpen;
  const isDripFocused =
    needsDripHistory || active === "distributor";
  const isLiquidityFocused = needsLiquidityHistory || wiringOpen;
  const isDexFocused =
    needsDexHistory || active === "distributor" || wiringOpen;

  // Prefetch only the always-visible summary feeds. Other sections load on demand.
  const needsFlow = true;
  const needsDistributor = isDistributorFocused;
  const needsBuyback = isBuybackFocused;
  const needsPolicy = isPolicyFocused;
  const needsDrip = isDripFocused;
  const needsLiquidity = isLiquidityFocused;
  const needsDex =
    active === "flow" ||
    active === "dex" ||
    active === "distributor" ||
    active === "transparency" ||
    wiringOpen;

  // Performance mode: poll only focused/visible sections, disable background polling.
  const flowIntervalMs = isFlowFocused ? FLOW_INTERVAL : 0;
  const distributorIntervalMs = isDistributorFocused ? DISTRIBUTOR_INTERVAL : 0;
  const buybackIntervalMs = isBuybackFocused ? BUYBACK_INTERVAL : 0;
  const policyIntervalMs = isPolicyFocused ? POLICY_INTERVAL : 0;
  const dripIntervalMs = isDripFocused ? DRIP_INTERVAL : 0;
  const liquidityIntervalMs = isLiquidityFocused ? LIQUIDITY_INTERVAL : 0;
  const dexIntervalMs = isDexFocused ? DEX_INTERVAL : 0;

  const historyOptions = React.useMemo(
    () => ({ limit: HISTORY_LIMIT, minIntervalMs: HISTORY_MIN_INTERVAL }),
    [],
  );
  const snapshotBaseOptions = React.useMemo(
    () => ({
      sanitize: false,
      minRefreshGapMs: REFRESH_GAP_MS,
      cacheTtlMs: SNAPSHOT_CACHE_TTL_MS,
      dedupeSnapshot: true,
      compareIgnoreKeys: SNAPSHOT_COMPARE_IGNORE_KEYS,
    }),
    [],
  );

  const infoItems = React.useMemo(
    () => [
      {
        label: "FLOW",
        description: [
          "Full tokenomics flow and value routing.",
          "Shows how mint value moves into reserves, buyback, and rewards.",
        ],
      },
      {
        label: "DISTRIBUTOR",
        description: [
          "Multi-collection distribution and reward splits.",
          "Tracks allocation to community/collection pools.",
        ],
      },
      {
        label: "BUYBACK",
        description: [
          "Buyback stats and routing outcomes.",
          "Shows executed swaps and treasury impact.",
        ],
      },
      {
        label: "DRIP",
        description: [
          "DRIP rewards schedule and balances.",
          "Displays emission status and available rewards.",
        ],
      },
      {
        label: "RESERVE / LM",
        description: [
          "Reserve and liquidity manager overview.",
          "Shows POL/BIGGI balances and LM actions.",
        ],
      },
      {
        label: "TOKEN / DEX",
        description: [
          "Token price + DEX metrics.",
          "Reserves, LP health, and derived price.",
        ],
      },
      {
        label: "TRANSPARENCY",
        description: [
          "On-chain wiring and transparency stats.",
          "All addresses and flows are verifiable on-chain.",
        ],
      },
      {
        label: "HISTORY",
        description: [
          "Recent buyback, LM, and DRIP operations.",
          "Snapshot timeline for quick audits.",
        ],
      },
      {
        label: "POLICY",
        description: [
          "On-chain policy parameters.",
          "Controls slippage, deadlines, and safety limits.",
        ],
      },
    ],
    [],
  );

  // --- snapshots (auto refresh) ---
  const flow = useFlowSnapshot({
    intervalMs: isLive && needsFlow ? flowIntervalMs : 0,
    immediate: needsFlow,
    initialDelayMs: needsFlow ? (isFlowFocused ? 0 : FLOW_DELAY) : 0,
    refreshKey: isFlowFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:flow`,
    ...snapshotBaseOptions,
  });
  const policy = usePolicySnapshot({
    intervalMs: isLive && needsPolicy ? policyIntervalMs : 0,
    immediate: needsPolicy,
    initialDelayMs: needsPolicy ? (isPolicyFocused ? 0 : POLICY_DELAY) : 0,
    refreshKey: isPolicyFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:policy`,
    ...snapshotBaseOptions,
  });
  const buyback = useBUYBACKTreasurySnapshot({
    intervalMs: isLive && needsBuyback ? buybackIntervalMs : 0,
    immediate: needsBuyback,
    initialDelayMs: needsBuyback ? (isBuybackFocused ? 0 : BUYBACK_DELAY) : 0,
    refreshKey: isBuybackFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:buyback`,
    ...snapshotBaseOptions,
  });
  const drip = useDRIPSnapshot({
    intervalMs: isLive && needsDrip ? dripIntervalMs : 0,
    immediate: needsDrip,
    initialDelayMs: needsDrip ? (isDripFocused ? 0 : DRIP_DELAY) : 0,
    refreshKey: isDripFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:drip`,
    ...snapshotBaseOptions,
  });
  const liquidity = useLiquiditySnapshot({
    intervalMs: isLive && needsLiquidity ? liquidityIntervalMs : 0,
    immediate: needsLiquidity,
    initialDelayMs: needsLiquidity
      ? isLiquidityFocused
        ? 0
        : LIQUIDITY_DELAY
      : 0,
    refreshKey: isLiquidityFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:liquidity`,
    ...snapshotBaseOptions,
  });
  const tokenDex = useTokenDexSnapshot({
    intervalMs: isLive && needsDex ? dexIntervalMs : 0,
    immediate: needsDex,
    initialDelayMs: needsDex ? (isDexFocused ? 0 : TOKEN_DEX_DELAY) : 0,
    refreshKey: isDexFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:dex`,
    ...snapshotBaseOptions,
  });
  const distributor = useDistributorSnapshot({
    intervalMs: isLive && needsDistributor ? distributorIntervalMs : 0,
    immediate: needsDistributor,
    initialDelayMs: needsDistributor
      ? isDistributorFocused
        ? 0
        : DISTRIBUTOR_DELAY
      : 0,
    refreshKey: isDistributorFocused ? active : null,
    cacheKey: `ecosystem:${snapshotScope}:distributor`,
    ...snapshotBaseOptions,
  });

  // --- histories (client-side buffers) ---
  const buybackHistory = useBUYBACKTreasuryHistory(
    needsBuybackHistory ? buyback.snapshot : null,
    historyOptions,
  );
  const dripHistory = useDRIPHistory(
    needsDripHistory ? drip.snapshot : null,
    historyOptions,
  );
  const liquidityHistory = useLiquidityHistory(
    needsLiquidityHistory ? liquidity.snapshot : null,
    historyOptions,
  );
  const tokenDexHistory = useTokenDexHistory(
    needsDexHistory ? tokenDex.snapshot : null,
    historyOptions,
  );
  const distributorHistory = useDistributorHistory(
    needsDistributorHistory ? distributor.snapshot : null,
    historyOptions,
  );

  const resolvedBuybackSnapshot = React.useMemo(
    () =>
      resolveBuybackSnapshot(buyback.snapshot, {
        flowSnapshot: flow.snapshot,
        liquiditySnapshot: liquidity.snapshot,
        tokenDexSnapshot: tokenDex.snapshot,
      }),
    [buyback.snapshot, flow.snapshot, liquidity.snapshot, tokenDex.snapshot],
  );

  const chainStatus = React.useMemo(
    () => ({ chainId, account, role: account ? "Connected" : "Viewer" }),
    [chainId, account],
  );
  const readerStatus = flow.snapshot?.readerStatus ?? null;

  const dexLiquidity = React.useMemo(() => {
    if (renderedTab !== "dex") return null;
    const p = tokenDex.snapshot?.dex?.pair;
    const r = p?.reserves;
    if (!r) return null;
    const derived = tokenDex.snapshot?.derived || {};
    return {
      reserveNative: toNumberSafe(r.native, 18),
      reserveBiggi: toNumberSafe(r.token, tokenDex.snapshot?.token?.decimals ?? 18),
      lpTotalSupply: toNumberSafe(p?.lpTotalSupply, 18),
      nativePerBiggi: derived.priceNativePerToken ?? null,
      biggiPerNative: derived.priceTokenPerNative ?? null,
      pairAddress: p.address ?? tokenDex.snapshot?.dex?.pairAddress ?? null,
    };
  }, [renderedTab, tokenDex.snapshot]);

  const pumpView = React.useMemo(() => {
    if (renderedTab !== "dex") return null;
    const p = tokenDex.snapshot?.dex?.pair;
    if (!p) return null;
    return {
      pair: {
        address: p.address,
        nativeReserve: toNumberSafe(p.reserves?.native, 18),
        biggiReserve: toNumberSafe(p.reserves?.token, tokenDex.snapshot?.token?.decimals ?? 18),
        lpTotalSupply: toNumberSafe(p.lpTotalSupply, 18),
      },
      derived: tokenDex.snapshot?.derived,
    };
  }, [renderedTab, tokenDex.snapshot]);

  const heroStats = React.useMemo(() => {
    const items = [];
    const tokenDecimals =
      tokenDex.snapshot?.token?.decimals ?? flow.snapshot?.tokenMeta?.decimals ?? 18;
    const priceNative = tokenDex.snapshot?.derived?.priceNativePerToken;
    const reserveNative =
      liquidity.snapshot?.reserve?.maticBalanceNumeric ??
      toNumberSafe(flow.snapshot?.liveBalances?.native?.reserve, 18);
    const lpLocked =
      liquidity.snapshot?.vault?.totalLpLockedNumeric ??
      toNumberSafe(readerStatus?.res?.lpBalanceInVault, 18);
    const treasuryBiggi =
      resolvedBuybackSnapshot?.treasury?.biggiBalanceNumeric ??
      toNumberSafe(flow.snapshot?.liveBalances?.token?.treasury, tokenDecimals);
    const treasuryNative =
      resolvedBuybackSnapshot?.treasury?.maticBalanceNumeric ??
      toNumberSafe(liquidity.snapshot?.treasury?.nativeBalance, 18) ??
      toNumberSafe(flow.snapshot?.liveBalances?.native?.treasury, 18);
    const dripAvailable =
      drip.snapshot?.distributor?.availableNumeric ??
      toNumberSafe(readerStatus?.drip?.availableTokens, tokenDecimals);

    if (Number.isFinite(priceNative)) {
      items.push({
        key: "price",
        label: "Price (POL / BIGGI)",
        value: priceNative.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        }),
        tone: "native",
      });
    }
    if (Number.isFinite(reserveNative)) {
      items.push({
        key: "reserve",
        label: "Reserve POL",
        value: reserveNative.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "native",
      });
    }
    if (Number.isFinite(lpLocked)) {
      items.push({
        key: "lp",
        label: "Vault LP locked",
        value: lpLocked.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "token",
      });
    }
    if (Number.isFinite(treasuryBiggi)) {
      items.push({
        key: "treasury",
        label: "Treasury BIGGI",
        value: treasuryBiggi.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "token",
      });
    }
    if (Number.isFinite(treasuryNative)) {
      items.push({
        key: "treasury-native",
        label: "Treasury POL",
        value: treasuryNative.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
        tone: "native",
      });
    }
    if (Number.isFinite(dripAvailable)) {
      items.push({
        key: "drip",
        label: "DRIP available",
        value: dripAvailable.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }),
      });
    }
    return items;
  }, [
    tokenDex.snapshot,
    liquidity.snapshot,
    resolvedBuybackSnapshot,
    drip.snapshot,
    flow.snapshot,
    readerStatus,
  ]);

  const tokenTotalSupply = React.useMemo(() => {
    if (renderedTab !== "distributor") return null;
    const total = tokenDex.snapshot?.token?.totalSupply;
    if (total == null) return null;
    try {
      const decimals = tokenDex.snapshot?.token?.decimals ?? 18;
      return formatUnits(total, decimals);
    } catch {
      return total?.toString?.() ?? null;
    }
  }, [renderedTab, tokenDex.snapshot]);

  const lastUpdatedLabel = React.useMemo(() => {
    const ts = Math.max(
      flow.snapshot?.ts || 0,
      policy.snapshot?.ts || 0,
      resolvedBuybackSnapshot?.ts || 0,
      drip.snapshot?.ts || 0,
      liquidity.snapshot?.ts || 0,
      tokenDex.snapshot?.ts || 0,
      distributor.snapshot?.ts || 0,
    );
    if (!ts) return null;
    const time = new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Updated ${time}`;
  }, [
    flow.snapshot,
    policy.snapshot,
    resolvedBuybackSnapshot,
    drip.snapshot,
    liquidity.snapshot,
    tokenDex.snapshot,
    distributor.snapshot,
  ]);

  const mainnetRailItems = React.useMemo(() => {
    const pickAddr = (...values) =>
      values.find((val) => typeof val === "string" && isAddress(val)) || null;
    const activeChainId = Number(chainId || ADDR.CHAIN_ID || 137);

    return [
      {
        label: "Network",
        value: `Polygon mainnet / chainId ${ADDR.CHAIN_ID || 137}`,
        tone: activeChainId === 137 ? "ok" : "warn",
      },
      {
        label: "Wallet",
        value: account ? shortAddr(account) : "Viewer mode",
        tone: account ? "ok" : "idle",
      },
      {
        label: "Core reader",
        address: pickAddr(ADDR.MAIN_READER, ADDR.READER),
      },
      {
        label: "Tokenomics status reader",
        address: pickAddr(ADDR.BIGGI_TOKENOMICS_READER, ADDR.TOKENOMIK_READER),
      },
      {
        label: "Rewards reader",
        address: pickAddr(
          ADDR.BIGGI_REWARDS_READER,
          ADDR.COLLECTION_REWARDS_READER,
        ),
      },
      {
        label: "DEX pair",
        address: pickAddr(
          tokenDex.snapshot?.dex?.pair?.address,
          tokenDex.snapshot?.dex?.pairAddress,
          ADDR.PAIR,
        ),
      },
      {
        label: "Last snapshot",
        value: lastUpdatedLabel || "Waiting for live data",
        tone: lastUpdatedLabel ? "ok" : "warn",
      },
    ];
  }, [account, chainId, lastUpdatedLabel, tokenDex.snapshot]);

  const wiringGroups = React.useMemo(() => {
    if (!wiringOpen) return [];
    const pickAddr = (...values) =>
      values.find((val) => typeof val === "string" && isAddress(val)) || null;

    const core = [
      {
        label: "BIGGI Token",
        address: pickAddr(
          tokenDex.snapshot?.token?.address,
          flow.snapshot?.tokenMeta?.address,
          ADDR.BIGGI_TOKEN,
          ADDR.BIGGI,
        ),
      },
      {
        label: "Distributor",
        address: pickAddr(
          distributor.snapshot?.address,
          flow.snapshot?.addresses?.distributor,
          ADDR.DISTRIBUTOR,
        ),
      },
      {
        label: "Reserve",
        address: pickAddr(
          liquidity.snapshot?.reserve?.address,
          flow.snapshot?.addresses?.reserve,
          ADDR.RESERVE,
        ),
      },
      {
        label: "Treasury",
        address: pickAddr(
          resolvedBuybackSnapshot?.treasury?.address,
          flow.snapshot?.addresses?.treasury,
          ADDR.TREASURY,
        ),
      },
      {
        label: "Buyback Agent",
        address: pickAddr(
          resolvedBuybackSnapshot?.BUYBACK?.address,
          flow.snapshot?.addresses?.BUYBACK,
          ADDR.BUYBACK_AGENT,
        ),
      },
      {
        label: "Policy",
        address: pickAddr(
          policy.snapshot?.policy?.address,
          policy.snapshot?.addresses?.policy,
          policy.snapshot?.addresses?.POLICY,
          ADDR.POLICY,
        ),
      },
    ];

    const liquidityStack = [
      {
        label: "Liquidity Manager",
        address: pickAddr(
          liquidity.snapshot?.manager?.address,
          liquidity.snapshot?.reserve?.liquidityManager,
          ADDR.LM,
        ),
      },
      {
        label: "Liquidity Vault",
        address: pickAddr(
          liquidity.snapshot?.vault?.address,
          ADDR.LIQUIDITY_VAULT,
        ),
      },
      {
        label: "Liquidity Automation",
        address: pickAddr(ADDR.LIQUIDITY_AUTOMATION),
      },
      {
        label: "Liquidity Setup",
        address: pickAddr(ADDR.LIQUIDITY_SETUP),
      },
      {
        label: "DEX Router",
        address: pickAddr(
          tokenDex.snapshot?.dex?.router?.address,
          tokenDex.snapshot?.dex?.router,
          ADDR.ROUTER,
        ),
      },
      {
        label: "DEX Factory",
        address: pickAddr(
          tokenDex.snapshot?.dex?.router?.factory,
          ADDR.FACTORY,
        ),
      },
      {
        label: "DEX Pair",
        address: pickAddr(
          tokenDex.snapshot?.dex?.pair?.address,
          tokenDex.snapshot?.dex?.pairAddress,
          ADDR.PAIR,
        ),
      },
      {
        label: "LP Price Feed",
        address: pickAddr(
          tokenDex.snapshot?.dex?.priceFeed?.address,
          ADDR.LP_PRICE_FEED,
        ),
      },
      {
        label: "Wrapped Native",
        address: pickAddr(
          tokenDex.snapshot?.dex?.weth,
          ADDR.WETH,
        ),
      },
    ];

    const rewards = [
      {
        label: "Collection Rewards",
        address: pickAddr(
          flow.snapshot?.addresses?.collectionRewards,
          ADDR.COLLECTION_REWARDS,
        ),
      },
      {
        label: "Token Rewards",
        address: pickAddr(
          flow.snapshot?.addresses?.tokenREWARDS,
          ADDR.TOKEN_REWARDS,
        ),
      },
      {
        label: "NFT Rewards",
        address: pickAddr(ADDR.NFT_REWARDS),
      },
      {
        label: "Community Center",
        address: pickAddr(
          flow.snapshot?.addresses?.communityCenter,
          ADDR.COMMUNITY_CENTER,
        ),
      },
      {
        label: "DRIP Distributor",
        address: pickAddr(
          flow.snapshot?.addresses?.DRIPDistributor,
          ADDR.DRIP_DISTRIBUTOR,
        ),
      },
      {
        label: "DRIP LM",
        address: pickAddr(ADDR.DRIP_LM),
      },
    ];

    return [
      { title: "Core contracts", rows: core },
      { title: "Liquidity & DEX", rows: liquidityStack },
      { title: "Rewards & Community", rows: rewards },
    ];
  }, [
    wiringOpen,
    flow.snapshot,
    distributor.snapshot,
    liquidity.snapshot,
    resolvedBuybackSnapshot,
    policy.snapshot,
    tokenDex.snapshot,
  ]);

  return (
    <EcosystemErrorBoundary>
      <section
        className={`rewards-grid biggi-skin ${styles.ecosystem}`}
        style={{
          "--eco-active-accent": activeTabMeta.accent,
          "--eco-active-accent-soft": activeTabMeta.accentSoft,
          "--eco-active-accent-glow": activeTabMeta.accentGlow,
        }}
      >
        <div className="rewards-grid__surface biggi-token-surface">
          <header className="rewards-grid__header biggi-header panel-header panel-header--ecosystem">
            <div className="rewards-grid__headline">
              <h2 className="rewards-grid__title">{activeTabMeta.title}</h2>
              <p className="rewards-grid__subtitle">
                {activeTabMeta.subtitle}
              </p>
            </div>

            <div className="biggi-header-right">
              <div className="biggi-status">
                <span className="biggi-status-dot" />
                <span>{chainStatus.role}</span>
              </div>
            </div>
          </header>

          <MainnetDataRail
            title="Tokenomics mainnet data"
            items={mainnetRailItems}
          />

          <HeroStats items={heroStats} className={styles.ecoHeroStats} />
          <div
            className={`panel-tabs-row ${styles.ecoToolbarRow}`}
          >
            <TabsBar tabs={TABS} active={active} onChange={handleTabChange} />
            <PanelInfoButton
              onClick={() => setInfoOpen(true)}
              ariaLabel="Ecosystem buttons info"
            />
          </div>
          {lastUpdatedLabel ? (
            <div className={`biggi-value mono ${styles.ecoUpdateStamp}`}>
              {lastUpdatedLabel}
            </div>
          ) : null}
          <PanelInfoModal
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            title="Ecosystem Panel"
            items={infoItems}
          />
          <div className={`biggi-content ${styles.ecoContent}`}>
            <React.Suspense
              fallback={
                <div className="flow-panel-box">
                  <div className="biggi-muted">Loading section...</div>
                </div>
              }
            >
              {renderedTab === "flow" ? (
                <FlowTab
                  snapshot={flow.snapshot}
                  buybackSnapshot={resolvedBuybackSnapshot}
                  dripSnapshot={drip.snapshot}
                  liquiditySnapshot={liquidity.snapshot}
                  tokenDexSnapshot={tokenDex.snapshot}
                  loading={flow.loading}
                  error={flow.error}
                />
              ) : null}

              {renderedTab === "buyback" ? (
                <BUYBACKTreasuryTab
                  snapshot={resolvedBuybackSnapshot}
                  readerStatus={readerStatus?.buy}
                  flowSnapshot={flow.snapshot}
                  dripSnapshot={drip.snapshot}
                  liquiditySnapshot={liquidity.snapshot}
                  tokenDexSnapshot={tokenDex.snapshot}
                  isLoading={buyback.loading}
                  error={buyback.error}
                  onRefresh={buyback.refresh}
                  nativeSeries={buybackHistory.nativeSeries}
                  treasurySeries={buybackHistory.treasurySeries}
                  biggiSeries={buybackHistory.biggiSeries}
                />
              ) : null}

              {renderedTab === "distributor" ? (
                <DistributorTokenTab
                  distributorData={distributor.snapshot}
                  tokenSnapshot={tokenDex.snapshot}
                  BUYBACKSnapshot={resolvedBuybackSnapshot}
                  BUYBACKFallback={
                    resolvedBuybackSnapshot?.BUYBACK?.totalBiggiAcquired
                  }
                  DRIPAvailable={
                    drip.snapshot?.distributor?.availableTokens ??
                    drip.snapshot?.distributor?.availableNumeric
                  }
                  tokenTotalSupply={tokenTotalSupply}
                  historyPoints={distributorHistory.points}
                  totalSeries={distributorHistory.totalSeries}
                  pendingSeries={distributorHistory.pendingSeries}
                  reserveSeries={distributorHistory.reserveSeries}
                  buybackSeries={distributorHistory.buybackSeries}
                  communitySeries={distributorHistory.communitySeries}
                  readerStatus={readerStatus?.dist}
                  isLoading={distributor.loading}
                  error={distributor.error}
                />
              ) : null}

              {renderedTab === "drip" ? (
                <DRIPTab
                  snapshot={drip.snapshot}
                  readerStatus={readerStatus?.drip}
                  flowSnapshot={flow.snapshot}
                  buybackSnapshot={resolvedBuybackSnapshot}
                  liquiditySnapshot={liquidity.snapshot}
                  tokenDexSnapshot={tokenDex.snapshot}
                  isLoading={drip.loading}
                  error={drip.error}
                  onRefresh={drip.refresh}
                  availableSeries={dripHistory.availableSeries}
                  capSeries={dripHistory.capSeries}
                  nativeSeries={dripHistory.nativeSeries}
                />
              ) : null}

              {renderedTab === "liquidity" ? (
                <TokenomicsPanel
                  activeSection="liquidity"
                  chainStatus={chainStatus}
                  liquidity={liquidity.snapshot}
                  tokenDex={tokenDex.snapshot}
                  liquidityHistory={liquidityHistory}
                  readerStatus={readerStatus}
                />
              ) : null}

              {renderedTab === "policy" ? (
                <PolicyTab
                  snapshot={policy.snapshot}
                  loading={policy.loading}
                  error={policy.error}
                />
              ) : null}

              {renderedTab === "dex" ? (
                <TokenomicsPanel
                  activeSection="dex"
                  chainStatus={chainStatus}
                  pumpView={pumpView}
                  liquidity={dexLiquidity}
                  dexHistory={tokenDexHistory}
                  dexLoading={tokenDex.loading}
                  dexError={tokenDex.error}
                  tok={tokenDex.snapshot?.token}
                  router={tokenDex.snapshot?.dex?.router}
                  tokenDex={tokenDex.snapshot}
                  readerStatus={readerStatus}
                  onDexRefresh={tokenDex.refresh}
                />
              ) : null}
              {renderedTab === "history" ? (
                <HistoryTab
                  buybackHistory={buybackHistory.history}
                  dripHistory={dripHistory.history}
                  liquidityHistory={liquidityHistory.history}
                />
              ) : null}
              {renderedTab === "transparency" ? (
                <TransparencyTab
                  flowSnapshot={flow.snapshot}
                  policySnapshot={policy.snapshot}
                  distributorSnapshot={distributor.snapshot}
                  buybackSnapshot={resolvedBuybackSnapshot}
                  dripSnapshot={drip.snapshot}
                  liquiditySnapshot={liquidity.snapshot}
                  tokenDexSnapshot={tokenDex.snapshot}
                  buybackHistory={buybackHistory.history}
                  dripHistory={dripHistory.history}
                  liquidityHistory={liquidityHistory.history}
                  distributorHistory={distributorHistory.history}
                  tokenDexHistory={tokenDexHistory.history}
                />
              ) : null}
            </React.Suspense>
          </div>
          <div className={styles.ecoWiringDock}>
            {wiringOpen ? (
              <div className={styles.ecoWiringOverlay}>
                <div className={styles.ecoWiringOverlayHeader}>
                  <div>
                    <div className={styles.ecoWiringOverlayTitle}>
                      Live Wiring Map
                    </div>
                    <div className={styles.ecoWiringOverlaySub}>
                      Address stack and current connection status across the
                      ecosystem.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={[
                      "biggi-btn",
                      "biggi-btn--ghost",
                      styles.ecoWiringToggle,
                      styles.ecoWiringToggleOpen,
                    ].join(" ")}
                    onClick={() => setWiringOpen(false)}
                  >
                    Hide wiring
                  </button>
                </div>
                <div className={styles.ecoWiringOverlayBody}>
                  <div className={styles.ecoWiringGrid}>
                    {wiringGroups.map((group) => (
                      <div key={group.title} className={styles.ecoWiringCard}>
                        <div className={styles.ecoWiringTitle}>{group.title}</div>
                        <div className={styles.ecoTable}>
                          {group.rows.map((row) => (
                            <div
                              key={`${group.title}-${row.label}`}
                              className={`${styles.ecoTableRow} ${styles.ecoTableRowThree} ${styles.ecoWiringRow}`}
                            >
                              <span className={`${styles.ecoTableLabel} ${styles.ecoWiringLabel}`}>
                                {row.label}
                              </span>
                              <span
                                className={`${styles.ecoTableValue} ${styles.ecoAddrMono} ${styles.ecoWiringValue}`}
                              >
                                <span
                                  className={styles.ecoWiringAddressMain}
                                  title={row.address || undefined}
                                >
                                  {row.address ? shortAddr(row.address) : "--"}
                                </span>
                                {row.address ? (
                                  <a
                                    className={styles.ecoTableLink}
                                    href={explorerLink(row.address)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Explorer
                                  </a>
                                ) : null}
                              </span>
                              <span
                                className={`${styles.ecoStatusDot} ${styles.ecoWiringStatus} ${row.address ? styles.ecoStatusOk : styles.ecoStatusWarn}`}
                                title={row.address ? "Connected" : "Missing"}
                                aria-label={row.address ? "Connected" : "Missing"}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <Card
              title="ECOSYSTEM WIRING"
              subtitle="Full on-chain wiring (addresses + status)"
              action={
                <button
                  type="button"
                  className={[
                    "biggi-btn",
                    "biggi-btn--ghost",
                    styles.ecoWiringToggle,
                    wiringOpen
                      ? styles.ecoWiringToggleOpen
                      : styles.ecoWiringToggleClosed,
                  ].join(" ")}
                  onClick={() => setWiringOpen((open) => !open)}
                  aria-expanded={wiringOpen}
                >
                  {wiringOpen ? "Wiring open" : "Show wiring"}
                </button>
              }
            >
              <div className={styles.ecoWiringHint}>
                Bottom dock for the full address map. When opened, the wiring
                drawer lifts above this bar.
              </div>
            </Card>
          </div>
        </div>
      </section>
    </EcosystemErrorBoundary>
  );
}
