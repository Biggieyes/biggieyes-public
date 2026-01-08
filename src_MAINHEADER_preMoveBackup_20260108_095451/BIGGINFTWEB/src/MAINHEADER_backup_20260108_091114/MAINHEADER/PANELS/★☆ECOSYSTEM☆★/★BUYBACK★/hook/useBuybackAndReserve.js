// src/HOOKS/useBUYBACKAndReserve.js
import * as React from "react";
import usePOLICY from "./usePOLICY";
import useReserve from "./useReserve";
import useTreasury from "./useTreasury";
import useBUYBACK from "./useBUYBACK";
import useDRIPDistributor from "./useDRIPDistributor";
import useDRIPLM from "./useDRIPLM";

/**
 * Koordinátorový hook.
 * Kombinuje POLICY, Reserve, Treasury a BUYBACK data do jedné struktury.
 * Umožňuje volat refreshAll() pro hromadné obnovení.
 */
export default function useBUYBACKAndReserve() {
  const POLICY = usePOLICY();
  const reserve = useReserve();
  const treasury = useTreasury();
  const BUYBACK = useBUYBACK();
  const DRIPDistributor = useDRIPDistributor();
  const DRIPLM = useDRIPLM();

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      POLICY.refresh(),
      reserve.refresh(),
      treasury.refresh(),
      BUYBACK.refresh(),
      DRIPDistributor.refresh(),
      DRIPLM.refresh(),
    ]);
  }, [POLICY, reserve, treasury, BUYBACK, DRIPDistributor, DRIPLM]);

  return {
    POLICY: POLICY.data,
    reserve: reserve.data,
    treasury: treasury.data,
    BUYBACK: BUYBACK.data,
    DRIPDistributor: DRIPDistributor.data,
    DRIPLM: DRIPLM.data,
    loading:
      POLICY.loading ||
      reserve.loading ||
      treasury.loading ||
      BUYBACK.loading ||
      DRIPDistributor.loading ||
      DRIPLM.loading,
    error:
      POLICY.error ||
      reserve.error ||
      treasury.error ||
      BUYBACK.error ||
      DRIPDistributor.error ||
      DRIPLM.error,
    refreshAll,
    refreshPOLICY: POLICY.refresh,
    refreshReserve: reserve.refresh,
    refreshTreasury: treasury.refresh,
    refreshBUYBACK: BUYBACK.refresh,
    refreshDRIPDistributor: DRIPDistributor.refresh,
    refreshDRIPLM: DRIPLM.refresh,
  };
}
...




