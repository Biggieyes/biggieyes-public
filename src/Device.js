// src/Device.js
import * as React from "react";

/**
 * useIsMobile
 * jednoduchý hook pro breakpoint-based detekci mobilu
 * @param {number} breakpoint pixely (default 700)
 */
export function useIsMobile(breakpoint = 700) {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mql.matches);
    try {
      mql.addEventListener("change", onChange);
    } catch {
      mql.addListener(onChange);
    }
    onChange();
    return () => {
      try {
        mql.removeEventListener("change", onChange);
      } catch {
        mql.removeListener(onChange);
      }
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * jednoduchý useWindowSize (volitelně)
 * vrací { width, height } aktuální okna - může být užitečné v několika komponentech
 */
export function useWindowSize() {
  const isClient = typeof window === "object";
  const initialSize = {
    width: isClient ? window.innerWidth : 0,
    height: isClient ? window.innerHeight : 0,
  };

  const [size, setSize] = React.useState(initialSize);

  React.useEffect(() => {
    if (!isClient) return;
    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, [isClient]);

  return size;
}
