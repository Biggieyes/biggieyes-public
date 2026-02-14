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

export default function TokenomicsPanel({
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

  if (resolved === "dex") {
    const dexLiquidity = liquidity || null;
    const tokenDecimals =
      typeof tokenDex?.token?.decimals === "number"
        ? tokenDex.token.decimals
        : 18;
    const liquidityView = dexLiquidity
      ? {
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
        }
      : null;

    const resolvedDexProps =
      dexProps || {
        pumpView,
        liquidity: liquidityView,
        dexHistory,
        tok: tok || tokenDex?.token,
        router: router || tokenDex?.dex?.router,
        tokenDexSnapshot: tokenDex || null,
      };

    return <TokenDexTab {...resolvedDexProps} />;
  }

  const reserve = liquidity?.reserve || null;
  const manager = liquidity?.manager || null;
  const vault = liquidity?.vault || null;

  const reserveView = reserve
    ? {
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
      }
    : null;

  const lmView = reserveView
    ? {
        lpBalance: reserveView.lpBalanceInVault,
        reserveMatic: reserveView.maticBalance,
        reserveBiggi: reserveView.biggiBalance,
        dexRefillBiggi: reserveView.dexRefillBiggi,
      }
    : null;

  const tokenDecimals =
    typeof tokenDex?.token?.decimals === "number" ? tokenDex.token.decimals : 18;
  const tokenBalances = tokenDex?.token?.balances || null;
  const lmChainBalances = tokenBalances
    ? {
        reserve: toNumberSafe(tokenBalances.reserve, tokenDecimals),
        liquidityManager: toNumberSafe(
          tokenBalances.liquidityManager,
          tokenDecimals,
        ),
        liquidityVault: toNumberSafe(
          tokenBalances.liquidityVault,
          tokenDecimals,
        ),
      }
    : null;

  const userRole =
    chainStatus?.role || (chainStatus?.account ? "Connected" : "Viewer");

  const warnings = [];
  if (vault?.pairWhitelisted === false) {
    warnings.push("LP pair is not whitelisted.");
  }
  if (manager && !manager.routerAddress) {
    warnings.push("Router address missing.");
  }
  if (manager && !manager.factoryAddress) {
    warnings.push("Factory address missing.");
  }

  const resolvedLiquidityProps =
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
    };

  return <LiquidityTab {...resolvedLiquidityProps} />;
}
