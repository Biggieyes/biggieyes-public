// src/components/common/Modal.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input[type="text"]:not([disabled])',
  'input[type="search"]:not([disabled])',
  'input[type="radio"]:not([disabled])',
  'input[type="checkbox"]:not([disabled])',
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  open,
  onClose = () => {},
  children,
  closeOnEsc = false,
  closeOnOverlay = true,
  trapFocus = false,
  preventScroll = false,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  initialFocusRef,
  size = "md",
  overlayClassName = "",
  windowClassName = "",
  alignTop = true,
  topOffset = "8vh",
  overlayZIndex = 12000,
  closeButtonClassName = "",
  closeButtonContent = "Close",
}) {
  const overlayRef = React.useRef(null);
  const windowRef = React.useRef(null);
  const lastActiveRef = React.useRef(null);
  const inertElsRef = React.useRef([]);
  const overlayPressStartRef = React.useRef(false);

  const autoDialogLabelId = React.useId();
  const computedAriaLabel =
    ariaLabel || (!ariaLabelledby ? "Dialog" : undefined);
  const computedAriaLabelledby = ariaLabelledby || undefined;

  const onKeyDown = React.useCallback(
    (e) => {
      if (closeOnEsc && e.key === "Escape") {
        e.stopPropagation();
        onClose("esc");
        return;
      }
      if (e.key === "Enter" && document.activeElement === overlayRef.current) {
        if (closeOnOverlay) onClose("overlay-enter");
      }
      if (trapFocus && e.key === "Tab") {
        const root = windowRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll(FOCUSABLE);
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
    [closeOnEsc, trapFocus, onClose, closeOnOverlay],
  );

  React.useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement;

    inertElsRef.current = [];
    const overlayEl = overlayRef.current;
    if (overlayEl && overlayEl.parentElement === document.body) {
      const siblings = Array.from(document.body.children);
      for (const el of siblings) {
        if (el === overlayEl) continue;
        try {
          el.setAttribute("aria-hidden", "true");
          el.inert = true;
          inertElsRef.current.push(el);
        } catch {}
      }
    }

    let prevOverFLOW = "";
    let prevPaddingRight = "";
    const onTouchMove = (ev) => {
      if (windowRef.current && !windowRef.current.contains(ev.target)) {
        ev.preventDefault();
      }
    };

    if (preventScroll) {
      prevOverFLOW = document.body.style.overFLOW;
      prevPaddingRight = document.body.style.paddingRight;
      const scrollBarW =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollBarW > 0) {
        document.body.style.paddingRight = `calc(${parseInt(prevPaddingRight || 0, 10)}px + ${scrollBarW}px)`;
      }
      document.body.style.overFLOW = "hidden";
      document.addEventListener("touchmove", onTouchMove, { passive: false });
    }

    document.addEventListener("keydown", onKeyDown, true);

    const t = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (trapFocus && windowRef.current) {
        const first = windowRef.current.querySelector(FOCUSABLE);
        if (first) first.focus();
        else windowRef.current.focus();
      }
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      clearTimeout(t);

      for (const el of inertElsRef.current) {
        try {
          el.removeAttribute("aria-hidden");
          el.inert = false;
        } catch {}
      }
      inertElsRef.current = [];

      if (preventScroll) {
        document.body.style.overFLOW = prevOverFLOW;
        document.body.style.paddingRight = prevPaddingRight;
        document.removeEventListener("touchmove", onTouchMove);
      }

      const last = lastActiveRef.current;
      if (last && last instanceof HTMLElement && document.contains(last)) {
        last.focus();
      }
    };
  }, [open, onKeyDown, initialFocusRef, trapFocus, preventScroll]);

  if (!open) return null;

  const content = (
    <div
      ref={overlayRef}
      className={`modal-overlay ${overlayClassName}`}
      style={{
        alignItems: alignTop ? "flex-start" : "center",
        paddingTop: alignTop ? topOffset : undefined,
        zIndex: overlayZIndex,
        touchAction: preventScroll ? "none" : undefined,
      }}
      onPointerDown={(e) => {
        if (!closeOnOverlay) return;
        overlayPressStartRef.current = e.target === overlayRef.current;
      }}
      onPointerUp={(e) => {
        if (!closeOnOverlay) return;
        const isSameTarget = e.target === overlayRef.current;
        if (overlayPressStartRef.current && isSameTarget) {
          onClose("overlay");
        }
        overlayPressStartRef.current = false;
      }}
      aria-hidden="false"
      tabIndex={-1}
    >
      <div
        ref={windowRef}
        className={`modal-window modal-window--${size} ${windowClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={computedAriaLabel}
        aria-labelledby={
          computedAriaLabel
            ? undefined
            : computedAriaLabelledby || autoDialogLabelId
        }
        aria-describedby={ariaDescribedby}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        style={{
          maxHeight: `calc(100dvh - ${alignTop ? topOffset : "0px"})`,
          overFLOW: "auto",
          WebkitOverFLOWScrolling: "touch",
        }}
      >
        {!ariaLabel && !ariaLabelledby && (
          <span
            id={autoDialogLabelId}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              margin: -1,
              padding: 0,
              overFLOW: "hidden",
              clip: "rect(0 0 0 0)",
              border: 0,
            }}
          >
            Dialog
          </span>
        )}

        <button
          className={`modal-close ${closeButtonClassName}`}
          type="button"
          aria-label="Close dialog"
          onClick={() => onClose("button")}
          onMouseDown={(e) => e.preventDefault()}
        >
          {closeButtonContent}
        </button>

        <div className="modal-content">{children}</div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}


