import * as React from "react";
import { Contract } from "ethers";
import { ADDR } from "@/shared/utils/addresses";
import { getROProvider } from "@/shared/utils/contract";
import { BiggiNftRewardsReader as BiggiNftRewardsReaderABI } from "@/config/abi/index.js";

const ABI = Array.isArray(BiggiNftRewardsReaderABI)
  ? BiggiNftRewardsReaderABI
  : [];

export default function useNftRewardsReader(providerOverride, addressOverride) {
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

  const address = addressOverride || ADDR.NFT_REWARDS_READER;

  const refresh = React.useCallback(async () => {
    if (!provider || !address || !ABI.length) {
      setData(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const contract = new Contract(address, ABI, provider);
      const status = await contract.getStatus();
      if (!status) {
        setData(null);
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
