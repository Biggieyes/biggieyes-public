import { toNumberSafe } from "../../../hooks/tokenomics/_utils.js";
import { ADDR } from "../../../shared/utils/addresses.js";

const MISSING_DISPLAY = new Set(["", "--", "N/A", "NaN"]);

const hasDisplayValue = (value) => {
  if (value == null) return false;
  const text = String(value).trim();
  return text ? !MISSING_DISPLAY.has(text) : false;
};

const formatAmount = (value, maximumFractionDigits = 2) => {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", { maximumFractionDigits });
};

const shortAddress = (address) => {
  if (!address || typeof address !== "string") return "--";
  return address.length <= 10
    ? address
    : `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export default function resolveBuybackSnapshot(
  buybackSnapshot,
  { flowSnapshot, liquiditySnapshot, tokenDexSnapshot } = {},
) {
  const tokenDecimals =
    tokenDexSnapshot?.token?.decimals ?? flowSnapshot?.tokenMeta?.decimals ?? 18;

  const treasuryAddress =
    buybackSnapshot?.treasury?.address ||
    flowSnapshot?.addresses?.treasury ||
    liquiditySnapshot?.treasury?.address ||
    ADDR.TREASURY ||
    null;

  const treasuryBiggiNumeric =
    buybackSnapshot?.treasury?.biggiBalanceNumeric ??
    tokenDexSnapshot?.token?.balances?.treasuryNumeric ??
    toNumberSafe(liquiditySnapshot?.treasury?.tokenBalance, tokenDecimals) ??
    toNumberSafe(flowSnapshot?.liveBalances?.token?.treasury, tokenDecimals);

  const treasuryNativeNumeric =
    buybackSnapshot?.treasury?.maticBalanceNumeric ??
    toNumberSafe(liquiditySnapshot?.treasury?.nativeBalance, 18) ??
    toNumberSafe(flowSnapshot?.liveBalances?.native?.treasury, 18);

  const hasResolvedTreasury =
    Boolean(treasuryAddress) ||
    Number.isFinite(treasuryBiggiNumeric) ||
    Number.isFinite(treasuryNativeNumeric);

  if (!buybackSnapshot && !hasResolvedTreasury) {
    return null;
  }

  const ts =
    buybackSnapshot?.ts ??
    flowSnapshot?.ts ??
    liquiditySnapshot?.ts ??
    tokenDexSnapshot?.ts ??
    Date.now();

  return {
    ...(buybackSnapshot || {}),
    ts,
    tsLabel:
      buybackSnapshot?.tsLabel ||
      new Date(ts).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    treasury: {
      ...(buybackSnapshot?.treasury || {}),
      address: treasuryAddress,
      shortAddress: hasDisplayValue(buybackSnapshot?.treasury?.shortAddress)
        ? buybackSnapshot.treasury.shortAddress
        : shortAddress(treasuryAddress),
      biggiBalanceNumeric: treasuryBiggiNumeric,
      biggiBalance: hasDisplayValue(buybackSnapshot?.treasury?.biggiBalance)
        ? buybackSnapshot.treasury.biggiBalance
        : formatAmount(treasuryBiggiNumeric),
      maticBalanceNumeric: treasuryNativeNumeric,
      maticBalance: hasDisplayValue(buybackSnapshot?.treasury?.maticBalance)
        ? buybackSnapshot.treasury.maticBalance
        : formatAmount(treasuryNativeNumeric),
      totalMaticReceived: hasDisplayValue(
        buybackSnapshot?.treasury?.totalMaticReceived,
      )
        ? buybackSnapshot.treasury.totalMaticReceived
        : "--",
    },
  };
}
