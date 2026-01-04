import * as React from "react";
import { ethers } from "ethers";
import { ADDR } from "../utils/addresses";
import { getROProvider, getReaderRO, getReadOnlyLiquidityContract, getPolicyRO } from "../utils/contract";
import { callFirst } from "../utils/contracts-helpers";

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
    return Number(ethers.utils.formatEther(bn)).toFixed(4);
  } catch {
    return null;
  }
}

export function useTransparencyData({ enabled = true } = {}) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });

  const load = React.useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    const provider = getROProvider();
    const rpcUrl = provider?.connection?.url || "";
    let latencyMs = null;
    let rpcError = null;
    try {
      const start = performance.now();
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("rpc_timeout")), 4000)),
      ]);
      latencyMs = Math.round(performance.now() - start);
    } catch (err) {
      rpcError = err?.message || String(err);
    }

    let snapshot = null;
    let rewards = null;
    let policy = null;

    try {
      const reader = getReaderRO();
      const snap = await reader.getFrontendSnapshotLite();
      const arr = Array.isArray(snap) ? snap : [];
      snapshot = {
        ticketPriceEth: snap?.ticketPriceWei ? fmtEth(snap.ticketPriceWei) : fmtEth(arr[0]),
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
      const [treasuryBal, buybackBal, reserveBal] = await Promise.all([
        prov.getBalance(ADDR.TREASURY).catch(() => null),
        prov.getBalance(ADDR.BUYBACK_AGENT).catch(() => null),
        prov.getBalance(ADDR.RESERVE).catch(() => null),
      ]);
      rewards = {
        rewardPoolEth: poolWei ? fmtEth(poolWei) : null,
        treasuryEth: fmtEth(treasuryBal),
        buybackEth: fmtEth(buybackBal),
        reserveEth: fmtEth(reserveBal),
      };
    } catch (err) {
      rewards = { error: err?.message || String(err) };
    }

    try {
      const policyRO = getPolicyRO();
      const gamma = policyRO?.gammaStakingBps ? await policyRO.gammaStakingBps() : null;
      policy = { gammaBps: gamma != null ? Number(gamma) : null };
    } catch (err) {
      policy = { error: err?.message || String(err) };
    }

    setState({
      loading: false,
      error: null,
      data: {
        rpc: { url: rpcUrl, latencyMs, error: rpcError },
        snapshot,
        rewards,
        policy,
        addresses: {
          main: ADDR.MAIN,
          reader: ADDR.READER || ADDR.MAIN_READER,
          rewards: ADDR.NFT_REWARDS,
          tokenomicsReader: ADDR.BIGGI_TOKENOMICS_READER,
          treasury: ADDR.TREASURY,
          buyback: ADDR.BUYBACK_AGENT,
          reserve: ADDR.RESERVE,
        },
      },
    });
  }, [enabled]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { ...state, refreshTransparency: load };
}

export default useTransparencyData;
