import { JsonRpcProvider, Network, parseUnits } from "ethers";
import { ACTIVE_CHAIN, getPrimaryRpcUrl, getROProvider } from "./contract";

const DEFAULT_MIN_PRIORITY_FEE_GWEI = 25;
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off"]);

function env(key) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return import.meta.env[key];
    }
  } catch {
    // ignore env lookup errors
  }
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
  } catch {
    // ignore process env lookup errors
  }
  return undefined;
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBool(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (!s) return fallback;
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  return fallback;
}

function resolveBoolOption(explicit, envKey) {
  if (explicit != null) return parseBool(explicit, false);
  return parseBool(env(envKey), false);
}

function resolveMinPriorityFeeGwei(explicit) {
  const direct = parsePositiveNumber(explicit);
  if (direct != null) return direct;
  const envA = parsePositiveNumber(env("VITE_MIN_PRIORITY_FEE_GWEI"));
  if (envA != null) return envA;
  const envB = parsePositiveNumber(env("VITE_MIN_TIP_GWEI"));
  if (envB != null) return envB;
  return DEFAULT_MIN_PRIORITY_FEE_GWEI;
}

function toBigInt(value) {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function findRequestTarget(provider) {
  const queue = [provider];
  const seen = new Set();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || (typeof cur !== "object" && typeof cur !== "function")) continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (typeof cur.request === "function") return cur;
    if (cur.provider) queue.push(cur.provider);
    if (cur.runner) queue.push(cur.runner);
    if (cur.ethereum) queue.push(cur.ethereum);
  }
  return null;
}

async function getBaseFee(provider) {
  if (!provider || typeof provider.getBlock !== "function") return null;
  try {
    const block = await provider.getBlock("latest");
    return toBigInt(block?.baseFeePerGas);
  } catch {
    return null;
  }
}

function isInjectedProvider(provider) {
  return Boolean(findRequestTarget(provider));
}

async function getLegacyGasPrice(provider) {
  if (!provider) return null;
  try {
    if (typeof provider.send === "function") {
      const v = await provider.send("eth_gasPrice", []);
      return toBigInt(v);
    }
  } catch {
    // ignore send errors
  }
  try {
    const requestTarget = findRequestTarget(provider);
    if (requestTarget) {
      const v = await requestTarget.request({ method: "eth_gasPrice" });
      return toBigInt(v);
    }
  } catch {
    // ignore request errors
  }
  try {
    if (typeof provider.getGasPrice === "function") {
      const v = await provider.getGasPrice();
      return toBigInt(v);
    }
  } catch {
    // ignore legacy getGasPrice errors
  }
  return null;
}

function resolveFeeProvider(provider) {
  if (!provider) return null;
  if (!isInjectedProvider(provider)) return provider;
  const url = getPrimaryRpcUrl();
  if (url) {
    try {
      const network = Network.from({ chainId: ACTIVE_CHAIN.chainId, name: ACTIVE_CHAIN.name });
      const options = { staticNetwork: network };
      const fromEnv = parsePositiveNumber(env("VITE_RPC_BATCH_MAX_COUNT"));
      if (fromEnv != null) {
        options.batchMaxCount = Math.trunc(fromEnv);
      } else {
        try {
          const host = new URL(String(url)).hostname.toLowerCase();
          if (host.endsWith(".drpc.org")) {
            options.batchMaxCount = 3;
          }
        } catch {
          // ignore URL parsing failures
        }
      }
      return new JsonRpcProvider(url, network, options);
    } catch {
      // fall back to default RO provider
    }
  }
  try {
    return getROProvider();
  } catch {
    return provider;
  }
}

export async function buildFeeOverrides(provider, options = {}) {
  const isInjected = isInjectedProvider(provider);
  const feeProvider = resolveFeeProvider(provider);
  if (!feeProvider) return {};

  const minTipGwei = resolveMinPriorityFeeGwei(options.minPriorityFeeGwei);
  const minTip = minTipGwei ? parseUnits(String(minTipGwei), "gwei") : null;
  const forceLegacy = resolveBoolOption(
    options.forceLegacy,
    "VITE_FORCE_LEGACY_GAS",
  );

  // Injected providers (MetaMask, WalletConnect) are safest in legacy mode.
  const preferLegacy = forceLegacy || isInjected;
  if (preferLegacy) {
    let gasPrice = await getLegacyGasPrice(feeProvider);
    const baseFee = isInjected ? null : await getBaseFee(feeProvider);
    if (minTip) {
      const floor = baseFee != null ? baseFee + minTip : minTip;
      if (gasPrice == null || gasPrice < floor) gasPrice = floor;
    } else if (gasPrice == null && baseFee != null) {
      gasPrice = baseFee;
    }
    if (gasPrice != null) return { type: 0, gasPrice };
    // Avoid triggering eth_maxPriorityFeePerGas on injected providers.
    if (isInjected) {
      const fallbackGasPrice =
        minTip || parseUnits(String(DEFAULT_MIN_PRIORITY_FEE_GWEI), "gwei");
      return { type: 0, gasPrice: fallbackGasPrice };
    }
    if (typeof feeProvider.getFeeData !== "function") return {};
  }
  if (typeof feeProvider.getFeeData !== "function") return {};

  let feeData = null;
  try {
    feeData = await feeProvider.getFeeData();
  } catch {
    feeData = null;
  }

  let maxPriorityFeePerGas = toBigInt(feeData?.maxPriorityFeePerGas);
  let maxFeePerGas = toBigInt(feeData?.maxFeePerGas);
  let gasPrice = toBigInt(feeData?.gasPrice);
  const hasEip1559Hints = maxFeePerGas != null || maxPriorityFeePerGas != null;

  if (minTip && hasEip1559Hints) {
    if (maxPriorityFeePerGas == null || maxPriorityFeePerGas < minTip) {
      maxPriorityFeePerGas = minTip;
    }
  }

  if (maxFeePerGas != null && maxPriorityFeePerGas != null) {
    if (maxFeePerGas < maxPriorityFeePerGas) {
      maxFeePerGas = maxPriorityFeePerGas * 2n;
    }
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  if (maxFeePerGas == null && maxPriorityFeePerGas != null) {
    const baseFee = await getBaseFee(feeProvider);
    if (baseFee != null) {
      maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
    } else {
      maxFeePerGas = maxPriorityFeePerGas * 2n;
    }
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  if (gasPrice == null) {
    gasPrice = await getLegacyGasPrice(feeProvider);
  }
  if (gasPrice != null) return { gasPrice };

  if (isInjected) {
    const fallbackGasPrice =
      minTip || parseUnits(String(DEFAULT_MIN_PRIORITY_FEE_GWEI), "gwei");
    return { type: 0, gasPrice: fallbackGasPrice };
  }

  if (maxPriorityFeePerGas != null && hasEip1559Hints) {
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: maxPriorityFeePerGas * 2n,
    };
  }

  return {};
}
