import * as React from "react";
import { ADDR } from "../shared/utils/addresses.js";

/**
 * Very-safe hook core: returns stable shape even if RPC/contracts are unavailable.
 * Phase-B goal: unblock runtime imports and keep complex panels functional.
 */
export function useStaticContractData(buildData) {
  const data = React.useMemo(() => buildData(ADDR), [buildData]);
  const refresh = React.useCallback(async () => data, [data]);
  return { data, loading: false, error: null, refresh };
}
