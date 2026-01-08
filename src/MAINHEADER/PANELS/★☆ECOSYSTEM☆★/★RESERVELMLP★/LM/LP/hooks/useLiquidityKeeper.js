// src/hooks/useLiquidityKeeper.js
import * as React from "react";
import { ethers } from "ethers";
import { ADDR } from "../utils/addresses.js";
import { LiquidityKeeper as ABI_LIQUIDITY_KEEPER } from "../config/abi/index.js";
import { getReadOnlyContract, getSignerProvider } from "../utils/contract.js";
import { getCached, invalidateCache } from "../utils/fetchCache.js";

export default function useLiquidityKeeper() {
  const [data, setData] = React.useState({
    address: ADDR.KEEPER_PROXY || null,
  });
  const [loading, setLoading] = React.useState(false);
  const [performing, setPerforming] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const addr = ADDR.KEEPER_PROXY || null;
      if (!addr)
        throw new Error(
          "LiquidityKeeper address not configured (KEEPER_PROXY)",
        );
      const cacheKey = `liquidityKeeper:${addr}`;
      const snapshot = await getCached(
        cacheKey,
        async () => {
          const contract = getReadOnlyContract(addr, ABI_LIQUIDITY_KEEPER);
          return { address: contract.address };
        },
        { force: options?.force === true },
      );
      setData(snapshot);
    } catch (e) {
      console.error("useLiquidityKeeper.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const executePairing = React.useCallback(
    async (requestedMatic, overrides = {}) => {
      setPerforming(true);
      setError(null);
      try {
        // ...existing code...
      } catch (e) {
        setError(e);
      } finally {
        setPerforming(false);
      }
    },
    [],
  );

  return { data, loading, performing, error, refresh, executePairing };
}
