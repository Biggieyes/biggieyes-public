import * as React from "react";
import "../rewards/REWARDSPanel.css";
import "./VRFPanel.css";
import { useVRF } from "../../hooks/useVRF";
import PanelInfoModal from "@/components/common/PanelInfoModal";

export default function VRFPanel({
  data = {},
  walletAddress = "",
  onRequestRandomness = () => {},
  onRefresh = null,
  onCancelPending = () => {},
  onOpenExplorer = () => {},
  autoOpenInfo = false,
}) {
  const [active, setActive] = React.useState("requests");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const autoInfoOpened = React.useRef(false);
  const refreshInFlightRef = React.useRef(null);
  const sections = React.useMemo(
    () => [
      { key: "requests", label: "Requests" },
      { key: "history", label: "History" },
      { key: "orchestration", label: "Post-Redeem" },
      { key: "engine", label: "CRE Engine" },
      { key: "proof", label: "Proof Log" },
    ],
    [],
  );
  const sectionMeta = React.useMemo(
    () => ({
      requests: {
        kicker: "LIVE",
        title: "Request Monitor",
        description:
          "Current request state, latest fulfillment, and a short recent history.",
      },
      history: {
        kicker: "ARCHIVE",
        title: "Full History",
        description:
          "All loaded VRF rows for this wallet with confirmations and tx links.",
      },
      orchestration: {
        kicker: "FLOW",
        title: "Post-Redeem Orchestration",
        description:
          "Read-only pipeline checks from request capture to proof synchronization.",
      },
      engine: {
        kicker: "MONITOR",
        title: "CRE Engine Signals",
        description:
          "Read-only health indicators used by Reserve / Buyback / DRIP logic.",
      },
      proof: {
        kicker: "AUDIT",
        title: "Proof Consistency Log",
        description:
          "Quick integrity checks for request ID, words, and fulfillment transaction.",
      },
    }),
    [],
  );
  const activeSectionMeta = sectionMeta[active] || sectionMeta.requests;

  React.useEffect(() => {
    if (autoOpenInfo && !autoInfoOpened.current) {
      setInfoOpen(true);
      autoInfoOpened.current = true;
    }
  }, [autoOpenInfo]);

  const infoItems = React.useMemo(
    () => [
      {
        label: "REQUESTS",
        description: [
          "Shows active VRF requests waiting for Chainlink fulfillment.",
          "Each request is tied to a redeemed ticket and target NFT.",
          "Pending status clears once the VRF callback completes.",
        ],
      },
      {
        label: "HISTORY",
        description: [
          "Completed VRF requests with result hashes and timestamps.",
          "Used to verify fairness of the random selection.",
        ],
      },
      {
        label: "POST-REDEEM",
        description: [
          "Read-only orchestration timeline after redeem + VRF callback.",
          "Shows whether request, fulfillment, and proof syncing are consistent.",
        ],
      },
      {
        label: "CRE ENGINE",
        description: [
          "Read-only monitoring layer for Reserve / Buyback / DRIP decisions.",
          "No transactions are executed from this panel.",
        ],
      },
      {
        label: "PROOF LOG",
        description: [
          "Audit table derived from VRF events and request state.",
          "Highlights missing tx hash / random words inconsistencies.",
        ],
      },
      {
        label: "ACTIONS",
        description: [
          "Redeem triggers a new VRF request from BiggiEyesMain.",
          "Refresh pulls the latest VRF status from on-chain history.",
        ],
      },
    ],
    [],
  );

  const { refreshVRFPanel: refreshVRFPanelHook } = useVRF();
  const [hookData, setHookData] = React.useState(null);

  const refreshData = React.useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const task = (async () => {
      setIsRefreshing(true);
      try {
        if (typeof onRefresh === "function") {
          return await onRefresh();
        }
        const next = await refreshVRFPanelHook(walletAddress);
        if (next) setHookData(next);
        return next;
      } finally {
        setIsRefreshing(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = task;
    return task;
  }, [onRefresh, refreshVRFPanelHook, walletAddress]);

  const hasExternalData = data && Object.keys(data).length > 0;
  const viewData = hasExternalData ? data : hookData || {};

  const last = viewData.last || {};
  const hist = Array.isArray(viewData.history) ? viewData.history : [];
  const params = viewData.params || {};
  const userAddr =
    viewData.user?.address ||
    viewData.userAddress ||
    viewData.address ||
    walletAddress ||
    "";

  const C = {
    bg: "#090a0f",
    text: "#f6f7fb",
    dim: "#cfd2db",
    line: "rgba(255,255,255,.12)",
    y: "#FFE800",
    p: "#FF5DA2",
    v: "#9B7BFF",
    c: "#27D9D2",
    g: "#6BEE5B",
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshData();
      } catch (e) {
        console.error("VRFPanel: refresh failed", e);
      } finally {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshData]);

  const short = React.useCallback(
    (addr) =>
      typeof addr === "string" && addr.length > 12
        ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
        : addr || "-",
    [],
  );

  const Badge = ({ children, tone = "info" }) => {
    const palette = {
      info: {
        clr: C.y,
        border: "rgba(255,232,0,.35)",
        bg: "rgba(255,232,0,.12)",
      },
      warn: {
        clr: C.p,
        border: "rgba(255,93,162,.4)",
        bg: "rgba(255,93,162,.12)",
      },
      ok: {
        clr: C.g,
        border: "rgba(107,238,91,.4)",
        bg: "rgba(107,238,91,.12)",
      },
      dim: {
        clr: C.dim,
        border: "rgba(207,210,219,.33)",
        bg: "rgba(207,210,219,.1)",
      },
    };
    const toneResolved = palette[tone] || palette.info;
    return (
      <span
        className="vrf-pill"
        style={{
          color: toneResolved.clr,
          borderColor: toneResolved.border,
          background: toneResolved.bg,
        }}
      >
        {children}
      </span>
    );
  };

  const Tabs = () => (
    <div role="tablist" aria-label="VRF tabs" className="rewards-grid__tabs vrf-tabs">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          role="tab"
          aria-selected={active === section.key}
          onClick={() => setActive(section.key)}
          className={`rewards-grid__tab${active === section.key ? " is-active" : ""}`}
        >
          {section.label}
        </button>
      ))}
    </div>
  );

  const GhostBtn = ({ children, className = "", tone = "ghost", ...props }) => {
    const toneClass =
      tone === "accent"
        ? "biggi-btn--accent"
        : tone === "ghost"
          ? "biggi-btn--ghost"
          : "";
    return (
      <button
        {...props}
        type="button"
        className={`biggi-btn ${toneClass} ${className}`.trim()}
      >
        {children}
      </button>
    );
  };

  const Value = ({ mono, children, tone = "neutral" }) => {
    const toneMap = {
      neutral:
        "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18))",
      warm: `linear-gradient(180deg, ${C.y}14, rgba(0,0,0,.18))`,
      cool: `linear-gradient(180deg, ${C.c}14, rgba(0,0,0,.18))`,
      violet: `linear-gradient(180deg, ${C.v}14, rgba(0,0,0,.18))`,
      pink: `linear-gradient(180deg, ${C.p}14, rgba(0,0,0,.18))`,
      green: `linear-gradient(180deg, ${C.g}14, rgba(0,0,0,.18))`,
    };
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: 34,
          padding: "8px 12px",
          borderRadius: 12,
          border: `1px solid ${C.line}`,
          background: toneMap[tone] || toneMap.neutral,
          fontWeight: 800,
          color: C.text,
          fontFamily: mono
            ? "ui-monospace,Menlo,Consolas,monospace"
            : "inherit",
        }}
      >
        {children}
      </span>
    );
  };

  const KV = ({ items = [] }) => (
    <div className="vrf-kv">
      {items.map(({ k, v, tone, mono, title }, i) => (
        <React.Fragment key={i}>
          <div className="vrf-kv__label">{k}</div>
          <div className="vrf-kv__value" title={title}>
            <Value tone={tone} mono={mono}>
              {v}
            </Value>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  const QuickStat = ({ label, value, accent }) => (
    <div
      className="rewards-grid__hero-card"
      style={{
        borderColor: accent ? `${accent}55` : undefined,
        boxShadow: accent
          ? `0 10px 24px rgba(0,0,0,0.28), 0 0 12px ${accent}22`
          : undefined,
      }}
    >
      <span
        className="rewards-grid__hero-label"
        style={{ color: accent || C.dim }}
      >
        {label}
      </span>
      <span
        className="rewards-grid__hero-value"
        style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}
      >
        {value}
      </span>
      <div className="rewards-grid__hero-bar">
        <span />
      </div>
    </div>
  );

  const netLabel = React.useMemo(() => {
    const id = Number(viewData.networkId ?? viewData.chainId);
    const map = {
      1: "Ethereum",
      5: "Goerli",
      10: "Optimism",
      137: "Polygon",
      80001: "Polygon Mumbai",
      80002: "Polygon Amoy",
      8453: "Base",
      42161: "Arbitrum",
    };
    if (Number.isFinite(id)) return `${map[id] || "EVM"} (${id})`;
    return viewData.network || "EVM";
  }, [viewData.networkId, viewData.chainId, viewData.network]);

  const effectiveLast = React.useMemo(() => {
    const L = { ...last };
    if (
      (Array.isArray(L.randomWords) && L.randomWords.length > 0) ||
      L.txHash
    ) {
      return { ...L, status: "fulfilled" };
    }
    const fulfilled = hist.find(
      (h) => String(h.status).toLowerCase() === "fulfilled",
    );
    if (String(L.status).toLowerCase() === "pending" && fulfilled) {
      return {
        requestId: L.requestId || fulfilled.requestId || "",
        status: "fulfilled",
        requestedAt: L.requestedAt || fulfilled.time || "",
        txHash: fulfilled.tx || L.txHash || "",
        blockNumber:
          typeof fulfilled.blockNumber === "number"
            ? fulfilled.blockNumber
            : L.blockNumber,
        randomWords:
          Array.isArray(fulfilled.randomWords) && fulfilled.randomWords.length
            ? fulfilled.randomWords
            : L.randomWords || [],
      };
    }
    if ((!L.requestId || L.requestId === "0") && fulfilled) {
      return {
        requestId: fulfilled.requestId || "",
        status: "fulfilled",
        requestedAt: fulfilled.time || "",
        txHash: fulfilled.tx || "",
        blockNumber: fulfilled.blockNumber,
        randomWords: fulfilled.randomWords || [],
      };
    }
    return L;
  }, [last, hist]);

  const lastStatusLabel = String(
    effectiveLast.status || "Unknown",
  ).toUpperCase();
  const statusTone =
    lastStatusLabel === "FULFILLED"
      ? "ok"
      : lastStatusLabel === "PENDING"
        ? "warn"
        : "info";

  const parseToEpoch = React.useCallback((raw) => {
    if (!raw) return null;
    const n = Date.parse(String(raw));
    return Number.isFinite(n) ? n : null;
  }, []);

  const pendingAgeMinutes = React.useMemo(() => {
    if (String(effectiveLast.status).toLowerCase() !== "pending") return null;
    const ts = parseToEpoch(effectiveLast.requestedAt);
    if (!ts) return null;
    const diff = Math.max(0, Date.now() - ts);
    return Math.round(diff / 60000);
  }, [effectiveLast.status, effectiveLast.requestedAt, parseToEpoch]);

  const latestFulfilled = React.useMemo(
    () => hist.find((h) => String(h.status).toLowerCase() === "fulfilled") || null,
    [hist],
  );

  const orchestrationSteps = React.useMemo(() => {
    const hasRequest = Boolean(effectiveLast.requestId && effectiveLast.requestId !== "0");
    const isFulfilled = String(effectiveLast.status).toLowerCase() === "fulfilled";
    const hasWords = Array.isArray(effectiveLast.randomWords) && effectiveLast.randomWords.length > 0;
    const hasTx = Boolean(effectiveLast.txHash);
    const hasHistory = hist.length > 0;
    return [
      {
        key: "request",
        label: "Redeem request captured",
        detail: hasRequest ? `requestId ${short(effectiveLast.requestId)}` : "No request found",
        state: hasRequest ? "ok" : "dim",
      },
      {
        key: "fulfill",
        label: "VRF callback fulfillment",
        detail: isFulfilled
          ? `Fulfilled at ${effectiveLast.requestedAt || latestFulfilled?.time || "-"}`
          : "Awaiting callback or confirmation",
        state: isFulfilled ? "ok" : hasRequest ? "warn" : "dim",
      },
      {
        key: "words",
        label: "Random words persisted",
        detail: hasWords
          ? `${effectiveLast.randomWords.length} word(s) captured`
          : "No random words stored yet",
        state: hasWords ? "ok" : isFulfilled ? "warn" : "dim",
      },
      {
        key: "tx",
        label: "Fulfillment tx linked",
        detail: hasTx ? short(effectiveLast.txHash) : "Tx hash missing",
        state: hasTx ? "ok" : isFulfilled ? "warn" : "dim",
      },
      {
        key: "history",
        label: "Proof history synced",
        detail: hasHistory ? `${hist.length} row(s) available` : "No rows in history",
        state: hasHistory ? "ok" : "dim",
      },
    ];
  }, [effectiveLast, hist, latestFulfilled]);

  const engineSignals = React.useMemo(() => {
    const pendingRows = hist.filter((row) => String(row.status).toLowerCase() === "pending").length;
    const hasFulfilled = Boolean(latestFulfilled);
    const latestWordCount = Array.isArray(effectiveLast.randomWords)
      ? effectiveLast.randomWords.length
      : 0;
    return [
      {
        key: "mode",
        label: "Mode",
        detail: "Read-only monitor (no tx execution)",
        state: "ok",
      },
      {
        key: "queue",
        label: "Pending queue",
        detail:
          pendingRows > 0
            ? `${pendingRows} pending request(s)${
                pendingAgeMinutes != null ? `, latest ${pendingAgeMinutes} min` : ""
              }`
            : "No pending requests",
        state: pendingRows > 0 ? "warn" : "ok",
      },
      {
        key: "proof",
        label: "Proof completeness",
        detail:
          latestWordCount > 0 && hasFulfilled
            ? "Latest request has words + tx"
            : "Waiting for complete fulfillment proof",
        state: latestWordCount > 0 && hasFulfilled ? "ok" : "warn",
      },
      {
        key: "params",
        label: "VRF params loaded",
        detail: params?.keyHash ? "keyHash + coordinator available" : "Incomplete VRF config",
        state: params?.keyHash ? "ok" : "dim",
      },
    ];
  }, [hist, latestFulfilled, effectiveLast.randomWords, pendingAgeMinutes, params?.keyHash]);

  const proofRows = React.useMemo(() => {
    const rows = hist.length
      ? hist
      : effectiveLast.requestId
        ? [
            {
              time: effectiveLast.requestedAt || "-",
              requestId: effectiveLast.requestId,
              status: effectiveLast.status || "unknown",
              words: Array.isArray(effectiveLast.randomWords)
                ? effectiveLast.randomWords.length
                : 0,
              tx: effectiveLast.txHash || "",
            },
          ]
        : [];
    return rows.slice(0, 20).map((row, idx) => {
      const status = String(row.status || "").toLowerCase();
      const wordsCountRaw =
        row.words ??
        (Array.isArray(row.randomWords) ? row.randomWords.length : null);
      const wordsCount = Number(wordsCountRaw ?? 0);
      const hasRequestId = Boolean(row.requestId);
      const hasTx = Boolean(row.tx);
      const needsTx = status === "fulfilled";
      const needsWords = status === "fulfilled";
      const hasWords = wordsCount > 0;
      const ok = hasRequestId && (!needsTx || hasTx) && (!needsWords || hasWords);
      return {
        key: `${row.requestId || "row"}-${idx}`,
        time: row.time || "-",
        requestId: row.requestId || "-",
        status: status || "unknown",
        words: Number.isFinite(wordsCount) ? wordsCount : 0,
        tx: row.tx || "",
        check: ok ? "ok" : needsTx || needsWords ? "warn" : "dim",
      };
    });
  }, [hist, effectiveLast]);

  const quickStats = React.useMemo(
    () => [
      { label: "Network", value: netLabel, accent: C.y },
      {
        label: "Wallet",
        value: userAddr ? short(userAddr) : "Not connected",
        accent: userAddr ? C.c : C.p,
      },
      {
        label: "Last Status",
        value: lastStatusLabel,
        accent: lastStatusLabel === "FULFILLED" ? C.g : C.v,
      },
      {
        label: "History",
        value: `${hist.length || 0}`,
        accent: hist.length ? C.y : C.dim,
      },
    ],
    [netLabel, userAddr, short, lastStatusLabel, hist.length, C.y, C.c, C.p, C.g, C.v, C.dim],
  );

  const recentHistory = React.useMemo(() => hist.slice(0, 6), [hist]);
  const historyHeaders = React.useMemo(
    () => ["Time", "RequestId", "Status", "Conf", "Words", "Tx"],
    [],
  );
  const proofHeaders = React.useMemo(
    () => ["Time", "RequestId", "Status", "Words", "Tx", "Check"],
    [],
  );

  const hasData = Boolean(
    viewData &&
      (viewData.params ||
        (Array.isArray(viewData.history) && viewData.history.length) ||
        (viewData.last &&
          (viewData.last.requestId ||
            (Array.isArray(viewData.last.randomWords) &&
              viewData.last.randomWords.length)))),
  );

  return (
    <section className="rewards-grid vrf-shell biggi-skin">
      <div className="rewards-grid__surface biggi-token-surface vrf-surface">
        <header className="rewards-grid__header biggi-header panel-header panel-header--vrf">
          <div className="rewards-grid__headline">
            <span className="vrf-badge">Chainlink VRF</span>
            <h2 className="rewards-grid__title">VRF Dashboard</h2>
            <p className="rewards-grid__subtitle">
              Monitor redeem requests, proofs, and results directly from on-chain
              data on {netLabel}.
            </p>
          </div>
          <div className="rewards-grid__header-actions">
            <GhostBtn onClick={refreshData} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </GhostBtn>
            {String(effectiveLast.status).toLowerCase() === "pending" &&
              effectiveLast.requestId && (
                <GhostBtn onClick={() => onCancelPending(effectiveLast.requestId)}>
                  Cancel Pending
                </GhostBtn>
              )}
            {!!effectiveLast.txHash && (
              <GhostBtn onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}>
                Explorer
              </GhostBtn>
            )}
            <GhostBtn
              tone="accent"
              onClick={() => onRequestRandomness()}
              title="Request randomness for your wallet"
            >
              Redeem / Request
            </GhostBtn>
            <button
              type="button"
              className="panel-info-btn biggi-btn biggi-btn--ghost"
              onClick={() => setInfoOpen(true)}
              aria-label="VRF panel info"
            >
              <span>i</span>
            </button>
          </div>
        </header>

        <div className="rewards-grid__hero">
          {quickStats.map((stat) => (
            <QuickStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              accent={stat.accent}
            />
          ))}
        </div>

        <Tabs />

        <div className="vrf-section-head" role="status" aria-live="polite">
          <span className="vrf-section-head__kicker">{activeSectionMeta.kicker}</span>
          <h3 className="vrf-section-head__title">{activeSectionMeta.title}</h3>
          <p className="vrf-section-head__desc">{activeSectionMeta.description}</p>
        </div>

        {!hasData && (
          <div className="vrf-card vrf-card--full">
            <div className="vrf-card__head">
              <h3>No VRF data</h3>
            </div>
            <p className="vrf-muted">
              Connect a wallet and press Refresh to load your VRF status.
            </p>
          </div>
        )}

        {active === "requests" && (
          <div className="vrf-pane">
            <div className="vrf-grid">
              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>My VRF Status</h3>
                  <Badge tone={statusTone}>{lastStatusLabel}</Badge>
                </div>
                <KV
                  items={[
                    {
                      k: "Your Address",
                      v: userAddr ? short(userAddr) : "-",
                      mono: true,
                      tone: "cool",
                      title: userAddr,
                    },
                    {
                      k: "Last Request ID",
                      v: effectiveLast.requestId || "-",
                      mono: true,
                      tone: "violet",
                      title: effectiveLast.requestId,
                    },
                    {
                      k: "Requested at",
                      v: effectiveLast.requestedAt || "-",
                      tone: "neutral",
                    },
                    {
                      k: "Fulfilled Tx",
                      v: effectiveLast.txHash ? short(effectiveLast.txHash) : "-",
                      mono: true,
                      tone: "violet",
                      title: effectiveLast.txHash,
                    },
                    {
                      k: "Block",
                      v: effectiveLast.blockNumber ?? "-",
                      mono: true,
                      tone: "neutral",
                    },
                  ]}
                />
              </div>

              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>Latest Result</h3>
                </div>
                <div className="vrf-result">
                  <div className="vrf-result__row">
                    <span>Random Word(s)</span>
                    <Value
                      mono
                      tone="green"
                      title={(effectiveLast.randomWords || []).join(", ")}
                    >
                      {Array.isArray(effectiveLast.randomWords) &&
                      effectiveLast.randomWords.length
                        ? effectiveLast.randomWords.slice(0, 3).join(", ") +
                          (effectiveLast.randomWords.length > 3 ? ", ..." : "")
                        : "-"}
                    </Value>
                  </div>
                  <div className="vrf-result__row">
                    <span>Fulfilled Tx</span>
                    {effectiveLast.txHash ? (
                      <GhostBtn
                        onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}
                      >
                        {short(effectiveLast.txHash)}
                      </GhostBtn>
                    ) : (
                      <Value>-</Value>
                    )}
                  </div>
                  <div className="vrf-result__row">
                    <span>Block</span>
                    <Value mono>{effectiveLast.blockNumber ?? "-"}</Value>
                  </div>
                </div>
              </div>
            </div>

            <div className="vrf-card vrf-card--full">
              <div className="vrf-card__head">
                <h3>Recent History</h3>
              </div>
              <div className="vrf-table-wrap">
                <table className="vrf-table">
                  <thead>
                    <tr>
                      {historyHeaders.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentHistory.map((r, idx) => (
                      <tr key={`${r.requestId}-${idx}`}>
                        <td>{r.time || "-"}</td>
                        <td className="vrf-table__mono">{short(r.requestId)}</td>
                        <td className="vrf-table__strong">
                          {String(r.status || "-").toUpperCase()}
                        </td>
                        <td>{r.confirmations ?? "-"}</td>
                        <td>{r.words ?? "-"}</td>
                        <td>
                          {r.tx ? (
                            <GhostBtn onClick={() => onOpenExplorer(r.tx, "tx")}>
                              {short(r.tx)}
                            </GhostBtn>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                    {!hist.length && (
                      <tr>
                        <td colSpan={6} className="vrf-table__empty">
                          No history yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {active === "history" && (
          <div className="vrf-pane">
            <div className="vrf-card vrf-card--full">
              <div className="vrf-card__head">
                <h3>History</h3>
              </div>
              <div className="vrf-table-wrap">
                <table className="vrf-table">
                  <thead>
                    <tr>
                      {historyHeaders.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hist.length ? (
                      hist.map((r, idx) => (
                        <tr key={`${r.requestId}-${idx}`}>
                          <td>{r.time || "-"}</td>
                          <td className="vrf-table__mono">{short(r.requestId)}</td>
                          <td className="vrf-table__strong">
                            {String(r.status || "-").toUpperCase()}
                          </td>
                          <td>{r.confirmations ?? "-"}</td>
                          <td>{r.words ?? "-"}</td>
                          <td>
                            {r.tx ? (
                              <GhostBtn onClick={() => onOpenExplorer(r.tx, "tx")}>
                                {short(r.tx)}
                              </GhostBtn>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="vrf-table__empty">
                          -
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {active === "orchestration" && (
          <div className="vrf-pane">
            <div className="vrf-grid">
              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>VRF Post-Redeem Orchestration</h3>
                  <Badge tone="dim">READ ONLY</Badge>
                </div>
                <p className="vrf-muted">
                  Redeem event to request to fulfillment to proof synchronization.
                  This section does not execute transactions.
                </p>
                <div className="vrf-steps">
                  {orchestrationSteps.map((step) => (
                    <div
                      key={step.key}
                      className={`vrf-step vrf-step--${step.state}`}
                    >
                      <div className="vrf-step__meta">
                        <span className="vrf-step__label">{step.label}</span>
                        <span className="vrf-step__detail">{step.detail}</span>
                      </div>
                      <Badge
                        tone={
                          step.state === "ok"
                            ? "ok"
                            : step.state === "warn"
                              ? "warn"
                              : "dim"
                        }
                      >
                        {step.state === "ok"
                          ? "OK"
                          : step.state === "warn"
                            ? "PENDING"
                            : "MISSING"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>Runtime Snapshot</h3>
                </div>
                <KV
                  items={[
                    {
                      k: "Current status",
                      v: lastStatusLabel,
                      tone: lastStatusLabel === "FULFILLED" ? "green" : "pink",
                    },
                    {
                      k: "Pending age",
                      v:
                        pendingAgeMinutes == null
                          ? "-"
                          : `${pendingAgeMinutes} minute(s)`,
                      tone: pendingAgeMinutes == null ? "neutral" : "warm",
                    },
                    {
                      k: "Last fulfilled",
                      v: latestFulfilled?.time || "-",
                    },
                    {
                      k: "Subscription",
                      v: viewData.subscription?.id || "-",
                      mono: true,
                      tone: "cool",
                    },
                    {
                      k: "Coordinator",
                      v: params?.coordinator ? short(params.coordinator) : "-",
                      title: params?.coordinator || "",
                      mono: true,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {active === "engine" && (
          <div className="vrf-pane">
            <div className="vrf-grid">
              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>CRE Decision Engine</h3>
                  <Badge tone="dim">READ ONLY</Badge>
                </div>
                <p className="vrf-muted">
                  Reserve / Buyback / DRIP engine is displayed here as a monitor
                  layer. It evaluates protocol signals and exposes auditable status.
                </p>
                <div className="vrf-chip-list">
                  {[
                    "VRF events",
                    "Request history",
                    "Chain params",
                    "Proof checks",
                    "Dashboard alerts",
                  ].map((label) => (
                    <span key={label} className="vrf-chip">
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="vrf-card">
                <div className="vrf-card__head">
                  <h3>Engine Signals</h3>
                </div>
                <div className="vrf-steps">
                  {engineSignals.map((signal) => (
                    <div
                      key={signal.key}
                      className={`vrf-step vrf-step--${signal.state}`}
                    >
                      <div className="vrf-step__meta">
                        <span className="vrf-step__label">{signal.label}</span>
                        <span className="vrf-step__detail">{signal.detail}</span>
                      </div>
                      <Badge
                        tone={
                          signal.state === "ok"
                            ? "ok"
                            : signal.state === "warn"
                              ? "warn"
                              : "dim"
                        }
                      >
                        {signal.state === "ok"
                          ? "OK"
                          : signal.state === "warn"
                            ? "CHECK"
                            : "N/A"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vrf-card vrf-card--full">
              <div className="vrf-card__head">
                <h3>Action Hooks</h3>
              </div>
              <p className="vrf-muted">
                This panel intentionally keeps execution disabled. Use refresh to
                run a new read cycle and update checks.
              </p>
              <div className="vrf-actions-row">
                <GhostBtn onClick={refreshData} disabled={isRefreshing}>
                  {isRefreshing ? "Running..." : "Run Checks"}
                </GhostBtn>
                {!!effectiveLast.txHash && (
                  <GhostBtn onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}>
                    Open Last Fulfillment Tx
                  </GhostBtn>
                )}
              </div>
            </div>
          </div>
        )}

        {active === "proof" && (
          <div className="vrf-pane">
            <div className="vrf-card vrf-card--full">
              <div className="vrf-card__head">
                <h3>Proof Log</h3>
              </div>
              <p className="vrf-muted">
                Audit rows from VRF history with consistency checks.
              </p>
              <div className="vrf-table-wrap">
                <table className="vrf-table">
                  <thead>
                    <tr>
                      {proofHeaders.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proofRows.length ? (
                      proofRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.time}</td>
                          <td className="vrf-table__mono">{short(row.requestId)}</td>
                          <td className="vrf-table__strong">
                            {String(row.status).toUpperCase()}
                          </td>
                          <td>{row.words}</td>
                          <td>
                            {row.tx ? (
                              <GhostBtn onClick={() => onOpenExplorer(row.tx, "tx")}>
                                {short(row.tx)}
                              </GhostBtn>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <Badge
                              tone={
                                row.check === "ok"
                                  ? "ok"
                                  : row.check === "warn"
                                    ? "warn"
                                    : "dim"
                              }
                            >
                              {row.check === "ok"
                                ? "PASS"
                                : row.check === "warn"
                                  ? "WARN"
                                  : "N/A"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="vrf-table__empty">
                          No proof rows yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <PanelInfoModal
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          title="VRF Panel"
          items={infoItems}
        />
      </div>
    </section>
  );

}
