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
  pumpView,
  tok,
  router,
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
    if (manager && !manager.routerAddress) {
      next.push("Router address missing.");
    }
    if (manager && !manager.factoryAddress) {
      next.push("Factory address missing.");
    }
    return next;
  }, [vault?.pairWhitelisted, manager?.routerAddress, manager?.factoryAddress, manager]);

  const resolvedLiquidityProps = React.useMemo(
    () =>
      liquidityProps || {
        liquidityHistory,
        reserve: reserveView,
        lmView,
        chainStatus,
        userRole,
        lmChainBalances,
        lmTokenPct: null,
        lmSlippageBps: null,
        lmDeadlineSec: null,
        lmKeeperAddress: null,
        lmAddress: manager?.address ?? null,
        lmVaultAddress: vault?.address ?? null,
        warnings,
      },
    [
      liquidityProps,
      liquidityHistory,
      reserveView,
      lmView,
      chainStatus,
      userRole,
      lmChainBalances,
      manager?.address,
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
  }, [liquiditySnapshot, tokenDex?.derived, tokenDex?.dex?.pair, tokenDex?.dex?.pairAddress, tokenDecimals]);

  const resolvedDexProps = React.useMemo(
    () =>
      dexProps || {
        pumpView,
        liquidity: dexLiquidityView,
        dexHistory,
        tok: tok || tokenDex?.token,
        router: router || tokenDex?.dex?.router,
        tokenDexSnapshot: tokenDex || null,
      },
    [
      dexProps,
      pumpView,
      dexLiquidityView,
      dexHistory,
      tok,
      router,
      tokenDex,
    ],
  );

  if (resolved === "dex") {
    return <TokenDexTab {...resolvedDexProps} />;
  }

  return <LiquidityTab {...resolvedLiquidityProps} />;
}

export default React.memo(TokenomicsPanel);
