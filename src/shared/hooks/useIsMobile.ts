import * as React from "react";

/**
 * Detekuje, zda je šířka okna menší nebo rovna breakpointu.
 * @param breakpoint - maximální šířka v px (default 700)
 * @returns true pokud je viewport <= breakpoint
 */
export default function useIsMobile(breakpoint: number = 700): boolean {
  type LegacyMql = MediaQueryList & {
    addListener?: (..._args: unknown[]) => void;
    removeListener?: (..._args: unknown[]) => void;
  };

  const getMatch = () =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false;

  const [isMobile, setIsMobile] = React.useState<boolean>(getMatch);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const handleChange = () => setIsMobile(mql.matches);

    // Nastaví ihned při změně breakpointu (např. při SSR hydrataci)
    setIsMobile(mql.matches);

    // Posluchač změny media query
    const legacyMql = mql as LegacyMql;
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
    } else {
      legacyMql.addListener?.(handleChange);
    }

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handleChange);
      } else {
        legacyMql.removeListener?.(handleChange);
      }
    };
  }, [breakpoint]);

  return isMobile;
}
