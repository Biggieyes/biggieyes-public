import * as React from "react";
import { formatEther } from "ethers";
import {
  getFrontendSnapshotLiteActive,
  getROProvider,
  getPOLICYRO,
  getReadOnlyLiquidityContract,
  ADDR,
} from "@/shared/utils/contract";

const toNumberSafe = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const str = value?.toString?.() ?? value;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
};

const toEthSafe = (value) => {
  try {
    if (value == null) return null;
    return Number(formatEther(value));
  } catch {
    const n = toNumberSafe(value);
    return Number.isFinite(n) ? n : null;
  }
};

export default function useTransparencyData(opts = {}) {
  const { enabled = true } = opts || {};
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(enabled));
  const [error, setError] = React.useState(null);

  const refreshTransparency = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getROProvider();
      const start = Date.now();
      let rpcError = null;
      try {
        await provider.getBlockNumber();
      } catch (err) {
        rpcError = err;
      }
      const latencyMs = Date.now() - start;
      const rpcUrl =
        provider?.connection?.url ||
        provider?._getConnection?.()?.url ||
        provider?.url ||
        null;

      const snapshotRaw = await getFrontendSnapshotLiteActive();
      const [
        ticketPriceWei,
        ticketMinted,
        biggiMinted,
        currentBlockPrices,
        blocksMinted,
        bgsMinted,
      ] = Array.isArray(snapshotRaw) ? snapshotRaw : [];

      const snapshot = {
        ticketPriceEth: toEthSafe(ticketPriceWei),
        ticketMinted: toNumberSafe(ticketMinted),
        biggiMinted: toNumberSafe(biggiMinted),
        currentBlockPrices:
          currentBlockPrices?.map?.((v) => toEthSafe(v)) || [],
        blocksMinted: blocksMinted?.map?.((v) => toNumberSafe(v)) || [],
        backgroundsMinted: bgsMinted?.map?.((v) => toNumberSafe(v)) || [],
      };

      const balances = await Promise.all([
        provider.getBalance(ADDR.TREASURY).catch(() => null),
        provider.getBalance(ADDR.BUYBACK_AGENT).catch(() => null),
        provider.getBalance(ADDR.RESERVE).catch(() => null),
      ]);

      let rewardPoolWei = null;
      try {
        const liq = getReadOnlyLiquidityContract();
        const candidates = [
          "weeklyPool",
          "currentWeekPool",
          "getWeeklyPool",
          "weekPool",
          "poolForCurrentWeek",
          "rewardPool",
          "currentRewardPool",
        ];
        for (const fn of candidates) {
          if (typeof liq?.[fn] === "function") {
            try {
              rewardPoolWei = await liq[fn]();
              break;
            } catch {
              // try next
            }
          }
        }
      } catch {
        rewardPoolWei = null;
      }

      let policySnapshot = {
        swapSlippageBps: null,
        txDeadlineSec: null,
        minBuybackInterval: null,
        buybacksPaused: null,
        maxDailyBuybackNative: null,
        usedToday: null,
        dayIndex: null,
      };
      try {
        const policy = getPOLICYRO();
        const callPolicy = async (fn) => {
          if (typeof fn !== "function") return null;
          try {
            return await fn();
          } catch {
            return null;
          }
        };
        policySnapshot = {
          swapSlippageBps: toNumberSafe(
            await callPolicy(policy?.swapSlippageBps),
          ),
          txDeadlineSec: toNumberSafe(
            await callPolicy(policy?.txDeadlineSec),
          ),
          minBuybackInterval: toNumberSafe(
            await callPolicy(policy?.minBuybackInterval),
          ),
          buybacksPaused: await callPolicy(policy?.buybacksPaused),
          maxDailyBuybackNative: toNumberSafe(
            await callPolicy(policy?.maxDailyBuybackNative),
          ),
          usedToday: toNumberSafe(await callPolicy(policy?.usedToday)),
          dayIndex: toNumberSafe(await callPolicy(policy?.dayIndex)),
        };
      } catch {
        policySnapshot = {
          swapSlippageBps: null,
          txDeadlineSec: null,
          minBuybackInterval: null,
          buybacksPaused: null,
          maxDailyBuybackNative: null,
          usedToday: null,
          dayIndex: null,
        };
      }

      setData({
        rpc: {
          url: rpcUrl,
          latencyMs,
          error: rpcError ? String(rpcError?.message || rpcError) : null,
        },
        snapshot,
        REWARDS: {
          rewardPoolEth: toEthSafe(rewardPoolWei),
          treasuryEth: toEthSafe(balances[0]),
          BUYBACKEth: toEthSafe(balances[1]),
          reserveEth: toEthSafe(balances[2]),
        },
        POLICY: {
          ...policySnapshot,
        },
        addresses: {
          main: ADDR.MAIN,
          reader: ADDR.READER || ADDR.MAIN_READER,
          REWARDS: ADDR.TOKEN_REWARDS,
          BUYBACK: ADDR.BUYBACK_AGENT,
        },
      });
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    refreshTransparency();
  }, [refreshTransparency]);

  return {
    data,
    loading,
    error,
    refreshTransparency,
    refresh: refreshTransparency,
  };
}
