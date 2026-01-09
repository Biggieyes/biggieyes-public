import { formatEther } from "ethers/lib.esm/utils.js";
import { getDistributorRO } from "./contract";

export async function fetchCOMMUNITYCENTERStats() {
  try {
    const distributor = await getDistributorRO();
    if (!distributor) return {};

    const COMMUNITYCENTERAddr =
      (typeof distributor.COMMUNITYCENTER === "function"
        ? await distributor.COMMUNITYCENTER().catch(() => null)
        : null) || null;

    const pendingCommunityPromise =
      typeof distributor.pendingCommunity === "function"
        ? distributor.pendingCommunity().catch(() => null)
        : typeof distributor.pendingOf === "function" && COMMUNITYCENTERAddr
          ? distributor.pendingOf(COMMUNITYCENTERAddr).catch(() => null)
          : typeof distributor.pending === "function" && COMMUNITYCENTERAddr
            ? distributor.pending(COMMUNITYCENTERAddr).catch(() => null)
            : Promise.resolve(null);

    const communityPoolBalancePromise =
      typeof distributor.communityBalance === "function"
        ? distributor.communityBalance().catch(() => null)
        : COMMUNITYCENTERAddr && distributor.provider
          ? distributor.provider
              .getBalance(COMMUNITYCENTERAddr)
              .catch(() => null)
          : Promise.resolve(null);

    const [pendingCommunity, communityPoolBalance] = await Promise.all([
      pendingCommunityPromise,
      communityPoolBalancePromise,
    ]);

    const fmt = (v) => (v != null ? formatEther(v) : undefined);
    return {
      COMMUNITYCENTERAddr: COMMUNITYCENTERAddr || undefined,
      pendingCommunity: fmt(pendingCommunity),
      communityPoolBalance: fmt(communityPoolBalance),
    };
  } catch {
    return {};
  }
}

