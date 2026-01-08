
Řekl/a jsi:
// BIGGI ECOSYSTEM panel - premium layout, safe fallbacks, live snapshot wiring

import * as React from "react";
import "../panels/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import styles from "./BiggiToken.module.css";
import LiquidityVaultChart from "./LiquidityVaultChart";
import TokenSupplyChart from "./TokenSupplyChart";
import DexLiquidityChart from "./DexLiquidityChart";
import BiggiButton from "./BiggiButton";
import FLOWButton from "./FLOWButton";
import BUYBACKDRIPButton from "./BUYBACKDRIPButton";
import LMReserveTokenDexButton from "./LMReserveTokenDexButton";
import POLICYButton from "./POLICYButton";
import { getBiggiBalancesAcrossReserveLmLv } from "../../services/composed";
import { BiggiLpPriceFeed as ABI_LP_PRICE_FEED } from "../../config/abi/index.js";
import { createBUYBACKService, createDRIPDistributorService } from "../../services/factories";
import { getROProvider, getSignerProvider, ensureAmoy, ADDR, AMOY } from "../../utils/contract";
// import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers"; // odstraněno duplicitně
import BiggiBUYBACKReader from "../../config/abi/BiggiBUYBACKReader.json";
import BiggiDRIPReader from "../../config/abi/BiggiDRIPReader.json";
  // --- On-chain BUYBACK and DRIP balances via their readers ---
  const [onchainBUYBACK, setOnchainBUYBACK] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  const [onchainDRIP, setOnchainDRIP] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  React.useEffect(() => {
    let cancelled = false;
    async function fetchBUYBACKOnchain() {
      setOnchainBUYBACK((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(ADDR.BUYBACK_READER, ABI_BUYBACK_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainBUYBACK({
          biggi: Number(formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainBUYBACK((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    async function fetchDRIPOnchain() {
      setOnchainDRIP((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(ADDR.DRIP_READER, ABI_DRIP_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainDRIP({
          biggi: Number(formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainDRIP((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    fetchBUYBACKOnchain();
    fetchDRIPOnchain();
    return () => { cancelled = true; };
  }, []);
import { getProvider } from "../../web3/provider";
import TokenREWARDSService from "../../services/tokenREWARDSService";
import {
  BiggiLiquidityManager as ABI_LM,
  UniswapV2Pair as ABI_PAIR,
  LiquidityVault as ABI_LIQUIDITY_VAULT,
  BiggiToken as ABI_TOKEN,
  BiggiBUYBACKAgent as ABI_BUYBACK,
  BiggiPOLICY as ABI_POLICY,
  DRIPLM as ABI_DRIPLM,
  DRIPDistributor as ABI_DRIP_DISTRIBUTOR,
  // Pokud máš ABI_UPKEEP a ABI_ROUTER v config/abi, přidej je zde
} from "../../config/abi/index.js";
import TokenomicsPanel from "../../panels/TokenomicsPanel/TokenomicsPanel";
import DistributorTokenTab from "../../panels/TokenomicsPanel/tabs/DistributorTokenTab";
import DRIPTab from "../../panels/TokenomicsPanel/tabs/DRIPTab";
import BUYBACKTreasuryTab from "../../panels/TokenomicsPanel/tabs/BUYBACKTreasuryTab";
import { formatUnits, formatEther, parseUnits } from "ethers";
import useDRIPSnapshot from "../../HOOKS/tokenomics/useDRIPSnapshot";
import useDRIPHistory from "../../HOOKS/tokenomics/useDRIPHistory";
import useBUYBACKTreasurySnapshot from "../../HOOKS/tokenomics/useBUYBACKTreasurySnapshot";
import useBUYBACKTreasuryHistory from "../../HOOKS/tokenomics/useBUYBACKTreasuryHistory";
import useLiquiditySnapshot from "../../HOOKS/tokenomics/useLiquiditySnapshot";
import useLiquidityHistory from "../../HOOKS/tokenomics/useLiquidityHistory";
import useTokenDexSnapshot from "../../HOOKS/tokenomics/useTokenDexSnapshot";
import useTokenDexHistory from "../../HOOKS/tokenomics/useTokenDexHistory";
import useBUYBACKStabilityHistory from "../../HOOKS/tokenomics/useBUYBACKStabilityHistory";
import useBiggiToken from "../../HOOKS/useBiggiToken";
import useBiggiTokenomicsReader from "../../HOOKS/useBiggiTokenomicsReader";
import useBUYBACK from "../../HOOKS/useBUYBACK";
import useReserve from "../../HOOKS/useReserve";
import useTreasury from "../../HOOKS/useTreasury";
import usePOLICY from "../../HOOKS/usePOLICY";
import useDRIPDistributor from "../../HOOKS/useDRIPDistributor";
import useDRIPLM from "../../HOOKS/useDRIPLM";
import useLiquidityManager from "../../HOOKS/useLiquidityManager";
import useLiquidityVault from "../../HOOKS/useLiquidityVault";
import useLiquidityAutomation from "../../HOOKS/useLiquidityAutomation";
import useBUYBACKKeeper from "../../HOOKS/useBUYBACKKeeper";
import useLiquidityKeeper from "../../HOOKS/useLiquidityKeeper";
import useDRIPKeeper from "../../HOOKS/useDRIPKeeper";
import useDistributor from "../../HOOKS/useDistributor";

class ECOSYSTEMErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("BiggiToken panel crashed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="REWARDS-grid biggi-skin" style={{ padding: "24px" }}>
          <div className="REWARDS-grid__surface biggi-token-surface">
            <header className="REWARDS-grid__header biggi-header panel-header panel-header--ECOSYSTEM">
              <div className="REWARDS-grid__headline">
                <h2 className="REWARDS-grid__title">BIGGI ECOSYSTEM</h2>
                <p className="REWARDS-grid__subtitle">Panel spadl na chybe. Zkuste refresh nebo overit RPC.</p>
              </div>
            </header>
            <div className="FLOW-panel-box" style={{ color: "#f2c94c" }}>
              <p>Detail: {this.state.error?.message || String(this.state.error)}</p>
              <button className="tab-button" onClick={() => window.location.reload()}>Reload stranky</button>
            </div>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

const getROSafe = () => {
  try {
    return getProvider({ forceRefresh: false });
  } catch (err) {
    console.warn("Shared fallback provider neni dostupny, zkousim legacy RO", err?.message || err);
  }
  try {
    return getROProvider();
  } catch (err) {
    console.error("Neni dostupny zadny read-only provider", err?.message || err);
    return null;
  }
};

const withTimeout = (promiseOrFn, ms, label) => {
  return new Promise((resolve) => {
    // Safety timeout - will ALWAYS resolve
    const safetyTimer = setTimeout(() => {
      console.warn([withTimeout] ${label || 'task'} force-resolved after ${ms}ms);
      resolve(null);
    }, ms);

    const finish = (val) => {
      clearTimeout(safetyTimer);
      resolve(val);
    };

    // Handle undefined/null - return immediately
    if (promiseOrFn == null) {
      finish(null);
      return;
    }

    // If it's a function, call it
    let result;
    try {
      result = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
    } catch (err) {
      console.warn([withTimeout] ${label || 'task'} threw on call:, err?.message || err);
      finish(null);
      return;
    }

    // If not promise-like, return immediately
    if (result == null || typeof result.then !== 'function') {
      finish(result);
      return;
    }

    // Wait for promise
    result.then(
      (val) => finish(val),
      (err) => {
        console.warn([withTimeout] ${label || 'task'} rejected:, err?.message || err);
        finish(null);
      }
    );
  });
};

const NOOP = () => {};

// Constants
const automationKeeper = ADDR.KEEPER_ADDR || null;
const DEFAULT_PAIRING_MATIC = "0.01";
const DEFAULT_DRIP_NATIVE = "0.001";

// Formatting functions
const fmtVal = (val, symbol = "", decimals = 2) => {
  if (val == null) return "--";
  const num = Number(val);
  if (isNaN(num)) return "--";
  return ${num.toFixed(decimals)} ${symbol}.trim();
};

const fmtLp = (val) => {
  if (val == null) return "--";
  const num = Number(val);
  if (isNaN(num)) return "--";
  return ${num.toFixed(2)} LP;
};

const numFrom = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const shortAddr = (addr) => {
  if (!addr) return "--";
  return ${addr.slice(0, 6)}...${addr.slice(-4)};
};

const isAddress = (addr) => typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);

const explorerLink = (addr) => (addr ? https://polygonscan.com/address/${addr} : null);

const fmtDate = (timestamp) => {
  if (!timestamp) return "--";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
};

const tokenomicsIndicatorStyle = {
  background: "#040b15",
  border: "1px solid #4ad2ff",
  borderRadius: "14px",
  padding: "6px 14px",
  margin: "14px 0 8px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#dbe9ff",
  fontSize: "0.85rem",
};

const indicatorDotStyle = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#4ad2ff",
};

// Component helpers
const AddressLine = ({ label, address, displayValue, href }) => {
  const targetValue = displayValue ?? shortAddr(address);
  return (
    <div className="biggi-address-line">
      <span className="biggi-address-label">{label}:</span>
      <span className="biggi-address-value">
        <span>{targetValue || "--"}</span>
        {href && (
          <a className="biggi-address-link" href={href} target="_blank" rel="noreferrer">
            Explorer
          </a>
        )}
      </span>
    </div>
  );
};

const Line = ({ label, value, tone = "default" }) => (
  <div className={biggi-line biggi-line--${tone}}>
    <span className="biggi-line-label">{label}:</span>
    <span className="biggi-line-value">{value || "--"}</span>
  </div>
);

const HeroStat = ({ label, value, tone = "default" }) => (
  <div className={biggi-hero__stat ${tone ? tone-${tone} : ""}}>
    <div className="biggi-hero__value">{value}</div>
    <div className="biggi-hero__label">{label}</div>
  </div>
);

const SectionHeader = ({ label, accent = "#ffe800" }) => (
  <div className="REWARDS-grid__section-header" style={{ "--section-accent": accent }}>
    <span className="REWARDS-grid__section-title">{label}</span>
    <span className="REWARDS-grid__section-line" />
  </div>
);

const Button = ({ variant = "ghost", children, ...props }) => (
  <BiggiButton variant={variant} {...props}>
    {children}
  </BiggiButton>
);

const Card = ({ title, subtitle, tone = "c", action, children }) => (
  <article className={REWARDS-grid__card biggi-card biggi-card--${tone}}>
    <div className="biggi-card__glow" aria-hidden />
    <div className="REWARDS-grid__card-header biggi-card__header">
      <div className="biggi-card__heading">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="biggi-card__actions">{action}</div> : null}
    </div>
    <div className="biggi-card__body">{children}</div>
  </article>
);

const BiggiTokenInner = ({
  data,
  distributorData,
  walletAddress = "",
  onRefreshTokenMeta,
  onRefreshREWARDS,
  onPreviewClaim,
  onCheckClaimStatus,
  onRefreshRouterInfo,
  onRefreshLiquidityPreview,
  onRefreshBUYBACKInfo,
  onRefreshPOLICY,
  fetchTreasuryInfo,
  fetchReserveInfo,
  fetchDistributorInfo,
  compact = false,
  onReserveTopUp,
  onBootstrapLiquidity,
  onAddLiquidityFromBalance,
  onBUYBACKAndSendToTreasury,
}) => {
  // --- LP price feed (live) ---
  const [lpPrice, setLpPrice] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const provider = getROProvider();
        const feedAddr = ADDR.LP_PRICE_FEED;
        if (feedAddr) {
          const feed = new Contract(feedAddr, ABI_LP_PRICE_FEED, provider);
          const round = await feed.latestRoundData().catch(() => null);
          const dec = await feed.decimals().catch(() => 18);
          if (!alive) return;
          if (round && round.answer != null) {
            const price = Number(formatUnits(round.answer, dec));
            if (Number.isFinite(price)) setLpPrice(price);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, []);
  // --- On-chain treasury balances via TreasuryReader ---
  const [onchainTreasury, setOnchainTreasury] = React.useState({ biggi: null, matic: null, loading: false, error: null });
  React.useEffect(() => {
    let cancelled = false;
    async function fetchTreasuryOnchain() {
      setOnchainTreasury((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(ADDR.TREASURY_READER, ABI_TREASURY_READER, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setOnchainTreasury({
          biggi: Number(formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setOnchainTreasury((prev) => ({ ...prev, loading: false, error: err?.message || String(err) }));
      }
    }
    fetchTreasuryOnchain();
    return () => { cancelled = true; };
  }, []);
  const { data: tokenHook } = useBiggiToken(walletAddress);
  const { status: tokenomicsStatus } = useBiggiTokenomicsReader();
  const { data: BUYBACKHook } = useBUYBACK();
  const { data: reserveHook } = useReserve();
  const { data: treasuryHook } = useTreasury();
  const { data: POLICYHook } = usePOLICY();
  const { data: DRIPDistributorHook } = useDRIPDistributor();
  const { data: DRIPLMHook } = useDRIPLM();
  const { data: liquidityManagerHook } = useLiquidityManager();
  const { data: liquidityVaultHook } = useLiquidityVault();
  const { data: liquidityAutomationHook } = useLiquidityAutomation();
  const { data: BUYBACKKeeperHook } = useBUYBACKKeeper();
  const { data: liquidityKeeperHook } = useLiquidityKeeper();
  const { data: DRIPKeeperHook } = useDRIPKeeper(walletAddress);
  const { data: distributorHook } = useDistributor();

  const tokBase = data?.token || data?.tok || {};
  const tok = tokenHook?.address ? { ...tokBase, ...tokenHook } : tokBase;

  const distBase = data?.distributor || data?.dist || {};
  const dist = distributorHook?.address ? { ...distBase, ...distributorHook } : distBase;
  if (!dist.pendingBUYBACK && dist.pendingBUYBACKAgent) dist.pendingBUYBACK = dist.pendingBUYBACKAgent;

  const distributorSnapshot = distributorData || dist;

  const reserveBase = data?.reserve || {};
  const reserve = reserveHook?.address ? { ...reserveBase, ...reserveHook } : reserveBase;
  if (!reserve.reserveAddress && reserve.address) reserve.reserveAddress = reserve.address;
  if (!reserve.liquidityManager && liquidityManagerHook?.address) {
    reserve.liquidityManager = liquidityManagerHook.address;
  }
  if (!reserve.liquidityVault && liquidityVaultHook?.address) {
    reserve.liquidityVault = liquidityVaultHook.address;
  }
  if (!reserve.keeper && liquidityManagerHook?.keeper) reserve.keeper = liquidityManagerHook.keeper;
  if (!reserve.keeper && liquidityKeeperHook?.address) reserve.keeper = liquidityKeeperHook.address;

  const treasuryBase = data?.treasury || {};
  const treasury = treasuryHook?.treasuryAddress ? { ...treasuryBase, ...treasuryHook } : treasuryBase;

  const BUYBACKBase = data?.BUYBACK || {};
  const BUYBACK = BUYBACKHook?.address ? { ...BUYBACKBase, ...BUYBACKHook } : BUYBACKBase;
  if (!BUYBACK.BUYBACKAgent && BUYBACK.address) BUYBACK.BUYBACKAgent = BUYBACK.address;
  if (!BUYBACK.DRIPLm && BUYBACK.DRIPLM) BUYBACK.DRIPLm = BUYBACK.DRIPLM;
  if (!BUYBACK.DRIPLm && DRIPLMHook?.address) BUYBACK.DRIPLm = DRIPLMHook.address;
  if (BUYBACKKeeperHook?.upkeepNeeded != null) BUYBACK.upkeepNeeded = BUYBACKKeeperHook.upkeepNeeded;
  if (!BUYBACK.upkeepAddress && BUYBACKKeeperHook?.address) BUYBACK.upkeepAddress = BUYBACKKeeperHook.address;

  const DRIPBase = data?.DRIP || {};
  const DRIP = DRIPDistributorHook?.address ? { ...DRIPBase, ...DRIPDistributorHook } : DRIPBase;
  if (!DRIP.DRIPDistributor && DRIP.address) DRIP.DRIPDistributor = DRIP.address;
  if (!DRIP.DRIPLm && DRIPLMHook?.address) DRIP.DRIPLm = DRIPLMHook.address;
  if (!DRIP.DRIPLM && DRIPLMHook?.address) DRIP.DRIPLM = DRIPLMHook.address;
  if (!DRIP.DRIPLm && DRIPKeeperHook?.DRIPLM) DRIP.DRIPLm = DRIPKeeperHook.DRIPLM;

  const POLICYBase = data?.POLICY || {};
  const POLICYHasSignal = Object.values(POLICYHook || {}).some((val) => val && val !== 0 && val !== "0");
  const POLICY = POLICYHasSignal ? { ...POLICYBase, ...POLICYHook } : POLICYBase;

  const liquidityBase = data?.liquidity || {};
  const derived = tokenomicsStatus?.derived || {};
  const liquidity = {
    ...liquidityBase,
    reserveNative: liquidityBase.reserveNative ?? derived.reserveNative,
    reserveBiggi: liquidityBase.reserveBiggi ?? derived.reserveBiggi,
    biggiPerNative: liquidityBase.biggiPerNative ?? derived.priceBiggiPerNative,
    nativePerBiggi: liquidityBase.nativePerBiggi ?? derived.priceNativePerBiggi,
  };

  const routerBase = data?.router || {};
  const router = {
    ...routerBase,
    routerAddress:
      routerBase.routerAddress ??
      liquidityAutomationHook?.router ??
      liquidityManagerHook?.router ??
      tok.routerAddr ??
      null,
    wrappedNative: routerBase.wrappedNative ?? tok.weth,
  };

  const [lmLoading, setLmLoading] = React.useState(false);
  const [svcBUYBACK, setSvcBUYBACK] = React.useState(null);
  const [svcDRIP, setSvcDRIP] = React.useState(null);
  const [lmView, setLmView] = React.useState(null);
  const [lmChainBalances, setLmChainBalances] = React.useState(null);
  const [chainStatus, setChainStatus] = React.useState({ chainId: null, account: null });
  const [warnings, setWarnings] = React.useState([]);
  const [pumpWarnings, setPumpWarnings] = React.useState([]);
  const [pairingPending, setPairingPending] = React.useState(false);
  const [pumpLoading, setPumpLoading] = React.useState(false);
  const [upkeepPending, setUpkeepPending] = React.useState(false);
  const [DRIPPending, setDRIPPending] = React.useState(false);
  const [DRIPDistributorBiggi, setDRIPDistributorBiggi] = React.useState(null);
  const [syncPending, setSyncPending] = React.useState(false);
  const [retryPending, setRetryPending] = React.useState(false);
  const [BUYBACKAllPending, setBUYBACKAllPending] = React.useState(false);
  const [tabBusy, setTabBusy] = React.useState(false);
  const [pumpView, setPumpView] = React.useState({ POLICY: null, BUYBACK: null, DRIP: null, masterBundle: null, pair: null, quote: null });
  const [tab, setTab] = React.useState('FLOW');
  const [fetchedTabs, setFetchedTabs] = React.useState({});
  const [trStats, setTrStats] = React.useState(null);
  const [trLoading, setTrLoading] = React.useState(false);
  const [trClaimPending, setTrClaimPending] = React.useState(false);
  const [trTokenIdsInput, setTrTokenIdsInput] = React.useState("");
  const isFLOWTab = tab === "FLOW";
  const isDRIPTab = tab === "DRIP";
  const isBUYBACKTab = tab === "BUYBACK";
  const isReserveTab = tab === "reserve";
  const isDexTab = tab === "dex";
  const needsTokenDexSnapshot = isFLOWTab || isDexTab;
  const needsDRIPSnapshot = isDRIPTab || isBUYBACKTab;

  const userRole = React.useMemo(() => {
    const accountLc = (chainStatus.account || "").toLowerCase();
    if (accountLc && automationKeeper && accountLc === automationKeeper) return "keeper";
    const BUYBACKOwner = pumpView.BUYBACK?.owner?.toLowerCase?.();
    const lmOwner = lmView?.owner?.toLowerCase?.();
    const BUYBACKAgent = pumpView.BUYBACK?.address?.toLowerCase?.();
    if (accountLc && lmOwner && accountLc === lmOwner) return "owner";
    if (accountLc && BUYBACKOwner && accountLc === BUYBACKOwner) return "owner";
    if (accountLc && BUYBACKAgent && accountLc === BUYBACKAgent) return "BUYBACK-agent";
    if (chainStatus.account) return "manual";
    return "guest";
  }, [chainStatus.account, pumpView.BUYBACK, lmView]);
  React.useEffect(() => {
    // IMPORTANT: do not do any RPC work on panel open.
    // This value is only needed for the DRIP tab, so fetch lazily.
    if (!isDRIPTab) return;

    let cancelled = false;
    const fetchDRIPDistributorBiggi = async () => {
      try {
        const provider = getROSafe();
        if (!provider) return;
        const token = new Contract(ADDR.BIGGI, ABI_TOKEN, provider);
        const bal = await withTimeout(() => token.balanceOf(ADDR.DRIP_DISTRIBUTOR), 8000, "DRIPDistributor.balanceOf");
        if (cancelled || bal == null) return;
        setDRIPDistributorBiggi(Number(formatUnits(bal, 18)));
      } catch {
        // ignore
      }
    };
    fetchDRIPDistributorBiggi();
    return () => {
      cancelled = true;
    };
  }, [isDRIPTab]);
  const DRIPLmAddress =
    BUYBACK?.DRIPLm ||
    BUYBACK?.DRIPLM ||
    DRIP?.DRIPLm ||
    DRIP?.DRIPLM ||
    DRIPLMHook?.address ||
    dist?.DRIPLm;
  const DRIPDistributorAddress =
    DRIP?.DRIPDistributor || DRIPDistributorHook?.address || dist?.distributor;
  const BUYBACKAgentAddress = BUYBACK?.BUYBACKAgent || BUYBACK?.address || dist?.BUYBACKAgent;
  const treasuryAddressRaw =
    treasury?.treasuryAddress ||
    treasury?.address ||
    BUYBACK?.treasury ||
    pumpView?.DRIP?.distributor?.treasury ||
    dist?.treasury ||
    ADDR.TREASURY;
  const treasuryAddress = isAddress(treasuryAddressRaw) ? treasuryAddressRaw : null;
  // Prefer on-chain value if available
  const treasuryNativeValue = onchainTreasury.matic != null ? fmtVal(onchainTreasury.matic, "POL") : fmtVal(treasury.nativeBalance, "POL");
  const treasuryBiggiValue = onchainTreasury.biggi != null ? fmtVal(onchainTreasury.biggi, "BIGGI") : fmtVal(treasury.tokenBalance, "BIGGI");
  const BUYBACKNativeValue = onchainBUYBACK.matic != null ? fmtVal(onchainBUYBACK.matic, "POL") : fmtVal(BUYBACK.nativeBalance, "POL");
  const BUYBACKBiggiValue = onchainBUYBACK.biggi != null ? fmtVal(onchainBUYBACK.biggi, "BIGGI") : fmtVal(BUYBACK.biggiBalance, "BIGGI");
  const DRIPNativeValue = onchainDRIP.matic != null ? fmtVal(onchainDRIP.matic, "POL") : "--";
  const DRIPBiggiValue = onchainDRIP.biggi != null ? fmtVal(onchainDRIP.biggi, "BIGGI") : "--";
  const treasuryNativeDisplay = treasuryAddress ? (
    <span className="biggi-line-value__inline">
      <span>{treasuryNativeValue}</span>
      <span className="biggi-line-value__divider">|</span>
      <span className="biggi-line-value__addr">{shortAddr(treasuryAddress)}</span>
      <a className="biggi-address-link" href={explorerLink(treasuryAddress)} target="_blank" rel="noreferrer">
        Explore
      </a>
    </span>
  ) : (
    treasuryNativeValue
  );

  const splits = {
    reserve: POLICY?.deltaReserveBps ?? 3000,
    BUYBACK: POLICY?.alphaBUYBACKBps ?? 2000,
    coll: POLICY?.gammaStakingBps ?? 3000,
    treasury: POLICY?.treasuryBps ?? 1000,
    community: POLICY?.communityBps ?? 1000,
  };
  const pct = (bps) => (bps != null ? ${(Number(bps) / 100).toFixed(1)} % : "--");
  const lmTokenPct =
    lmView?.tokenPct ??
    liquidityManagerHook?.tokenPct ??
    liquidityAutomationHook?.tokenPct ??
    null;
  const lmSlippageBps = lmView?.slippageBps ?? liquidityManagerHook?.slippageBps ?? null;
  const lmDeadlineSec = lmView?.txDeadlineSec ?? liquidityManagerHook?.txDeadlineSec ?? null;
  const lmKeeperAddress =
    lmView?.keeper ||
    reserve.keeper ||
    liquidityManagerHook?.keeper ||
    liquidityKeeperHook?.address ||
    null;
  const lmAddress =
    lmView?.reserveAddr ||
    reserve.liquidityManager ||
    liquidityManagerHook?.address ||
    null;
  const lmVaultAddress =
    lmView?.liquidityVault ||
    reserve.liquidityVault ||
    liquidityVaultHook?.address ||
    null;

  const heroStats = React.useMemo(
    () => [
      { label: "Total supply", value: fmtVal(tok?.totalSupply, "BIGGI", 0), tone: "token" },
      { label: "Mintable left", value: fmtVal(tok?.remainingMintable, "BIGGI", 0), tone: "token" },
      { label: "Reserve balance", value: fmtVal(reserve?.maticBalance, "POL", 4), tone: "native" },
      { label: "Treasury balance", value: treasuryNativeValue, tone: "native" },
      { label: "LP in vault", value: fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault), tone: "token" },
      { label: "LP token price", value: lpPrice != null ? ${lpPrice} POL : "--", tone: "native" },
    ],
    [lmView?.lpBalance, reserve?.lpBalanceInVault, reserve?.maticBalance, tok?.remainingMintable, tok?.totalSupply, treasuryNativeValue, lpPrice]
  );
  const DRIPDistributorBiggiValue =
    DRIPDistributorBiggi ??
    pumpView?.DRIP?.distributor?.biggiBalance ??
    DRIP?.distributor?.biggiBalance ??
    null;
  const multiCOLLECTIONDistributor = dist?.COLLECTIONREWARDS || ADDR.COLLECTION_REWARDS || dist?.distributor;

  const { snapshot: DRIPSnapshot, loading: DRIPLoading, error: DRIPError } = useDRIPSnapshot({ enabled: needsDRIPSnapshot });
  const { availableSeries: DRIPAvailableSeries, capSeries: DRIPCapSeries, nativeSeries: DRIPNativeSeries } =
    useDRIPHistory(DRIPSnapshot);
  const { snapshot: BUYBACKSnapshot, loading: BUYBACKLoading, error: BUYBACKError } = useBUYBACKTreasurySnapshot({ enabled: isBUYBACKTab });
  const { nativeSeries: BUYBACKNativeSeries, biggiSeries: BUYBACKBiggiSeries, treasurySeries: BUYBACKTreasurySeries } =
    useBUYBACKTreasuryHistory(BUYBACKSnapshot);
  const { snapshot: liquiditySnapshot } = useLiquiditySnapshot({ enabled: isReserveTab });
  const { history: liquiditySnapshots } = useLiquidityHistory(liquiditySnapshot);
  const { snapshot: tokenDexSnapshot } = useTokenDexSnapshot({ enabled: needsTokenDexSnapshot });
  const { history: tokenDexHistory } = useTokenDexHistory(tokenDexSnapshot);

  const tokenHistory = React.useMemo(() => {
    const fromHistory = (tokenDexHistory || [])
      .map((entry) => {
        const total = entry?.token?.totalSupplyNumeric;
        const remaining = entry?.token?.remainingMintableNumeric;
        if (!Number.isFinite(total) || !Number.isFinite(remaining)) return null;
        const minted = total - remaining;
        if (!Number.isFinite(minted)) return null;
        return {
          time: entry?.tsLabel || "",
          totalSupply: total,
          minted,
          mintableLeft: remaining,
        };
      })
      .filter(Boolean);

    if (fromHistory.length) return fromHistory;

    const totalFallback = numFrom(tok?.totalSupply);
    const remainingFallback = numFrom(tok?.remainingMintable);
    if (!Number.isFinite(totalFallback) || !Number.isFinite(remainingFallback)) return [];
    return [
      {
        time: "Now",
        totalSupply: totalFallback,
        minted: totalFallback - remainingFallback,
        mintableLeft: remainingFallback,
      },
    ];
  }, [tokenDexHistory, tok?.totalSupply, tok?.remainingMintable]);

  const liquidityHistory = React.useMemo(() => {
    const fromHistory = (liquiditySnapshots || [])
      .map((entry) => {
        const liquidityVal = entry?.vault?.totalLpLockedNumeric;
        if (!Number.isFinite(liquidityVal)) return null;
        return { time: entry?.tsLabel || "", liquidity: liquidityVal };
      })
      .filter(Boolean);

    if (fromHistory.length) return fromHistory;

    const lpFallback = numFrom(lmView?.lpBalance ?? reserve?.lpBalanceInVault);
    if (!Number.isFinite(lpFallback)) return [];
    return [{ time: "Now", liquidity: lpFallback }];
  }, [liquiditySnapshots, lmView?.lpBalance, reserve?.lpBalanceInVault]);

  const dexHistory = React.useMemo(() => {
    const fromHistory = (tokenDexHistory || [])
      .map((entry) => {
        const reserveNative = entry?.dex?.pair?.reserves?.nativeNumeric;
        const reserveBiggi = entry?.dex?.pair?.reserves?.biggiNumeric;
        const price = entry?.dex?.price?.pair?.biggiPerNativeNumeric ?? null;
        const hasValue = [reserveNative, reserveBiggi, price].some(
          (val) => typeof val === "number" && Number.isFinite(val)
        );
        if (!hasValue) return null;
        return {
          time: entry?.tsLabel || "",
          reserveNative: Number.isFinite(reserveNative) ? reserveNative : null,
          reserveBiggi: Number.isFinite(reserveBiggi) ? reserveBiggi : null,
          price: Number.isFinite(price) ? price : null,
        };
      })
      .filter(Boolean);

    if (fromHistory.length) return fromHistory;

    const reserveNativeFallback = numFrom(liquidity?.reserveNative);
    const reserveBiggiFallback = numFrom(liquidity?.reserveBiggi);
    const priceFallback = numFrom(liquidity?.biggiPerNative);
    if (
      !Number.isFinite(reserveNativeFallback) &&
      !Number.isFinite(reserveBiggiFallback) &&
      !Number.isFinite(priceFallback)
    ) {
      return [];
    }
    return [
      {
        time: "Now",
        reserveNative: Number.isFinite(reserveNativeFallback) ? reserveNativeFallback : null,
        reserveBiggi: Number.isFinite(reserveBiggiFallback) ? reserveBiggiFallback : null,
        price: Number.isFinite(priceFallback) ? priceFallback : null,
      },
    ];
  }, [tokenDexHistory, liquidity?.reserveNative, liquidity?.reserveBiggi, liquidity?.biggiPerNative]);

  const BUYBACKStabilityHistory = useBUYBACKStabilityHistory({ BUYBACKSnapshot, DRIPSnapshot });
  const DRIPAvailableValue =
    DRIPSnapshot?.distributor?.availableTokens ??
    data?.REWARDS?.DRIPAvailable ??
    DRIP?.availableTokens ??
    tokenomicsStatus?.derived?.DRIPAvailable;

  const fetchLmReserveVaultSnapshot = React.useCallback(async () => {
    setLmLoading(true);
    const nextWarnings = [];
    try {
      const provider = getROSafe();
      if (!provider) throw new Error("Read-only provider neni k dispozici");

      // Chain/account (best-effort)
      try {
        const signerProv = getSignerProvider();
        const net = await signerProv.getNetwork();
        const accts = await signerProv.listAccounts();
        setChainStatus({ chainId: net?.chainId ?? null, account: (accts && accts[0]) || null });
      } catch {
        setChainStatus((prev) => ({ ...prev, chainId: prev.chainId ?? null }));
      }

      const lmContract = new Contract(ADDR.LM, ABI_LM, provider);
      const reserveContract = new Contract(ADDR.RESERVE, ABI_RESERVE, provider);
      const pairContract = new Contract(ADDR.PAIR, ABI_PAIR, provider);
      const tokenContract = new Contract(ADDR.BIGGI, ABI_TOKEN, provider);

      const [owner, keeper, tokenPct, slippageBps, txDeadlineSec, liquidityVaultAddr, reserveAddr, routerAddr, factoryAddr] = await Promise.all([
        lmContract.owner(),
        lmContract.keeper(),
        lmContract.tokenPct().catch(() => 0),
        lmContract.slippageBps().catch(() => 0),
        lmContract.txDeadlineSec().catch(() => 0),
        lmContract.liquidityVault().catch(() => ADDR.LIQUIDITY_VAULT),
        lmContract.reserve().catch(() => ADDR.RESERVE),
        lmContract.router().catch(() => ADDR.ROUTER),
        lmContract.factory().catch(() => ADDR.FACTORY),
      ]);

      const [lpDecimals, lpBalanceRaw, reserveMaticRaw, reserveBiggiRaw, dexRefillBiggiRaw, nativeReserveBalanceRaw, pairWhitelisted] = await Promise.all([
        pairContract.decimals().catch(() => 18),
        pairContract.balanceOf(liquidityVaultAddr).catch(() => 0n),
        reserveContract.maticBalance().catch(() => 0n),
        reserveContract.biggiBalance().catch(() => 0n),
        reserveContract.dexRefillBiggi().catch(() => 0n),
        provider.getBalance(reserveAddr).catch(() => 0n),
        new Contract(liquidityVaultAddr, ABI_LIQUIDITY_VAULT, provider).whitelistedPairs(ADDR.PAIR).catch(() => false),
      ]);

      const lpBalance = Number(formatUnits(lpBalanceRaw, lpDecimals));
      const reserveMatic = Number(formatEther(reserveMaticRaw));
      const reserveBiggi = Number(formatUnits(reserveBiggiRaw, 18));
      const dexRefillBiggi = Number(formatUnits(dexRefillBiggiRaw, 18));
      const nativeBalance = Number(formatEther(nativeReserveBalanceRaw));

      if (keeper && ADDR.KEEPER_ADDR && keeper.toLowerCase() !== ADDR.KEEPER_ADDR.toLowerCase()) {
        nextWarnings.push("Keeper address differs from the Automation/Keeper contract");
      }
      if (lpBalance === 0) {
        nextWarnings.push("Liquidity Vault currently holds 0 LP tokens");
      }
      if (reserveMatic < 0.1 || reserveBiggi <= 0) {
        nextWarnings.push("Nothing to pair - top up POL or BIGGI in the Reserve");
      }

      setLmView({
        owner,
        keeper,
        router: routerAddr,
        factory: factoryAddr,
        tokenPct: Number(tokenPct),
        slippageBps: Number(slippageBps),
        txDeadlineSec: Number(txDeadlineSec),
        liquidityVault: liquidityVaultAddr,
        reserveAddr,
        lpBalance,
        lpDecimals,
        reserveMatic,
        reserveBiggi,
        dexRefillBiggi,
        nativeBalance,
        pairWhitelisted,
      });
      setWarnings(nextWarnings);
    } catch (err) {
      console.warn("fetchLmReserveVaultSnapshot failed", err);
      setWarnings(["Failed to load LM/Reserve/Vault data"]);
    } finally {
      setLmLoading(false);
    }
  }, []);

  // --- FETCHERS ---


  const fetchPumpSnapshot = React.useCallback(async () => {
    setPumpLoading(true);
    const nextWarnings = [];
    try {
      const provider = getROSafe();
      if (!provider) throw new Error("Read-only provider neni k dispozici");
      const BUYBACK = new Contract(ADDR.BUYBACK_AGENT, ABI_BUYBACK, provider);
      const POLICY = new Contract(ADDR.POLICY, ABI_POLICY, provider);
      const DRIPLM = new Contract(ADDR.DRIP_LM, ABI_DRIPLM, provider);
      const distributor = new Contract(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, provider);
      const routerContract = new Contract(ADDR.ROUTER, ABI_ROUTER, provider);
      const pair = new Contract(ADDR.PAIR, ABI_PAIR, provider);
      const token = new Contract(ADDR.BIGGI, ABI_TOKEN, provider);


      const [bbPOLICYAddr, bbNativeRaw, lastBUYBACKAt, bbOwner, bbPaused, minIntervalSec, bbDRIPLm] = await Promise.all([
        BUYBACK.POLICY().catch(() => ADDR.POLICY),
        BUYBACK.nativeBalance().catch(() => 0n),
        BUYBACK.lastBUYBACKAt().catch(() => 0),
        BUYBACK.owner().catch(() => null),
        POLICY.BUYBACKsPaused().catch(() => false),
        POLICY.minBUYBACKInterval().catch(() => 0),
        BUYBACK.DRIPLM().catch(() => ADDR.DRIP_LM),
      ]);

      const [DRIPRouter, DRIPReserve, DRIPDistributorAddr, DRIPBUYBACKAgent, sellPct, DRIPSlip, DRIPDeadline] = await Promise.all([
        DRIPLM.router().catch(() => ADDR.ROUTER),
        DRIPLM.reserve().catch(() => ADDR.RESERVE),
        DRIPLM.DRIPDistributor().catch(() => ADDR.DRIP_DISTRIBUTOR),
        DRIPLM.BUYBACKAgent().catch(() => ADDR.BUYBACK_AGENT),
        DRIPLM.sellPct().catch(() => 0),
        DRIPLM.slippageBps().catch(() => 0),
        DRIPLM.txDeadlineSec().catch(() => 0),
      ]);

      const [tokensPerMintRaw, availableTokensRaw, totalTopUpRaw, treasuryAddr, totalNotifiedRaw, pendingForBUYBACKRaw, distributorBiggiRaw] = await Promise.all([
        distributor.tokensPerMint().catch(() => 0n),
        distributor.getAvailable ? distributor.getAvailable().catch(() => distributor.availableTokens().catch(() => 0n)) : distributor.availableTokens().catch(() => 0n),
        distributor.totalTopUp().catch(() => 0n),
        distributor.treasury().catch(() => null),
        distributor.totalNotified ? distributor.totalNotified().catch(() => 0n) : 0n,
        distributor.pending ? distributor.pending(ADDR.BUYBACK_AGENT).catch(() => 0n) : 0n,
        token.balanceOf(ADDR.DRIP_DISTRIBUTOR).catch(() => 0n),
      ]);

      const [pairToken0, pairToken1, reservesTuple, quoteTuple, pairTotalSupplyRaw, pairDecimals] = await Promise.all([
        pair.token0().catch(() => ADDR.BIGGI),
        pair.token1().catch(() => ADDR.WETH),
        pair.getReserves().catch(() => null),
        routerContract
          .getAmountsOut(parseUnits("0.01", 18), [ADDR.WETH, ADDR.BIGGI])
          .catch(() => null),
        pair.totalSupply().catch(() => 0n),
        pair.decimals().catch(() => 18),
      ]);

      const nativeBalance = Number(formatEther(bbNativeRaw));
      const availableTokens = Number(formatUnits(availableTokensRaw, 18));
      const totalTopUp = Number(formatUnits(totalTopUpRaw, 18));
      const tokensPerMint = Number(formatUnits(tokensPerMintRaw, 18));
      const totalNotified = Number(formatUnits(totalNotifiedRaw, 18));
      const pendingForBUYBACK = Number(formatUnits(pendingForBUYBACKRaw, 18));
      const distributorBiggi = Number(formatUnits(distributorBiggiRaw, 18));
      setDRIPDistributorBiggi(distributorBiggi);

      let pairView = null;
      if (reservesTuple && pairToken0 && pairToken1) {
        const [r0, r1] = reservesTuple;
        const r0n = Number(formatUnits(r0, 18));
        const r1n = Number(formatUnits(r1, 18));
        const token0lc = pairToken0.toLowerCase();
        const token1lc = pairToken1.toLowerCase();
        const biggiIs0 = token0lc === ADDR.BIGGI.toLowerCase();
        const biggiReserve = biggiIs0 ? r0n : r1n;
        const nativeReserve = biggiIs0 ? r1n : r0n;
        pairView = {
          token0: pairToken0,
          token1: pairToken1,
          biggiReserve,
          nativeReserve,
          lpTotalSupply: Number(formatUnits(pairTotalSupplyRaw, pairDecimals)),
        };
      }

      let quoteView = null;
      if (quoteTuple && Array.isArray(quoteTuple) && quoteTuple.length === 2) {
        quoteView = {
          amountIn: 0.01,
          amountOut: Number(formatUnits(quoteTuple[1], 18)),
        };
      }

      if (bbPaused) nextWarnings.push("BUYBACKs paused v POLICY");
      if (nativeBalance < 0.001) nextWarnings.push("BUYBACKAgent has low native balance (<0.001)");
      if (availableTokens === 0) nextWarnings.push("DRIPDistributor has no available tokens");
      if (chainStatus.chainId && chainStatus.chainId !== AMOY.chainId) nextWarnings.push("Wallet is not connected to Amoy (80002)");


      setPumpView({
        POLICY: { address: bbPOLICYAddr, paused: bbPaused, minIntervalSec: Number(minIntervalSec) },
        BUYBACK: {
          address: ADDR.BUYBACK_AGENT,
          POLICY: bbPOLICYAddr,
          nativeBalance,
          lastBUYBACKAt: Number(lastBUYBACKAt),
          owner: bbOwner,
          DRIPLM: bbDRIPLm,
        },
        DRIP: {
          address: ADDR.DRIP_LM,
          router: DRIPRouter,
          reserve: DRIPReserve,
          DRIPDistributor: DRIPDistributorAddr,
          BUYBACKAgent: DRIPBUYBACKAgent,
          sellPct: Number(sellPct),
          slippageBps: Number(DRIPSlip),
          txDeadlineSec: Number(DRIPDeadline),
          distributor: {
            address: DRIPDistributorAddr,
            availableTokens,
            totalTopUp,
            tokensPerMint,
            totalNotified,
            pendingForBUYBACK,
            biggiBalance: distributorBiggi,
            treasury: treasuryAddr,
          },
        },
        pair: pairView,
        quote: quoteView,
      });
      setPumpWarnings(nextWarnings);
    } catch (err) {
      console.warn("fetchPumpSnapshot failed", err);
      setPumpWarnings(["Failed to load BUYBACK/DRIP data"]);
    } finally {
      setPumpLoading(false);
    }
  }, [chainStatus.chainId]);


  const handleLiquiditySuite = React.useCallback(async () => {
    try {
      if (typeof onRefreshLiquidityPreview === 'function') onRefreshLiquidityPreview();
      if (typeof fetchReserveInfo === 'function') fetchReserveInfo();
      getBiggiBalancesAcrossReserveLmLv()
        .then((res) => setLmChainBalances(res))
        .catch(() => {});
      await Promise.allSettled([
        fetchLmReserveVaultSnapshot(),
        fetchPumpSnapshot(),
      ]);
    } catch (err) {
      console.warn('handleLiquiditySuite failed', err?.message || err);
    }
  }, [fetchLmReserveVaultSnapshot, fetchPumpSnapshot, fetchReserveInfo, onRefreshLiquidityPreview]);

  const prefetchBUYBACKDRIPServices = React.useCallback(async () => {
    const provider = getROSafe();
    if (!provider) {
      console.warn("Prefetch: chybi read-only provider");
      return;
    }
    try {
      const svc = createBUYBACKService(undefined, provider);
      const raw = await svc.getAllStats();
      setSvcBUYBACK({
        native: formatUnits(raw?.nativeBalance || 0, 18),
        biggi: formatUnits(raw?.biggiBalance || 0, 18),
        totalNativeSpent: formatUnits(raw?.totalNativeSpent || 0, 18),
        totalBiggiAcquired: formatUnits(raw?.totalBiggiAcquired || 0, 18),
      });
    } catch {
      // ignore
    }

    try {
      const svc = createDRIPDistributorService(undefined, provider);
      const raw = await svc.getAllStats();
      setSvcDRIP({
        available: formatUnits(raw?.availableTokens || 0, 18),
        totalNotified: formatUnits(raw?.totalNotified || 0, 18),
        totalClaimed: formatUnits(raw?.totalClaimed || 0, 18),
      });
    } catch {
      // ignore
    }

    try {
      const provider = getROSafe();
      if (!provider) throw new Error("Read-only provider neni k dispozici");
      const trSvc = new TokenREWARDSService(ADDR.TOKEN_REWARDS, provider);
      const rawTr = await trSvc.getAllStats();
      const formatted = await TokenREWARDSService.formatUsingTokenMeta(rawTr);
      setTrStats(formatted);
    } catch {
      // ignore
    }
  }, []);

  const refreshTab = React.useCallback(
    async (targetTab) => {
      const tabKey = targetTab;
      if (!tabKey) return;
      setTabBusy(true);
      try {
        const jobs = [];

        switch (tabKey) {
          case "FLOW":
            jobs.push(withTimeout(onRefreshTokenMeta, 8000, "onRefreshTokenMeta"));
            jobs.push(withTimeout(fetchTreasuryInfo, 8000, "fetchTreasuryInfo"));
            jobs.push(withTimeout(fetchReserveInfo, 8000, "fetchReserveInfo"));
            jobs.push(withTimeout(fetchDistributorInfo, 8000, "fetchDistributorInfo"));
            break;
          case "BUYBACK":
            jobs.push(withTimeout(onRefreshBUYBACKInfo, 12000, "onRefreshBUYBACKInfo"));
            jobs.push(withTimeout(fetchPumpSnapshot, 12000, "fetchPumpSnapshot"));
            jobs.push(withTimeout(prefetchBUYBACKDRIPServices, 12000, "prefetchBUYBACKDRIPServices"));
            break;
          case "DRIP":
            jobs.push(withTimeout(fetchPumpSnapshot, 12000, "fetchPumpSnapshot"));
            jobs.push(withTimeout(prefetchBUYBACKDRIPServices, 12000, "prefetchBUYBACKDRIPServices"));
            break;
          case "reserve":
            jobs.push(withTimeout(handleLiquiditySuite, 12000, "handleLiquiditySuite"));
            break;
          case "POLICY":
            jobs.push(withTimeout(onRefreshPOLICY, 8000, "onRefreshPOLICY"));
            break;
          case "dex":
            jobs.push(withTimeout(onRefreshRouterInfo, 8000, "onRefreshRouterInfo"));
            jobs.push(withTimeout(onRefreshLiquidityPreview, 8000, "onRefreshLiquidityPreview"));
            jobs.push(withTimeout(fetchPumpSnapshot, 12000, "fetchPumpSnapshot"));
            jobs.push(withTimeout(onRefreshTokenMeta, 8000, "onRefreshTokenMeta"));
            break;
          default:
            break;
        }

        if (jobs.length > 0) {
          await Promise.allSettled(jobs);
        }
      } catch (err) {
        console.error("refreshTab crashed", err);
      } finally {
        setTabBusy(false);
      }
    },
    [
      fetchPumpSnapshot,
      handleLiquiditySuite,
      onRefreshBUYBACKInfo,
      onRefreshLiquidityPreview,
      onRefreshPOLICY,
      onRefreshRouterInfo,
      onRefreshTokenMeta,
      prefetchBUYBACKDRIPServices,
      fetchDistributorInfo,
      fetchReserveInfo,
      fetchTreasuryInfo,
    ]
  );

  const runManualPairing = async () => {
    setPairingPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const lm = new Contract(ADDR.LM, ABI_LM, signer);
      await lm.executePairing(DEFAULT_PAIRING_MATIC);
    } catch (err) {
      console.warn("executePairing failed", err);
    } finally {
      setPairingPending(false);
      fetchLmReserveVaultSnapshot();
    }
  };

  const runManualBUYBACKUpkeep = async () => {
    setUpkeepPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const upkeep = new Contract(ADDR.UPKEEP_PROXY, ABI_UPKEEP, signer);
      await upkeep.performUpkeep("0x");
    } catch (err) {
      console.warn("performUpkeep failed", err);
    } finally {
      setUpkeepPending(false);
      fetchPumpSnapshot();
    }
  };

  const runManualDRIP = async () => {
    setDRIPPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const DRIPLM = new Contract(ADDR.DRIP_LM, ABI_DRIPLM, signer);
      await DRIPLM.DRIPOnBuy(DEFAULT_DRIP_NATIVE);
    } catch (err) {
      console.warn("DRIPOnBuy failed", err);
    } finally {
      setDRIPPending(false);
      fetchPumpSnapshot();
    }
  };

  const runSyncAvailable = async () => {
    setSyncPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const distributor = new Contract(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, signer);
      await distributor.syncAvailableToBalance();
    } catch (err) {
      console.warn("syncAvailableToBalance failed", err);
    } finally {
      setSyncPending(false);
      fetchPumpSnapshot();
    }
  };

  const runRetryPending = async () => {
    setRetryPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const distributor = new Contract(ADDR.DRIP_DISTRIBUTOR, ABI_DRIP_DISTRIBUTOR, signer);
      await distributor.retryPending(ADDR.BUYBACK_AGENT);
    } catch (err) {
      console.warn("retryPending failed", err);
    } finally {
      setRetryPending(false);
      fetchPumpSnapshot();
    }
  };

  const runBUYBACKAll = async () => {
    const ok = typeof window !== "undefined"
      ? window.confirm("Run BUYBACKAllToTreasury? Make sure you have enough gas.")
      : true;
    if (!ok) return;
    setBUYBACKAllPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const BUYBACK = new Contract(ADDR.BUYBACK_AGENT, ABI_BUYBACK, signer);
      if (typeof BUYBACK.BUYBACKAllToTreasury === "function") {
        await BUYBACK.BUYBACKAllToTreasury(0);
      } else {
      throw new Error("BUYBACKAllToTreasury is missing from ABI");
      }
    } catch (err) {
      console.warn("BUYBACKAllToTreasury failed", err);
    } finally {
      setBUYBACKAllPending(false);
      fetchPumpSnapshot();
    }
  };

  const markFetched = React.useCallback((key) => setFetchedTabs((prev) => (prev[key] ? prev : { ...prev, [key]: true })), []);

  // Auto-fetch disabled to prevent freezing - user must click Refresh
  React.useEffect(() => {
    if (tab === "FLOW" && !fetchedTabs.FLOW) markFetched("FLOW");
    if (tab === "BUYBACK" && !fetchedTabs.BUYBACK) markFetched("BUYBACK");
    if (tab === "reserve" && !fetchedTabs.reserve) markFetched("reserve");
    if (tab === "DRIP" && !fetchedTabs.DRIP) markFetched("DRIP");
    if (tab === "POLICY" && !fetchedTabs.POLICY) markFetched("POLICY");
    if (tab === "dex" && !fetchedTabs.dex) markFetched("dex");
  }, [tab, fetchedTabs, markFetched]);

  const handleTrRefresh = async () => {
    setTrLoading(true);
    try {
      const provider = getROSafe();
      if (!provider) throw new Error("Read-only provider neni k dispozici");
      const trSvc = new TokenREWARDSService(ADDR.TOKEN_REWARDS, provider);
      const rawTr = await trSvc.getAllStats();
      const formatted = await TokenREWARDSService.formatUsingTokenMeta(rawTr);
      setTrStats(formatted);
    } catch (e) {
      console.warn('TokenREWARDS refresh failed', e);
    } finally {
      setTrLoading(false);
    }
  };

  const handleTrClaim = async () => {
    if (!trTokenIdsInput) return;
    setTrClaimPending(true);
    try {
      await ensureAmoy();
      const signerProvider = getSignerProvider();
      const signer = signerProvider.getSigner();
      const provider = getROSafe();
      if (!provider) throw new Error("Read-only provider neni k dispozici");
      const trSvc = new TokenREWARDSService(ADDR.TOKEN_REWARDS, provider);
      trSvc.connectWithSigner(signer);
      const ids = trTokenIdsInput.split(',').map((s) => s.trim()).filter(Boolean).map((s) => Number(s));
      const receipt = await trSvc.claim(ids);
      // basic success feedback
      try { window && window.alert && window.alert('Claim tx: ' + (receipt.transactionHash || receipt?.transactionHash || 'ok')); } catch (_) {}
    } catch (e) {
      console.warn('Claim failed', e);
      try { window && window.alert && window.alert('Claim failed: ' + (e?.message || e)); } catch (_) {}
    } finally {
      setTrClaimPending(false);
      handleTrRefresh();
    }
  };

  const tabs = [
    { key: "FLOW", label: "FLOWs" },
    { key: "BUYBACK", label: "BUYBACK" },
    { key: "DRIP", label: "DRIP" },
    { key: "reserve", label: "LM / Reserve / Vault" },
    { key: "POLICY", label: "POLICY" },
    { key: "dex", label: "Token & DEX" },
  ];

  return (
    <section className={${styles.ECOSYSTEM} REWARDS-grid biggi-skin${compact ? " is-compact" : ""}}>
      <div className="REWARDS-grid__surface biggi-token-surface">
        <header className="REWARDS-grid__header biggi-header panel-header panel-header--ECOSYSTEM">
          <div className="REWARDS-grid__headline">
            <h2 className="REWARDS-grid__title">BIGGI ECOSYSTEM</h2>
            <p className="REWARDS-grid__subtitle">
              Premium overview: mint -&gt; distributor -&gt; BUYBACK / reserve / treasury.
            </p>
          </div>
        </header>

        <SectionHeader label="Live snapshot" accent="#ffe800" />
        <div className="REWARDS-grid__hero" aria-label="Token summary">
          {heroStats.map((stat, idx) => (
            <HeroStat key={idx} {...stat} />
          ))}
        </div>

        <SectionHeader label="Control center" accent="#27d9d2" />
        <div className="view-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={tab-button ${tab === t.key ? "active" : ""}}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "reserve" && <TokenomicsPanel />}

        <div className="REWARDS-grid__cards">
          {tab === "FLOW" && (
            <>
            <Card
              title="Token FLOWs"
              subtitle="Mint -&gt; Distributor -&gt; Reserve / BUYBACK / Treasury / Community"
              tone="y"
            >
              <div className="FLOW-panel-grid FLOW-panel-grid--unified">
                {/* Full-width chart */}
                <div className="FLOW-chart-full">
                  <div className="FLOW-panel-box">
                    <div className="FLOW-panel-box__header">
                      <div>
                        <strong>Biggi ECOSYSTEM</strong>
                        <p>Minted vs. Mintable left</p>
                      </div>
                      <div className="token-pill">{fmtVal(tok?.totalSupply, "BIGGI", 0)} supply</div>
                    </div>
                    <TokenSupplyChart data={tokenHistory} />
                  </div>
                </div>
                {/* Two boxes side by side */}
                <div className="FLOW-panel-left">
                  <div className="FLOW-panel-box">
                    <div className="FLOW-panel-box__header">
                      <div>
                        <strong>FLOW summary</strong>
                        <p>Mint → Distributor → Reserve / BUYBACK / Treasury</p>
                      </div>
                    </div>
                    <div className="FLOW-panel-box__rows">
                      <Line label="Mint -> Distributor" tone="native" value={fmtVal(dist?.totalReceived, "POL")} />
                      <Line label="FLOW to Reserve" tone="native" value={fmtVal(reserve?.totalMaticReceived, "POL")} />
                      <Line label="FLOW to BUYBACK" tone="native" value={fmtVal(dist?.pendingBUYBACK, "POL")} />
                      <Line label="FLOW to Treasury" tone="native" value={treasuryNativeValue} />
                      <Line label="Community pool" tone="native" value={fmtVal(dist?.communityPoolBalance, "POL")} />
                      <AddressLine
                        label="Reserve contract"
                        address={reserve?.reserveAddress || ADDR.RESERVE}
                        href={explorerLink(reserve?.reserveAddress || ADDR.RESERVE)}
                      />
                      <AddressLine
                        label="Multi-COLLECTION distributor"
                        address={multiCOLLECTIONDistributor}
                        href={explorerLink(multiCOLLECTIONDistributor)}
                      />
                    </div>
                  </div>
                  <div className="FLOW-panel-box">
                    <div className="FLOW-panel-box__header">
                      <div>
                        <strong>Token contract & HOOKS</strong>
                        <p>Addresses with explorer links</p>
                      </div>
                    </div>
                    <div className="FLOW-panel-box__rows">
                      {[{
                        label: "BIGGI token",
                        address: tokenDexSnapshot?.token?.address || ADDR.BIGGI,
                      }, {
                        label: "Reserve hook",
                        address: tokenDexSnapshot?.token?.addresses?.reserve || ADDR.RESERVE,
                      }, {
                        label: "DRIPDistributor hook",
                        address: tokenDexSnapshot?.token?.addresses?.DRIPDistributor || ADDR.DRIP_DISTRIBUTOR,
                      }, {
                        label: "TokenREWARDS hook",
                        address: tokenDexSnapshot?.token?.addresses?.tokenREWARDS || ADDR.TOKEN_REWARDS,
                      }, {
                        label: "Treasury",
                        address: ADDR.TREASURY,
                      }, {
                        label: "Distributor",
                        address: ADDR.DISTRIBUTOR,
                      }].map((hook) => (
                        <AddressLine
                          key={hook.label}
                          label={hook.label}
                          address={hook.address}
                          href={explorerLink(hook.address)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="FLOW-panel-right">
                  <div className="FLOW-panel-box">
                    <div className="FLOW-panel-box__header">
                      <div>
                        <strong>FLOW status</strong>
                        <p>Liquidity splits & activity</p>
                      </div>
                      <FLOWButton disabled={tabBusy} onClick={() => refreshTab("FLOW")}>
                        Refresh FLOW
                      </FLOWButton>
                    </div>
                    <div className="FLOW-panel-box__rows">
                      <div className="FLOW-split-grid">
                        <span className="FLOW-split-label">Default split</span>
                        <span className="FLOW-split-item">CR <strong>{pct(splits.coll)}</strong></span>
                        <span className="FLOW-split-item">Reserve <strong>{pct(splits.reserve)}</strong></span>
                        <span className="FLOW-split-item">BUYBACK <strong>{pct(splits.BUYBACK)}</strong></span>
                        <span className="FLOW-split-item">Treasury <strong>{pct(splits.treasury)}</strong></span>
                        <span className="FLOW-split-item">Community <strong>{pct(splits.community)}</strong></span>
                      </div>
                      <div className="FLOW-big-value-row">
                        <span className="FLOW-big-label">Treasury BIGGI</span>
                        <span className="FLOW-big-value tone-token">{treasuryBiggiValue}</span>
                      </div>
                      <Line label="Pending CR/NFT" tone="token" value={fmtVal(dist?.pendingCOLLECTIONREWARDS, "BIGGI")} />
                      <div className="FLOW-big-value-row">
                        <span className="FLOW-big-label">FLOW status</span>
                        <span className="FLOW-big-value" style={{ color: dist?.paused ? '#ff6b6b' : '#4ade80' }}>{dist?.paused ? "Paused" : "Active"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Token REWARDS section was removed per request */}
            </Card>
            {isFLOWTab && (
              <div className="FLOW-panel">
                <DistributorTokenTab
                  distributorData={distributorSnapshot}
                  tokenSnapshot={tokenDexSnapshot}
                  BUYBACKSnapshot={BUYBACKSnapshot}
                  BUYBACKFallback={BUYBACK?.biggiBalance}
                  DRIPAvailable={DRIPAvailableValue}
                  tokenTotalSupply={tok?.totalSupply}
                />
              </div>
            )}
            </>
          )}

          {tab === "BUYBACK" && (
            <div className="BUYBACK-two-col">
              <Card
                title="BUYBACK Agent"
                subtitle="20% from distributor, swaps native->BIGGI, tops up Treasury"
                tone="c"
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <BUYBACKDRIPButton disabled={tabBusy} onClick={() => refreshTab("BUYBACK")}>
                      Refresh
                    </BUYBACKDRIPButton>
                  </div>
                }
              >
                <div className="biggi-contract-grid biggi-contract-grid--BUYBACK">
                  <div className="biggi-contract-box">
                    <Line label="Auto BUYBACK" value={BUYBACK.autoBUYBACKEnabled ? "On" : "Off"} />
                    <Line label="Paused" value={BUYBACK.paused ? "Yes" : "No"} />
                    <Line
                      label="Upkeep needed"
                      value={BUYBACK.upkeepNeeded != null ? (BUYBACK.upkeepNeeded ? "Yes" : "No") : "--"}
                    />
                    <Line label="Native balance" tone="native" value={BUYBACKNativeValue} />
                    <Line label="BIGGI balance" tone="token" value={BUYBACKBiggiValue} />
                    <Line
                      label="(svc) Native / BIGGI"
                      value={svcBUYBACK ? ${fmtVal(svcBUYBACK.native, "POL")} / ${fmtVal(svcBUYBACK.biggi, "BIGGI")} : "--"}
                    />
                    <Line label="Total BIGGI bought" tone="token" value={fmtVal(BUYBACK.totalBiggiAcquired, "BIGGI")} />
                    <Line label="Total native spent" tone="native" value={fmtVal(BUYBACK.totalNativeSpent, "POL")} />
                    <Line
                      label="(svc) Total bought / spent"
                      value={svcBUYBACK ? ${fmtVal(svcBUYBACK.totalBiggiAcquired, "BIGGI")} / ${fmtVal(svcBUYBACK.totalNativeSpent, "POL")} : "--"}
                    />
                    <Line label="Last BUYBACK" value={fmtDate(BUYBACK.lastBUYBACKAt)} />
                  </div>
                  <div className="biggi-contract-box">
                    <Line label="Treasury native" tone="native" value={treasuryNativeDisplay} />
                    <Line label="Treasury BIGGI" tone="token" value={treasuryBiggiValue} />
                    <Line label="Reserve native" tone="native" value={fmtVal(reserve.maticBalance, "POL")} />
                    <Line label="Reserve BIGGI" tone="token" value={fmtVal(reserve.biggiBalance, "BIGGI")} />
                    <Line label="Distributor pending BB" tone="native" value={fmtVal(dist.pendingBUYBACK, "POL")} />
                    <Line label="Distributor pending REWARDS" tone="token" value={fmtVal(dist.pendingCOLLECTIONREWARDS, "BIGGI")} />
                    <Line label="Native from multi-COLLECTION" tone="native" value={fmtVal(dist.totalReceived, "POL")} />
                  </div>
                </div>
              </Card>
              {isBUYBACKTab && (
                <div className="FLOW-panel BUYBACK-two-col__right">
                  <BUYBACKTreasuryTab
                    snapshot={BUYBACKSnapshot}
                    nativeSeries={BUYBACKNativeSeries}
                    biggiSeries={BUYBACKBiggiSeries}
                    treasurySeries={BUYBACKTreasurySeries}
                    isLoading={BUYBACKLoading}
                    error={BUYBACKError}
                  />
                </div>
              )}
            </div>
          )}
        {tab === "reserve" && (
          <>
            <Card
              title="Reserve / LM / Vault"
              subtitle="30% distributor share + BIGGI mints"
              tone="v"
              action={<LMReserveTokenDexButton disabled={tabBusy} onClick={() => refreshTab("reserve")} />}
            >
              <div className="liquidity-vault-layout liquidity-vault-layout--chart-first">
                <div className="liquidity-vault-chartwrap">
                  <div className="liquidity-vault-charthead">
                    <div>
                      <div className="muted">Liquidity Vault</div>
                      <div className="liquidity-vault-charttitle">Liquidity over time</div>
                    </div>
                    <div className="liquidity-vault-pill">
                      LP {fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault)} | Native {fmtVal(lmView?.reserveMatic ?? reserve?.maticBalance, "POL")}
                    </div>
                  </div>
                  <LiquidityVaultChart data={liquidityHistory} />
                </div>

                <div className="liquidity-vault-table">
                  <div className="lv-row">
                    <span>Chain</span>
                    <span className="mono lv-value">{chainStatus.chainId ? chainId ${chainStatus.chainId} : "--"}</span>
                  </div>
                  <div className="lv-row">
                    <span>Account</span>
                    <span className="mono lv-value lv-value--addr">{chainStatus.account ? shortAddr(chainStatus.account) : "--"}</span>
                  </div>
                  <div className="lv-row">
                    <span>Role</span>
                    <span className="mono lv-value">{userRole}</span>
                  </div>
                  <div className="lv-row">
                    <span>LP in vault</span>
                    <span className="mono lv-value">{fmtLp(lmView?.lpBalance ?? reserve?.lpBalanceInVault)}</span>
                  </div>
                  <div className="lv-row">
                    <span>Native balance (Reserve)</span>
                    <span className="mono lv-value">{fmtVal(lmView?.reserveMatic ?? reserve?.maticBalance, "POL")}</span>
                  </div>
                  <div className="lv-row">
                    <span>BIGGI balance (Reserve)</span>
                    <span className="mono lv-value">{fmtVal(lmView?.reserveBiggi ?? reserve?.biggiBalance, "BIGGI")}</span>
                  </div>
                  <div className="lv-row">
                    <span>DEX refill BIGGI</span>
                    <span className="mono lv-value">{fmtVal(lmView?.dexRefillBiggi ?? reserve?.dexRefillBiggi, "BIGGI")}</span>
                  </div>
                  <div className="lv-row">
                    <span>BIGGI across Reserve / LM / Vault</span>
                    <span className="mono lv-value">
                      {fmtVal(lmChainBalances?.reserve, "R")} | {fmtVal(lmChainBalances?.liquidityManager, "LM")} | {fmtVal(lmChainBalances?.liquidityVault, "LV")}
                    </span>
                  </div>
                  <div className="lv-row">
                    <span>Waiting BIGGI → LM</span>
                    <span className="mono lv-value">{fmtVal(reserve?.waitingBiggi, "BIGGI")}</span>
                  </div>
                  <div className="lv-row">
                    <span>LM token %</span>
                    <span className="mono lv-value">{lmTokenPct != null ? ${lmTokenPct}% : "--"}</span>
                  </div>
                  <div className="lv-row">
                    <span>LM slippage</span>
                    <span className="mono lv-value">{lmSlippageBps != null ? ${lmSlippageBps} bps : "--"}</span>
                  </div>
                  <div className="lv-row">
                    <span>LM deadline</span>
                    <span className="mono lv-value">{lmDeadlineSec != null ? ${lmDeadlineSec} s : "--"}</span>
                  </div>
                  <div className="lv-row">
                    <span>Keeper</span>
                    <span className="mono lv-value lv-value--addr">{shortAddr(lmKeeperAddress)}</span>
                                   </div>
                  <div className="lv-row">
                    <span>Liquidity Manager</span>
                    <span className="mono lv-value lv-value--addr">{shortAddr(lmAddress)}</span>
                  </div>
                  <div className="lv-row">
                    <span>Reserve contract</span>
                    <span className="mono lv-value lv-value--addr">{shortAddr(reserve?.reserveAddress || ADDR.RESERVE)}</span>
                  </div>
                  <div className="lv-row">
                    <span>Liquidity Vault</span>
                    <span className="mono lv-value lv-value--addr">{shortAddr(lmVaultAddress)}</span>
                  </div>
                  <div className="lv-row">
                    <span>Pair whitelisted</span>
                    <span className="lv-value">{reserve.pairWhitelisted ? "Yes" : "No"}</span>
                  </div>
                  {warnings.length ? (
                    <div className="lv-row" style={{ color: "#ffb347", flexDirection: "column", alignItems: "flex-start" }}>
                      <span>Warnings</span>
                      {warnings.map((w, i) => (
                        <span key={i} className="mono">- {w}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          </>
        )}
        {tab === "DRIP" && (
          <>
            <div style={{marginBottom: 12}}>
              <Line label="DRIP native (on-chain)" tone="native" value={DRIPNativeValue} />
              <Line label="DRIP BIGGI (on-chain)" tone="token" value={DRIPBiggiValue} />
            </div>
            <DRIPTab
              snapshot={DRIPSnapshot}
              availableSeries={DRIPAvailableSeries}
              capSeries={DRIPCapSeries}
              nativeSeries={DRIPNativeSeries}
              stabilitySeries={BUYBACKStabilityHistory}
              isLoading={DRIPLoading}
              error={DRIPError}
            />
          </>
        )}

        {tab === "POLICY" && (
            <Card
              title="POLICY & distribution guards"
              subtitle="Slippage / deadline / intervals / BUYBACK guards"
              tone="y"
              action={<POLICYButton onClick={onRefreshPOLICY} />}
            >
              <div className="biggi-contract-grid">
                <div className="biggi-contract-box">
                  <Line label="Swap slippage" value={POLICY.swapSlippageBps != null ? ${POLICY.swapSlippageBps} bps : "200 bps"} />
                  <Line label="LP slippage" value={POLICY.lpSlippageBps != null ? ${POLICY.lpSlippageBps} bps : "200 bps"} />
                  <Line label="Tx deadline" value={POLICY.txDeadlineSec != null ? ${POLICY.txDeadlineSec} s : "600 s"} />
                  <Line label="BUYBACK cooldown" value={POLICY.minBUYBACKInterval != null ? ${POLICY.minBUYBACKInterval} s : "300 s"} />
                  <Line label="Daily BB cap" value={POLICY.maxDailyBUYBACKNative ?? "0 (no cap)"} />
                  <Line label="BUYBACKs paused" value={POLICY.BUYBACKsPaused ? "Yes" : "No"} />
                </div>
                <div className="biggi-contract-box">
                  <Line label="Reserve %" value={pct(splits.reserve)} />
                  <Line label="BUYBACK %" value={pct(splits.BUYBACK)} />
                  <Line label="COLLECTIONREWARDS %" value={pct(splits.coll)} />
                  <Line label="Treasury %" value={pct(splits.treasury)} />
                  <Line label="Community %" value={pct(splits.community)} />
                </div>
              </div>
            </Card>
          )}

          {tab === "dex" && (
            <Card
              title="Token & DEX"
              subtitle="BIGGI/WETH pair, router and reserves"
              tone="v"
              action={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="v" disabled={tabBusy} onClick={() => refreshTab("dex")}>
                    {tabBusy ? "Refreshing..." : "Refresh tab"}
                  </Button>
                </div>
              }
            >
              <div className="dex-liquidity-layout">
                <div className="dex-chartwrap">
                  <div className="dex-charthead">
                    <div>
                      <div className="muted">DEX liquidity</div>
                      <div className="dex-charttitle">Reserves & price</div>
                    </div>
                    <div className="dex-pill">{fmtVal(pumpView.pair?.nativeReserve ?? liquidity.reserveNative, "POL", 4)} - {fmtVal(pumpView.pair?.biggiReserve ?? liquidity.reserveBiggi, "BIGGI", 0)} - {fmtVal(liquidity.biggiPerNative)}</div>
                  </div>
                  <DexLiquidityChart data={dexHistory} />
                </div>
              </div>
              <div className="biggi-contract-grid">
                <div className="biggi-contract-box">
                  <AddressLine label="Token" address={tok.address} />
                  <AddressLine label="Router" address={router.routerAddress || tok.routerAddr} />
                  <AddressLine label="Wrapped native" address={router.wrappedNative || tok.weth} />
                  <AddressLine label="Pair" address={liquidity.pairAddress || tok.pair} />
                  <AddressLine label="Factory" address={tok.factoryAddr} />
                </div>
                <div className="biggi-contract-box">
                  <Line label="Pair reserves (native)" tone="native" value={fmtVal(pumpView.pair?.nativeReserve ?? liquidity.reserveNative, "POL")} />
                  <Line label="Pair reserves (BIGGI)" tone="token" value={fmtVal(pumpView.pair?.biggiReserve ?? liquidity.reserveBiggi, "BIGGI")} />
                  <Line label="BIGGI per 1 POL" value={fmtVal(liquidity.biggiPerNative)} />
                  <Line label="POL per 1 BIGGI" value={fmtVal(liquidity.nativePerBiggi)} />
                  <Line label="LP total supply" value={fmtVal(pumpView.pair?.lpTotalSupply ?? liquidity.lpTotalSupply, "LP")} />
                  <Line label="Contract POL" tone="native" value={fmtVal(liquidity.contractEthBalance, "POL")} />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

const BiggiToken = (props) => {
  const [liveEnabled, setLiveEnabled] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("biggi_ECOSYSTEM_live") === "1";
  });

  const enableLive = () => {
    setLiveEnabled(true);
    try {
      window.sessionStorage.setItem("biggi_ECOSYSTEM_live", "1");
    } catch {
      // ignore storage errors
    }
  };

  if (!liveEnabled) {
    return (
      <section className="REWARDS-grid biggi-skin" style={{ padding: "24px" }}>
        <div className="REWARDS-grid__surface biggi-token-surface">
          <header className="REWARDS-grid__header biggi-header panel-header panel-header--ECOSYSTEM">
            <div className="REWARDS-grid__headline">
              <h2 className="REWARDS-grid__title">BIGGI ECOSYSTEM</h2>
              <p className="REWARDS-grid__subtitle">
                Panel je v safe modu. Klikni pro nacteni live dat.
              </p>
            </div>
          </header>
          <div className="FLOW-panel-box" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <BiggiButton variant="c" onClick={enableLive}>
                Nacist live data
              </BiggiButton>
              <span className="muted">
                Pokud to znovu zamrzne, dame postupne vypinace na jednotlive bloky.
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <ECOSYSTEMErrorBoundary>
      <BiggiTokenInner {...props} />
    </ECOSYSTEMErrorBoundary>
  );
};

export default BiggiToken;










