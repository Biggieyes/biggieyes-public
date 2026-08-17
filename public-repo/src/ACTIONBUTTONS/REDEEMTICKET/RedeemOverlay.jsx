// src/components/redeem/RedeemOverlay.jsx
import * as React from "react";
import { getInjectedProvider } from "@/shared/utils/contract";

export default function RedeemOverlay({
  open,
  isRedeeming,
  VRFPending,
  redeemMsg,
  pendingTicketId,
  onRefresh,
}) {
  const layerRef = React.useRef(null);
  const anchorElRef = React.useRef(null);
  const rafIdRef = React.useRef(0);
  const resizeObserverRef = React.useRef(null);
  const intersectionObserverRef = React.useRef(null);
  const VRFPollRef = React.useRef(null);

  const [anchorPos, setAnchorPos] = React.useState(null);

  // Network hint for newer contracts/chains
  const [chainId, setChainId] = React.useState(null);
  const [networkLabel, setNetworkLabel] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    async function loadNet() {
      try {
        const injected = getInjectedProvider();
        const idHex = await injected?.request?.({
          method: "eth_chainId",
        });
        const id = idHex ? parseInt(idHex, 16) : null;
        if (alive) {
          setChainId(id);
          setNetworkLabel(
            Number.isFinite(id)
              ? id === 137
                ? "Polygon mainnet (137)"
                : `Unsupported chain (${id})`
              : "Not connected",
          );
        }
      } catch {
        if (alive) {
          setChainId(null);
          setNetworkLabel("EVM");
        }
      }
    }
    loadNet();
    const onChain = () => loadNet();
    const injected = getInjectedProvider();
    injected?.on?.("chainChanged", onChain);
    return () => injected?.removeListener?.("chainChanged", onChain);
  }, []);

  // Find and store the anchor widget reference when opened
  const findWidgetEl = React.useCallback(() => {
    return (
      document.querySelector(".live-stats-widget-new") ||
      document.querySelector(".widget-center-wrapper")
    );
  }, []);

  const shallowEqualPos = (a, b) => {
    if (!a || !b) return false;
    return (
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.height === b.height
    );
  };

  const measurePos = React.useCallback(() => {
    const el = anchorElRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // Use viewport coordinates (layer is FIXED); no scroll offsets
    const next = {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    return next;
  }, []);

  // Throttle via rAF: if a request is already scheduled, ignore new ones
  const updatePosRaf = React.useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = 0;
      const next = measurePos();
      setAnchorPos((prev) => {
        if (!next) return null;
        if (prev && shallowEqualPos(prev, next)) return prev;
        return next;
      });
    });
  }, [measurePos]);

  React.useLayoutEffect(() => {
    if (!open) return;
    // Find and store element
    const el = findWidgetEl();
    anchorElRef.current = el || null;
    // Measure immediately on open
    updatePosRaf();
  }, [open, findWidgetEl, updatePosRaf]);

  React.useEffect(() => {
    if (!open) return;

    const onScroll = () => updatePosRaf();
    const onResize = () => updatePosRaf();

    // Passive listeners + rAF throttle
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    // Observe anchor size changes
    if (anchorElRef.current && "ResizeObserver" in window) {
      resizeObserverRef.current = new ResizeObserver(() => updatePosRaf());
      resizeObserverRef.current.observe(anchorElRef.current);
    }

    // If anchor is barely visible, scroll it into view once
    if (anchorElRef.current && "IntersectionObserver" in window) {
      intersectionObserverRef.current = new IntersectionObserver(
        (entries, obs) => {
          const entry = entries[0];
          if (!entry) return;
          // If less than ~70% visible, center it
          if (entry.intersectionRatio < 0.7) {
            try {
              anchorElRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            } catch {}
          }
          // Disconnect after one adjustment
          obs.disconnect();
          intersectionObserverRef.current = null;
        },
        { threshold: [0.7] },
      );
      intersectionObserverRef.current.observe(anchorElRef.current);
    }

    // Initial measurement
    updatePosRaf();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch {}
        resizeObserverRef.current = null;
      }
      if (intersectionObserverRef.current) {
        try {
          intersectionObserverRef.current.disconnect();
        } catch {}
        intersectionObserverRef.current = null;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [open, updatePosRaf]);

  // Auto-refresh while VRF is pending (light polling)
  React.useEffect(() => {
    if (!open) return;
    if (VRFPending) {
      if (!VRFPollRef.current) {
        VRFPollRef.current = setInterval(() => {
          try {
            onRefresh?.();
          } catch {}
        }, 6500);
      }
    } else {
      if (VRFPollRef.current) {
        clearInterval(VRFPollRef.current);
        VRFPollRef.current = null;
      }
    }
    return () => {
      if (VRFPollRef.current) {
        clearInterval(VRFPollRef.current);
        VRFPollRef.current = null;
      }
    };
  }, [open, VRFPending, onRefresh]);

  if (!open) return null;

  const phase = VRFPending ? "VRF" : isRedeeming ? "tx" : "idle";
  const title =
    phase === "tx"
      ? "Redeeming Your NFT"
      : phase === "VRF"
        ? "Generating Your NFT"
        : "Working...";
  const note =
    phase === "tx"
      ? redeemMsg || "Waiting for your confirmation and on-chain transaction..."
      : redeemMsg || "Generating unique properties with Chainlink VRF...";
  const pct = phase === "tx" ? 40 : 80;

  const S = styles;

  return (
    <div
      ref={layerRef}
      style={S.layer}
      role="dialog"
      aria-modal="true"
      aria-label="Redeem progress"
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%{opacity:.7} 50%{opacity:1} 100%{opacity:.7} }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
        }
      `}</style>

      <div
        style={
          anchorPos
            ? {
                ...S.anchorWrap,
                left: anchorPos.left + anchorPos.width / 2,
                top: anchorPos.top + anchorPos.height,
                transform: "translate(-50%, 14px)",
              }
            : { ...S.centerWrap }
        }
      >
        <div style={S.card}>
          <div style={S.header}>
            <div style={S.iconContainer}>
              <img
                src="/images/icons/mint.png"
                alt=""
                style={S.icon}
                loading="React.lazy"
                decoding="async"
                fetchPriority="low"
              />
            </div>
            <div style={S.headerTxts}>
              <div style={S.title}>{title}</div>
              {pendingTicketId && (
                <div style={S.subTitle}>
                  Ticket ID: <span style={S.badge}>#{pendingTicketId}</span>
                </div>
              )}
              {/* Network badge from connected wallet */}
              {networkLabel && (
                <div style={{ ...S.subTitle, display: "inline-flex", gap: 8 }}>
                  <span
                    style={{
                      border: "1px solid rgba(93,220,255,.45)",
                      borderRadius: 8,
                      padding: "2px 8px",
                      color: "#5ddcff",
                      background: "rgba(93,220,255,.08)",
                      fontWeight: 700,
                    }}
                    title="Active Network"
                  >
                    {networkLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={S.progressContainer}>
            <div style={S.progressWrap} aria-label="progress bar">
              <div style={{ ...S.progressBar, width: `${pct}%` }} />
            </div>
            <div style={S.progressText}>{pct}% Complete</div>
          </div>

          {/* ---- Steps ---- */}
          <div style={S.stepList} role="list" aria-label="Redeem steps">
            <Row
              step={1}
              label="Wallet confirmation"
              active={phase === "tx"}
              done={phase === "VRF"}
            />
            <Row
              step={2}
              label="On-chain transaction (ticket burn)"
              active={phase === "tx"}
              done={phase === "VRF"}
              even
            />
            <Row
              step={3}
              label="Chainlink VRF & metadata generation"
              active={phase === "VRF"}
              done={false}
            />
          </div>

          <div style={S.note} aria-live="polite">
            <div style={S.noteIcon}>i</div>
            {note}
          </div>

          {phase === "VRF" && (
            <button style={S.refreshBtn} onClick={onRefresh}>
              Check Status
              <span style={S.refreshIcon}>⟳</span>
            </button>
          )}

          <div style={S.footer}>
            <img
              src="/images/Biggi.png"
              alt=""
              style={S.thumb}
              loading="React.lazy"
              decoding="async"
              fetchPriority="low"
            />
            <div style={S.tip}>
              Your NFT will automatically appear in your gallery once revealed.
            </div>
          </div>

          <div style={S.arrowUp} />
        </div>
      </div>
    </div>
  );
}

// Memoized row to avoid rerender unless props change
const Row = React.memo(function Row({ step, active, done, label, even }) {
  const S = styles;
  const chipStyle = done
    ? S.statusDone
    : active
      ? S.statusActive
      : S.statusIdle;
  const statusText = done ? "Completed" : active ? "In Progress" : "Pending";
  const rowStyle = {
    ...S.stepRow,
    ...(even ? S.stepRowAlt : {}),
    ...(done ? S.stepRowDone : {}),
    ...(active && !done ? S.stepRowActive : {}),
  };
  const pillStyle = {
    ...S.stepPill,
    ...(done ? S.stepPillDone : {}),
    ...(active && !done ? S.stepPillActive : {}),
  };
  const labelStyle = {
    ...S.stepLabel,
    ...(done ? S.stepLabelDone : {}),
    ...(active && !done ? S.stepLabelActive : {}),
  };

  return (
    <div style={rowStyle} role="listitem">
      <div style={S.stepLeft}>
        <span style={pillStyle}>{step}</span>
        <div style={labelStyle}>{label}</div>
      </div>
      <div style={S.stepRight}>
        <span style={{ ...S.statusChip, ...chipStyle }}>
          {statusText}
          {active && (
            <span style={S.spinnerWrap} aria-hidden>
              <span style={S.spinner} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

const styles = {
  layer: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(5px)",
    zIndex: 9998,
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  anchorWrap: {
    position: "fixed", // anchor to viewport
    pointerEvents: "auto", // must be auto for button clicks
    zIndex: 9999,
  },
  centerWrap: {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "auto",
    zIndex: 9999,
  },
  card: {
    width: "min(700px, 92vw)",
    background:
      "linear-gradient(135deg, rgba(25,28,45,0.95) 0%, rgba(15,18,35,0.98) 100%)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,232,0,0.2)",
    color: "#fff",
    padding: "24px",
    fontFamily: "'Inter', sans-serif",
    pointerEvents: "auto",
    position: "relative",
    overFLOW: "hidden",
    willChange: "transform",
  },
  arrowUp: {
    position: "absolute",
    left: "50%",
    top: -10,
    width: 20,
    height: 20,
    transform: "translateX(-50%) rotate(45deg)",
    background: "rgba(25,28,45,0.95)",
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "-2px -2px 10px rgba(0,0,0,0.3)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: "12px",
    background: "rgba(255,232,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,232,0,0.2)",
  },
  icon: {
    width: 32,
    height: "auto",
    filter: "drop-shadow(0 0 5px rgba(255,232,0,0.5))",
  },
  headerTxts: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  title: {
    fontWeight: 700,
    fontSize: "20px",
    color: "#FFFFFF",
    letterSpacing: "0.5px",
  },
  subTitle: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.7)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  badge: {
    display: "inline-block",
    border: "1px solid rgba(255,232,0,0.3)",
    borderRadius: "6px",
    padding: "4px 8px",
    color: "#FFE800",
    background: "rgba(255,232,0,0.1)",
    fontWeight: 600,
    fontSize: "12px",
  },
  progressContainer: {
    marginBottom: "24px",
  },
  progressWrap: {
    height: "8px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
    overFLOW: "hidden",
    marginBottom: "8px",
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #FFE800, #FF9D00)",
    boxShadow: "0 0 20px rgba(255,232,0,0.4)",
    transition: "width .5s ease",
    borderRadius: "10px",
    animation: "shimmer 2s infinite linear",
    backgroundSize: "1000px 100%",
  },
  progressText: {
    textAlign: "right",
    fontSize: "12px",
    color: "rgba(255,255,255,0.7)",
    fontWeight: 500,
  },

  /* ---- Steps ---- */
  stepList: {
    position: "relative",
    border: "1px solid rgba(8,255,230,0.15)",
    borderRadius: "16px",
    overFLOW: "hidden",
    background:
      "linear-gradient(145deg, rgba(13,20,38,0.9) 0%, rgba(9,13,26,0.85) 100%)",
    marginTop: "22px",
    marginBottom: "22px",
    boxShadow:
      "0 16px 36px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)",
    backdropFilter: "blur(12px)",
    padding: "10px",
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    minHeight: "56px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.01)",
    transition: "all 0.25s ease",
  },
  stepRowAlt: {
    background: "rgba(255,255,255,0.02)",
  },
  stepRowActive: {
    background:
      "linear-gradient(90deg, rgba(8,255,230,0.22) 0%, rgba(8,255,230,0.04) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(8,255,230,0.22)",
  },
  stepRowDone: {
    background:
      "linear-gradient(90deg, rgba(255,232,0,0.18) 0%, rgba(255,232,0,0.03) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,232,0,0.22)",
  },
  stepLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: "1 1 auto",
  },
  stepLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 1.4,
    transition: "color 0.25s ease, text-shadow 0.25s ease",
  },
  stepLabelActive: {
    color: "#08FFE6",
    textShadow: "0 0 12px rgba(8,255,230,0.35)",
  },
  stepLabelDone: {
    color: "#FFE800",
  },
  stepRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  stepPill: {
    display: "inline-grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.8)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 100%)",
    fontWeight: 700,
    fontSize: "15px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
    transition: "all 0.25s ease",
  },
  stepPillActive: {
    borderColor: "rgba(8,255,230,0.7)",
    color: "#08FFE6",
    background:
      "linear-gradient(135deg, rgba(8,255,230,0.25) 0%, rgba(8,255,230,0.05) 100%)",
    boxShadow:
      "0 0 0 1px rgba(8,255,230,0.3), 0 12px 24px rgba(8,255,230,0.22)",
  },
  stepPillDone: {
    borderColor: "rgba(255,232,0,0.65)",
    color: "#FFE800",
    background:
      "linear-gradient(135deg, rgba(255,232,0,0.25) 0%, rgba(255,232,0,0.05) 100%)",
    boxShadow:
      "0 0 0 1px rgba(255,232,0,0.3), 0 12px 24px rgba(255,232,0,0.25)",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "30px",
    padding: "6px 16px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    borderWidth: "1px",
    borderStyle: "solid",
    transition: "all 0.3s ease",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  statusIdle: {
    borderColor: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.65)",
    background: "rgba(255,255,255,0.06)",
  },
  statusActive: {
    borderColor: "rgba(8,255,230,0.6)",
    color: "#0AF0FF",
    background: "rgba(8,255,230,0.12)",
    boxShadow: "0 0 14px rgba(8,255,230,0.35)",
  },
  statusDone: {
    borderColor: "rgba(255,232,0,0.6)",
    background: "rgba(255,232,0,0.12)",
    color: "#FFE800",
    boxShadow: "0 0 14px rgba(255,232,0,0.28)",
  },
  spinnerWrap: {
    display: "inline-grid",
    placeItems: "center",
    width: "14px",
    height: "14px",
  },
  spinner: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    border: "2px solid #08FFE6",
    borderTopColor: "transparent",
    animation: "spin 0.9s linear infinite",
  },

  note: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
    padding: "12px 16px",
    fontSize: "14px",
    color: "rgba(255,255,255,0.8)",
    background: "rgba(255,232,0,0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  noteIcon: {
    fontSize: "16px",
    animation: "pulse 2s ease-in-out infinite",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "0 auto 16px",
    background: "linear-gradient(135deg, #08FFE6 0%, #00D1FF 100%)",
    border: "none",
    color: "#0A1F2D",
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 10px rgba(8,255,230,0.3)",
  },
  refreshIcon: {
    fontSize: "16px",
    transition: "transform 0.3s ease",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  thumb: {
    width: "40px",
    height: "40px",
    border: "1px solid rgba(255,232,0,0.3)",
    borderRadius: "8px",
    background: "rgba(0,0,0,0.2)",
    objectFit: "cover",
  },
  tip: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.4,
  },
};


