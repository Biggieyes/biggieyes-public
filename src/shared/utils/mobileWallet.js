const DEFAULT_WALLETCONNECT_MOBILE_LINKS = Object.freeze([
  "metamask",
  "trust",
  "okx",
  "rainbow",
  "zerion",
  "bitget",
  "coinbase",
]);

const MOBILE_USER_AGENT_RE =
  /android|iphone|ipad|ipod|iemobile|opera mini|mobile/i;

export function isCapacitorNativeRuntime() {
  if (typeof window === "undefined") return false;
  const capacitor = window.Capacitor;
  try {
    if (capacitor && typeof capacitor.isNativePlatform === "function") {
      return Boolean(capacitor.isNativePlatform());
    }
    const platform =
      typeof capacitor?.getPlatform === "function"
        ? capacitor.getPlatform()
        : capacitor?.platform;
    return platform === "android" || platform === "ios";
  } catch {
    return false;
  }
}

export function isLikelyMobileWalletRuntime() {
  if (typeof window === "undefined") return false;

  const userAgent = String(window.navigator?.userAgent || "");
  if (MOBILE_USER_AGENT_RE.test(userAgent)) return true;

  try {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    const noHover = window.matchMedia?.("(hover: none)")?.matches;
    const touchPoints = Number(window.navigator?.maxTouchPoints || 0);
    return Boolean((coarsePointer && noHover) || touchPoints > 0);
  } catch {
    return false;
  }
}

export function shouldUseMetaMaskMobileFallback() {
  return isCapacitorNativeRuntime() || isLikelyMobileWalletRuntime();
}

export function getWalletConnectMobileLinks({ preferMetaMask = false } = {}) {
  if (!preferMetaMask) return [...DEFAULT_WALLETCONNECT_MOBILE_LINKS];
  return [
    "metamask",
    ...DEFAULT_WALLETCONNECT_MOBILE_LINKS.filter((item) => item !== "metamask"),
  ];
}
