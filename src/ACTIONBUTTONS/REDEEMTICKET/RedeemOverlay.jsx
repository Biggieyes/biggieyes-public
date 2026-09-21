import * as React from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Images,
  RefreshCw,
  X,
} from "lucide-react";

import {
  VRF_FRAME_SEQUENCES,
  VRF_STEPS,
  VRF_TRANSFORMATION_FRAMES,
  deriveVrfUiStage,
  getVrfActiveStep,
  getVrfStageProgress,
} from "./vrfTransformationFrames.js";
import "./VrfTransformationModal.css";

const PLACEHOLDER_IMAGES = new Set(["", "/images/Biggi.png"]);

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}

function useFramePreloader(enabled) {
  const startedRef = React.useRef(false);
  const [state, setState] = React.useState({ loaded: 0, ready: false });

  React.useEffect(() => {
    if (!enabled || startedRef.current) return undefined;
    startedRef.current = true;
    let active = true;
    let loaded = 0;

    const load = (src) =>
      new Promise((resolve) => {
        const image = new Image();
        const settle = () => {
          image.onload = null;
          image.onerror = null;
          loaded += 1;
          if (active) setState({ loaded, ready: false });
          resolve();
        };
        image.onload = settle;
        image.onerror = settle;
        image.src = src;
      });

    Promise.all(VRF_TRANSFORMATION_FRAMES.map(load)).then(() => {
      if (active) {
        setState({
          loaded: VRF_TRANSFORMATION_FRAMES.length,
          ready: true,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}

function useTransformationFrame({ mode, ready, reducedMotion, onFinalFrame }) {
  const currentRef = React.useRef(0);
  const fadeTimerRef = React.useRef(null);
  const callbackRef = React.useRef(onFinalFrame);
  const [current, setCurrent] = React.useState(0);
  const [previous, setPrevious] = React.useState(null);

  React.useEffect(() => {
    callbackRef.current = onFinalFrame;
  }, [onFinalFrame]);

  const showFrame = React.useCallback((next) => {
    if (currentRef.current === next) return;
    setPrevious(currentRef.current);
    currentRef.current = next;
    setCurrent(next);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setPrevious(null), 210);
  }, []);

  React.useEffect(() => {
    if (!ready) return undefined;
    const sequence = VRF_FRAME_SEQUENCES[mode] || VRF_FRAME_SEQUENCES.burning;
    let cancelled = false;
    let timer = null;

    if (reducedMotion) {
      const majorFrame = sequence.frames.at(-1) ?? 0;
      showFrame(majorFrame);
      if (mode === "revealing") {
        timer = setTimeout(() => {
          if (!cancelled) callbackRef.current?.();
        }, 420);
      }
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    let cursor = 0;
    const advance = () => {
      if (cancelled) return;
      showFrame(sequence.frames[cursor] ?? sequence.frames[0] ?? 0);
      cursor += 1;
      if (cursor < sequence.frames.length) {
        timer = setTimeout(advance, sequence.durationMs);
        return;
      }
      if (sequence.loop) {
        cursor = 0;
        timer = setTimeout(advance, sequence.durationMs);
        return;
      }
      if (mode === "revealing") {
        timer = setTimeout(() => {
          if (!cancelled) callbackRef.current?.();
        }, 380);
      }
    };

    advance();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mode, ready, reducedMotion, showFrame]);

  React.useEffect(
    () => () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  return { current, previous };
}

function short(value, start = 8, end = 6) {
  const text = String(value || "");
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function isSelectedNftReady(selectedNft, fulfillment) {
  if (!selectedNft || !fulfillment?.tokenId) return false;
  const tokenId = String(selectedNft.tokenId ?? selectedNft.id ?? "");
  const image = String(selectedNft.image || selectedNft.meta?.image || "").trim();
  return (
    tokenId === String(fulfillment.tokenId) &&
    !selectedNft.isTicket &&
    !selectedNft.isPending &&
    !PLACEHOLDER_IMAGES.has(image)
  );
}

function getStatusText(stage, message, selectedNftReady) {
  if (stage === "error") return message || "The redeem operation did not complete.";
  if (stage === "complete") return "NFT selected and metadata loaded";
  if (stage === "revealing") {
    return selectedNftReady
      ? "VRF fulfilled - revealing NFT"
      : "VRF fulfilled - loading NFT metadata";
  }
  if (message) return message;
  const labels = {
    burning: "Waiting for wallet confirmation",
    confirming: "Waiting for transaction confirmation",
    requesting_vrf: "Requesting Chainlink VRF",
    waiting_vrf: "Waiting for Chainlink VRF",
  };
  return labels[stage] || "Preparing transformation";
}

export default function RedeemOverlay({
  isRedeeming = false,
  VRFPending = false,
  redeemMsg = "",
  redeemError = "",
  pendingTicketId = "",
  txStatus = null,
  txLink = "",
  requestId = "",
  fulfillment = null,
  selectedNft = null,
  onRefresh,
}) {
  const processActive = Boolean(isRedeeming || VRFPending);
  const hasInitialPresentation = Boolean(
    processActive || fulfillment || redeemError,
  );
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = React.useState(hasInitialPresentation);
  const [processStarted, setProcessStarted] = React.useState(
    hasInitialPresentation,
  );
  const [revealComplete, setRevealComplete] = React.useState(false);
  const [retainedTicketId, setRetainedTicketId] = React.useState(
    pendingTicketId || "",
  );
  const activeRef = React.useRef(processActive);
  const fulfillmentKeyRef = React.useRef("");
  const errorKeyRef = React.useRef("");
  const closeButtonRef = React.useRef(null);

  const fulfillmentKey = fulfillment
    ? `${fulfillment.requestId || ""}:${fulfillment.tokenId || ""}:${fulfillment.txHash || ""}`
    : "";
  const effectiveRequestId = String(
    requestId || fulfillment?.requestId || "",
  );
  const selectedNftReady = isSelectedNftReady(selectedNft, fulfillment);

  React.useEffect(() => {
    if (processActive && !activeRef.current) {
      setProcessStarted(true);
      setVisible(true);
      setRevealComplete(false);
      fulfillmentKeyRef.current = "";
    }
    activeRef.current = processActive;
  }, [processActive]);

  React.useEffect(() => {
    if (pendingTicketId) setRetainedTicketId(String(pendingTicketId));
  }, [pendingTicketId]);

  React.useEffect(() => {
    if (!fulfillmentKey || fulfillmentKey === fulfillmentKeyRef.current) return;
    fulfillmentKeyRef.current = fulfillmentKey;
    setProcessStarted(true);
    setVisible(true);
    setRevealComplete(false);
  }, [fulfillmentKey]);

  React.useEffect(() => {
    if (!redeemError || redeemError === errorKeyRef.current) return;
    errorKeyRef.current = redeemError;
    setProcessStarted(true);
    setVisible(true);
  }, [redeemError]);

  const stage = deriveVrfUiStage({
    isRedeeming,
    vrfPending: VRFPending,
    txStage: txStatus?.type === "redeem" ? txStatus?.stage : "",
    requestId: effectiveRequestId,
    fulfillment,
    revealComplete,
    selectedNftReady,
    error: redeemError,
  });
  const shouldPrepareFrames = processStarted || processActive || Boolean(fulfillment);
  const preload = useFramePreloader(shouldPrepareFrames);
  const animationMode =
    stage === "complete"
      ? "flash_hold"
      : stage === "revealing" && revealComplete
        ? "flash_hold"
        : stage === "idle"
          ? "burning"
          : stage;
  const { current, previous } = useTransformationFrame({
    mode: animationMode,
    ready: preload.ready,
    reducedMotion,
    onFinalFrame: () => setRevealComplete(true),
  });

  React.useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const focusTimer = setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible]);

  if (!processStarted && !processActive && !fulfillment && !redeemError) {
    return null;
  }

  if (!visible) {
    return processActive ? (
      <button
        type="button"
        className="vrf-transform-reopen"
        onClick={() => setVisible(true)}
      >
        <Images size={18} aria-hidden="true" />
        Show VRF transformation
      </button>
    ) : null;
  }

  const progress = getVrfStageProgress(stage);
  const activeStep = getVrfActiveStep(stage);
  const statusText = getStatusText(
    stage,
    redeemError || redeemMsg,
    selectedNftReady,
  );
  const selectedImage = selectedNftReady
    ? selectedNft.image || selectedNft.meta?.image
    : "";
  const tokenId = fulfillment?.tokenId || selectedNft?.tokenId || "";
  const title =
    stage === "complete"
      ? "MUTATION COMPLETE"
      : stage === "error"
        ? "TRANSFORMATION INTERRUPTED"
        : "VRF TRANSFORMATION IN PROGRESS";

  const viewInGallery = () => {
    setVisible(false);
    document.getElementById("gallery")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="vrf-transform-layer" role="presentation">
      <section
        className={`vrf-transform-modal vrf-transform-modal--${stage}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vrf-transform-title"
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="vrf-transform-close"
          onClick={() => setVisible(false)}
          aria-label="Close transformation"
          title="Close"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <header className="vrf-transform-header">
          <p className="vrf-transform-kicker">BIGGIEYES / CHAINLINK VRF</p>
          <h2 id="vrf-transform-title">{title}</h2>
          <p>
            Burning ticket <span aria-hidden="true">&bull;</span> Requesting
            randomness <span aria-hidden="true">&bull;</span> Finalizing mutation
          </p>
          <div className="vrf-transform-identifiers">
            {retainedTicketId ? <span>Ticket #{retainedTicketId}</span> : null}
            {effectiveRequestId && effectiveRequestId !== "0" ? (
              <span title={effectiveRequestId}>
                Request {short(effectiveRequestId)}
              </span>
            ) : null}
          </div>
        </header>

        <div
          className={`vrf-transform-viewer ${
            stage === "waiting_vrf" ? "vrf-transform-viewer--waiting" : ""
          } ${stage === "revealing" ? "vrf-transform-viewer--flash" : ""}`}
        >
          {stage === "complete" && selectedImage ? (
            <img
              className="vrf-transform-nft"
              src={selectedImage}
              alt={`BIGGI NFT #${tokenId}`}
              decoding="async"
            />
          ) : preload.ready ? (
            <>
              {previous != null ? (
                <img
                  className="vrf-transform-frame vrf-transform-frame--previous"
                  src={VRF_TRANSFORMATION_FRAMES[previous]}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              <img
                key={VRF_TRANSFORMATION_FRAMES[current]}
                className="vrf-transform-frame vrf-transform-frame--current"
                src={VRF_TRANSFORMATION_FRAMES[current]}
                alt="Illustrative Biggi transformation"
              />
            </>
          ) : (
            <div className="vrf-transform-preload" role="status">
              <RefreshCw size={28} aria-hidden="true" />
              <span>
                Preparing transformation {preload.loaded}/
                {VRF_TRANSFORMATION_FRAMES.length}
              </span>
            </div>
          )}
          <div className="vrf-transform-bloom" aria-hidden="true" />
        </div>

        {stage === "complete" ? (
          <div className="vrf-transform-result" aria-live="polite">
            <strong>BIGGI #{tokenId}</strong>
            <span>
              Block: {selectedNft?.blockName || "-"} / Background:{" "}
              {selectedNft?.backgroundName || "-"}
            </span>
          </div>
        ) : null}

        <ol className="vrf-transform-steps" aria-label="VRF transformation stages">
          {VRF_STEPS.map((label, index) => {
            const done = stage === "complete" || index < activeStep;
            const active = stage !== "complete" && index === activeStep;
            return (
              <li
                key={label}
                className={`${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
              >
                <span className="vrf-transform-step-dot" aria-hidden="true">
                  {done ? <Check size={15} /> : index + 1}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="vrf-transform-progress-wrap">
          <div
            className="vrf-transform-progress"
            role="progressbar"
            aria-label="On-chain process stage"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>

        <div
          className={`vrf-transform-status ${stage === "error" ? "is-error" : ""}`}
          aria-live="polite"
        >
          {stage === "error" ? (
            <AlertTriangle size={20} aria-hidden="true" />
          ) : (
            <span className="vrf-transform-status-pulse" aria-hidden="true" />
          )}
          <div>
            <span>On-chain status</span>
            <strong>{statusText}</strong>
          </div>
        </div>

        <p className="vrf-transform-disclaimer">
          Visual mutation is illustrative only. The final NFT appears only after
          on-chain fulfillment.
        </p>

        <footer className="vrf-transform-actions">
          {(VRFPending || stage === "revealing") && onRefresh ? (
            <button type="button" onClick={onRefresh}>
              <RefreshCw size={17} aria-hidden="true" />
              Check status
            </button>
          ) : null}
          {txLink ? (
            <a href={txLink} target="_blank" rel="noreferrer">
              <ExternalLink size={17} aria-hidden="true" />
              Transaction
            </a>
          ) : null}
          {stage === "complete" ? (
            <button type="button" onClick={viewInGallery}>
              <Images size={17} aria-hidden="true" />
              View NFT
            </button>
          ) : null}
          <button type="button" onClick={() => setVisible(false)}>
            <X size={17} aria-hidden="true" />
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
