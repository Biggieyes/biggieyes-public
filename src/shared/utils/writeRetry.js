export async function runWriteWithRpcRetry(sendFn, options = {}) {
  const {
    maxRetries = 2,
    baseDelayMs = 4500,
    delayStepMs = 3000,
    isRateLimitError = () => false,
    onRateLimitRetry = async () => {},
    waitFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  const retries = Math.max(0, Number(maxRetries) || 0);
  const baseDelay = Math.max(0, Number(baseDelayMs) || 0);
  const stepDelay = Math.max(0, Number(delayStepMs) || 0);

  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    try {
      return await sendFn();
    } catch (err) {
      lastErr = err;
      const rateLimited = Boolean(isRateLimitError(err));
      if (!rateLimited || attempt >= retries) throw err;

      const delayMs = baseDelay + attempt * stepDelay;
      await onRateLimitRetry({
        attempt,
        retries,
        delayMs,
        error: err,
      });
      if (delayMs > 0) {
        await waitFn(delayMs);
      }
      attempt += 1;
    }
  }

  throw lastErr || new Error("transaction failed");
}

