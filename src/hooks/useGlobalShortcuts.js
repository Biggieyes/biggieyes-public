import * as React from "react";

export function useGlobalShortcuts({
  zoomImg,
  setZoomImg,
  adminOpen,
  setAdminOpen,
  openNavIdx,
  setOpenNavIdx,
  cardsHelpOpen,
  setCardsHelpOpen,
}) {
  // Arrow up/down to scroll
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return undefined;
    const handleArrowScroll = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key || event.code || "";
      if (
        key !== "ArrowDown" &&
        key !== "ArrowUp" &&
        event.keyCode !== 40 &&
        event.keyCode !== 38
      )
        return;
      const tag = event.target?.tagName?.toLowerCase?.() ?? "";
      const interactiveTargets = ["input", "textarea", "select"];
      if (interactiveTargets.includes(tag) || event.target?.isContentEditable)
        return;
      const step = window.innerHeight
        ? Math.round(window.innerHeight * 0.85)
        : 600;

      // Find nearest scrollable ancestor for in-panel scrolling
      const findScrollable = (start) => {
        let el = start;
        while (el) {
          const style =
            el instanceof HTMLElement ? window.getComputedStyle(el) : null;
          const canScroll =
            style &&
            (style.overflowY === "auto" ||
              style.overflowY === "scroll" ||
              style.overflowY === "overlay") &&
            el.scrollHeight - el.clientHeight > 4;
          if (canScroll) return el;
          el = el.parentElement || null;
        }
        return (
          document?.scrollingElement ||
          document?.documentElement ||
          document?.body
        );
      };
      const scrollEl = findScrollable(event.target);
      const scrollBy = (delta) => {
        if (scrollEl) {
          const next = (scrollEl.scrollTop || 0) + delta;
          scrollEl.scrollTo({ top: next, behavior: "smooth" });
        } else {
          window.scrollBy({ top: delta, behavior: "smooth" });
        }
      };
      const isDown = key === "ArrowDown" || event.keyCode === 40;
      const isUp = key === "ArrowUp" || event.keyCode === 38;
      if (isDown) {
        event.preventDefault();
        event.stopPropagation();
        scrollBy(step);
      } else if (isUp) {
        event.preventDefault();
        event.stopPropagation();
        scrollBy(-step);
      }
    };
    document.addEventListener("keydown", handleArrowScroll, {
      passive: false,
      capture: true,
    });
    return () =>
      document.removeEventListener("keydown", handleArrowScroll, true);
  }, []);

  // Escape to close overlays/nav
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleEscapeBack = (event) => {
      if (event.key !== "Escape") return;
      let handled = false;
      if (zoomImg) {
        setZoomImg(null);
        handled = true;
      } else if (adminOpen) {
        setAdminOpen(false);
        handled = true;
      } else if (openNavIdx !== null) {
        setOpenNavIdx(null);
        handled = true;
      } else if (cardsHelpOpen) {
        setCardsHelpOpen(false);
        handled = true;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleEscapeBack);
    return () => window.removeEventListener("keydown", handleEscapeBack);
  }, [
    zoomImg,
    adminOpen,
    openNavIdx,
    cardsHelpOpen,
    setZoomImg,
    setAdminOpen,
    setOpenNavIdx,
    setCardsHelpOpen,
  ]);
}

