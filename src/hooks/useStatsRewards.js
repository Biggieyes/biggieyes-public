import * as React from "react";
import { formatEther } from "ethers";
import {
  ADDR,
  getReaderRO,
  getFrontendSnapshotLiteActive,
  getReadOnlyMain as getReadOnlyContract,
  getLMRO as getReadOnlyLiquidityContract,
} from "../utils/contract";
import { getSafeDeployBlock, queryLogsBatched } from "../utils/shared";
import { callFirst } from "../utils/contracts-helpers";

export function useStatsREWARDS({
  setTicketPrice,
  setTicketMinted,
  setBiggiMinted,
  setBlockPrices,
  setBlockMintCounts,
  setBackgroundMintCounts,
  setRewardPool,
  setMintVolumeMatic,
  walletAddress,
  myNFTs,
  setMyClaimable,
}) {
  const fetchStats = React.useCallback(async () => {
    try {
      const reader = getReaderRO();
      const [
        ticketPriceWei,
        ticketMinted_,
        biggiMinted_,
        currentBlockPrices,
        blocksMinted,
        bgsMinted,
      ] = await getFrontendSnapshotLiteActive(reader);

      setTicketPrice(Number(formatEther(ticketPriceWei)));
      setTicketMinted(Number(ticketMinted_));
      setBiggiMinted(Number(biggiMinted_));
      setBlockPrices(
        currentBlockPrices.map((x) => Number(formatEther(x))),
      );
      setBlockMintCounts(blocksMinted.map((x) => Number(x)));
      setBackgroundMintCounts(bgsMinted.map((x) => Number(x)));
    } catch (err) {
      console.error("fetchStats(reader)", err);
      try {
        const main = getReadOnlyContract();
        const priceCandidates = [
          "getTicketPrice",
          "ticketPrice",
          "getTicketPriceWei",
          "ticketPriceWei",
        ];
        let priceWei = null;
        for (const fn of priceCandidates) {
          const f = main?.[fn];
          if (typeof f === "function") {
            try {
              const v = await f();
              if (v != null) {
                priceWei = v;
                break;
              }
            } catch (err) {
              console.debug("fetchStats fallback price candidate failed", err);
            }
          }
        }
        if (priceWei != null)
          setTicketPrice(Number(formatEther(priceWei)));

        try {
          const tm = await main.ticketMinted();
          setTicketMinted(Number(tm?.toString?.() || tm || 0));
        } catch (err) {
          console.debug("fetchStats fallback ticketMinted failed", err);
        }
        try {
          const bm = await main.biggiMinted();
          setBiggiMinted(Number(bm?.toString?.() || bm || 0));
        } catch (err) {
          console.debug("fetchStats fallback biggiMinted failed", err);
        }

        const prices = [];
        const blkCounts = [];
        const bgCounts = [];
        for (let i = 1; i <= 10; i++) {
          try {
            const p = await main.getCurrentBlockPrice(i);
            prices.push(Number(formatEther(p)));
          } catch {
            prices.push(0);
          }
          try {
            const c = await main.getBlockMintCount(i);
            blkCounts.push(Number(c?.toString?.() || c || 0));
          } catch {
            blkCounts.push(0);
          }
        }
        for (let j = 0; j < 10; j++) {
          try {
            const c = await main.backgroundMintCounts(j);
            bgCounts.push(Number(c?.toString?.() || c || 0));
          } catch {
            bgCounts.push(0);
          }
        }
        setBlockPrices(prices);
        setBlockMintCounts(blkCounts);
        setBackgroundMintCounts(bgCounts);
      } catch (e2) {
        console.error("fetchStats(fallback main)", e2);
      }
    }
  }, [
    setTicketPrice,
    setTicketMinted,
    setBiggiMinted,
    setBlockPrices,
    setBlockMintCounts,
    setBackgroundMintCounts,
  ]);

  const fetchREWARDS = React.useCallback(async () => {
    try {
      const main = getReadOnlyContract();

      const volumeCandidates = [
        "totalMintVolume",
        "mintVolume",
        "getMintVolume",
        "totalRevenue",
        "totalRevenueMatic",
        "accMintValue",
        "mintedValue",
      ];
      let volWei = await callFirst(main, volumeCandidates);
      if (volWei) {
        const vol = Number(formatEther(volWei));
        setMintVolumeMatic(vol);
      } else {
        setMintVolumeMatic(null);
      }

      let weeklyWei = null;
      try {
        const brl = await getReadOnlyLiquidityContract();
        const weeklyPoolFns = [
          "weeklyPool",
          "currentWeekPool",
          "getWeeklyPool",
          "weekPool",
          "poolForCurrentWeek",
          "rewardPool",
          "currentRewardPool",
        ];
        weeklyWei = await callFirst(brl, weeklyPoolFns);
      } catch (err) {
        console.debug("fetchREWARDS weekly pool lookup failed", err);
      }

      if (weeklyWei != null) {
        try {
          const isPositive = typeof weeklyWei === 'bigint'
            ? weeklyWei > 0n
            : Number(weeklyWei) > 0;
          if (isPositive) {
            setRewardPool(Number(formatEther(weeklyWei)));
          } else if (volWei) {
            setRewardPool(Number(formatEther(volWei)) * 0.22);
          } else {
            setRewardPool(0);
          }
        } catch {
          if (volWei)
            setRewardPool(Number(formatEther(volWei)) * 0.22);
          else setRewardPool(0);
        }
      } else {
        if (volWei)
          setRewardPool(Number(formatEther(volWei)) * 0.22);
        else setRewardPool(0);
      }

      if (walletAddress) {
        const brl = await getReadOnlyLiquidityContract();

        let tokenIds = myNFTs
          .filter((x) => !x.isTicket)
          .map((x) => BigInt(x.tokenId));

        if (!tokenIds.length) {
          const contract = getReadOnlyContract();
          const latest = await contract.provider.getBlockNumber();
          const fallbackFrom = Number(ADDR?.DEPLOY_BLOCK);
          const FROM =
            Number.isFinite(fallbackFrom) && fallbackFrom > 0
              ? fallbackFrom
              : await getSafeDeployBlock(contract.provider);
          const toFilter = contract.filters.Transfer(null, walletAddress, null);
          const fromFilter = contract.filters.Transfer(
            walletAddress,
            null,
            null,
          );
          const [toLogs, fromLogs] = await Promise.all([
            queryLogsBatched(contract, toFilter, FROM, latest),
            queryLogsBatched(contract, fromFilter, FROM, latest),
          ]);
          const all = [...toLogs, ...fromLogs].sort((a, b) => {
            if (a.blockNumber !== b.blockNumber)
              return a.blockNumber - b.blockNumber;
            return a.logIndex - b.logIndex;
          });
          const held = new Set();
          const me = String(walletAddress || "").toLowerCase();
          for (const l of all) {
            const from = String(
              l.args?.from ?? l.args?.[0] ?? "",
            ).toLowerCase();
            const to = String(l.args?.to ?? l.args?.[1] ?? "").toLowerCase();
            const tid = (l.args?.tokenId ?? l.args?.[2])?.toString?.() || "";
            if (!tid) continue;
            if (to === me) held.add(tid);
            if (from === me) held.delete(tid);
          }
          const arr = Array.from(held);
          const nonTickets = [];
          for (const tid of arr) {
            try {
              const isT =
                typeof contract?.isTicket === "function"
                  ? await contract.isTicket(tid)
                  : false;
              if (!isT) nonTickets.push(BigInt(tid));
            } catch {
              nonTickets.push(BigInt(tid));
            }
          }
          tokenIds = nonTickets;
        }

        if (tokenIds.length) {
          try {
            const [, amount] = await brl.claimablePreview(tokenIds);
            setMyClaimable(Number(formatEther(amount)));
          } catch {
            setMyClaimable(0);
          }
        } else {
          setMyClaimable(0);
        }
      }
    } catch (e) {
      console.error("fetchREWARDS", e);
    }
  }, [
    walletAddress,
    myNFTs,
    setMintVolumeMatic,
    setRewardPool,
    setMyClaimable,
  ]);

  return { fetchStats, fetchREWARDS };
}


