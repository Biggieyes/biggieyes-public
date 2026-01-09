import * as React from "react";
import { formatEther } from "ethers/lib.esm/utils.js";
import { ADDR } from "../utils/addresses";
import {
  getROProvider,
  getReaderRO,
  getReadOnlyLiquidityContract,
  getPOLICYRO,
  getFrontendSnapshotLiteActive,
} from "../utils/contract";
import { callFirst } from "../utils/contracts-helpers";
import { getCached } from "../utils/fetchCache";

const WEEKLY_POOL_FNS = [
  "weeklyPool",
  "currentWeekPool",
  "getWeeklyPool",
  "weekPool",
  "poolForCurrentWeek",
  "rewardPool",
  "currentRewardPool",
];

function fmtEth(bn) {
  try {
    return Number(formatEther(bn)).toFixed(4);
  } catch {
    return null;
  }
}

export function useTransparencyData({ enabled = true } = {}) {
  const [state, setState] = React.useState({
    loading: true,
    data: null,
    error: null,
  });

  const load = React.useCallback(
    async (options = {}) => {
      if (!enabled) {
        setState({ loading: false, data: null, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        if (!provider) throw new Error("Read-only provider not available");
        const rpcUrl = provider?.connection?.url || "";
        const cacheKey = `transparency:${rpcUrl}:${ADDR.MAIN}:${ADDR.READER || ADDR.MAIN_READER}:${ADDR.NFT_REWARDS}:${ADDR.BIGGI_TOKENOMICS_READER}:${ADDR.TREASURY}:${ADDR.BUYBACK_AGENT}:${ADDR.RESERVE}`;

        const data = await getCached(
          cacheKey,
          async () => {
            let latencyMs = null;
            let rpcError = null;
            try {
              const start = performance.now();
              await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, rej) =>
                  setTimeout(() => rej(new Error("rpc_timeout")), 4000),
                ),
              ]);
              latencyMs = Math.round(performance.now() - start);
            } catch (err) {
              rpcError = err?.message || String(err);
            }

            let snapshot = null;
            let REWARDS = null;
            let POLICY = null;

            try {
              const reader = getReaderRO();
              const snap = await getFrontendSnapshotLiteActive(reader);
              const arr = Array.isArray(snap) ? snap : [];
              snapshot = {
                ticketPriceEth: snap?.ticketPriceWei
                  ? fmtEth(snap.ticketPriceWei)
                  : fmtEth(arr[0]),
                ticketMinted: snap?.ticketMinted_ ?? arr[1] ?? null,
                biggiMinted: snap?.biggiMinted_ ?? arr[2] ?? null,
              };
            } catch (err) {
              snapshot = { error: err?.message || String(err) };
            }

            try {
              const lm = await getReadOnlyLiquidityContract();
              const poolWei = await callFirst(lm, WEEKLY_POOL_FNS);
              const prov = provider;
              const [treasuryBal, BUYBACKBal, reserveBal] = await Promise.all([
                prov.getBalance(ADDR.TREASURY).catch(() => null),
                prov.getBalance(ADDR.BUYBACK_AGENT).catch(() => null),
                prov.getBalance(ADDR.RESERVE).catch(() => null),
              ]);
              REWARDS = {
                rewardPoolEth: poolWei ? fmtEth(poolWei) : null,
                treasuryEth: fmtEth(treasuryBal),
                BUYBACKEth: fmtEth(BUYBACKBal),
                reserveEth: fmtEth(reserveBal),
              };
            } catch (err) {
              REWARDS = { error: err?.message || String(err) };
            }

            try {
              const POLICYRO = getPOLICYRO();
              const gamma = POLICYRO?.gammaStakingBps
                ? await POLICYRO.gammaStakingBps()
                : null;
              POLICY = { gammaBps: gamma != null ? Number(gamma) : null };
            } catch (err) {
              POLICY = { error: err?.message || String(err) };
            }

            return {
              rpc: { url: rpcUrl, latencyMs, error: rpcError },
              snapshot,
              REWARDS,
              POLICY,
              addresses: {
                main: ADDR.MAIN,
                reader: ADDR.READER || ADDR.MAIN_READER,
                REWARDS: ADDR.NFT_REWARDS,
                tokenomicsReader: ADDR.BIGGI_TOKENOMICS_READER,
                treasury: ADDR.TREASURY,
                BUYBACK: ADDR.BUYBACK_AGENT,
                reserve: ADDR.RESERVE,
              },
            };
          },
          { force: options?.force === true },
        );

        setState({ loading: false, data, error: null });
      } catch (err) {
        console.error("useTransparencyData.load", err);
        setState((prev) => ({ ...prev, loading: false, error: err }));
      }
    },
    [enabled],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  return { ...state, refreshTransparency: load };
}

export default useTransparencyData;



