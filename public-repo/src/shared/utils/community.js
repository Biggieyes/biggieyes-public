import { formatEther } from "ethers";
import { getMCDReaderV2RO } from "./contract";
import { ADDR } from "./addresses";
import {
  getDistributorGlobalSnapshot,
  getDistributorPendingCommunity,
} from "@/shared/services/tokenomics/distributorReaderCompat.js";

export async function fetchCOMMUNITYCENTERStats() {
  try {
    const reader = getMCDReaderV2RO();
    if (!reader) return {};

    const [rawSnap, pendingCommunity] = await Promise.all([
      getDistributorGlobalSnapshot(reader),
      getDistributorPendingCommunity(reader).catch(() => null),
    ]);

    const snap = rawSnap;
    const communityCenter =
      snap?.communityCenter ?? ADDR.COMMUNITY_CENTER ?? null;

    let communityPoolBalance = null;
    try {
      const provider =
        reader.provider || reader.runner?.provider || reader.runner;
      if (provider?.getBalance && communityCenter) {
        communityPoolBalance = await provider
          .getBalance(communityCenter)
          .catch(() => null);
      }
    } catch {
      // ignore balance fetch failures
    }

    const fmt = (v) => (v != null ? formatEther(v) : undefined);
    return {
      COMMUNITYCENTERAddr: communityCenter || undefined,
      pendingCommunity: fmt(pendingCommunity ?? snap?.totalPending),
      communityPoolBalance: fmt(communityPoolBalance),
    };
  } catch {
    return {};
  }
}
