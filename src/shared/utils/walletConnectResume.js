const WALLETCONNECT_RESUME_STORAGE_KEY = "biggi_walletconnect_resume_v1";

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

export function getWalletConnectResumeExpected() {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(WALLETCONNECT_RESUME_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWalletConnectResumeExpected(enabled) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (enabled) {
      storage.setItem(WALLETCONNECT_RESUME_STORAGE_KEY, "1");
      return;
    }
    storage.removeItem(WALLETCONNECT_RESUME_STORAGE_KEY);
  } catch {
    // ignore storage write failures
  }
}

export function clearWalletConnectResumeExpected() {
  setWalletConnectResumeExpected(false);
}
