import * as React from "react";
import { StatsContext } from "../../../../providers/StatsProvider";

/**
 * Umožňuje přístup k datům a funkcím ze StatsProvideru.
 * Vrací { data, loading, refresh }.
 */
export function useStats() {
  const ctx = React.useContext(StatsContext);
  if (!ctx) throw new Error("useStats must be used inside <StatsProvider>");
  return ctx;
}

export default useStats;
