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
  const [state, setState] = React.useState(null);
  const requestId = React.useRef(0);

  const provider = React.useMemo(() => {
    if (providerOverride) return providerOverride;
    try {
      return getROProvider();
    } catch {
      return null;
    }
  }, [providerOverride]);

  const address = addressOverride || ADDR.TOKEN_REWARDS_READER;
  const context = React.useMemo(
    () => ({ provider, address }),
    [provider, address],
  );

  const refresh = React.useCallback(async () => {
    const id = ++requestId.current;
    if (!provider || !address || !ABI.length) {
      setState({ context, data: null, loading: false, error: null });
      return null;
    }
    setState({ context, data: null, loading: true, error: null });
    try {
      const contract = new Contract(address, ABI, provider);
      const raw = await contract.getStatus();
      if (id !== requestId.current) return null;
      const tuple = normalizeTuple(raw, [null, null]);
      const status = tuple?.[0];
      const meta = normalizeMeta(tuple?.[1]);

      if (!status) {
        setState({ context, data: null, loading: false, error: null });
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

      setState({ context, data: next, loading: false, error: null });
      return next;
    } catch (err) {
      if (id === requestId.current) {
        setState({ context, data: null, loading: false, error: err });
      }
      return null;
    }
  }, [provider, address, context]);

  React.useEffect(() => {
    refresh();
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);

  const current = state?.context === context ? state : null;
  return {
    data: current?.data ?? null,
    loading: current?.loading ?? Boolean(provider && address && ABI.length),
    error: current?.error ?? null,
    refresh,
  };
}
