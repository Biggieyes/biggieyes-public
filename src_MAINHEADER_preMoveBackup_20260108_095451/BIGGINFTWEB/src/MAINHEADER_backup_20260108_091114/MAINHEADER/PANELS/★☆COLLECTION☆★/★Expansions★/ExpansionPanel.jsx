// src/components/panels/ExpansionPanel.jsx
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import {
  getROProvider,
  getSignerProvider,
  getReadOnlyMain2,
  getBiggiTokenomicsReaderRO,
} from "../../../../utils/contract.js";
import { ADDR } from "../../../../utils/addresses.js";
import { getFullStatusSafe } from "../../../../utils/tokenomicsFullStatus.js";
import "../panels/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";

const DISTRIBUTOR_ADDRESS = ADDR.DISTRIBUTOR;

const DISTRIBUTOR_ABI = [
  "function totalReceived() view returns (uint256)",
  "function receivedByCOLLECTION(address) view returns (uint256)",
  "function isCOLLECTION(address) view returns (bool)",
  "function reserve() view returns (address)",
  "function COLLECTIONREWARDS() view returns (address)",
  "function BUYBACKAgent() view returns (address)",
  "function treasury() view returns (address)",
  "event MintShareAccepted(address indexed COLLECTION, uint256 amount)",
];

const Badge = React.memo(function Badge({ children }) {
  return <span className="biggi-badge">{children}</span>;
});

const GhostBtn = React.memo(function GhostBtn({
  children,
  tone = "#FFE800",
  className = "",
  style = {},
  ...props
}) {
  const baseStyle = React.useMemo(
    () => ({
      border: `1px solid ${tone || "#FFE800"}55`,
      background: `linear-gradient(180deg, ${tone || "#FFE800"}1a, rgba(0,0,0,0.35))`,
      color: "var(--text-0)",
    }),
    [tone],
  );

  return (
    <button
      {...props}
      className={`REWARDS-grid__btn REWARDS-grid__btn--ghost biggi-ghost-btn ${className}`.trim()}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        fontWeight: 700,
        cursor: "pointer",
        ...baseStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
});

const KeyValueGrid = React.memo(function KeyValueGrid({ items = [] }) {
  return (
    <div className="biggi-grid">
      {items.map(({ k, v, tone, mono }, idx) => (
        <div key={idx} className="biggi-line">
          <span className="muted">{k}</span>
          <span
            className={`biggi-value${mono ? " mono" : ""}`}
            style={tone ? { borderColor: `${tone}55`, color: tone } : undefined}
          >
            {v ?? "--"}
          </span>
        </div>
      ))}
    </div>
  );
});

const Card = React.memo(function Card({
  title,
  subtitle,
  icon,
  tone = "y",
  action = null,
  children,
}) {
  const toneClass = tone ? ` biggi-card--${tone}` : "";
  return (
    <article className={`REWARDS-grid__card biggi-card${toneClass}`}>
      <div className="biggi-card__glow" aria-hidden />
      <div className="REWARDS-grid__card-header biggi-card__header">
        <div className="biggi-card__heading">
          {title ? (
            <h3>
              {icon ? (
                <span className="biggi-card__icon" aria-hidden>
                  {icon}
                </span>
              ) : null}
              {title}
            </h3>
          ) : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="biggi-card__actions">{action}</div> : null}
      </div>
      <div className="biggi-card__body">{children}</div>
    </article>
  );
});

const formatNumber = (value, { decimals = 4, fallback = "--" } = {}) => {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (numeric === 0) return "0";
  if (numeric >= 1)
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
    });
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: Math.min(6, decimals + 2),
  });
};

const shortAddress = (addr) => {
  if (!addr || typeof addr !== "string") return "--";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatTimestamp = (ts) => {
  const num = Number(ts);
  if (!Number.isFinite(num) || num <= 0) return "--";
  return new Date(num * 1000).toLocaleString();
};

const formatBalance = (value) => {
  if (value === null || value === undefined) return "--";
  return `${Number(value).toFixed(4)} POL`;
};

const FLOW_STYLES = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 8,
  },
  node: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  nodeLabel: {
    fontSize: 12,
    letterSpacing: "0.04em",
    color: "#9ba5b9",
    textTransform: "uppercase",
  },
  nodeValue: {
    fontWeight: 800,
    color: "#f6f7fb",
    fontSize: 14,
  },
  arrowRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    color: "#cfd2db",
    fontSize: 13,
    flexWrap: "wrap",
  },
  spark: {
    marginTop: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: 8,
  },
  sparkLabel: {
    display: "block",
    marginTop: 4,
    color: "#9ba5b9",
    fontSize: 12,
  },
};

