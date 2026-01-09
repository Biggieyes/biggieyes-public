import * as React from "react";
import {
  parseEth,
  writeFirst,
  setVRFAllOrPartial,
} from "../utils/adminActions";

export function useAdminActions({
  getContract,
  getLiquidityContract,
  getPOLICY,
  fetchStats,
  fetchREWARDS,
  onRefreshRouterInfo,
  onRefreshLiquidityPreview,
  onRefreshPOLICY,
  onRefreshREWARDS,
  onRefreshTokenMeta,
  onRefreshBUYBACKInfo,
  fetchTreasuryInfo,
  fetchReserveInfo,
}) {
  return React.useMemo(
    () => ({
      refresh: async () => {
        await fetchStats();
        await fetchREWARDS();
        try {
          await onRefreshRouterInfo();
        } catch (err) {
          console.debug("onRefreshRouterInfo failed", err);
        }
        try {
          await onRefreshLiquidityPreview();
        } catch (err) {
          console.debug("onRefreshLiquidityPreview failed", err);
        }
        try {
          await onRefreshPOLICY();
        } catch (err) {
          console.debug("onRefreshPOLICY failed", err);
        }
      },
      setPaused: async (flag) => {
        await writeFirst(
          [getContract],
          ["setPaused", "pauseMinting", "setPause"],
          !!flag,
        );
      },
      setBaseURI: async (uri) => {
        if (!uri) throw new Error("BaseURI is empty");
        await writeFirst(
          [getContract],
          ["setBaseURI", "setBaseUri", "setTokenURIBase"],
          uri,
        );
      },
      setTicketPrice: async (priceNum) => {
        await writeFirst(
          [getContract],
          ["setTicketPrice", "updateTicketPrice"],
          parseEth(priceNum),
        );
      },
      setBlockBasePrice: async (idx, priceNum) => {
        const p = parseEth(priceNum);
        await writeFirst(
          [getContract],
          ["setBlockBasePrice", "updateBlockBasePrice", "setBlockPrice"],
          idx,
          p,
        );
      },
      setVRFParams: async (VRF) => {
        await setVRFAllOrPartial(VRF);
      },
      setTreasury: async (addr) => {
        if (!addr) throw new Error("Treasury is empty");
        await writeFirst(
          [getContract, getLiquidityContract],
          ["setTreasury", "updateTreasury", "setTreasuryAddress"],
          addr,
        );
      },
      setLiquiditySink: async (addr) => {
        if (!addr) throw new Error("Liquidity sink is empty");
        await writeFirst(
          [getLiquidityContract, getContract],
          ["setLiquiditySink", "updateLiquiditySink", "setSinkAddress"],
          addr,
        );
      },
      setTokenAddress: async (addr) => {
        if (!addr) throw new Error("Token address is empty");
        await writeFirst(
          [getLiquidityContract, getContract],
          ["setTokenAddress", "setBIGGI", "updateTokenAddress"],
          addr,
        );
      },
      setRouter: async (addr) => {
        if (!addr) throw new Error("Router address is empty");
        await writeFirst(
          [getLiquidityContract, getContract],
          ["setRouter", "setDexRouter", "updateRouter"],
          addr,
        );
      },
      withdrawNative: async () => {
        await writeFirst(
          [getContract, getLiquidityContract],
          ["withdrawNative", "withdrawETH", "withdrawMatic"],
        );
      },
      withdrawToken: async () => {
        await writeFirst(
          [getLiquidityContract, getContract],
          ["withdrawToken", "withdrawBIGGI", "withdrawERC20"],
        );
      },
      sweepDust: async () => {
        await writeFirst(
          [getLiquidityContract, getContract],
          ["sweepDust", "sweep", "sweepTokens"],
        );
      },

      /* --- Liquidity Manager tokenomika setters --- */
      liq_setLiquidityRecipient: async (addr) => {
        if (!addr) throw new Error("Recipient is empty");
        await writeFirst(
          [getLiquidityContract],
          [
            "setLiquidityRecipient",
            "setRecipient",
            "setLiquidityReceiver",
            "setReceiver",
          ],
          addr,
        );
      },
      liq_setLpUseBalanceBps: async (bps) => {
        await writeFirst(
          [getLiquidityContract],
          ["setLpUseBalanceBps", "setLpUseBps", "setUseLpBps"],
          Number(bps),
        );
      },
      liq_setSwapSlippageBps: async (bps) => {
        await writeFirst(
          [getLiquidityContract],
          ["setSwapSlippageBps", "setSwapSlipBps", "setSwapSlippage"],
          Number(bps),
        );
      },
      liq_setLpAddSlippageBps: async (bps) => {
        await writeFirst(
          [getLiquidityContract],
          ["setLpAddSlippageBps", "setLpSlipBps", "setLpAddSlipBps"],
          Number(bps),
        );
      },
      liq_setTxDeadline: async (sec) => {
        await writeFirst(
          [getLiquidityContract],
          ["setTxDeadline", "setTxDeadlineSec", "setDeadline"],
          Number(sec),
        );
      },
      liq_setSwapPath: async (pathArr) => {
        await writeFirst(
          [getLiquidityContract],
          ["setSwapPath", "updateSwapPath"],
          pathArr,
        );
      },
      liq_clearSwapPath: async () => {
        await writeFirst(
          [getLiquidityContract],
          ["clearSwapPath", "resetSwapPath"],
          [],
        );
      },
      liq_BUYBACKToTreasury: async (nativeAmount, minOut) => {
        const overrides = nativeAmount ? { value: parseEth(nativeAmount) } : {};
        const minOutWei = minOut ? parseEth(minOut) : 0n;
        await writeFirst(
          [getLiquidityContract],
          [
            "BUYBACKToTreasury",
            "buyBiggiAndSendToTreasury",
            "BUYBACKAllToTreasury",
          ],
          minOutWei,
          overrides,
        );
        await onRefreshRouterInfo();
        await onRefreshBUYBACKInfo();
      },
      liq_BUYBACKAllToTreasury: async (minOut) => {
        const minOutWei = minOut ? parseEth(minOut) : 0n;
        await writeFirst(
          [getLiquidityContract],
          [
            "BUYBACKAllToTreasury",
            "buyBiggiAndSendToTreasury",
            "BUYBACKToTreasury",
          ],
          minOutWei,
        );
        await onRefreshRouterInfo();
        await onRefreshBUYBACKInfo();
      },
      liq_addLiquidityFromBalances: async (biggiAmount, nativeAmount) => {
        const overrides = nativeAmount ? { value: parseEth(nativeAmount) } : {};
        const tokenWei = biggiAmount
          ? parseEth(biggiAmount)
          : 0n;
        await writeFirst(
          [getLiquidityContract],
          [
            "addLiquidityFromBalances",
            "addLiquidityFromBalance",
            "addLiquidity",
          ],
          tokenWei,
          overrides,
        );
        await onRefreshLiquidityPreview();
      },
      liq_bootstrapLiquidity: async (tokenAmount, nativeAmount) => {
        const tokenWei = parseEth(tokenAmount || 0);
        const overrides = nativeAmount ? { value: parseEth(nativeAmount) } : {};
        await writeFirst(
          [getLiquidityContract],
          ["bootstrapLiquidity", "bootstrapLp"],
          tokenWei,
          overrides,
        );
        await onRefreshLiquidityPreview();
      },
      liq_routeBiggiToTreasury: async (amount) => {
        const amtWei = parseEth(amount || 0);
        await writeFirst(
          [getLiquidityContract],
          [
            "routeBiggiToTreasury",
            "routeTokensToTreasury",
            "sendBiggiToTreasury",
          ],
          amtWei,
        );
      },

      /* --- POLICY tokenomics setters --- */
      pol_setSplits: async (alphaBps, betaBps, gammaBps) => {
        await writeFirst(
          [getPOLICY],
          ["setSplits", "setSplitBps", "setPOLICYSplits", "setAllocations"],
          Number(alphaBps),
          Number(betaBps),
          Number(gammaBps),
        );
      },
      pol_setGuards: async (g) => {
        const dailyWei = g.dailyCapNative
          ? parseEth(g.dailyCapNative)
          : 0n;
        const args = [
          Number(g.swapSlip),
          Number(g.lpSlip),
          Number(g.deadlineSec),
          Number(g.cooldownSec),
          Number(g.epsBandBps),
          Number(g.twapWindowSec),
          dailyWei,
        ];
        await writeFirst(
          [getPOLICY],
          ["setGuards", "configureGuards", "setLimits"],
          ...args,
        );
      },
      pol_setPauses: async ({ BUYBACKs, refills, lpAdds, eoc }) => {
        await writeFirst(
          [getPOLICY],
          ["setPauses", "setPauseFlags", "setPaused"],
          !!BUYBACKs,
          !!refills,
          !!lpAdds,
          !!eoc,
        );
      },
      pol_setOperator: async (addr, allowed) => {
        if (!addr) throw new Error("Operator address is empty");
        await writeFirst(
          [getPOLICY],
          ["setOperator", "setOperatorAllowed", "setOperatorPermission"],
          addr,
          !!allowed,
        );
      },
      pol_consumeDaily: async (amtNative) => {
        const wei = parseEth(amtNative || 0);
        await writeFirst(
          [getPOLICY],
          ["consumeDaily", "consumeDailyAllowance", "consumeDailyCap"],
          wei,
        );
      },
      pol_resetDailyCounter: async () => {
        await writeFirst(
          [getPOLICY],
          ["resetDaily", "resetDailyCounter", "resetDailyCap"],
        );
      },

      fetchTreasuryInfo,
      fetchReserveInfo,
      onRefreshREWARDS,
      onRefreshTokenMeta,
    }),
    [
      getContract,
      getLiquidityContract,
      getPOLICY,
      fetchStats,
      fetchREWARDS,
      onRefreshRouterInfo,
      onRefreshLiquidityPreview,
      onRefreshPOLICY,
      onRefreshREWARDS,
      onRefreshTokenMeta,
      onRefreshBUYBACKInfo,
      fetchTreasuryInfo,
      fetchReserveInfo,
    ],
  );
}




