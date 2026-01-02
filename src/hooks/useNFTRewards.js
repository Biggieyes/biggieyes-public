// src/hooks/useNFTRewards.js
import * as React from "react";
import { ethers } from "ethers";
import { useContracts } from "../providers/ContractsProvider";

/**
 * Čte a spravuje data z NFTRewards kontraktu.
 * Zahrnuje claimable odměny, historii a funkci claim().
 */
export default function useNFTRewards() {
  const { nftRewardsRead, nftRewardsWrite } = useContracts();
  const [rewards, setRewards] = React.useState({
    currentWeek: null,
    claimable: "0",
    totalClaimed: "0",
    lastClaimAt: null,
    userShareBps: null,
  });

  const fmt = (v) => {
    try {
      return ethers.utils.formatEther(v);
    } catch {
      return "0";
    }
  };

  /** Načti aktuální informace o odměnách uživatele */
  const refreshRewards = React.useCallback(
    async (address) => {
      const ctr = nftRewardsRead?.();
      if (!ctr || !address) return;
      try {
        const [week, claimable, totalClaimed, lastClaimAt, shareBps] =
          await Promise.all([
            ctr.currentWeek?.().catch(() => null),
            ctr.claimable?.(address).catch(() => 0),
            ctr.totalClaimed?.(address).catch(() => 0),
            ctr.lastClaimAt?.(address).catch(() => 0),
            ctr.userShareBps?.(address).catch(() => null),
          ]);

        setRewards({
          currentWeek: week != null ? Number(week) : null,
          claimable: fmt(claimable),
          totalClaimed: fmt(totalClaimed),
          lastClaimAt:
            Number(lastClaimAt) > 0
              ? new Date(Number(lastClaimAt) * 1000).toLocaleString()
              : null,
          userShareBps: shareBps != null ? Number(shareBps) : null,
        });
      } catch (e) {
        console.error("refreshRewards", e);
      }
    },
    [nftRewardsRead]
  );

  /** Claim všech aktuálních NFT odměn */
  const claimAll = React.useCallback(
    async (address) => {
      const ctr = nftRewardsWrite?.();
      if (!ctr || !address) return alert("Wallet not connected");
      try {
        const tx = await ctr.claimAll?.();
        await tx.wait();
        await refreshRewards(address);
        alert("NFT rewards claimed.");
      } catch (e) {
        console.error("claimAll", e);
        alert("Claim failed: " + (e?.reason || e?.message || "Unknown error"));
      }
    },
    [nftRewardsWrite, refreshRewards]
  );

  return { rewards, refreshRewards, claimAll };
}
