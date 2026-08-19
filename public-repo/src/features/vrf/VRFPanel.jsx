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
}) {
  const [active, setActive] = React.useState("requests");
  const [infoOpen, setInfoOpen] = React.useState(false);

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
        label: "ACTIONS",
        description: [
          "Redeem triggers a new VRF request from the chapter's BiggiMain collection.",
          "Refresh pulls the latest VRF status from on-chain history.",
        ],
      },
    ],
    [],
  );

  const { refreshVRFPanel: refreshVRFPanelHook } = useVRF();
  const [hookData, setHookData] = React.useState(null);

  const refreshData = React.useCallback(async () => {
    if (typeof onRefresh === "function") {
      return await onRefresh();
    }
    const next = await refreshVRFPanelHook(walletAddress);
    if (next) setHookData(next);
    return next;
  }, [onRefresh, refreshVRFPanelHook, walletAddress]);

  const hasExternalData = data && Object.keys(data).length > 0;
  const viewData = hasExternalData ? data : hookData || {};

  const last = viewData.last || {};
  const hist = Array.isArray(viewData.history) ? viewData.history : [];
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

  const short = (addr) =>
    typeof addr === "string" && addr.length > 12
      ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
      : addr || "-";

  const Badge = ({ children, tone = "dim" }) => {
    const clr = tone === "warn" ? C.p : tone === "ok" ? C.g : "#ffe800";
    const border =
      tone === "warn"
        ? "rgba(255,93,162,.4)"
        : tone === "ok"
          ? "rgba(107,238,91,.4)"
          : "rgba(255,232,0,.35)";
    const bg =
      tone === "warn"
        ? "rgba(255,93,162,.12)"
        : tone === "ok"
          ? "rgba(107,238,91,.12)"
          : "rgba(255,232,0,.12)";
    return (
      <span
        className="vrf-pill"
        style={{ color: clr, borderColor: border, background: bg }}
      >
        {children}
      </span>
    );
  };

  const Tabs = () => (
    <div role="tablist" aria-label="VRF tabs" className="rewards-grid__tabs vrf-tabs">
      <button
        type="button"
        role="tab"
        aria-selected={active === "requests"}
        onClick={() => setActive("requests")}
        className={`rewards-grid__tab${active === "requests" ? " is-active" : ""}`}
      >
        Requests
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "history"}
        onClick={() => setActive("history")}
        className={`rewards-grid__tab${active === "history" ? " is-active" : ""}`}
      >
        History
      </button>
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
    if (Number.isFinite(id)) {
      return id === 137
        ? "Polygon mainnet (137)"
        : `Unsupported chain (${id})`;
    }
    return viewData.network || "Not connected";
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
        : "dim";

  const quickStats = [
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
  ];

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
            <GhostBtn onClick={refreshData}>Refresh</GhostBtn>
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
          <>
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
                      {["Time", "RequestId", "Status", "Conf", "Words", "Tx"].map(
                        (h) => (
                          <th key={h}>{h}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(hist || []).slice(0, 6).map((r, idx) => (
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
          </>
        )}

        {active === "history" && (
          <div className="vrf-card vrf-card--full">
            <div className="vrf-card__head">
              <h3>History</h3>
            </div>
            <div className="vrf-table-wrap">
              <table className="vrf-table">
                <thead>
                  <tr>
                    {["Time", "RequestId", "Status", "Conf", "Words", "Tx"].map(
                      (h) => (
                        <th key={h}>{h}</th>
                      ),
                    )}
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
