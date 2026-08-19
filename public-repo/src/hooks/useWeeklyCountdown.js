import * as React from "react";

const DEFAULT_WEEK_SECONDS = 7 * 24 * 60 * 60;

const nowSeconds = () => Math.floor(Date.now() / 1000);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function useWeeklyCountdown(options = {}) {
  const { epochStart = null, weekSeconds, fetchChainNowTs, claimFn } = options;
  const period = Number(weekSeconds) || DEFAULT_WEEK_SECONDS;

  const [displayed, setDisplayed] = React.useState(() => ({
    remainingSeconds: period,
    percentComplete: 0,
    status: "loading",
    claimable: false,
    currentWeek: null,
    blockNumber: null,
    lastSync: Date.now(),
    error: null,
  }));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [claimSuccess, setClaimSuccess] = React.useState(false);

  const resolveNow = React.useCallback(async () => {
    if (typeof fetchChainNowTs === "function") {
      const ts = await fetchChainNowTs().catch(() => null);
      if (Number.isFinite(Number(ts))) return Number(ts);
    }
    return nowSeconds();
  }, [fetchChainNowTs]);

  const computeInfo = React.useCallback(
    (nowSec) => {
      const start =
        Number.isFinite(Number(epochStart)) && Number(epochStart) > 0
          ? Number(epochStart)
          : nowSec - (nowSec % period);
      const elapsed = Math.max(0, nowSec - start);
      const remaining = Math.max(0, period - elapsed);
      const percent = period ? clamp((elapsed / period) * 100, 0, 100) : 0;
      const claimable = remaining === 0;
      const weekIndex = period ? Math.floor(nowSec / period) + 1 : null;
      return {
        remainingSeconds: remaining,
        percentComplete: percent,
        status: claimable ? "claimable" : "next",
        claimable,
        currentWeek: weekIndex,
        blockNumber: null,
        lastSync: Date.now(),
        error: null,
      };
    },
    [epochStart, period],
  );

  const syncWeeklyInfo = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nowSec = await resolveNow();
      const next = computeInfo(nowSec);
      setDisplayed(next);
      return next;
    } catch (err) {
      setError(err);
      setDisplayed((prev) => ({
        ...prev,
        error: err?.message || "Failed to sync",
        status: "error",
        lastSync: Date.now(),
      }));
      return null;
    } finally {
      setLoading(false);
    }
  }, [computeInfo, resolveNow]);

  const handleClaim = React.useCallback(async () => {
    if (isClaiming) return;
    setClaimSuccess(false);
    setError(null);
    if (!displayed?.claimable) {
      setError(new Error("Claim window is not open."));
      return;
    }
    if (typeof claimFn !== "function") {
      setError(new Error("Claim action is not configured."));
      return;
    }
    setIsClaiming(true);
    try {
      await claimFn();
      setClaimSuccess(true);
      await syncWeeklyInfo();
    } catch (err) {
      setError(err);
    } finally {
      setIsClaiming(false);
    }
  }, [claimFn, displayed?.claimable, isClaiming, syncWeeklyInfo]);

  React.useEffect(() => {
    syncWeeklyInfo();
    const id = setInterval(syncWeeklyInfo, 15_000);
    return () => clearInterval(id);
  }, [syncWeeklyInfo]);

  return {
    displayed: { ...displayed, error: error?.message || displayed.error },
    loading,
    error,
    isClaiming,
    claimSuccess,
    syncWeeklyInfo,
    handleClaim,
  };
}
