import * as React from "react";
import LiquidityTab from "../tabs/LiquidityTab.jsx";
import TokenDexTab from "../tabs/TokenDexTab.jsx";
import { toNumberSafe } from "@/hooks/tokenomics/_utils";

const toNumberLoose = (value) => {
  if (value == null) return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/,/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

function TokenomicsPanel({
  segment = "reserve",
  activeSection,
  liquidityProps,
  dexProps,
  chainStatus,
  liquidity,
  tokenDex,
  liquidityHistory,
  dexHistory,
  dexLoading,
  dexError,
  pumpView,
  tok,
  router,
  readerStatus,
  onDexRefresh,
}) {
  const resolved = activeSection || segment;

  const tokenDecimals = React.useMemo(
    () =>
      typeof tokenDex?.token?.decimals === "number" ? tokenDex.token.decimals : 18,
    [tokenDex?.token?.decimals],
  );

  const liquiditySnapshot = liquidity || null;
  const reserve = liquiditySnapshot?.reserve || null;
  const manager = liquiditySnapshot?.manager || null;
  const vault = liquiditySnapshot?.vault || null;
  const treasury = liquiditySnapshot?.treasury || null;
  const automation = liquiditySnapshot?.automation || null;
  const keeperProxy = liquiditySnapshot?.keeperProxy || null;
  const branchReader = liquiditySnapshot?.branchReader || null;
  const liquidityHistoryBundle = React.useMemo(
    () =>
      Array.isArray(liquidityHistory)
        ? { chartPoints: liquidityHistory }
        : liquidityHistory || null,
    [liquidityHistory],
  );

  const reserveView = React.useMemo(() => {
    if (!reserve) return null;
    return {
      maticBalance: toNumberLoose(
        reserve.maticBalanceNumeric ?? reserve.maticBalance,
      ),
      biggiBalance: toNumberLoose(
        reserve.biggiBalanceNumeric ?? reserve.biggiBalance,
      ),
      waitingBiggi: toNumberLoose(
        reserve.waitingBiggiNumeric ?? reserve.waitingBiggi,
      ),
      dexRefillBiggi: toNumberLoose(
        reserve.dexRefillBiggiNumeric ?? reserve.dexRefillBiggi,
      ),
      totalMaticReceived: toNumberLoose(
        reserve.totalMaticReceivedNumeric ?? reserve.totalMaticReceived,
      ),
      liquidityManager: reserve.liquidityManager,
      reserveAddress: reserve.address,
      lpBalanceInVault: toNumberLoose(
        vault?.totalLpLockedNumeric ?? vault?.totalLpLocked,
      ),
      pairWhitelisted: vault?.pairWhitelisted ?? null,
    };
  }, [reserve, vault]);

  const lmView = React.useMemo(() => {
    if (!reserveView) return null;
    return {
      lpBalance: reserveView.lpBalanceInVault,
      reserveMatic: reserveView.maticBalance,
      reserveBiggi: reserveView.biggiBalance,
      waitingBiggi: reserveView.waitingBiggi,
      dexRefillBiggi: reserveView.dexRefillBiggi,
    };
  }, [reserveView]);

  const tokenBalances = tokenDex?.token?.balances || null;
  const lmChainBalances = React.useMemo(() => {
    if (!tokenBalances) return null;
    return {
      reserve: toNumberSafe(tokenBalances.reserve, tokenDecimals),
      liquidityManager: toNumberSafe(
        tokenBalances.liquidityManager,
        tokenDecimals,
      ),
      liquidityVault: toNumberSafe(
        tokenBalances.liquidityVault,
        tokenDecimals,
      ),
    };
  }, [tokenBalances, tokenDecimals]);

  const userRole = React.useMemo(
    () => chainStatus?.role || (chainStatus?.account ? "Connected" : "Viewer"),
    [chainStatus?.role, chainStatus?.account],
  );

  const warnings = React.useMemo(() => {
    const next = [];
    if (vault?.pairWhitelisted === false) {
      next.push("LP pair is not whitelisted.");
    }
    if (manager && !manager.router) {
      next.push("Router address missing.");
    }
    if (manager && !manager.factory) {
      next.push("Factory address missing.");
    }
    if (automation?.wiredOk === false) {
      next.push("Liquidity orchestrator wiring mismatch.");
    }
    if (branchReader?.isStale) {
      next.push("Legacy branch reader is wired to previous reserve/LM addresses.");
    }
    return next;
  }, [
    vault?.pairWhitelisted,
    manager?.router,
    manager?.factory,
    manager,
    automation?.wiredOk,
    branchReader?.isStale,
  ]);

  const resolvedLiquidityProps = React.useMemo(
    () =>
      liquidityProps || {
        liquidityHistory: liquidityHistoryBundle,
        reserve: reserveView,
        lmView,
        chainStatus,
        userRole,
        lmChainBalances,
        treasury,
        snapshotTsLabel: liquiditySnapshot?.tsLabel ?? null,
        lmTokenPct: automation?.lmTokenPct ?? null,
        lmSlippageBps: automation?.lmSlippageBps ?? null,
        lmDeadlineSec: automation?.lmDeadlineSec ?? null,
        lmKeeperAddress:
          manager?.keeper ??
          automation?.keeperAddr ??
          readerStatus?.res?.keeper ??
          null,
        lmAddress:
          manager?.address ??
          automation?.lmAddress ??
          readerStatus?.res?.liquidityManager ??
          reserve?.liquidityManager ??
          null,
        lmVaultAddress:
          vault?.address ??
          automation?.lmVault ??
          readerStatus?.res?.liquidityVault ??
          manager?.vault ??
          null,
        manager,
        automation,
        keeperProxy,
        branchReader,
        warnings,
      },
    [
      liquidityProps,
      liquidityHistoryBundle,
      reserveView,
      lmView,
      chainStatus,
      userRole,
      lmChainBalances,
      treasury,
      liquiditySnapshot?.tsLabel,
      automation?.keeperAddr,
      automation?.lmAddress,
      automation?.lmDeadlineSec,
      automation?.lmSlippageBps,
      automation?.lmTokenPct,
      automation?.lmVault,
      automation,
      branchReader,
      keeperProxy,
      readerStatus?.res?.keeper,
      readerStatus?.res?.liquidityManager,
      readerStatus?.res?.liquidityVault,
      reserve?.liquidityManager,
      manager?.address,
      manager,
      manager?.vault,
      manager?.keeper,
      vault?.address,
      warnings,
    ],
  );

  const dexLiquidityView = React.useMemo(() => {
    const dexLiquidity = liquiditySnapshot;
    if (!dexLiquidity) return null;
    return {
      reserveNative: toNumberLoose(dexLiquidity.reserveNative),
      reserveBiggi: toNumberLoose(dexLiquidity.reserveBiggi),
      waitingBiggi: reserveView?.waitingBiggi ?? null,
      dexRefillBiggi: reserveView?.dexRefillBiggi ?? null,
      lpTotalSupply: toNumberLoose(dexLiquidity.lpTotalSupply),
      nativePerBiggi:
        dexLiquidity.nativePerBiggi ??
        tokenDex?.derived?.priceNativePerToken ??
        null,
      biggiPerNative:
        dexLiquidity.biggiPerNative ??
        tokenDex?.derived?.priceTokenPerNative ??
        null,
      pairAddress:
        dexLiquidity.pairAddress ??
        tokenDex?.dex?.pair?.address ??
        tokenDex?.dex?.pairAddress ??
        null,
      contractEthBalance: dexLiquidity.contractEthBalance ?? null,
      tokenDecimals,
    };
  }, [
    liquiditySnapshot,
    reserveView?.waitingBiggi,
    reserveView?.dexRefillBiggi,
    tokenDex?.derived,
    tokenDex?.dex?.pair,
    tokenDex?.dex?.pairAddress,
    tokenDecimals,
  ]);

  const resolvedDexProps = React.useMemo(
    () =>
      dexProps || {
        tabBusy: dexLoading,
        error: dexError,
        onRefresh: onDexRefresh,
        pumpView,
        liquidity: dexLiquidityView,
        dexHistory,
        tok: tok || tokenDex?.token,
        router: router || tokenDex?.dex?.router,
        tokenDexSnapshot: tokenDex || null,
        readerStatus,
      },
    [
      dexProps,
      dexLoading,
      dexError,
      onDexRefresh,
      pumpView,
      dexLiquidityView,
      dexHistory,
      tok,
      router,
      tokenDex,
      readerStatus,
    ],
  );

  if (resolved === "dex") {
    return <TokenDexTab {...resolvedDexProps} />;
  }

  return <LiquidityTab {...resolvedLiquidityProps} />;
}

export default React.memo(TokenomicsPanel);
