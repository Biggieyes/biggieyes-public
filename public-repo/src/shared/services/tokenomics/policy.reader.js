import { Contract } from "ethers";

import { getProvider } from "../../../web3/provider";
import { BiggiPolicy as ABI_BiggiPolicy } from "@/config/abi/index.js";
import { getAddresses } from "@/config/addresses/index.js";

async function _callOptional(fn, fallback = null) {
  if (typeof fn !== "function") return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function fetchPolicySnapshot({ chainId, provider } = {}) {
  const signerOrProvider = provider || getProvider();
  const addrs = getAddresses(chainId);
  const policyAddress = addrs?.policy || addrs?.POLICY || null;

  if (!policyAddress) {
    return {
      ts: Date.now(),
      tsLabel: new Date().toLocaleString(),
      policy: null,
      addresses: addrs,
    };
  }

  const policy = new Contract(
    policyAddress,
    ABI_BiggiPolicy,
    signerOrProvider,
  );

  const [
    buybacksPaused,
    swapSlippageBps,
    txDeadlineSec,
    minBuybackInterval,
    maxDailyBuybackNative,
    usedToday,
    dayIndex,
  ] = await Promise.all([
    _callOptional(() => policy.buybacksPaused(), null),
    _callOptional(() => policy.swapSlippageBps(), null),
    _callOptional(() => policy.txDeadlineSec(), null),
    _callOptional(() => policy.minBuybackInterval(), null),
    _callOptional(() => policy.maxDailyBuybackNative(), null),
    _callOptional(() => policy.usedToday(), null),
    _callOptional(() => policy.dayIndex?.(), null),
  ]);

  const ts = Date.now();

  return {
    ts,
    tsLabel: new Date(ts).toLocaleString(),
    policy: {
      address: policyAddress,
      buybacksPaused,
      swapSlippageBps,
      txDeadlineSec,
      minBuybackInterval,
      maxDailyBuybackNative,
      usedToday,
      dayIndex,
    },
    addresses: addrs,
  };
}