const buildSparkPoints = (values = []) => {
  const data = values.filter((v) => Number.isFinite(v));
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const step = 100 / (data.length - 1 || 1);
  return data
    .map(
      (v, i) =>
        `${(i * step).toFixed(2)},${(100 - (v / max) * 100).toFixed(2)}`,
    )
    .join(" ");
};

const explorerUrlFor = (address, networkName) => {
  if (!address) return "#";
  const n = (networkName || "").toLowerCase();
  if (n.includes("polygon") || n.includes("matic"))
    return `https://polygonscan.com/address/${address}`;
  if (n.includes("amoy"))
    return `https://amoy.polygonscan.com/address/${address}`;
  if (n.includes("goerli"))
    return `https://goerli.etherscan.io/address/${address}`;
  if (n.includes("sepolia"))
    return `https://sepolia.etherscan.io/address/${address}`;
  if (n.includes("mainnet") || n === "homestead")
    return `https://etherscan.io/address/${address}`;
  return `https://etherscan.io/address/${address}`;
};

export default function ExpansionPanel({ compact = false }) {
  const [provider, setProvider] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [account, setAccount] = React.useState(null);
  const [contract, setContract] = React.useState(null);
  const [networkName, setNetworkName] = React.useState("");

  const [totalReceived, setTotalReceived] = React.useState("0");
  const [receivedForAddr, setReceivedForAddr] = React.useState("0");
  const [isWhitelisted, setIsWhitelisted] = React.useState(false);
  const [events, setEvents] = React.useState([]);
  const [pools, setPools] = React.useState({
    reserve: null,
    COLLECTIONREWARDS: null,
    BUYBACKAgent: null,
    treasury: null,
    DRIPDistributor: ADDR.DRIP_DISTRIBUTOR || null,
    DRIPLm: ADDR.DRIP_LM || null,
    liquidityManager: ADDR.LM || null,
    liquidityVault: null,
  });
  const [poolsBalances, setPoolsBalances] = React.useState({
    reserve: null,
    COLLECTIONREWARDS: null,
    BUYBACKAgent: null,
    treasury: null,
    DRIPDistributor: null,
    DRIPLm: null,
    liquidityManager: null,
    liquidityVault: null,
  });
  const [tokenomicsReader, setTokenomicsReader] = React.useState(null);
  const [tokenomicsStatus, setTokenomicsStatus] = React.useState(null);
  const [main2Stats, setMain2Stats] = React.useState({
    minted: null,
    ticketPrice: null,
  });

  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const sparklinePoints = React.useMemo(() => {
    const vals = [
      Number(poolsBalances.reserve),
      Number(poolsBalances.COLLECTIONREWARDS),
      Number(poolsBalances.BUYBACKAgent),
      Number(poolsBalances.treasury),
    ].filter((v) => Number.isFinite(v) && v > 0);
    return buildSparkPoints(vals);
  }, [
    poolsBalances.BUYBACKAgent,
    poolsBalances.COLLECTIONREWARDS,
    poolsBalances.reserve,
    poolsBalances.treasury,
  ]);

  const FLOWNodes = React.useMemo(
    () => [
      {
        label: "Main2",
        value: main2Stats?.minted
          ? `${formatNumber(main2Stats.minted)} minted`
          : "Mint",
      },
      {
        label: "Distributor",
        value: `${formatNumber(totalReceived, { decimals: 2 })} POL`,
      },
      { label: "Reserve", value: formatBalance(poolsBalances.reserve) },
      { label: "Treasury", value: formatBalance(poolsBalances.treasury) },
      { label: "BUYBACK", value: formatBalance(poolsBalances.BUYBACKAgent) },
      {
        label: "REWARDS",
        value: formatBalance(poolsBalances.COLLECTIONREWARDS),
      },
    ],
    [
      main2Stats?.minted,
      poolsBalances.BUYBACKAgent,
      poolsBalances.COLLECTIONREWARDS,
      poolsBalances.reserve,
      poolsBalances.treasury,
      totalReceived,
    ],
  );

  const [activeTab, setActiveTab] = React.useState("overview");

  React.useEffect(() => {
    const init = async () => {
      try {
        const prov = getROProvider();
        setProvider(prov);
        const dist = new Contract(
          DISTRIBUTOR_ADDRESS,
          DISTRIBUTOR_ABI,
          prov,
        );
        setContract(dist);
        try {
          const tor = getBiggiTokenomicsReaderRO?.(prov);
          setTokenomicsReader(tor || null);
        } catch (err) {
          console.debug("Tokenomics reader init failed", err);
        }
        try {
          const net = await prov.getNetwork();
          setNetworkName(net?.name || "");
        } catch (err) {
          console.debug("Unable to read network", err);
        }
      } catch (err) {
        console.error("Distributor init failed", err);
        setStatus("Init error");
      }
    };
    init();
  }, []);

  const connect = React.useCallback(async () => {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        setStatus("No injected wallet");
        return;
      }
      let prov;
      try {
        prov = getSignerProvider();
      } catch {
        prov = new BrowserProvider(window.ethereum, "any");
      }
      await prov.send("eth_requestAccounts", []);
      const signerInstance = prov.getSigner();
      const addr = await signerInstance.getAddress();
      setSigner(signerInstance);
      setAccount(addr);
      setStatus("Connected");
      setTimeout(() => setStatus(""), 1200);
    } catch (err) {
      console.error(err);
      setStatus("Connect failed");
    }
  }, []);

  const loadOnChain = React.useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const total = await contract.totalReceived();
      setTotalReceived(formatEther(total || 0));

      if (account) {
        const [colShare, whitelisted] = await Promise.all([
          contract
            .receivedByCOLLECTION(account)
            .catch(() => BigInt(0)),
          contract.isCOLLECTION(account).catch(() => false),
        ]);
        setReceivedForAddr(formatEther(colShare || 0));
        setIsWhitelisted(Boolean(whitelisted));
      } else {
        setReceivedForAddr("0");
        setIsWhitelisted(false);
      }

      let reserveAddr = null;
      let collAddr = null;
      let buyAddr = null;
      let treasuryAddr = null;
      let liquidityManager = ADDR.LM || null;
      let liquidityVault = null;
      let DRIPDistributor = ADDR.DRIP_DISTRIBUTOR || null;
      let DRIPLm = ADDR.DRIP_LM || null;

      try {
        [reserveAddr, collAddr, buyAddr, treasuryAddr] = await Promise.all([
          contract.reserve().catch(() => null),
          contract.COLLECTIONREWARDS().catch(() => null),
          contract.BUYBACKAgent().catch(() => null),
          contract.treasury().catch(() => null),
        ]);
      } catch (err) {
        console.warn("Pool fetch", err);
      }

      try {
        if (
          tokenomicsReader &&
          typeof tokenomicsReader.getFullStatus === "function"
        ) {
          const snap = await getFullStatusSafe(tokenomicsReader);
          const [core, dist, buy, res, DRIP] = Array.isArray(snap)
            ? snap
            : [snap?.core, snap?.dist, snap?.buy, snap?.res, snap?.DRIP];
          setTokenomicsStatus(snap);
          liquidityManager = res?.liquidityManager || liquidityManager;
          liquidityVault = res?.liquidityVault || liquidityVault;
          DRIPDistributor = DRIP?.DRIPDistributor || DRIPDistributor;
          DRIPLm = DRIP?.DRIPLM || DRIPLm;
          // prefer distro snapshot for reserve/treasury/BUYBACK
          reserveAddr = dist?.reserve || reserveAddr;
          collAddr = dist?.COLLECTIONREWARDS || collAddr;
          buyAddr = dist?.BUYBACKAgent || buyAddr;
          treasuryAddr = dist?.treasury || treasuryAddr;
        }
      } catch (err) {
        console.warn("Tokenomics snapshot failed", err);
      }

      setPools({
        reserve: reserveAddr || null,
        COLLECTIONREWARDS: collAddr || null,
        BUYBACKAgent: buyAddr || null,
        treasury: treasuryAddr || null,
        DRIPDistributor,
        DRIPLm,
        liquidityManager,
        liquidityVault,
      });

      try {
        const prov = provider || getROProvider();
        const balances = await Promise.all([
          reserveAddr ? prov.getBalance(reserveAddr).catch(() => null) : null,
          collAddr ? prov.getBalance(collAddr).catch(() => null) : null,
          buyAddr ? prov.getBalance(buyAddr).catch(() => null) : null,
          treasuryAddr ? prov.getBalance(treasuryAddr).catch(() => null) : null,
          DRIPDistributor
            ? prov.getBalance(DRIPDistributor).catch(() => null)
            : null,
          DRIPLm ? prov.getBalance(DRIPLm).catch(() => null) : null,
          liquidityManager
            ? prov.getBalance(liquidityManager).catch(() => null)
            : null,
          liquidityVault
            ? prov.getBalance(liquidityVault).catch(() => null)
            : null,
        ]);
        setPoolsBalances({
          reserve: balances[0]
            ? Number(formatEther(balances[0]))
            : null,
          COLLECTIONREWARDS: balances[1]
            ? Number(formatEther(balances[1]))
            : null,
          BUYBACKAgent: balances[2]
            ? Number(formatEther(balances[2]))
            : null,
          treasury: balances[3]
            ? Number(formatEther(balances[3]))
            : null,
          DRIPDistributor: balances[4]
            ? Number(formatEther(balances[4]))
            : null,
          DRIPLm: balances[5]
            ? Number(formatEther(balances[5]))
            : null,
          liquidityManager: balances[6]
            ? Number(formatEther(balances[6]))
            : null,
          liquidityVault: balances[7]
            ? Number(formatEther(balances[7]))
            : null,
        });
      } catch (err) {
        console.warn("Pool balances", err);
      }

      try {
        const main2 = getReadOnlyMain2();
        const [mintedRaw, ticketRaw] = await Promise.all([
          main2.biggiMinted?.().catch(() => null),
          (main2.getTicketPrice?.() ?? main2.ticketPrice?.())?.catch?.(
            () => null,
          ) || main2.ticketPrice?.().catch(() => null),
        ]);
        setMain2Stats({
          minted: mintedRaw ? Number(mintedRaw.toString()) : null,
          ticketPrice: ticketRaw ? formatEther(ticketRaw) : null,
        });
      } catch (err) {
        console.debug("MAIN2 fetch", err);
      }

      const latest = provider
        ? await provider.getBlockNumber().catch(() => null)
        : null;
      const fromBlock = Math.max(0, (latest || 0) - 200_000);
      const ev = await contract.queryFilter(
        contract.filters.MintShareAccepted(),
        fromBlock,
        latest || "latest",
      );
      const mapped = (ev || [])
        .slice(-12)
        .reverse()
        .map((entry) => ({
          tx: entry.transactionHash,
          block: entry.blockNumber,
          COLLECTION: String(entry.args?.COLLECTION ?? entry.args?.[0] ?? ""),
          amount: formatEther(
            entry.args?.amount ?? entry.args?.[1] ?? 0,
          ),
        }));
      setEvents(mapped);
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("Load failed");
    } finally {
      setLoading(false);
    }
  }, [contract, account, provider]);

  React.useEffect(() => {
    loadOnChain();
  }, [loadOnChain]);

  React.useEffect(() => {
    if (!contract || typeof contract.on !== "function") return;
    const listener = (COLLECTION, amount, ev) => {
      const item = {
        tx: ev.transactionHash,
        block: ev.blockNumber,
        COLLECTION: String(COLLECTION),
        amount: formatEther(amount),
      };
      setEvents((prev) => [item, ...prev].slice(0, 12));
      loadOnChain();
    };
    try {
      contract.on(contract.filters.MintShareAccepted(), listener);
    } catch (err) {
      console.error("listener error", err);
    }
    return () => {
      try {
        contract.off(contract.filters.MintShareAccepted(), listener);
      } catch (err) {}
    };
  }, [contract, loadOnChain]);

  const copyAddress = React.useCallback(() => {
    if (!account) return;
    navigator.clipboard?.writeText(account);
    setStatus("Address copied");
    setTimeout(() => setStatus(""), 1500);
  }, [account]);

  const openExplorer = React.useCallback(
    async (address = DISTRIBUTOR_ADDRESS) => {
      let net = networkName;
      if (!net && provider) {
        try {
          const n = await provider.getNetwork();
          net = n?.name || "";
          setNetworkName(net);
        } catch {}
      }
      const url = explorerUrlFor(address, net);
      window.open(url, "_blank", "noopener");
    },
    [networkName, provider],
  );

  const statsItems = React.useMemo(
    () => [
      {
        k: "Total Received",
        v: `${formatNumber(totalReceived, { decimals: 2 })} POL`,
        tone: "#FFE800",
      },
      {
        k: "My COLLECTION Share",
        v: `${formatNumber(receivedForAddr, { decimals: 2 })} POL`,
        tone: "#27D9D2",
      },
      {
        k: "MAIN2 Minted",
        v:
          main2Stats.minted != null
            ? formatNumber(main2Stats.minted, { decimals: 0 })
            : "--",
        tone: "#9B7BFF",
      },
      {
        k: "Ticket Price",
        v: main2Stats.ticketPrice ? `${main2Stats.ticketPrice} ETH` : "--",
        tone: "#5DDCFF",
      },
    ],
    [totalReceived, receivedForAddr, main2Stats],
  );

  const poolRows = React.useMemo(
    () => [
      { key: "reserve", label: "Reserve" },
      { key: "COLLECTIONREWARDS", label: "COLLECTION REWARDS" },
      { key: "BUYBACKAgent", label: "BUYBACK Agent" },
      { key: "treasury", label: "Treasury" },
      { key: "DRIPDistributor", label: "DRIP Distributor" },
      { key: "DRIPLm", label: "DRIP LM" },
      { key: "liquidityManager", label: "Liquidity Manager" },
      { key: "liquidityVault", label: "Liquidity Vault" },
    ],
    [],
  );

  const poolChartData = React.useMemo(() => {
    const keys = ["reserve", "treasury", "BUYBACKAgent", "COLLECTIONREWARDS"];
    const sum = keys.reduce(
      (acc, k) => acc + (Number(poolsBalances[k]) || 0),
      0,
    );
    if (!sum) return [];
    return keys.map((k) => ({
      key: k,
      label: k.replace(/([A-Z])/g, " $1"),
      value: Number(poolsBalances[k]) || 0,
      pct: ((Number(poolsBalances[k]) || 0) / sum) * 100,
    }));
  }, [
    poolsBalances.BUYBACKAgent,
    poolsBalances.COLLECTIONREWARDS,
    poolsBalances.reserve,
    poolsBalances.treasury,
  ]);

  const eventSparkPoints = React.useMemo(() => {
    const vals = (events || [])
      .slice(0, 20)
      .map((e) => Number(e.amount))
      .filter((v) => Number.isFinite(v));
    return buildSparkPoints(vals);
  }, [events]);

  return (
    <section
      className={`REWARDS-grid biggi-skin${compact ? " is-compact" : ""}`}
    >
      <div className="REWARDS-grid__surface biggi-token-surface">
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(900px 360px at 80% -20%, rgba(255,232,0,0.12), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />

        <header className="REWARDS-grid__header biggi-header panel-header panel-header--COLLECTION">
          <div className="REWARDS-grid__headline">
            <h2 className="REWARDS-grid__title">Expansion - Distributor</h2>
            <p className="REWARDS-grid__subtitle">
              Mint-share FLOW and COLLECTION readiness overview.
            </p>
          </div>
          <div className="REWARDS-grid__header-actions">
            <GhostBtn tone="#FFE800" onClick={() => openExplorer()}>
              Distributor Explorer
            </GhostBtn>
          </div>
        </header>
        <div className="REWARDS-grid__tabs">
          {[
            { id: "overview", label: "Overview" },
            { id: "events", label: "Events" },
            { id: "pools", label: "Pools" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`REWARDS-grid__tab${activeTab === tab.id ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="REWARDS-grid__cards">
            <Card title="Distributor Overview" tone="y">
              <KeyValueGrid items={statsItems} />
            </Card>
            <Card title="FLOW Overview" tone="c">
              <div style={FLOW_STYLES.grid}>
                {FLOWNodes.map((node, idx) => (
                  <div key={idx} style={FLOW_STYLES.node}>
                    <span style={FLOW_STYLES.nodeLabel}>{node.label}</span>
                    <span style={FLOW_STYLES.nodeValue}>{node.value}</span>
                  </div>
                ))}
              </div>
              <div style={FLOW_STYLES.arrowRow}>
                <span>Mint</span>
                <span className="FLOW-arrow">-&gt;</span>
                <span>Distributor</span>
                <span className="FLOW-arrow">-&gt;</span>
                <span>Reserve / Treasury / BUYBACK / REWARDS</span>
              </div>
            </Card>
            <Card title="Pool Distribution" tone="c">
              {poolChartData.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
                    gap: 10,
                  }}
                >
                  {poolChartData.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          color: "#9ba5b9",
                        }}
                      >
                        <span>{item.label}</span>
                        <span>{item.pct.toFixed(1)}%</span>
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          height: 8,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.06)",
                          overFLOW: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${item.pct}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, #4ac0ff, #2be2a4)",
                            boxShadow: "0 0 10px rgba(74,192,255,0.35)",
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        {formatBalance(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">No pool balances yet.</div>
              )}
            </Card>
            <Card title="Event Volume" tone="v">
              {eventSparkPoints ? (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    aria-label="Event volume trend"
                    style={{ width: "100%", height: 60 }}
                  >
                    <polyline
                      points={eventSparkPoints}
                      fill="none"
                      stroke="#9B7BFF"
                      strokeWidth="3"
                    />
                  </svg>
                  <span style={{ color: "#9ba5b9", fontSize: 12 }}>
                    Last {Math.min(events.length, 20)} events (POL)
                  </span>
                </div>
              ) : (
                <div className="muted">No events yet.</div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "events" && (
          <div className="REWARDS-grid__cards">
            <Card title="Recent Mint-share Events" tone="v">
              {loading ? (
                <div className="muted">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="muted">No recent events found.</div>
              ) : (
                <div
                  className="biggi-grid"
                  style={{ gap: 6, maxHeight: 300, overFLOWY: "auto" }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{ textAlign: "left", color: "var(--text-dim)" }}
                      >
                        <th style={{ padding: "6px" }}>COLLECTION</th>
                        <th style={{ padding: "6px", textAlign: "right" }}>
                          Amount
                        </th>
                        <th style={{ padding: "6px", textAlign: "right" }}>
                          Block
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.slice(0, 6).map((ev, idx) => (
                        <tr
                          key={`${ev.tx}-${idx}`}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <td style={{ padding: "8px 6px" }}>
                            {shortAddress(ev.COLLECTION)}
                          </td>
                          <td
                            style={{ padding: "8px 6px", textAlign: "right" }}
                          >
                            {Number(ev.amount).toFixed(4)} POL
                          </td>
                          <td
                            style={{ padding: "8px 6px", textAlign: "right" }}
                          >
                            {ev.block}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "pools" && (
          <div className="REWARDS-grid__cards">
            <Card title="Pools (Recipients)" tone="v">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ color: "var(--text-dim)", textAlign: "left" }}>
                    <th style={{ padding: "6px" }}>Pool</th>
                    <th style={{ padding: "6px", textAlign: "right" }}>
                      Balance
                    </th>
                    <th style={{ padding: "6px", textAlign: "right" }}>
                      Address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {poolRows.map(({ key, label }) => (
                    <tr
                      key={key}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      <td style={{ padding: "8px 6px" }}>{label}</td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        {formatBalance(poolsBalances[key])}
                      </td>
                      <td
                        style={{
                          padding: "8px 6px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ marginRight: 8 }}>
                          {shortAddress(pools[key])}
                        </span>
                        <GhostBtn
                          onClick={() => pools[key] && openExplorer(pools[key])}
                          tone="#5DDCFF"
                          disabled={!pools[key]}
                          style={{ padding: "4px 8px" }}
                        >
                          View
                        </GhostBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sparklinePoints ? (
                <div style={FLOW_STYLES.spark}>
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    aria-label="Pool balance trend"
                  >
                    <polyline
                      points={sparklinePoints}
                      fill="none"
                      stroke="#4ac0ff"
                      strokeWidth="3"
                    />
                  </svg>
                  <span style={FLOW_STYLES.sparkLabel}>
                    Pool balances (relative)
                  </span>
                </div>
              ) : null}
            </Card>
            <Card title="Security" tone="y">
              <p className="muted">
                Never sign transactions you do not understand. This panel is
                read-only apart from the optional wallet connection that shows
                personal stats.
              </p>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}






