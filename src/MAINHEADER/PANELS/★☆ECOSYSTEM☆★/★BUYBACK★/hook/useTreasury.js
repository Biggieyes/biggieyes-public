import * as React from "react";
import { ethers } from "ethers";
import { getCached } from "../../../../../utils/fetchCache";
import { getTreasuryRO } from "../../../../../utils/contract"; // přizpůsob podle projektu

/**
 * Hook pro čtení informací z Treasury kontraktu.
 * Čte z read-only provideru, bez nutnosti podpisu.
 */
export default function useTreasury() {
  const [data, setData] = React.useState({
    treasuryAddress: null,
    nativeBalance: "0",
    tokenBalance: "0",
    lastRefillAt: null,
    operator: null,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchTreasuryInfo = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getTreasuryRO();
      if (!contract) throw new Error("Treasury contract not found");
      const cacheKey = `treasury:${contract.address || "unknown"}`;

      const snapshot = await getCached(
        cacheKey,
        async () => {
          const provider = contract.provider;
          const [treasuryAddr, tokenAddr, lastRefillAtRaw, operator] =
            await Promise.all([
              contract
                .treasury?.()
                .catch(() => contract.treasuryAddress?.().catch(() => null)),
              contract
                .token?.()
                .catch(() => contract.tokenAddress?.().catch(() => null)),
              contract.lastRefillAt?.().catch(() => 0),
              contract.operator?.().catch(() => null),
            ]);

          let nativeBalance = "0";
          let tokenBalance = "0";

          if (treasuryAddr && provider) {
            try {
              const wei = await provider.getBalance(treasuryAddr);
              nativeBalance = ethers.utils.formatEther(wei);
            } catch (err) {
              console.debug("fetchTreasuryInfo balance failed", err);
            }
          }

          if (tokenAddr && treasuryAddr && provider) {
            try {
              const erc20 = new ethers.Contract(
                tokenAddr,
                [
                  "function balanceOf(address) view returns (uint256)",
                  "function symbol() view returns (string)",
                ],
                provider,
              );
              const [bal, sym] = await Promise.all([
                erc20.balanceOf(treasuryAddr),
                erc20.symbol().catch(() => "BIGGI"),
              ]);
              tokenBalance = `${ethers.utils.formatEther(bal)} ${sym}`;
            } catch (err) {
              console.debug("fetchTreasuryInfo token balance failed", err);
            }
          }

          let lastRefillAt = null;
          try {
            const n = Number(
              lastRefillAtRaw?.toString?.() || lastRefillAtRaw || 0,
            );
            if (Number.isFinite(n) && n > 0) {
              lastRefillAt = new Date(n * 1000).toLocaleString();
            }
          } catch (err) {
            console.debug("fetchTreasuryInfo lastRefill failed", err);
          }

          return {
            treasuryAddress: treasuryAddr || null,
            nativeBalance,
            tokenBalance,
            lastRefillAt,
            operator: operator || null,
          };
        },
        { force: options?.force === true },
      );

      setData(snapshot);
    } catch (e) {
      console.error("useTreasury.fetchTreasuryInfo", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTreasuryInfo();
  }, [fetchTreasuryInfo]);

  return { data, loading, error, refresh: fetchTreasuryInfo };
}
