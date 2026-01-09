// src/HOOKS/useTokenREWARDS.js
import * as React from "react";
import { formatUnits } from "ethers/lib.esm/utils.js";
import TokenREWARDSService from "../services/tokenRewardsService";
import { getROProvider } from "../utils/contract";
import { ADDR } from "../utils/addresses";

const DEFAULT_DATA = {
  address: ADDR.TOKEN_REWARDS,
  unitReward: "0",
  REWARDSMinted: "0",
  REWARDSCap: "0",
  remainingCap: "0",
  totalDistributed: "0",
  distributedThisWeek: "0",
  currentWeek: 0,
  lastRecordedWeek: 0,
  lastWeekDistributed: "0",
  blockWeights: [],
  tokenMeta: null,
  tokenSymbol: "BIGGI",
  tokenDecimals: 18,
  mainNFT: null,
  main2NFT: null,
  owner: null,
  paused: false,
  treasure: null,
};

export default function useTokenREWARDS(providerOverride = null) {
  const [data, setData] = React.useState(DEFAULT_DATA);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = providerOverride || getROProvider();
        if (!provider) throw new Error("Read-only provider not available");

        const address = ADDR.TOKEN_REWARDS;
        if (!address) {
          setData((prev) => ({ ...prev }));
          return;
        }

        const svc = new TokenREWARDSService(address, provider);
        const raw = await svc.getAllStats();
        const meta = raw?.tokenMeta ?? null;
        const decimals = Number(meta?.decimals_ ?? meta?.[2] ?? 18) || 18;
        const fmt = (bn) => {
          try {
            return formatUnits(bn ?? 0, decimals);
          } catch {
            return "0";
          }
        };

        setData((prev) => ({
          ...prev,
          address,
          unitReward: fmt(raw.unitReward),
          REWARDSMinted: fmt(raw.REWARDSMinted),
          REWARDSCap: fmt(raw.REWARDSCap),
          remainingCap: fmt(raw.remainingCap),
          totalDistributed: fmt(raw.totalDistributed),
          distributedThisWeek: fmt(raw.distributedThisWeek),
          currentWeek: Number(raw.currentWeek ?? 0),
          lastRecordedWeek: Number(raw.lastRecordedWeek ?? 0),
          lastWeekDistributed: fmt(raw.lastWeekDistributed),
          blockWeights: Array.isArray(raw.blockWeights)
            ? raw.blockWeights.map((v) => Number(v?.toString?.() ?? v))
            : [],
          tokenMeta: meta,
          tokenSymbol: meta?.symbol_ ?? meta?.[1] ?? prev.tokenSymbol,
          tokenDecimals: decimals,
          mainNFT: raw.mainNFT || null,
          main2NFT: raw.main2NFT || null,
          owner: raw.owner || null,
          paused: Boolean(raw.paused),
          treasure: raw.treasure || null,
        }));
      } catch (e) {
        console.error("useTokenREWARDS.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [providerOverride],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
