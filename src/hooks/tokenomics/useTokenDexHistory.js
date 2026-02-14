import * as React from "react";
import useHistoryBuffer from "./_useHistoryBuffer";
import { toNumberSafe } from "./_utils";

export default function useTokenDexHistory(snapshot, options = {}) {
  const { limit = 30, tokenDecimals } = options;
  const { history } = useHistoryBuffer(snapshot, { limit });

  const resolvedTokenDecimals = React.useMemo(() => {
    if (typeof tokenDecimals === "number") return tokenDecimals;
    if (typeof snapshot?.token?.decimals === "number") {
      return snapshot.token.decimals;
    }
    return 18;
  }, [tokenDecimals, snapshot?.token?.decimals]);

  const pricePoints = React.useMemo(
    () =>
      history
        .map((entry) => ({
          label: entry?.tsLabel || "",
          value:
            typeof entry?.derived?.priceNativePerToken === "number"
              ? entry.derived.priceNativePerToken
              : null,
        }))
        .filter((point) => Number.isFinite(point.value)),
    [history],
  );

  const reservePoints = React.useMemo(() => {
    return history
      .map((entry) => ({
        label: entry?.tsLabel || "",
        value: toNumberSafe(entry?.dex?.pair?.reserves?.native, 18),
        tokenValue: toNumberSafe(
          entry?.dex?.pair?.reserves?.token,
          resolvedTokenDecimals,
        ),
      }))
      .filter((point) => Number.isFinite(point.value));
  }, [history, resolvedTokenDecimals]);

  const lpPoints = React.useMemo(
    () =>
      history
        .map((entry) => ({
          label: entry?.tsLabel || "",
          value: toNumberSafe(entry?.dex?.pair?.lpTotalSupply, 18),
        }))
        .filter((point) => Number.isFinite(point.value)),
    [history],
  );

  return {
    history,
    pricePoints,
    reservePoints,
    lpPoints,
  };
}
