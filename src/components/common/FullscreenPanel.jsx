// src/components/common/FullscreenPanel.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function FullscreenPanel({
  open,
  title,
  onClose,
  children,
  logoSrc = "/images/main-logo1.png",
  // default behavior mirrors original
  closeOnEsc = false,
  closeOnOverlay = true,
  preventScroll = false,

  // optional
  trapFocus = false,
  initialFocusRef,
  ariaLabel,
  ariaLabelledby,

  // topbar arrows (used in fullscreen variant)
  onPrev,
  onNext,
  containerStyle = undefined,
  contentStyle = undefined,
}) {
  const rootRef = React.useRef(null);
  const lastActiveRef = React.useRef(null);
  const titleId = React.useId();
  const prevOverflowRef = React.useRef("");
  const prevPaddingRightRef = React.useRef("");

  const C = {
    text: "#f6f7fb",
    line: "rgba(255,255,255,.12)",
    y: "#FFE800",
    c: "#5DDCFF",
  };
  const headerGlowShadow = "0 6px 25px rgba(0,0,0,0.7), 0 0 18px #ffe800";

  // === phone-friendly tweaks (no other changes) ===
  const [isPhone, setIsPhone] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 700px)").matches
      : false,
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 700px)");
    const onChange = (e) => setIsPhone(e.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        mq.removeListener(onChange);
      }
    };
  }, []);

  // --- Popover anchor near the info button ---
  const popRef = React.useRef(null);
  const [popPos, setPopPos] = React.useState({
    top: 0,
    left: 0,
    origin: "top right",
    ready: false,
  });

  // Remember last pointer position as a fallback anchor
  const lastPointerRef = React.useRef({ x: 0, y: 0 });
  React.useEffect(() => {
    const onPtr = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointerdown", onPtr, true);
    return () => window.removeEventListener("pointerdown", onPtr, true);
  }, []);

  // Heuristic: treat Escape-enabled panels as info-button popovers.
  const isPopover = !!closeOnEsc;

  const lockScrollIfNeeded = React.useCallback(() => {
    if (!preventScroll || isPopover || typeof document === "undefined") return; // no scroll lock for popover
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    prevOverflowRef.current = document.body.style.overflow;
    prevPaddingRightRef.current = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarW > 0) {
      const cur = window.getComputedStyle(document.body).paddingRight || "0px";
      const curPx = parseFloat(cur) || 0;
      document.body.style.paddingRight = `${curPx + scrollbarW}px`;
    }
  }, [preventScroll, isPopover]);

  const unlockScrollIfNeeded = React.useCallback(() => {
    if (!preventScroll || isPopover || typeof document === "undefined") return;
    document.body.style.overflow = prevOverflowRef.current;
    document.body.style.paddingRight = prevPaddingRightRef.current;
  }, [preventScroll, isPopover]);

  const onKeyDown = React.useCallback(
    (e) => {
      if (closeOnEsc && e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (trapFocus && e.key === "Tab") {
        const root = rootRef.current || document.body;
        const nodes = root.querySelectorAll
          ? root.querySelectorAll(FOCUSABLE)
          : document.querySelectorAll(FOCUSABLE);
        const list = Array.from(nodes);
        if (list.length === 0) {
          e.preventDefault();
          return;
        }

        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [closeOnEsc, trapFocus, onClose],
  );

  // Position the popover under the info button and clamp to the viewport
  const placePopover = React.useCallback(() => {
    if (!isPopover || !open || typeof document === "undefined") return;
    const el = popRef.current;
    if (!el) return;

    const anchorEl =
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null;

    const a = anchorEl
      ? anchorEl.getBoundingClientRect()
      : {
          top: lastPointerRef.current.y,
          bottom: lastPointerRef.current.y,
          left: lastPointerRef.current.x,
          right: lastPointerRef.current.x,
          width: 0,
          height: 0,
        };

    const r = el.getBoundingClientRect();

    // Always place BELOW the button (requested)
    let top = a.bottom + 10; // below the anchor
    let origin = "top right"; // grow from top when opening

    // Horizontal: align right edges by default
    let left = (a.right || a.left) - r.width;

    // Clamp to viewport
    const maxLeft = window.innerWidth - r.width - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;

    const maxTop = window.innerHeight - r.height - 8;
    if (top > maxTop) top = maxTop; // still "below", just clamped
    if (top < 8) top = 8;

    setPopPos({
      top: Math.round(top),
      left: Math.round(left),
      origin,
      ready: true,
    });
  }, [isPopover, open]);

  React.useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement;
    lockScrollIfNeeded();
    document.addEventListener("keydown", onKeyDown, true);

    const preventTouchScroll = (ev) => {
      if (!preventScroll || isPopover) return;
      const root = rootRef.current;
      if (!root) return;
      if (ev.target === root) ev.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchScroll, {
      passive: false,
      capture: true,
    });

    if (!isPopover && rootRef.current) {
      rootRef.current.style.overscrollBehavior = "contain";
    }

    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (trapFocus && (rootRef.current || popRef.current)) {
        const scope = rootRef.current || popRef.current;
        const firstFocusable = scope.querySelector
          ? scope.querySelector(FOCUSABLE)
          : null;
        if (firstFocusable) firstFocusable.focus();
        else scope.focus?.();
      }
    }, 0);

    const placeTimer = setTimeout(placePopover, 0);
    const onWin = () => placePopover();
    if (isPopover) {
      window.addEventListener("resize", onWin);
      window.addEventListener("scroll", onWin, true);
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("touchmove", preventTouchScroll, {
        capture: true,
      });
      clearTimeout(focusTimer);
      clearTimeout(placeTimer);
      if (isPopover) {
        window.removeEventListener("resize", onWin);
        window.removeEventListener("scroll", onWin, true);
      }
      unlockScrollIfNeeded();
      if (lastActiveRef.current?.focus) lastActiveRef.current.focus();
      if (rootRef.current) rootRef.current.style.overscrollBehavior = "";
    };
  }, [
    open,
    onKeyDown,
    trapFocus,
    initialFocusRef,
    lockScrollIfNeeded,
    unlockScrollIfNeeded,
    preventScroll,
    isPopover,
    placePopover,
  ]);

  if (!open) return null;

  // Arrow button (fullscreen only)
  const ArrowBtn = ({ label, onClick, title }) => {
    const baseShadow =
      "0 8px 20px rgba(0,0,0,.45), inset 0 0 18px rgba(93,220,255,.12)";
    const hoverShadow = `${headerGlowShadow}, inset 0 0 18px rgba(93,220,255,.12)`;

    return (
      <button
        type="button"
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        style={{
          width: isPhone ? 36 : 44,
          height: isPhone ? 36 : 44,
          minWidth: isPhone ? 36 : 44,
          minHeight: isPhone ? 36 : 44,
          borderRadius: 10,
          background:
            "linear-gradient(180deg, rgba(12,20,26,.85), rgba(8,12,18,.85))",
          border: "1px solid rgba(93,220,255,.45)",
          color: C.c,
          fontWeight: 900,
          fontSize: isPhone ? 16 : 18,
          cursor: "pointer",
          boxShadow: baseShadow,
          backdropFilter: "blur(6px)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          touchAction: "manipulation",
          boxSizing: "border-box",
          flexShrink: 0,
          transition: "box-shadow 0.2s ease",
        }}
        title={title}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = hoverShadow;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = baseShadow;
        }}
      >
        {label}
      </button>
    );
  };

  // === POPOVER VARIANT (opened by the info button) ===
  if (isPopover) {
    const content = (
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby || (title ? titleId : undefined)}
        onMouseDown={(e) => {
          if (!closeOnOverlay) return;
          const pop = popRef.current;
          if (pop && !pop.contains(e.target)) onClose?.();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "transparent",
          zIndex: 4000,
        }}
      >
        <div
          ref={popRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: popPos.top,
            left: popPos.left,
            maxWidth: "min(92vw, 560px)",
            maxHeight: "70vh",
            overflow: "hidden",
            borderRadius: 14,
            border: `2px solid ${C.c}`,
            background: "rgba(26,26,26,.96)",
            backdropFilter: "blur(6px) saturate(120%)",
            boxShadow:
              "0 16px 32px rgba(0,0,0,.55), 0 0 18px rgba(93,220,255,.28)",
            padding: 10,
            transformOrigin: popPos.origin,
            animation: "fsPop .18s ease-out both",
          }}
        >
          <style>{`
            @keyframes fsPop { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
            .nft-info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .nft-info-table td { padding: 6px 8px; border-top: 1px solid rgba(255,255,255,.08); vertical-align: top; }
            .nft-info-table tr:first-child td { border-top: 0; }
            .nft-info-table td:first-child { width: 42%; color: ${C.y}; font-weight: 800; }
            .nft-info-note { margin-top: 8px; font-size: 12px; color: #cfd2db; }
          `}</style>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 6px 8px 6px",
              borderBottom: "1px solid rgba(93,220,255,.35)",
            }}
          >
            <strong id={titleId} style={{ color: C.c, letterSpacing: 0.4 }}>
              {title}
            </strong>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              aria-label="Close"
              title="Close"
              style={{
                width: isPhone ? 30 : 32,
                height: isPhone ? 30 : 32,
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.18))",
                color: C.c,
                fontWeight: 900,
                fontSize: isPhone ? 14 : 16,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                touchAction: "manipulation",
              }}
            >
              X
            </button>
          </div>

          <div
            style={{
              padding: 6,
              overflowY: "auto",
              maxHeight: "calc(70vh - 46px)",
            }}
          >
            <React.Suspense fallback={<div>Loading...</div>}>
              {children}
            </React.Suspense>

            <div style={{ marginTop: 8 }}>
              <table
                className="nft-info-table"
                aria-label="NFT cards quick help"
              >
                <tbody>
                  <tr>
                    <td>"i" button</td>
                    <td>
                      Opens this quick reference panel. Click outside the
                      overlay or press Escape to close it.
                    </td>
                  </tr>
                  <tr>
                    <td>Add to MetaMask</td>
                    <td>
                      Uses <code>wallet_watchAsset</code> to add the selected
                      NFT to MetaMask. After a successful import the button
                      hides on this device. Clearing site data, switching
                      devices, or changing the MetaMask account may show it
                      again.
                    </td>
                  </tr>
                  <tr>
                    <td>Keyboard shortcuts</td>
                    <td>
                      Use the Left and Right arrow keys to move between panels
                      and Escape to close.
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="nft-info-note">
                These helpers keep the card layout compact while leaving room
                for wallet actions.
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    if (typeof document === "undefined") return null;
    return ReactDOM.createPortal(content, document.body);
  }

  // === FULLSCREEN VARIANT (original behavior for other panels)
  // Estimated top-bar height (~72px) to compute max content height
  const TOPBAR_EST = isPhone ? 62 : 72;

  const content = (
    <div
      className="fullscreen-panel"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby || (title ? titleId : undefined)}
      onMouseDown={(e) => {
        if (!closeOnOverlay) return;
        if (e.target === rootRef.current) onClose?.();
      }}
      tabIndex={-1}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        height: "100svh",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <div
        className="fullscreen-panel__topbar"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(145deg, rgba(255,232,0,.16), rgba(93,220,255,.14))",
          border: `1px solid rgba(255,232,0,.28)`,
          borderRadius: isPhone ? 12 : 14,
          padding: isPhone ? "8px 10px" : "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow:
            "inset 0 0 18px rgba(93,220,255,.12), 0 10px 26px rgba(0,0,0,.45)",
          color: C.text,
          width: "100%",
          boxSizing: "border-box",
          columnGap: isPhone ? 8 : 12,
          backdropFilter: "blur(6px)",
        }}
      >
        <h2
          id={titleId}
          style={{
            margin: 0,
            letterSpacing: 0.5,
            color: C.c,
            fontSize: isPhone ? 16 : 18,
          }}
        >
          {title}
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isPhone ? 6 : 10,
          }}
        >
          {typeof onPrev === "function" && (
            <ArrowBtn label="<" onClick={onPrev} title="Previous" />
          )}
          {typeof onNext === "function" && (
            <ArrowBtn label=">" onClick={onNext} title="Next" />
          )}
          <button
            type="button"
            className="fullscreen-panel__close"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Close"
            title="Close"
            style={{
              width: isPhone ? 36 : 44,
              height: isPhone ? 36 : 44,
              borderRadius: 10,
              border: `1px solid ${C.line}`,
              background:
                "linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.18))",
              color: C.c,
              fontWeight: 900,
              fontSize: isPhone ? 16 : 18,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              touchAction: "manipulation",
              boxShadow: "none",
              transition: "box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = headerGlowShadow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            X
          </button>
        </div>
      </div>

      <div
        className="fullscreen-panel__content"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          overflowY: "auto",
          minHeight: 0,
          padding: isPhone ? "10px" : "12px 12px",
          maxHeight: `calc(100svh - ${TOPBAR_EST}px)`,
          ...(contentStyle || {}),
        }}
      >
        <div
          className="fullscreen-panel__container"
          style={{
            minHeight: 0,
            maxHeight: "100%",
            overflow: "auto",
            width: isPhone ? "min(1100px, 94vw)" : "min(1100px, 92vw)",
            background: "#141414",
            border: "1px solid #262626",
            borderRadius: isPhone ? 14 : 16,
            padding: isPhone ? 14 : 16,
            color: "#fff",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            ...(containerStyle || {}),
          }}
        >
          <React.Suspense fallback={<div>Loading...</div>}>
            {children}
          </React.Suspense>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(content, document.body);
}

