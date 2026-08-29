import { Contract, formatEther } from "ethers";
import VRF_SUBSCRIPTION_ABI from "../../config/abi/IVRFSubscriptionV2Plus.json";

function sameAddress(left, right) {
  const a = String(left || "")
    .trim()
    .toLowerCase();
  const b = String(right || "")
    .trim()
    .toLowerCase();
  return Boolean(a && b && a === b);
}

function emptySnapshot(overrides = {}) {
  return {
    loaded: false,
    linkBalance: "",
    linkBalanceWei: "",
    nativeBalance: "",
    nativeBalanceWei: "",
    fundedForNative: null,
    requestCount: "",
    owner: "",
    ownerMatches: null,
    consumers: [],
    routerIsConsumer: null,
    pendingRequestExists: null,
    error: "",
    ...overrides,
  };
}

export async function readVrfSubscriptionSnapshot({
  provider,
  coordinator,
  subId,
  routerAddress,
  expectedOwner,
}) {
  const id = String(subId ?? "").trim();
  if (!provider || !coordinator || !id || id === "0") {
    return emptySnapshot();
  }

  try {
    const contract = new Contract(coordinator, VRF_SUBSCRIPTION_ABI, provider);
    const [subscription, pendingRequestExists] = await Promise.all([
      contract.getSubscription(id),
      contract.pendingRequestExists(id).catch(() => null),
    ]);
    const linkBalanceWei = subscription.balance.toString();
    const nativeBalanceWei = subscription.nativeBalance.toString();
    const owner = String(subscription.owner || "");
    const consumers = Array.from(subscription.consumers || [], String);

    return emptySnapshot({
      loaded: true,
      linkBalance: formatEther(linkBalanceWei),
      linkBalanceWei,
      nativeBalance: formatEther(nativeBalanceWei),
      nativeBalanceWei,
      fundedForNative: BigInt(nativeBalanceWei) > 0n,
      requestCount: subscription.reqCount.toString(),
      owner,
      ownerMatches: expectedOwner ? sameAddress(owner, expectedOwner) : null,
      consumers,
      routerIsConsumer: routerAddress
        ? consumers.some((consumer) => sameAddress(consumer, routerAddress))
        : null,
      pendingRequestExists,
    });
  } catch (error) {
    return emptySnapshot({
      error: String(error?.shortMessage || error?.message || error),
    });
  }
}
