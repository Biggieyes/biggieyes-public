import * as React from "react";
import "../panels/RewardsPanel.css";
import "./VRFPanel.css";
import { useVRF } from "../../hooks/useVRF";

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
    viewData.user?.address || viewData.userAddress || viewData.address || walletAddress || "";

  // ====== PALETTE (shared) ======
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

  // Auto-refresh on mount to populate data (safe async + error handled)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshData();
      } catch (e) {
        // log it, but do not crash render
        console.error("VRFPanel: refresh failed", e);
      } finally {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshData]);

  // ===== helpers (shared) =====
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
        className="rewards-grid__pill"
        style={{ color: clr, borderColor: border, background: bg }}
      >
        {children}
      </span>
    );
  };

  const Tabs = () => (
    <div role="tablist" aria-label="VRF tabs" className="view-tabs rewards-panel__tabs">
      <button
        type="button"
        role="tab"
        aria-selected={active === "requests"}
        onClick={() => setActive("requests")}
        className={`tab-button ${active === "requests" ? "active" : ""}`}
      >
        Requests
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "history"}
        onClick={() => setActive("history")}
        className={`tab-button ${active === "history" ? "active" : ""}`}
      >
        History
      </button>
      <button
        type="button"
        aria-pressed={infoOpen}
        aria-expanded={infoOpen}
        aria-controls="vrf-info-panel"
        onClick={() => setInfoOpen((open) => !open)}
        className={`tab-button ${infoOpen ? "active" : ""}`}
      >
        Info
      </button>
    </div>
  );

  const Card = ({ title, right, hue = "y", children, subtitle }) => {
    const ring =
      hue === "y" ? C.y : hue === "v" ? C.v : hue === "p" ? C.p : hue === "c" ? C.c : C.g;
    return (
      <article className="biggi-card rewards-grid__card vrf-card" style={{ borderColor: `${ring}55` }}>
        <div className="biggi-card__glow" aria-hidden />
        <div className="biggi-card__header">
          <div className="biggi-card__heading">
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {right ? <div className="biggi-card__actions">{right}</div> : null}
        </div>
        <div className="biggi-card__body">{children}</div>
      </article>
    );
  };

  const GhostBtn = ({ children, className = "", ...props }) => (
    <button {...props} className={`rewards-grid__refresh ${className}`.trim()}>
      {children}
    </button>
  );

  const Value = ({ mono, children, tone = "neutral" }) => {
    const toneMap = {
      neutral: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18))",
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
          fontFamily: mono ? "ui-monospace,Menlo,Consolas,monospace" : "inherit",
        }}
      >
        {children}
      </span>
    );
  };

  const KV = ({ items = [] }) => (
    <div className="vrf-panel__kv">
      {items.map(({ k, v, tone, mono, title }, i) => (
        <React.Fragment key={i}>
          <div className="vrf-panel__kv-label">{k}</div>
          <div className="vrf-panel__kv-value" title={title}>
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
        boxShadow: accent ? `0 10px 24px rgba(0,0,0,0.28), 0 0 12px ${accent}22` : undefined,
      }}
    >
      <span className="rewards-grid__hero-label" style={{ color: accent || C.dim }}>
        {label}
      </span>
      <span className="rewards-grid__hero-value" style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>
        {value}
      </span>
      <div className="rewards-grid__hero-bar">
        <span />
      </div>
    </div>
  );

  const SectionHeader = ({ label, accent = C.y }) => (
    <div className="rewards-grid__section-header" style={{ "--section-accent": accent }}>
      <span className="rewards-grid__section-title">{label}</span>
      <span className="rewards-grid__section-line" />
    </div>
  );

  // ====== derived ======
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
    if ((Array.isArray(L.randomWords) && L.randomWords.length > 0) || L.txHash) {
      return { ...L, status: "fulfilled" };
    }
    const fulfilled = hist.find((h) => String(h.status).toLowerCase() === "fulfilled");
    if (String(L.status).toLowerCase() === "pending" && fulfilled) {
      return {
        requestId: L.requestId || fulfilled.requestId || "",
        status: "fulfilled",
        requestedAt: L.requestedAt || fulfilled.time || "",
        txHash: fulfilled.tx || L.txHash || "",
        blockNumber: typeof fulfilled.blockNumber === "number" ? fulfilled.blockNumber : L.blockNumber,
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

  const lastStatusLabel = String(effectiveLast.status || "Unknown").toUpperCase();

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
            (Array.isArray(viewData.last.randomWords) && viewData.last.randomWords.length))))
  );

  const StatusRibbon = () => {
    const status = String(effectiveLast.status || "idle").toLowerCase();
    const tone = status === "fulfilled" ? C.g : status === "pending" ? C.v : C.y;
    const text =
      status === "fulfilled"
        ? "Last request fulfilled"
        : status === "pending"
        ? "Randomness pending"
        : "No active VRF request";
    const toneClass = status === "fulfilled" ? "is-success" : "";
    return (
      <div className={`rewards-grid__alert vrf-panel__ribbon${toneClass ? ` ${toneClass}` : ""}`}>
        <span
          className="vrf-panel__ribbon-dot"
          style={{
            background: tone,
            boxShadow: `0 0 10px ${tone}66`,
          }}
          aria-hidden
        />
        <div className="vrf-panel__ribbon-text">
          <strong style={{ letterSpacing: 0.06, textTransform: "uppercase" }}>{text}</strong>
          <span style={{ color: C.dim, fontSize: 13 }}>
            Req ID: {effectiveLast.requestId || "-"} | Block: {effectiveLast.blockNumber ?? "-"} | Words:{" "}
            {Array.isArray(effectiveLast.randomWords) && effectiveLast.randomWords.length
              ? effectiveLast.randomWords.length
              : "-"}
          </span>
        </div>
        {effectiveLast.txHash ? (
          <GhostBtn onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")} className="vrf-panel__ribbon-cta">
            View tx
          </GhostBtn>
        ) : null}
      </div>
    );
  };

  return (
    <section className="rewards-grid biggi-skin vrf-panel">
      <div className="rewards-grid__surface biggi-token-surface">
        <header className="rewards-grid__header biggi-header panel-header panel-header--vrf">
          <div className="rewards-grid__headline">
            <span className="biggi-badge">Verifiable Randomness</span>
            <h2 className="rewards-grid__title">Chainlink VRF</h2>
            <p className="rewards-grid__subtitle">
              Monitor randomness requests, proofs, and contract parameters on {netLabel}. Every update is streamed
              directly from the smart contracts.
            </p>
          </div>
        </header>

        <StatusRibbon />

        {infoOpen && (
          <section
            id="vrf-info-panel"
            className="rewards-grid__info"
            role="region"
            aria-label="VRF details"
          >
            <div className="rewards-grid__info-content">
              <div className="rewards-grid__info-top">
                <h3>VRF quick guide</h3>
                <button
                  type="button"
                  className="rewards-grid__close-btn"
                  onClick={() => setInfoOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="rewards-grid__info-body">
                <div className="rewards-grid__info-column" style={{ width: "100%" }}>
                  <table className="vrf-panel__info-table">
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>What is VRF?</td>
                        <td style={{ padding: "10px 12px" }}>
                          Chainlink VRF provides <strong>verifiable</strong> randomness with proofs validated on-chain.
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>Request -&gt; Fulfill</td>
                        <td style={{ padding: "10px 12px" }}>
                          You request randomness; oracle responds via <code>fulfillRandomWords</code>.
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>Key Hash</td>
                        <td style={{ padding: "10px 12px" }}>Identifies gas lane / key for VRF.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>Confirmations</td>
                        <td style={{ padding: "10px 12px" }}>Blocks to wait before delivery.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>Num Words</td>
                        <td style={{ padding: "10px 12px" }}>How many random numbers to return.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 12px", fontWeight: 800 }}>Callback Gas</td>
                        <td style={{ padding: "10px 12px" }}>
                          Must cover your processing in the callback.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="rewards-grid__hero vrf-panel__hero">
          {quickStats.map((stat, idx) => (
            <QuickStat key={`${stat.label}-${idx}`} {...stat} />
          ))}
        </div>

        <Tabs />

        {!hasData && (
          <div style={{ marginBottom: 12 }}>
            <Card title="No VRF data" hue="y" subtitle="Connect wallet and press Refresh to load your VRF status.">
              <div style={{ display: "flex", gap: 8 }}>
                <GhostBtn onClick={refreshData}>Refresh</GhostBtn>
              </div>
            </Card>
          </div>
        )}

        {active === "requests" && (
          <div className="rewards-grid__cards">
            <SectionHeader label="Requests" accent={C.y} />
            <Card
              title="My VRF Status"
              hue="y"
              subtitle={`Network: ${netLabel}`}
              right={
                <>
                  <GhostBtn onClick={refreshData}>Refresh</GhostBtn>
                  {String(effectiveLast.status).toLowerCase() === "pending" && effectiveLast.requestId && (
                    <GhostBtn onClick={() => onCancelPending(effectiveLast.requestId)}>
                      Cancel My Pending
                    </GhostBtn>
                  )}
                  {!!effectiveLast.txHash && (
                    <GhostBtn onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}>
                      View on Explorer
                    </GhostBtn>
                  )}
                  <GhostBtn onClick={() => onRequestRandomness()} title="Request randomness for your wallet">
                    Request My Randomness
                  </GhostBtn>
                </>
              }
            >
              <KV
                items={[
                  { k: "Your Address", v: userAddr ? short(userAddr) : "-", mono: true, tone: "cool", title: userAddr },
                  { k: "Status", v: String(effectiveLast.status || "idle").toUpperCase(), tone: "warm" },
                  { k: "Last Request ID", v: effectiveLast.requestId || "-", mono: true, tone: "violet", title: effectiveLast.requestId },
                  { k: "Requested at", v: effectiveLast.requestedAt || "-", tone: "neutral" },
                  { k: "Fulfilled Tx", v: effectiveLast.txHash ? short(effectiveLast.txHash) : "-", mono: true, tone: "violet", title: effectiveLast.txHash },
                  { k: "Block", v: effectiveLast.blockNumber ?? "-", mono: true, tone: "neutral" },
                ]}
              />
            </Card>

            <Card title="My Latest Result" hue="g" right={null} subtitle="Most recent fulfilled randomness for your address.">
              <div className="vrf-panel__result">
                <div className="vrf-panel__row">
                  <div className="vrf-panel__row-label">Random Word(s)</div>
                  <div className="vrf-panel__row-value">
                    <Value mono tone="green" title={(effectiveLast.randomWords || []).join(", ")}>
                      {Array.isArray(effectiveLast.randomWords) && effectiveLast.randomWords.length
                        ? effectiveLast.randomWords.slice(0, 3).join(", ") +
                          (effectiveLast.randomWords.length > 3 ? ", ..." : "")
                        : "-"}
                    </Value>
                  </div>
                </div>
                <div className="vrf-panel__row">
                  <div className="vrf-panel__row-label">Fulfilled Tx</div>
                  <div className="vrf-panel__row-value">
                    {effectiveLast.txHash ? (
                      <GhostBtn onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}>
                        {short(effectiveLast.txHash)}
                      </GhostBtn>
                    ) : (
                      <Value>-</Value>
                    )}
                  </div>
                </div>
                <div className="vrf-panel__row">
                  <div className="vrf-panel__row-label">Block</div>
                  <div className="vrf-panel__row-value">
                    <Value mono>{effectiveLast.blockNumber ?? "-"}</Value>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {active === "history" && (
          <div className="rewards-grid__cards">
            <SectionHeader label="History" accent={C.v} />
            <Card title="My History" hue="p" right={<Badge>read-only</Badge>} subtitle="Recent randomness requests.">
              <div className="vrf-panel__history">
                <div className="vrf-panel__history-scroll">
                  <table className="vrf-panel__history-table">
                    <thead>
                      <tr>
                        {["Time", "RequestId", "Status", "Conf", "Words", "Tx"].map((h, i, arr) => (
                          <th
                            key={h}
                            className={`vrf-panel__history-head${i === 0 ? " is-first" : ""}${i === arr.length - 1 ? " is-last" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hist.length ? (
                        hist.map((r, idx) => (
                          <tr
                            key={`${r.requestId}-${idx}`}
                            className={idx % 2 === 0 ? "vrf-panel__history-row" : "vrf-panel__history-row is-alt"}
                          >
                            <td className="vrf-panel__history-cell">{r.time || "-"}</td>
                            <td className="vrf-panel__history-cell vrf-panel__history-cell--mono">
                              <Value mono>{short(r.requestId)}</Value>
                            </td>
                            <td className="vrf-panel__history-cell vrf-panel__history-cell--strong">
                              {String(r.status || "-").toUpperCase()}
                            </td>
                            <td className="vrf-panel__history-cell">{r.confirmations ?? "-"}</td>
                            <td className="vrf-panel__history-cell">{r.words ?? "-"}</td>
                            <td className="vrf-panel__history-cell">
                              {r.tx ? (
                                <GhostBtn onClick={() => onOpenExplorer(r.tx, "tx")}>{short(r.tx)}</GhostBtn>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="vrf-panel__history-empty">
                            -
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
