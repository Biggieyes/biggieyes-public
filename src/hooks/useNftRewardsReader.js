import * as React from "react";
import { Contract } from "ethers";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import { BiggiNftRewardsReader as BiggiNftRewardsReaderABI } from "@/config/abi/index.js";

const ABI = Array.isArray(BiggiNftRewardsReaderABI)
  ? BiggiNftRewardsReaderABI
  : [];

export default function useNftRewardsReader(providerOverride, addressOverride) {
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

  const address = addressOverride || ADDR.NFT_REWARDS_READER;
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
      const status = await contract.getStatus();
      if (id !== requestId.current) return null;
      if (!status) {
        setState({ context, data: null, loading: false, error: null });
        return null;
      }

      const next = {
        contractAddress: status.nftRewards ?? null,
        mainContract: status.main ?? null,
        VRFRouter: status.vrfRouter ?? null,
        owner: status.owner ?? null,
        registry: status.registry ?? null,
        nextEventId: status.nextEventId ?? null,
        nextRewardId: status.nextRewardId ?? null,
        totalRewardsCreated: status.totalRewardsCreated ?? null,
        name: status.name ?? null,
        symbol: status.symbol ?? null,
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
