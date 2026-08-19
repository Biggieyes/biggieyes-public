import * as React from "react";
import { Contract } from "ethers";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import { BiggiTokenRewardsReader as BiggiTokenRewardsReaderABI } from "@/config/abi/index.js";

const ABI = Array.isArray(BiggiTokenRewardsReaderABI)
  ? BiggiTokenRewardsReaderABI
  : [];

const normalizeTuple = (raw, fallback = null) => {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw[0]) || Array.isArray(raw[1])) return raw;
    if (raw.s || raw.meta) return [raw.s, raw.meta];
  }
  return fallback;
};

const normalizeMeta = (meta) => {
  if (!meta) return null;
  if (Array.isArray(meta)) {
    return {
      name_: meta[0],
      symbol_: meta[1],
      decimals_: Number(meta[2] ?? 18),
    };
  }
  return {
    name_: meta.name_ ?? meta.name ?? null,
    symbol_: meta.symbol_ ?? meta.symbol ?? null,
    decimals_: Number(meta.decimals_ ?? meta.decimals ?? 18),
  };
};

export default function useTokenRewardsReader(
  providerOverride,
  addressOverride,
) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);

  const address = addressOverride || ADDR.TOKEN_REWARDS_READER;

  const refresh = React.useCallback(async () => {
    if (!provider || !address || !ABI.length) {
      setData(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(address, ABI, provider);
      const raw = await contract.getStatus();
      const tuple = normalizeTuple(raw, [null, null]);
      const status = tuple?.[0];
      const meta = normalizeMeta(tuple?.[1]);

      if (!status) {
        setData(null);
        return null;
      }

      const next = {
        tokenRewards: status.tokenRewards ?? null,
        token: status.token ?? null,
        main: status.main ?? null,
        main2: status.main2 ?? null,
        unitReward: status.unitReward ?? null,
        emissionController: status.emissionController ?? null,
        emissionControllerEnabled: status.emissionControllerEnabled ?? null,
        blockWeights: status.blockWeights ?? null,
        REWARDSCap: status.rewardsCap ?? null,
        REWARDSMinted: status.rewardsMinted ?? null,
        rewardsCapRemaining: status.rewardsCapRemaining ?? null,
        tokenRemainingMintable: status.tokenRemainingMintable ?? null,
        rewardBalance: status.rewardBalance ?? null,
        totalDistributed: status.totalDistributed ?? null,
        distributedThisWeek: status.distributedThisWeek ?? null,
        lastWeekDistributed: status.lastWeekDistributed ?? null,
        currentWeek: status.currentWeek ?? null,
        lastRecordedWeek: status.lastRecordedWeek ?? null,
        remainingCap:
          status.rewardsCapRemaining ?? status.tokenRemainingMintable ?? null,
        tokenMeta: meta,
        tokenDecimals: meta?.decimals_ ?? 18,
        tokenSymbol: meta?.symbol_ ?? null,
      };

      setData(next);
      return next;
    } catch (err) {
      setError(err);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [provider, address]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
