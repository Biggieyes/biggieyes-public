// src/HOOKS/useDistributor.js
import * as React from "react";
import { formatEther } from "ethers/lib.esm/utils.js";
import { getMultiCOLLECTIONDistributorRO } from "../utils/contract";
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
    COLLECTIONREWARDS: null,
    BUYBACKAgent: null,
    treasury: null,
    COMMUNITYCENTER: null,
    pendingReserve: "0",
    pendingCOLLECTIONREWARDS: "0",
    pendingBUYBACKAgent: "0",
    pendingTreasury: "0",
    pendingCOMMUNITYCENTER: "0",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchDistributorInfo = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getMultiCOLLECTIONDistributorRO();
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
            COLLECTIONREWARDS,
            BUYBACKAgent,
            treasury,
            COMMUNITYCENTER,
          ] = await Promise.all([
            safeCall("totalReceived", [], 0n),
            safeCall("totalPending", [], 0n),
            safeCall("reserve", [], null),
            safeCall("COLLECTIONREWARDS", [], null),
            safeCall("BUYBACKAgent", [], null),
            safeCall("treasury", [], null),
            safeCall("COMMUNITYCENTER", [], null),
          ]);

          const pendingFor = async (addr) => {
            if (!addr || addr === ZERO) return 0n;
            const v = await safeCall("pendingOf", [addr], null);
            if (v != null) return v;
            return safeCall("pending", [addr], 0n);
          };

          const [
            pendingReserveRaw,
            pendingCOLLECTIONREWARDSRaw,
            pendingBUYBACKRaw,
            pendingTreasuryRaw,
            pendingCommunityRaw,
          ] = await Promise.all([
            pendingFor(reserve),
            pendingFor(COLLECTIONREWARDS),
            pendingFor(BUYBACKAgent),
            pendingFor(treasury),
            pendingFor(COMMUNITYCENTER),
          ]);

          const fmt = (v) => {
            try {
              return formatEther(v);
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
            COLLECTIONREWARDS,
            BUYBACKAgent,
            treasury,
            COMMUNITYCENTER,
            pendingReserve: fmt(pendingReserveRaw),
            pendingCOLLECTIONREWARDS: fmt(pendingCOLLECTIONREWARDSRaw),
            pendingBUYBACKAgent: fmt(pendingBUYBACKRaw),
            pendingTreasury: fmt(pendingTreasuryRaw),
            pendingCOMMUNITYCENTER: fmt(pendingCommunityRaw),
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





