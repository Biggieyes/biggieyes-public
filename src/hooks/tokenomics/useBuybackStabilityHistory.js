import * as React from "react";
import useHistoryBuffer from "./_useHistoryBuffer";

const toNumberLoose = (value) => {
  if (value == null) return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const normalizeSnapshot = (input) => {
  if (!input) return null;
  const drip = input?.dripSnapshot || input?.drip || input;
  const buyback = input?.buybackSnapshot || input?.buyback || input;
  return {
    ts: input?.ts ?? Date.now(),
    tsLabel: input?.tsLabel,
    DRIPDistributor: toNumberLoose(
      drip?.distributor?.tokenBalanceNumeric ?? drip?.distributor?.tokenBalance,
    ),
    DRIPLm: toNumberLoose(
      drip?.DRIPLM?.nativeBalanceNumeric ?? drip?.DRIPLM?.nativeBalance,
    ),
    BUYBACKAgent: toNumberLoose(
      buyback?.BUYBACK?.nativeBalanceNumeric ??
        buyback?.BUYBACK?.nativeBalance,
    ),
    treasury: toNumberLoose(
      buyback?.treasury?.maticBalanceNumeric ?? buyback?.treasury?.maticBalance,
    ),
  };
};

export default function useBUYBACKStabilityHistory(input, options = {}) {
  const { limit = 30 } = options;
  const normalized = React.useMemo(() => normalizeSnapshot(input), [input]);
  const { history } = useHistoryBuffer(normalized, { limit });

  const data = React.useMemo(
    () =>
      history.map((entry) => ({
        time: entry?.tsLabel || "",
        DRIPDistributor: entry?.DRIPDistributor ?? null,
        DRIPLm: entry?.DRIPLm ?? null,
        BUYBACKAgent: entry?.BUYBACKAgent ?? null,
        treasury: entry?.treasury ?? null,
      })),
    [history],
  );

  return { history, data };
}
