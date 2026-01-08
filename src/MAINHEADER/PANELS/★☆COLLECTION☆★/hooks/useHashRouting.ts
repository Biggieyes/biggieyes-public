// src/hooks/useHashRouting.ts
import * as React from "react";

/**
 * Tracks whether we are on a given path and current anchor, working with both
 * BrowserRouter and HashRouter (/#/…).
 *
 * @param rewardsPath e.g. "/collection/rewards-info"
 */
export default function useHashRouting(
  rewardsPath: string = "/collection/rewards-info",
) {
  const normTarget = rewardsPath.toLowerCase().replace(/\/+$/, ""); // strip trailing slash

  const parse = React.useCallback((): {
    onRewards: boolean;
    anchor: string | null;
  } => {
    if (typeof window === "undefined") {
      return { onRewards: false, anchor: null };
    }

    const href = window.location.href;
    const usesHashRouter = href.includes("/#/");
    const pathnameLower = (window.location.pathname || "")
      .toLowerCase()
      .replace(/\/+$/, "");
    const hashFull = window.location.hash || "";

    if (usesHashRouter) {
      // after "#": "/collection/rewards-info[#anchor|?q=..#anchor]"
      const afterHash = hashFull.slice(1); // drop leading '#'
      const lower = afterHash.toLowerCase();

      // support optional query part before #anchor
      const pathOnly = lower.split("#", 1)[0].split("?", 1)[0];
      const onRewards = pathOnly.startsWith(normTarget);

      // anchor is the part after the LAST '#', if any
      const hashPos = afterHash.lastIndexOf("#");
      const anchor = hashPos >= 0 ? "#" + afterHash.slice(hashPos + 1) : null;

      return { onRewards, anchor };
    } else {
      // BrowserRouter
      const onRewards = pathnameLower.endsWith(normTarget);
      const anchor = hashFull || null;
      return { onRewards, anchor };
    }
  }, [normTarget]);

  const [state, setState] = React.useState(() => parse());

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
      const sel = selector ?? state.anchor;
      if (!sel || typeof document === "undefined") return;
      // run after layout; try a couple of frames in case of React.lazy mount
      const tryScroll = (tries = 2) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (tries > 0) requestAnimationFrame(() => tryScroll(tries - 1));
      };
      requestAnimationFrame(() => tryScroll());
    },
    [state.anchor],
  );

  // auto-scroll on first mount if already on target path
  React.useEffect(() => {
    if (state.onRewards && state.anchor) scrollToAnchor(state.anchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  return React.useMemo(
    () => ({
      onRewards: state.onRewards,
      anchor: state.anchor,
      scrollToAnchor,
    }),
    [state.onRewards, state.anchor, scrollToAnchor],
  );
}
