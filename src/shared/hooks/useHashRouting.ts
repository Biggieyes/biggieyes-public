// src/HOOKS/useHashRouting.ts
import * as React from "react";

/**
 * Tracks whether we are on a given path and current anchor, working with both
 * BrowserRouter and HashRouter (/#/…).
 *
 * @param REWARDSPath e.g. "/COLLECTION/REWARDS-info"
 */
export default function useHashRouting(
  REWARDSPath: string = "/COLLECTION/REWARDS-info",
) {
  const normTarget = REWARDSPath.toLowerCase().replace(/\/+$/, ""); // strip trailing slash

  const parse = React.useCallback((): {
    onREWARDS: boolean;
    anchor: string | null;
  } => {
    if (typeof window === "undefined") {
      return { onREWARDS: false, anchor: null };
    }

    const href = window.location.href;
    const usesHashRouter = href.includes("/#/");
    const pathnameLower = (window.location.pathname || "")
      .toLowerCase()
      .replace(/\/+$/, "");
    const hashFull = window.location.hash || "";

    if (usesHashRouter) {
      // after "#": "/COLLECTION/REWARDS-info[#anchor|?q=..#anchor]"
      const afterHash = hashFull.slice(1); // drop leading '#'
      const lower = afterHash.toLowerCase();

      // support optional query part before #anchor
      const pathOnly = lower.split("#", 1)[0].split("?", 1)[0];
      const onREWARDS = pathOnly.startsWith(normTarget);

      // anchor is the part after the LAST '#', if any
      const hashPos = afterHash.lastIndexOf("#");
      const anchor = hashPos >= 0 ? "#" + afterHash.slice(hashPos + 1) : null;

      return { onREWARDS, anchor };
    } else {
      // BrowserRouter
      const onREWARDS = pathnameLower.endsWith(normTarget);
      const anchor = hashFull || null;
      return { onREWARDS, anchor };
    }
  }, [normTarget]);

  const [state, setState] = React.useState(() => parse());
  const scrollFrameRef = React.useRef<number | null>(null);
  const cancelScroll = React.useCallback(() => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setState(parse());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, [parse]);

  // helper to smooth-scroll to current (or provided) anchor
  const scrollToAnchor = React.useCallback(
    (selector?: string | null) => {
      cancelScroll();
      const sel = selector ?? state.anchor;
      if (!sel?.startsWith("#") || typeof document === "undefined") return;
      let id: string;
      try {
        id = decodeURIComponent(sel.slice(1));
      } catch {
        return;
      }
      if (!id) return;
      // run after layout; try a couple of frames in case of React.lazy mount
      const tryScroll = (tries = 2) => {
        scrollFrameRef.current = null;
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (tries > 0) {
          scrollFrameRef.current = requestAnimationFrame(() =>
            tryScroll(tries - 1),
          );
        }
      };
      scrollFrameRef.current = requestAnimationFrame(() => tryScroll());
    },
    [state.anchor, cancelScroll],
  );

  React.useEffect(() => cancelScroll, [state.anchor, cancelScroll]);

  // auto-scroll on first mount if already on target path
  React.useEffect(() => {
    if (state.onREWARDS && state.anchor) scrollToAnchor(state.anchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  return React.useMemo(
    () => ({
      onREWARDS: state.onREWARDS,
      anchor: state.anchor,
      scrollToAnchor,
    }),
    [state.onREWARDS, state.anchor, scrollToAnchor],
  );
}
