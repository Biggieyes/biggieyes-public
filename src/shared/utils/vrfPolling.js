export function shouldRunHeavyVrfRefresh(pollCount, isBackoffActive) {
  if (isBackoffActive) return false;
  const n = Number(pollCount) || 0;
  if (n <= 1) return true;
  return n % 2 === 0;
}

export function shouldRunWalletAssetRefresh(pollCount, isBackoffActive) {
  if (isBackoffActive) return false;
  const n = Number(pollCount) || 0;
  return n > 0 && n % 6 === 0;
}

export function getNextVrfPollDelayMs(elapsedMs, isBackoffActive) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  let nextDelay = 10_000;
  if (elapsed > 0 && elapsed < 120_000) nextDelay = 6_000;
  else if (elapsed >= 120_000 && elapsed < 600_000) nextDelay = 10_000;
  else if (elapsed >= 600_000) nextDelay = 18_000;
  if (isBackoffActive) nextDelay = Math.max(nextDelay, 12_000);
  return nextDelay;
}

