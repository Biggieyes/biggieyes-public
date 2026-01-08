// src/HOOKS/useLiquidityVault.js
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getROProvider, ABI_LIQUIDITY_VAULT_READER, getReadOnlyContract } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

export default function useLiquidityVault() {
  const [data, setData] = React.useState({
    address: null,
    liquidityManager: null,
    owner: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Nový LiquidityVaultReader contract instance
      const contract = new Contract(
        "0xaCbc930541E08c7dF9E4d3597173b5D781FD161b",
        ABI_LIQUIDITY_VAULT_READER,
        getROProvider(),
      );
      const cacheKey = `liquidityVault:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const [liquidityManager, owner] = await Promise.all([
            contract.liquidityManager?.().catch(() => null),
            contract.owner?.().catch(() => null),
          ]);

          return {
            address: contract.address,
            liquidityManager: liquidityManager || null,
            owner: owner || null,
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useLiquidityVault.refresh", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const getLpBalance = React.useCallback(async (lpPair) => {
    if (!lpPair) return "0";
    const contract = getReadOnlyContract("liquidityvault");
    if (!contract) return "0";
    try {
      const raw = await contract.lpBalanceOf(lpPair);
      return raw?.toString?.() ?? "0";
    } catch (e) {
      console.error("useLiquidityVault.getLpBalance", e);
      return "0";
    }
  }, []);

  const isWhitelistedPair = React.useCallback(async (lpPair) => {
    if (!lpPair) return false;
    const contract = getReadOnlyContract("liquidityvault");
    if (!contract) return false;
    try {
      return Boolean(await contract.whitelistedPairs(lpPair));
    } catch (e) {
      console.error("useLiquidityVault.isWhitelistedPair", e);
      return false;
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, getLpBalance, isWhitelistedPair };
}


