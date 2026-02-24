const EIP6963_ANNOUNCE_EVENT = "eip6963:announceProvider";
const EIP6963_REQUEST_EVENT = "eip6963:requestProvider";

const announcedProviders = [];
const providerInfoByRef = new WeakMap();
let discoveryStarted = false;

const isProviderLike = (provider) =>
  Boolean(provider && typeof provider.request === "function");

const normalizeRdns = (value) => String(value || "").trim().toLowerCase();

const isMetaMaskProvider = (provider) => {
  if (!provider) return false;
  const info = providerInfoByRef.get(provider);
  const rdns = normalizeRdns(info?.rdns);
  if (rdns.includes("metamask")) return true;
  if (!provider.isMetaMask) return false;
  if (provider.isBraveWallet) return false;
  if (provider.isCoinbaseWallet) return false;
  if (provider.isRabby) return false;
  if (provider.isTrust) return false;
  return true;
};

export const isLikelyMetaMaskSdkProvider = (provider) => {
  if (!provider) return false;
  const info = providerInfoByRef.get(provider);
  const rdns = normalizeRdns(info?.rdns);
  if (rdns.includes("mmsdk") || rdns.includes("metamask-sdk")) return true;
  const hasMetaMaskBridge =
    provider._metamask &&
    typeof provider._metamask.isUnlocked === "function";
  if (hasMetaMaskBridge) return false;
  return Boolean(
    provider.isMetaMask &&
      typeof provider.connect === "function" &&
      !provider.providers,
  );
};

const metaMaskScore = (provider) => {
  if (!provider) return -1;
  const info = providerInfoByRef.get(provider);
  const rdns = normalizeRdns(info?.rdns);
  let score = 0;
  if (rdns === "io.metamask") score += 8;
  if (rdns.includes("metamask")) score += 4;
  if (rdns.includes("sdk")) score -= 6;
  if (provider._metamask && typeof provider._metamask.isUnlocked === "function")
    score += 6;
  if (typeof provider.isConnected === "function") score += 2;
  if (provider.providers) score -= 3;
  if (isLikelyMetaMaskSdkProvider(provider)) score -= 30;
  return score;
};

function onEip6963Announce(event) {
  const detail = event?.detail;
  const provider = detail?.provider;
  if (!isProviderLike(provider)) return;
  if (announcedProviders.includes(provider)) return;
  announcedProviders.push(provider);
  if (detail?.info && typeof detail.info === "object") {
    providerInfoByRef.set(provider, detail.info);
  }
}

function requestEip6963Providers() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(EIP6963_REQUEST_EVENT));
  } catch {
    // ignore discovery dispatch failures
  }
}

export function startInjectedProviderDiscovery() {
  if (typeof window === "undefined") return;
  if (discoveryStarted) return;
  discoveryStarted = true;
  window.addEventListener(EIP6963_ANNOUNCE_EVENT, onEip6963Announce);
  requestEip6963Providers();
  setTimeout(requestEip6963Providers, 250);
}

export function getInjectedProviderCandidates(options = {}) {
  startInjectedProviderDiscovery();
  const { preferred = null, metaMaskOnly = false } = options;
  const root = typeof window !== "undefined" ? window.ethereum : null;
  const rootProviders =
    Array.isArray(root?.providers) && root.providers.length
      ? root.providers
      : [];
  // Prefer providers directly exposed on window.ethereum first.
  // EIP-6963 announced providers may include SDK wrappers that are not usable
  // in the current browser context.
  const all = [preferred, ...rootProviders, root, ...announcedProviders].filter(
    (provider, index, list) =>
      isProviderLike(provider) && list.indexOf(provider) === index,
  );

  const metamaskFirst = [
    ...all
      .filter((provider) => isMetaMaskProvider(provider))
      .sort((a, b) => metaMaskScore(b) - metaMaskScore(a)),
    ...all.filter((provider) => !isMetaMaskProvider(provider)),
  ];
  if (!metaMaskOnly) return metamaskFirst;

  const onlyMetaMask = metamaskFirst.filter((provider) =>
    isMetaMaskProvider(provider),
  );
  const directMetaMask = onlyMetaMask.filter(
    (provider) => !isLikelyMetaMaskSdkProvider(provider),
  );
  return directMetaMask.length ? directMetaMask : onlyMetaMask;
}

export function isMetaMaskExtensionMissingError(error) {
  const parts = [
    error?.message,
    error?.cause?.message,
    error?.error?.message,
    error?.data?.message,
    error?.data?.originalError?.message,
  ]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase());
  const merged = parts.join(" | ");
  const hasExtensionNotFound =
    merged.includes("extension not found") ||
    merged.includes("metamask extension not found");
  return (
    hasExtensionNotFound ||
    (merged.includes("failed to connect to metamask") &&
      merged.includes("extension"))
  );
}
