import { ethers } from "ethers";
import { getDistributorRO } from "./contract";

export async function fetchCommunityCenterStats() {
  try {
    const distributor = await getDistributorRO();
    if (!distributor) return {};

    const communityCenterAddr =
      (typeof distributor.communityCenter === "function"
        ? await distributor.communityCenter().catch(() => null)
        : null) || null;

    const pendingCommunityPromise =
      typeof distributor.pendingCommunity === "function"
        ? distributor.pendingCommunity().catch(() => null)
        : typeof distributor.pendingOf === "function" && communityCenterAddr
          ? distributor.pendingOf(communityCenterAddr).catch(() => null)
          : typeof distributor.pending === "function" && communityCenterAddr
            ? distributor.pending(communityCenterAddr).catch(() => null)
            : Promise.resolve(null);

    const communityPoolBalancePromise =
      typeof distributor.communityBalance === "function"
        ? distributor.communityBalance().catch(() => null)
        : communityCenterAddr && distributor.provider
          ? distributor.provider
              .getBalance(communityCenterAddr)
              .catch(() => null)
          : Promise.resolve(null);

    const [pendingCommunity, communityPoolBalance] = await Promise.all([
      pendingCommunityPromise,
      communityPoolBalancePromise,
    ]);

    const fmt = (v) => (v != null ? ethers.utils.formatEther(v) : undefined);
    return {
      communityCenterAddr: communityCenterAddr || undefined,
      pendingCommunity: fmt(pendingCommunity),
      communityPoolBalance: fmt(communityPoolBalance),
    };
  } catch {
    return {};
  }
}
