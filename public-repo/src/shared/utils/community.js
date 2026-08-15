import { formatEther } from "ethers";
import { getMCDReaderV2RO } from "./contract";
import { ADDR } from "./addresses";

export async function fetchCOMMUNITYCENTERStats() {
  try {
    const reader = getMCDReaderV2RO();
    if (!reader) return {};

    const [rawSnap, pendingCommunity] = await Promise.all([
      reader.globalSnapshot(),
      reader.pendingCommunity?.().catch?.(() => null),
    ]);

    const snap = rawSnap?.s ?? rawSnap?.[0] ?? rawSnap;
    const communityCenter =
      snap?.communityCenter ??
      snap?.[4] ??
      ADDR.COMMUNITY_CENTER ??
      null;

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
      pendingCommunity: fmt(pendingCommunity ?? snap?.totalPending ?? snap?.[5]),
      communityPoolBalance: fmt(communityPoolBalance),
    };
  } catch {
    return {};
  }
}

