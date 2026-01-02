import * as React from "react";
import { getROProvider } from "../utils/contract";

const DEFAULT_WEEK_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_INFO = {
  remainingSeconds: 432000,
  percentComplete: 30,
  currentWeek: 275,
  blockNumber: 1734508800,
  lastSync: new Date().toISOString(),
  status: "claimable",
  claimable: true,
};

const normalizeSeconds = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : DEFAULT_WEEK_SECONDS;

const computeDisplay = (info, tick, weekDuration) => {
  const remaining = Math.max(0, (info.remainingSeconds ?? 0) - tick);
  const duration = Number.isFinite(Number(weekDuration)) && weekDuration > 0 ? Number(weekDuration) : DEFAULT_WEEK_SECONDS;
  const percentComplete =
    duration > 0
      ? Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100))
      : info.percentComplete ?? 0;
  const claimable = info.claimable ?? remaining <= 0;
  return {
    ...info,
    remainingSeconds: remaining,
    percentComplete,
    claimable,
  };
};

export default function useWeeklyCountdown({ epochStart = null, fetchChainNowTs = null, weekSeconds = DEFAULT_WEEK_SECONDS } = {}) {
  const weekDuration = normalizeSeconds(weekSeconds);
  const [weeklyInfo, setWeeklyInfo] = React.useState(() => ({ ...DEFAULT_INFO }));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [claimSuccess, setClaimSuccess] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  const syncWeeklyInfo = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = (() => {
        try {
          return getROProvider();
        } catch {
          return null;
        }
      })();
      const block = provider ? await provider.getBlock("latest").catch(() => null) : null;
      const nowTs =
        block?.timestamp ??
        (fetchChainNowTs ? await fetchChainNowTs().catch(() => Math.floor(Date.now() / 1000)) : null) ??
        Math.floor(Date.now() / 1000);
      const epochTs =
        epochStart && Number.isFinite(Number(epochStart)) ? Math.floor(Number(epochStart)) : nowTs - (nowTs % weekDuration);
      const nextWeek = epochTs + weekDuration;
      const remainingSeconds = Math.max(0, nextWeek - nowTs);
      setWeeklyInfo((prev) => ({
        ...prev,
        remainingSeconds,
        percentComplete: Math.min(100, Math.max(0, ((weekDuration - remainingSeconds) / weekDuration) * 100)),
        blockNumber: block?.number ?? prev.blockNumber,
        lastSync: nowTs * 1000,
        status: remainingSeconds <= 0 ? "claimable" : "next",
        claimable: remainingSeconds <= 0,
      }));
    } catch (err) {
      console.error("Weekly countdown sync failed", err);
      setError("Unable to load data. Try again.");
    } finally {
      setLoading(false);
    }
  }, [epochStart, fetchChainNowTs, weekDuration]);

  const displayed = React.useMemo(() => computeDisplay(weeklyInfo, tick, weekDuration), [weeklyInfo, tick, weekDuration]);

  const claimableNow = React.useMemo(() => displayed.claimable && !loading && !error, [displayed.claimable, loading, error]);

  const handleClaim = React.useCallback(async () => {
    if (!claimableNow || isClaiming) return;
    setIsClaiming(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setClaimSuccess(true);
      setWeeklyInfo((prev) => ({
        ...prev,
        status: "already",
        claimable: false,
      }));
      setTimeout(() => setClaimSuccess(false), 4000);
      await syncWeeklyInfo();
    } catch (err) {
      console.error("Weekly claim simulation failed", err);
      setError("Unable to claim. Try again later.");
    } finally {
      setIsClaiming(false);
    }
  }, [claimableNow, isClaiming, syncWeeklyInfo]);

  React.useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return {
    info: weeklyInfo,
    displayed,
    loading,
    error,
    isClaiming,
    claimSuccess,
    syncWeeklyInfo,
    handleClaim,
    claimableNow,
  };
}
