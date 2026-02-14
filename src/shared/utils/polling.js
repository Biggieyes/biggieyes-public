// src/utils/polling.js
// Shared polling helpers to reduce redundant work in background tabs.

export const getPollInterval = (fallbackMs, envKey) => {
  const raw =
    envKey && typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env[envKey]
      : undefined;
  const val = Number(raw);
  return Number.isFinite(val) && val > 0 ? val : fallbackMs;
};

export const canPoll = () => {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
};

export const runWithLock = async (lockRef, fn) => {
  if (!lockRef || lockRef.current) return false;
  lockRef.current = true;
  try {
    await fn();
  } finally {
    lockRef.current = false;
  }
  return true;
};

