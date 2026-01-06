// src/hooks/useBuybackAndReserve.js
import * as React from "react";
import usePolicy from "./usePolicy";
import useReserve from "./useReserve";
import useTreasury from "./useTreasury";
import useBuyback from "./useBuyback";
import useDripDistributor from "./useDripDistributor";
import useDripLM from "./useDripLM";

/**
 * Koordinátorový hook.
 * Kombinuje Policy, Reserve, Treasury a Buyback data do jedné struktury.
 * Umožňuje volat refreshAll() pro hromadné obnovení.
 */
export default function useBuybackAndReserve() {
  const policy = usePolicy();
  const reserve = useReserve();
  const treasury = useTreasury();
  const buyback = useBuyback();
  const dripDistributor = useDripDistributor();
  const dripLM = useDripLM();

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      policy.refresh(),
      reserve.refresh(),
      treasury.refresh(),
      buyback.refresh(),
      dripDistributor.refresh(),
      dripLM.refresh(),
    ]);
  }, [policy, reserve, treasury, buyback, dripDistributor, dripLM]);

  return {
    policy: policy.data,
    reserve: reserve.data,
    treasury: treasury.data,
    buyback: buyback.data,
    dripDistributor: dripDistributor.data,
    dripLM: dripLM.data,

    // pro stav UI
    loading:
      policy.loading ||
      reserve.loading ||
      treasury.loading ||
      buyback.loading ||
      dripDistributor.loading ||
      dripLM.loading,
    error:
      policy.error ||
      reserve.error ||
      treasury.error ||
      buyback.error ||
      dripDistributor.error ||
      dripLM.error,

    refreshAll,
    refreshPolicy: policy.refresh,
    refreshReserve: reserve.refresh,
    refreshTreasury: treasury.refresh,
    refreshBuyback: buyback.refresh,
    refreshDripDistributor: dripDistributor.refresh,
    refreshDripLM: dripLM.refresh,
  };
}
