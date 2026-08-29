import * as React from "react";
import "../rewards/REWARDSPanel.css";
import "./VRFPanel.css";
import "../../styles/panel-buttons.css";
import { useVRF } from "../../hooks/useVRF";
import PanelInfoModal from "@/components/common/PanelInfoModal";
import PanelInfoButton from "@/components/common/PanelInfoButton";

const VRF_COLORS = {
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

const Badge = React.memo(function VRFBadge({
  children,
  tone = "info",
  colors = VRF_COLORS,
}) {
  const palette = {
    info: {
      clr: colors.y,
      border: "rgba(255,232,0,.35)",
      bg: "rgba(255,232,0,.12)",
    },
    warn: {
      clr: colors.p,
      border: "rgba(255,93,162,.4)",
      bg: "rgba(255,93,162,.12)",
    },
    ok: {
      clr: colors.g,
      border: "rgba(107,238,91,.4)",
      bg: "rgba(107,238,91,.12)",
    },
    dim: {
      clr: colors.dim,
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
});

const Tabs = React.memo(function VRFTabs({ sections, active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="VRF tabs"
      className="rewards-grid__tabs vrf-tabs"
    >
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          role="tab"
          aria-selected={active === section.key}
          onClick={() => onChange(section.key)}
          className={`rewards-grid__tab${active === section.key ? " is-active" : ""}`}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
});

function GhostBtn({ children, className = "", tone = "ghost", ...props }) {
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
}

function Value({
  mono,
  children,
  tone = "neutral",
  title,
  colors = VRF_COLORS,
}) {
  const toneMap = {
    neutral: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18))",
    warm: `linear-gradient(180deg, ${colors.y}14, rgba(0,0,0,.18))`,
    cool: `linear-gradient(180deg, ${colors.c}14, rgba(0,0,0,.18))`,
    violet: `linear-gradient(180deg, ${colors.v}14, rgba(0,0,0,.18))`,
    pink: `linear-gradient(180deg, ${colors.p}14, rgba(0,0,0,.18))`,
    green: `linear-gradient(180deg, ${colors.g}14, rgba(0,0,0,.18))`,
  };

  return (
    <span
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: 34,
        padding: "8px 12px",
        boxSizing: "border-box",
        borderRadius: 12,
        border: `1px solid ${colors.line}`,
        background: toneMap[tone] || toneMap.neutral,
        fontWeight: 800,
        color: colors.text,
        fontFamily: mono ? "ui-monospace,Menlo,Consolas,monospace" : "inherit",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      {children}
    </span>
  );
}

function KV({ items = [], colors = VRF_COLORS }) {
  return (
    <div className="vrf-kv">
      {items.map(({ k, v, tone, mono, title }, i) => (
        <React.Fragment key={i}>
          <div className="vrf-kv__label">{k}</div>
          <div className="vrf-kv__value" title={title}>
            <Value tone={tone} mono={mono} title={title} colors={colors}>
              {v}
            </Value>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveMatchState(liveValue, expectedValue, explicitMatch) {
  if (typeof explicitMatch === "boolean") {
    return explicitMatch ? "ok" : "warn";
  }
  if (!liveValue || !expectedValue) return "dim";
  return normalizeComparable(liveValue) === normalizeComparable(expectedValue)
    ? "ok"
    : "warn";
}

function wiringBadgeLabel(state) {
  if (state === "ok") return "OK";
  if (state === "warn") return "CHECK";
  if (state === "standby") return "STANDBY";
  return "CONFIG";
}

const QuickStat = React.memo(function VRFQuickStat({
  label,
  value,
  accent,
  colors = VRF_COLORS,
}) {
  return (
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
        style={{ color: accent || colors.dim }}
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
});

export default function VRFPanel({
  data = {},
  walletAddress = "",
  onRequestRandomness = null,
  onRefresh = null,
  onCancelPending = null,
  onOpenExplorer = () => {},
  autoOpenInfo = false,
}) {
  const [active, setActive] = React.useState("requests");
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [diagramInfoOpen, setDiagramInfoOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const autoInfoOpened = React.useRef(false);
  const refreshInFlightRef = React.useRef(null);
  const refreshDataRef = React.useRef(null);
  const sections = React.useMemo(
    () => [
      { key: "requests", label: "Requests" },
      { key: "history", label: "History" },
      { key: "orchestration", label: "Post-Redeem" },
      { key: "engine", label: "VRF Health" },
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
        title: "VRF Health Signals",
        description:
          "Read-only Chainlink VRF configuration, request health, and mainnet wiring checks.",
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
        label: "VRF HEALTH",
        description: [
          "Read-only monitoring layer for Chainlink VRF request health and mainnet wiring.",
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
          "TicketHub redeem submits a request through the VRF collection and router.",
          "Refresh pulls the latest VRF status from on-chain history.",
        ],
      },
    ],
    [],
  );
  const diagramInfoItems = React.useMemo(
    () => [
      {
        label: "Panel sections",
        description:
          "Requests, History, Post-Redeem, VRF Health, and Proof Log are shown as separate read views over one VRF data model.",
      },
      {
        label: "Contract path",
        description:
          "Wallet redeem goes to TicketHub, then the VRF collection requests randomness through BiggiVRFRouter and the Chainlink VRF coordinator; callback fulfillment updates request status.",
      },
      {
        label: "Read path",
        description:
          "Refresh loads RPC/event snapshots through the useVRF layer and rehydrates all tabs from one source of truth.",
      },
      {
        label: "Explorer links",
        description:
          "Tx hash shortcuts from Requests/History/Proof are external links for audit and verification.",
      },
    ],
    [],
  );

  const { refreshVRFPanel: refreshVRFPanelHook } = useVRF();
  const [hookData, setHookData] = React.useState(null);

  const refreshData = React.useCallback(
    async ({ silent = false } = {}) => {
      if (refreshInFlightRef.current) return refreshInFlightRef.current;

      const task = (async () => {
        if (!silent) setIsRefreshing(true);
        try {
          if (typeof onRefresh === "function") {
            return await onRefresh();
          }
          const next = await refreshVRFPanelHook(walletAddress);
          if (next) setHookData(next);
          return next;
        } finally {
          if (!silent) setIsRefreshing(false);
          refreshInFlightRef.current = null;
        }
      })();

      refreshInFlightRef.current = task;
      return task;
    },
    [onRefresh, refreshVRFPanelHook, walletAddress],
  );
  refreshDataRef.current = refreshData;

  const hasExternalData = data && Object.keys(data).length > 0;
  const viewData = hasExternalData ? data : hookData || {};

  const last = React.useMemo(() => viewData.last || {}, [viewData.last]);
  const hist = React.useMemo(
    () => (Array.isArray(viewData.history) ? viewData.history : []),
    [viewData.history],
  );
  const params = React.useMemo(() => viewData.params || {}, [viewData.params]);
  const userAddr =
    viewData.user?.address ||
    viewData.userAddress ||
    viewData.address ||
    walletAddress ||
    "";

  const C = VRF_COLORS;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshDataRef.current?.({ silent: true });
      } catch (e) {
        if (!cancelled) {
          console.error("VRFPanel: refresh failed", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const short = React.useCallback(
    (addr) =>
      typeof addr === "string" && addr.length > 12
        ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
        : addr || "-",
    [],
  );

  const netLabel = React.useMemo(() => {
    const id = Number(viewData.networkId ?? viewData.chainId);
    if (Number.isFinite(id)) {
      return id === 137 ? "Polygon mainnet (137)" : `Unsupported chain (${id})`;
    }
    return viewData.network || "Not connected";
  }, [viewData.networkId, viewData.chainId, viewData.network]);

  const effectiveLast = React.useMemo(() => {
    const L = { ...last };
    const requestId = String(L.requestId || "");
    const matchingHistory = requestId
      ? hist.find((row) => String(row.requestId || "") === requestId)
      : null;
    const matchingFulfilled =
      matchingHistory &&
      String(matchingHistory.status).toLowerCase() === "fulfilled"
        ? matchingHistory
        : null;
    const latestFulfilledRow = hist.find(
      (h) => String(h.status).toLowerCase() === "fulfilled",
    );

    if (matchingFulfilled) {
      return {
        requestId: requestId || matchingFulfilled.requestId || "",
        status: "fulfilled",
        requestedAt: L.requestedAt || matchingFulfilled.time || "",
        requestedAtMs: L.requestedAtMs ?? null,
        txHash: matchingFulfilled.tx || L.txHash || "",
        blockNumber:
          typeof matchingFulfilled.blockNumber === "number"
            ? matchingFulfilled.blockNumber
            : L.blockNumber,
        randomWords:
          Array.isArray(matchingFulfilled.randomWords) &&
          matchingFulfilled.randomWords.length
            ? matchingFulfilled.randomWords
            : L.randomWords || [],
        pendingTicketId: L.pendingTicketId || "",
      };
    }

    if (String(L.status).toLowerCase() === "pending") return L;

    if (Array.isArray(L.randomWords) && L.randomWords.length > 0) {
      return { ...L, status: "fulfilled" };
    }

    if ((!requestId || requestId === "0") && latestFulfilledRow) {
      return {
        requestId: latestFulfilledRow.requestId || "",
        status: "fulfilled",
        requestedAt: latestFulfilledRow.time || "",
        requestedAtMs: null,
        txHash: latestFulfilledRow.tx || "",
        blockNumber: latestFulfilledRow.blockNumber,
        randomWords: latestFulfilledRow.randomWords || [],
        pendingTicketId: "",
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

  const activeChapterCount = Number(params?.activeChapterCount ?? 0);
  const activeChapterId = Number(params?.activeChapterId ?? 0);
  const activeChapterLabel =
    activeChapterCount === 1
      ? params?.activeChapterName || `Chapter ${activeChapterId}`
      : activeChapterCount === 0
        ? "Pre-launch"
        : `${activeChapterCount} active - check`;
  const requestBlockedReason = React.useMemo(() => {
    const chainId = Number(viewData.networkId ?? viewData.chainId);
    if (chainId !== 137) return "Switch the wallet to Polygon mainnet.";
    if (!userAddr) return "Connect a wallet first.";
    if (activeChapterCount !== 1) {
      return activeChapterCount > 1
        ? "Exactly one chapter must be active."
        : "No chapter is active yet.";
    }
    if (params?.ticketHubPaused === true) return "TicketHub is paused.";
    if (params?.collectionApproved === false) {
      return "The active collection is not approved by the VRF Router.";
    }
    if (viewData.subscription?.routerIsConsumer === false) {
      return "The VRF Router is not registered as a subscription consumer.";
    }
    if (viewData.subscription?.fundedForNative === false) {
      return "The VRF subscription has no native-token funding.";
    }
    if (String(effectiveLast.status).toLowerCase() === "pending") {
      return "A VRF request is already pending for this wallet.";
    }
    if (typeof onRequestRandomness !== "function") {
      return "Redeem is unavailable in this build.";
    }
    return "";
  }, [
    activeChapterCount,
    effectiveLast.status,
    onRequestRandomness,
    params?.collectionApproved,
    params?.ticketHubPaused,
    userAddr,
    viewData.chainId,
    viewData.networkId,
    viewData.subscription?.fundedForNative,
    viewData.subscription?.routerIsConsumer,
  ]);
  const canRequestRandomness = !requestBlockedReason;

  const parseToEpoch = React.useCallback((raw) => {
    if (!raw) return null;
    const n = Date.parse(String(raw));
    return Number.isFinite(n) ? n : null;
  }, []);

  const pendingAgeMs = React.useMemo(() => {
    if (String(effectiveLast.status).toLowerCase() !== "pending") return null;
    const numericTs = Number(effectiveLast.requestedAtMs);
    if (Number.isFinite(numericTs) && numericTs > 0) {
      return Math.max(0, Date.now() - numericTs);
    }
    const ts = parseToEpoch(effectiveLast.requestedAt);
    if (!ts) return null;
    return Math.max(0, Date.now() - ts);
  }, [
    effectiveLast.status,
    effectiveLast.requestedAt,
    effectiveLast.requestedAtMs,
    parseToEpoch,
  ]);

  const pendingAgeMinutes = React.useMemo(() => {
    if (pendingAgeMs == null) return null;
    return Math.round(pendingAgeMs / 60000);
  }, [pendingAgeMs]);

  const pendingRetryDelaySec = React.useMemo(() => {
    const raw = Number(params?.pendingRetryDelaySec ?? 0);
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  }, [params?.pendingRetryDelaySec]);

  const retryRemainingSeconds = React.useMemo(() => {
    if (
      String(effectiveLast.status).toLowerCase() !== "pending" ||
      pendingRetryDelaySec <= 0 ||
      pendingAgeMs == null
    ) {
      return 0;
    }
    return Math.max(
      0,
      Math.ceil((pendingRetryDelaySec * 1000 - pendingAgeMs) / 1000),
    );
  }, [effectiveLast.status, pendingRetryDelaySec, pendingAgeMs]);

  const formatRetryCountdown = React.useCallback((seconds) => {
    const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    if (minutes > 0 && remainder > 0) return `${minutes}m ${remainder}s`;
    if (minutes > 0) return `${minutes}m`;
    return `${safeSeconds}s`;
  }, []);

  const pendingRetryReady =
    String(effectiveLast.status).toLowerCase() === "pending" &&
    (pendingRetryDelaySec <= 0 ||
      pendingAgeMs == null ||
      retryRemainingSeconds === 0);

  const pendingActionLabel = pendingRetryReady
    ? "Retry Pending"
    : `Retry in ${formatRetryCountdown(retryRemainingSeconds)}`;

  const pendingActionTitle = pendingRetryReady
    ? "Submit a fresh VRF request for the current pending ticket."
    : `Retry becomes available in ${formatRetryCountdown(retryRemainingSeconds)}.`;

  const latestFulfilled = React.useMemo(
    () =>
      hist.find((h) => String(h.status).toLowerCase() === "fulfilled") || null,
    [hist],
  );

  const orchestrationSteps = React.useMemo(() => {
    const hasRequest = Boolean(
      effectiveLast.requestId && effectiveLast.requestId !== "0",
    );
    const isFulfilled =
      String(effectiveLast.status).toLowerCase() === "fulfilled";
    const hasWords =
      Array.isArray(effectiveLast.randomWords) &&
      effectiveLast.randomWords.length > 0;
    const hasTx = Boolean(effectiveLast.txHash);
    const hasHistory = hist.length > 0;
    return [
      {
        key: "request",
        label: "Redeem request captured",
        detail: hasRequest
          ? `requestId ${short(effectiveLast.requestId)}`
          : "No request found",
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
        detail: hasHistory
          ? `${hist.length} row(s) available`
          : "No rows in history",
        state: hasHistory ? "ok" : "dim",
      },
    ];
  }, [effectiveLast, hist, latestFulfilled, short]);

  const wiringSignals = React.useMemo(() => {
    const subscription = viewData.subscription || {};
    const keyHashLive = params?.keyHashLive || "";
    const keyHashDisplay = keyHashLive || params?.keyHash || "";
    const coordinatorLive = params?.coordinatorLive || "";
    const coordinatorDisplay = coordinatorLive || params?.coordinator || "";
    const keyHashState = resolveMatchState(
      keyHashLive,
      params?.expectedKeyHash,
      params?.keyHashMatches,
    );
    const coordinatorState = resolveMatchState(
      coordinatorLive,
      params?.expectedCoordinator,
      params?.coordinatorMatches,
    );
    const subscriptionState = resolveMatchState(
      subscription?.matches === null ? "" : subscription?.id,
      subscription?.expectedId,
      subscription?.matches,
    );
    const chapterState =
      activeChapterCount === 1
        ? "ok"
        : activeChapterCount > 1
          ? "warn"
          : "standby";
    const collectionState = !params?.collection
      ? "warn"
      : params?.collectionApproved === false
        ? "warn"
        : params?.collectionApproved === true
          ? chapterState
          : "dim";
    const ticketHubState = !params?.ticketHub
      ? "warn"
      : params?.ticketHubPaused === true
        ? "warn"
        : params?.ticketHubPaused === false
          ? "ok"
          : "dim";

    return [
      {
        key: "chapter",
        label: "Active chapter",
        detail:
          activeChapterCount === 1
            ? `${activeChapterLabel} (#${activeChapterId})`
            : activeChapterCount === 0
              ? "No chapter active (pre-launch)"
              : `${activeChapterCount} chapters active; exactly one required`,
        state: chapterState,
      },
      {
        key: "collection",
        label: "Collection VRF",
        detail: params?.collection
          ? short(params.collection)
          : "Missing collection address",
        title: params?.collection || "",
        state: collectionState,
      },
      {
        key: "ticketHub",
        label: "TicketHub",
        detail: params?.ticketHub
          ? `${short(params.ticketHub)} / ${
              params?.ticketHubPaused === true
                ? "paused"
                : params?.ticketHubPaused === false
                  ? "ready"
                  : "status not loaded"
            }`
          : "Missing TicketHub address",
        title: params?.ticketHub || "",
        state: ticketHubState,
      },
      {
        key: "router",
        label: "VRF Router",
        detail: params?.vrfRouter
          ? short(params.vrfRouter)
          : "Missing VRF router address",
        title: params?.vrfRouter || "",
        state: params?.vrfRouter ? "ok" : "warn",
      },
      {
        key: "coordinator",
        label: "Coordinator",
        detail: coordinatorDisplay
          ? `${short(coordinatorDisplay)}${
              params?.expectedCoordinator
                ? ` / expected ${short(params.expectedCoordinator)}`
                : ""
            }`
          : "Coordinator not loaded",
        title: coordinatorDisplay || params?.expectedCoordinator || "",
        state: coordinatorState,
      },
      {
        key: "keyHash",
        label: "KeyHash",
        detail: keyHashDisplay
          ? `${short(keyHashDisplay)}${
              params?.expectedKeyHash
                ? ` / expected ${short(params.expectedKeyHash)}`
                : ""
            }`
          : "KeyHash not loaded",
        title: keyHashDisplay || params?.expectedKeyHash || "",
        state: keyHashState,
      },
      {
        key: "subscription",
        label: "Subscription",
        detail: subscription?.id
          ? `${short(String(subscription.id))}${
              subscription?.expectedId
                ? ` / expected ${short(String(subscription.expectedId))}`
                : ""
            }`
          : "Subscription not loaded",
        title: subscription?.id || subscription?.expectedId || "",
        state: subscriptionState,
      },
      {
        key: "routerApproval",
        label: "Router approval",
        detail:
          params?.collectionApproved === true
            ? "Active collection approved"
            : params?.collectionApproved === false
              ? "Active collection not approved"
              : "Approval not loaded",
        state:
          params?.collectionApproved === true
            ? "ok"
            : params?.collectionApproved === false
              ? "warn"
              : "dim",
      },
      {
        key: "routerOwner",
        label: "Router owner",
        detail: params?.routerOwner
          ? short(params.routerOwner)
          : "Owner not loaded",
        title: params?.routerOwner || "",
        state:
          params?.routerOwnerMatches === true
            ? "ok"
            : params?.routerOwnerMatches === false
              ? "warn"
              : "dim",
      },
      {
        key: "subscriptionConsumer",
        label: "Subscription consumer",
        detail:
          subscription?.routerIsConsumer === true
            ? "VRF Router registered"
            : subscription?.routerIsConsumer === false
              ? "VRF Router missing"
              : "Consumer list not loaded",
        state:
          subscription?.routerIsConsumer === true
            ? "ok"
            : subscription?.routerIsConsumer === false
              ? "warn"
              : "dim",
      },
      {
        key: "subscriptionOwner",
        label: "Subscription owner",
        detail: subscription?.owner
          ? short(subscription.owner)
          : "Owner not loaded",
        title: subscription?.owner || "",
        state:
          subscription?.ownerMatches === true
            ? "ok"
            : subscription?.ownerMatches === false
              ? "warn"
              : "dim",
      },
      {
        key: "subscriptionFunding",
        label: "Native subscription funding",
        detail: subscription?.loaded
          ? `${subscription.nativeBalance || "0"} POL / ${
              subscription.requestCount || "0"
            } requests`
          : "Balance not loaded",
        state:
          subscription?.fundedForNative === true
            ? "ok"
            : subscription?.fundedForNative === false
              ? "warn"
              : "dim",
      },
    ];
  }, [
    activeChapterCount,
    activeChapterId,
    activeChapterLabel,
    params,
    short,
    viewData.subscription,
  ]);

  const engineSignals = React.useMemo(() => {
    const pendingRows = hist.filter(
      (row) => String(row.status).toLowerCase() === "pending",
    ).length;
    const currentPending =
      String(effectiveLast.status).toLowerCase() === "pending";
    const pendingCount = Math.max(pendingRows, currentPending ? 1 : 0);
    const hasFulfilled = Boolean(latestFulfilled);
    const latestWordCount = Array.isArray(effectiveLast.randomWords)
      ? effectiveLast.randomWords.length
      : 0;
    const hasMainnetWiring = Boolean(
      params?.collection &&
      params?.ticketHub &&
      params?.vrfRouter &&
      (params?.keyHash || params?.expectedKeyHash) &&
      (params?.coordinator || params?.expectedCoordinator) &&
      params?.collectionApproved === true &&
      params?.ticketHubPaused === false &&
      params?.routerOwnerMatches === true &&
      viewData.subscription?.matches === true &&
      viewData.subscription?.routerIsConsumer === true &&
      viewData.subscription?.ownerMatches === true &&
      viewData.subscription?.fundedForNative === true,
    );
    const hasMismatch =
      params?.keyHashMatches === false ||
      params?.coordinatorMatches === false ||
      params?.routerOwnerMatches === false ||
      params?.collectionApproved === false ||
      params?.ticketHubPaused === true ||
      viewData.subscription?.matches === false ||
      viewData.subscription?.routerIsConsumer === false ||
      viewData.subscription?.ownerMatches === false ||
      viewData.subscription?.fundedForNative === false;
    const hasAnyRequest = Boolean(
      (effectiveLast.requestId && effectiveLast.requestId !== "0") ||
      hist.length,
    );
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
          pendingCount > 0
            ? `${pendingCount} pending request(s)${
                pendingAgeMinutes != null
                  ? `, latest ${pendingAgeMinutes} min`
                  : ""
              }`
            : "No pending requests",
        state: pendingCount > 0 ? "warn" : "ok",
      },
      {
        key: "proof",
        label: "Proof completeness",
        detail: !hasAnyRequest
          ? "No request history for this wallet"
          : latestWordCount > 0 && hasFulfilled
            ? "Latest request has words + tx"
            : "Waiting for complete fulfillment proof",
        state: !hasAnyRequest
          ? "dim"
          : latestWordCount > 0 && hasFulfilled
            ? "ok"
            : "warn",
      },
      {
        key: "params",
        label: "VRF params loaded",
        detail:
          params?.keyHash && params?.coordinator
            ? "keyHash + coordinator available"
            : "Incomplete VRF config",
        state: params?.keyHash && params?.coordinator ? "ok" : "dim",
      },
      {
        key: "wiring",
        label: "Mainnet wiring",
        detail: hasMismatch
          ? "One or more live values differ from configured mainnet data"
          : activeChapterCount > 1
            ? "More than one chapter is active"
            : activeChapterCount === 0 && hasMainnetWiring
              ? "VRF infrastructure ready; chapter activation pending"
          : hasMainnetWiring
            ? "Collection, TicketHub, router, coordinator and keyHash configured"
            : "Mainnet wiring incomplete",
        state: hasMismatch
          ? "warn"
          : activeChapterCount === 1 && hasMainnetWiring
            ? "ok"
            : activeChapterCount > 1
              ? "warn"
              : "dim",
      },
    ];
  }, [
    hist,
    latestFulfilled,
    effectiveLast.randomWords,
    pendingAgeMinutes,
    params,
    viewData.subscription,
    effectiveLast.requestId,
    effectiveLast.status,
    activeChapterCount,
  ]);

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
      const ok =
        hasRequestId && (!needsTx || hasTx) && (!needsWords || hasWords);
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
        label: "Active Chapter",
        value: activeChapterLabel,
        accent:
          activeChapterCount === 1 ? C.g : activeChapterCount > 1 ? C.p : C.dim,
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
    [
      netLabel,
      userAddr,
      short,
      lastStatusLabel,
      hist.length,
      C.y,
      C.c,
      C.p,
      C.g,
      C.v,
      C.dim,
      activeChapterCount,
      activeChapterLabel,
    ],
  );

  const recentHistory = React.useMemo(() => hist.slice(0, 6), [hist]);
  const historyHeaders = React.useMemo(
    () => ["Time", "RequestId", "Status", "Words", "Tx"],
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
              Observe the Chainlink VRF lifecycle on {netLabel}: request
              creation, fulfillment timing, random words, health signals, and
              proof checks. Live contract values are compared with the Polygon
              mainnet configuration.
            </p>
          </div>
          <div className="rewards-grid__header-actions">
            <GhostBtn onClick={refreshData} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </GhostBtn>
            {String(effectiveLast.status).toLowerCase() === "pending" &&
              effectiveLast.requestId &&
              params?.retryPendingSupported === true &&
              typeof onCancelPending === "function" && (
                <GhostBtn
                  onClick={() => onCancelPending(effectiveLast.requestId)}
                  disabled={!pendingRetryReady}
                  title={pendingActionTitle}
                >
                  {pendingActionLabel}
                </GhostBtn>
              )}
            {!!effectiveLast.txHash && (
              <GhostBtn
                onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}
              >
                Explorer
              </GhostBtn>
            )}
            <GhostBtn
              tone="accent"
              onClick={() => onRequestRandomness?.()}
              disabled={!canRequestRandomness}
              title={
                requestBlockedReason ||
                "Redeem a ticket and request Chainlink VRF"
              }
            >
              Redeem Ticket
            </GhostBtn>
            {requestBlockedReason && (
              <span className="vrf-request-blocked" role="status">
                {requestBlockedReason}
              </span>
            )}
            <PanelInfoButton
              onClick={() => setInfoOpen(true)}
              ariaLabel="VRF panel info"
            />
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

        <Tabs sections={sections} active={active} onChange={setActive} />

        <div className="vrf-section-head" role="status" aria-live="polite">
          <span className="vrf-section-head__kicker">
            {activeSectionMeta.kicker}
          </span>
          <h3 className="vrf-section-head__title">{activeSectionMeta.title}</h3>
          <p className="vrf-section-head__desc">
            {activeSectionMeta.description}
          </p>
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
                      v: effectiveLast.txHash
                        ? short(effectiveLast.txHash)
                        : "-",
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
                        onClick={() =>
                          onOpenExplorer(effectiveLast.txHash, "tx")
                        }
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
                        <td data-label="Time">{r.time || "-"}</td>
                        <td data-label="Request ID" className="vrf-table__mono">
                          {short(r.requestId)}
                        </td>
                        <td data-label="Status" className="vrf-table__strong">
                          {String(r.status || "-").toUpperCase()}
                        </td>
                        <td data-label="Words">{r.words ?? "-"}</td>
                        <td data-label="Transaction">
                          {r.tx ? (
                            <GhostBtn
                              onClick={() => onOpenExplorer(r.tx, "tx")}
                            >
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
                        <td colSpan={5} className="vrf-table__empty">
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
                          <td data-label="Time">{r.time || "-"}</td>
                          <td
                            data-label="Request ID"
                            className="vrf-table__mono"
                          >
                            {short(r.requestId)}
                          </td>
                          <td data-label="Status" className="vrf-table__strong">
                            {String(r.status || "-").toUpperCase()}
                          </td>
                          <td data-label="Words">{r.words ?? "-"}</td>
                          <td data-label="Transaction">
                            {r.tx ? (
                              <GhostBtn
                                onClick={() => onOpenExplorer(r.tx, "tx")}
                              >
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
                        <td colSpan={5} className="vrf-table__empty">
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
                  Redeem event to request to fulfillment to proof
                  synchronization. This section does not execute transactions.
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
                      tone:
                        viewData.subscription?.matches === false
                          ? "pink"
                          : "cool",
                      title: viewData.subscription?.expectedId
                        ? `Expected: ${viewData.subscription.expectedId}`
                        : viewData.subscription?.id || "",
                    },
                    {
                      k: "Collection VRF",
                      v: params?.collection ? short(params.collection) : "-",
                      title: params?.collection || "",
                      mono: true,
                      tone: params?.collection ? "cool" : "pink",
                    },
                    {
                      k: "TicketHub",
                      v: params?.ticketHub ? short(params.ticketHub) : "-",
                      title: params?.ticketHub || "",
                      mono: true,
                      tone: params?.ticketHub ? "cool" : "pink",
                    },
                    {
                      k: "VRF Router",
                      v: params?.vrfRouter ? short(params.vrfRouter) : "-",
                      title: params?.vrfRouter || "",
                      mono: true,
                      tone: params?.vrfRouter ? "cool" : "pink",
                    },
                    {
                      k: "Coordinator",
                      v: params?.coordinator ? short(params.coordinator) : "-",
                      title: params?.coordinator || "",
                      mono: true,
                      tone:
                        params?.coordinatorMatches === false
                          ? "pink"
                          : "neutral",
                    },
                    {
                      k: "KeyHash",
                      v: params?.keyHash ? short(params.keyHash) : "-",
                      title: params?.keyHash || "",
                      mono: true,
                      tone:
                        params?.keyHashMatches === false ? "pink" : "neutral",
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
                  <h3>VRF Health Monitor</h3>
                  <Badge tone="dim">READ ONLY</Badge>
                </div>
                <p className="vrf-muted">
                  Chainlink request state, fulfillment proof, and mainnet wiring
                  are displayed here as a read-only monitor.
                </p>
                <div className="vrf-chip-list">
                  {[
                    "VRF events",
                    "Request history",
                    "Chainlink params",
                    "Proof checks",
                    "Mainnet wiring",
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
                        <span className="vrf-step__detail">
                          {signal.detail}
                        </span>
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
                <h3>Mainnet Wiring</h3>
                <Badge tone="info">POLYGON</Badge>
              </div>
              <div className="vrf-steps vrf-steps--grid">
                {wiringSignals.map((signal) => (
                  <div
                    key={signal.key}
                    className={`vrf-step vrf-step--${signal.state}`}
                    title={signal.title}
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
                      {wiringBadgeLabel(signal.state)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="vrf-card vrf-card--full">
              <div className="vrf-card__head">
                <h3>Action Hooks</h3>
              </div>
              <p className="vrf-muted">
                This panel intentionally keeps execution disabled. Use refresh
                to run a new read cycle and update checks.
              </p>
              <div className="vrf-actions-row">
                <GhostBtn onClick={refreshData} disabled={isRefreshing}>
                  {isRefreshing ? "Running..." : "Run Checks"}
                </GhostBtn>
                {!!effectiveLast.txHash && (
                  <GhostBtn
                    onClick={() => onOpenExplorer(effectiveLast.txHash, "tx")}
                  >
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
                          <td data-label="Time">{row.time}</td>
                          <td
                            data-label="Request ID"
                            className="vrf-table__mono"
                          >
                            {short(row.requestId)}
                          </td>
                          <td data-label="Status" className="vrf-table__strong">
                            {String(row.status).toUpperCase()}
                          </td>
                          <td data-label="Words">{row.words}</td>
                          <td data-label="Transaction">
                            {row.tx ? (
                              <GhostBtn
                                onClick={() => onOpenExplorer(row.tx, "tx")}
                              >
                                {short(row.tx)}
                              </GhostBtn>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td data-label="Check">
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

        <div
          className="rewards-grid__section-header"
          style={{ "--section-accent": "#27d9d2" }}
        >
          <span className="rewards-grid__section-title">VRF Diagram</span>
          <span className="rewards-grid__section-line" />
        </div>
        <section className="vrf-diagram-wrap">
          <PanelInfoButton
            className="vrf-diagram-info-btn"
            onClick={() => setDiagramInfoOpen(true)}
            ariaLabel="Open VRF diagram info"
            title="VRF diagram info"
          />
          <img
            className="vrf-diagram-image"
            src="/images/schemas/vrf-flow-diagram.png?v=20260224a"
            alt="VRF panel diagram showing sections, request lifecycle, Chainlink callback, and proof or explorer data paths."
            loading="lazy"
            decoding="async"
          />
        </section>

        <PanelInfoModal
          open={diagramInfoOpen}
          onClose={() => setDiagramInfoOpen(false)}
          title="VRF diagram info"
          items={diagramInfoItems}
        />
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
