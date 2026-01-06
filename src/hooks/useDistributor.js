// src/hooks/useDistributor.js
import * as React from "react";
import { ethers } from "ethers";
import { getMultiCollectionDistributorRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

/**
 * Hook pro čtení z Distributor kontraktu (Expansion Panel).
 * Obsahuje přehled odměn, přidělení, adres a konfigurace.
 */
export default function useDistributor() {
  const [data, setData] = React.useState({
    address: null,
    totalDistributed: "0",
    totalReceived: "0",
    totalPending: "0",
    lastDistributionAt: null,
    operator: null,
    distributionCount: 0,
    reserve: null,
    collectionRewards: null,
    buybackAgent: null,
    treasury: null,
    communityCenter: null,
    pendingReserve: "0",
    pendingCollectionRewards: "0",
    pendingBuybackAgent: "0",
    pendingTreasury: "0",
    pendingCommunityCenter: "0",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchDistributorInfo = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getMultiCollectionDistributorRO();
      if (!contract) throw new Error("Distributor contract not found");
      const cacheKey = `distributor:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const ZERO = "0x0000000000000000000000000000000000000000";
          const safeCall = async (method, args = [], fallback = null) => {
            try {
              const fn = contract?.[method];
              if (typeof fn !== "function") return fallback;
              const res = await fn(...args);
              return res ?? fallback;
            } catch {
              return fallback;
            }
          };

          const [
            totalReceivedRaw,
            totalPendingRaw,
            reserve,
            collectionRewards,
            buybackAgent,
            treasury,
            communityCenter,
          ] = await Promise.all([
            safeCall("totalReceived", [], ethers.constants.Zero),
            safeCall("totalPending", [], ethers.constants.Zero),
            safeCall("reserve", [], null),
            safeCall("collectionRewards", [], null),
            safeCall("buybackAgent", [], null),
            safeCall("treasury", [], null),
            safeCall("communityCenter", [], null),
          ]);

          const pendingFor = async (addr) => {
            if (!addr || addr === ZERO) return ethers.constants.Zero;
            const v = await safeCall("pendingOf", [addr], null);
            if (v != null) return v;
            return safeCall("pending", [addr], ethers.constants.Zero);
          };

          const [
            pendingReserveRaw,
            pendingCollectionRewardsRaw,
            pendingBuybackRaw,
            pendingTreasuryRaw,
            pendingCommunityRaw,
          ] = await Promise.all([
            pendingFor(reserve),
            pendingFor(collectionRewards),
            pendingFor(buybackAgent),
            pendingFor(treasury),
            pendingFor(communityCenter),
          ]);

          const fmt = (v) => {
            try {
              return ethers.utils.formatEther(v);
            } catch {
              return "0";
            }
          };

          return {
            address: contract.address,
            totalDistributed: fmt(totalReceivedRaw),
            totalReceived: fmt(totalReceivedRaw),
            totalPending: fmt(totalPendingRaw),
            lastDistributionAt: null,
            operator: null,
            distributionCount: 0,
            reserve,
            collectionRewards,
            buybackAgent,
            treasury,
            communityCenter,
            pendingReserve: fmt(pendingReserveRaw),
            pendingCollectionRewards: fmt(pendingCollectionRewardsRaw),
            pendingBuybackAgent: fmt(pendingBuybackRaw),
            pendingTreasury: fmt(pendingTreasuryRaw),
            pendingCommunityCenter: fmt(pendingCommunityRaw),
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useDistributor.fetchDistributorInfo", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDistributorInfo();
  }, [fetchDistributorInfo]);

  return { data, loading, error, refresh: fetchDistributorInfo };
}
