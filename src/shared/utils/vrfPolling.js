export function shouldRunHeavyVrfRefresh(pollCount, isBackoffActive) {
  if (isBackoffActive) return false;
  const n = Number(pollCount) || 0;
  return n > 0 && n % 4 === 0;
}

export function shouldRunWalletAssetRefresh(pollCount, isBackoffActive) {
  if (isBackoffActive) return false;
  const n = Number(pollCount) || 0;
  return n > 0 && n % 12 === 0;
}

export function getNextVrfPollDelayMs(elapsedMs, isBackoffActive) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  let nextDelay = 8_000;
  if (elapsed < 120_000) nextDelay = 3_500;
  else if (elapsed < 600_000) nextDelay = 8_000;
  else nextDelay = 15_000;
  if (isBackoffActive) nextDelay = Math.max(nextDelay, 12_000);
  return nextDelay;
}
