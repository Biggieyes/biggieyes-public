import * as React from "react";
import useHistoryBuffer from "./_useHistoryBuffer";
import { toNumberSafe } from "./_utils";

export default function useTokenDexHistory(snapshot, options = {}) {
  const { limit = 30, tokenDecimals, minIntervalMs = 0 } = options;
  const { history } = useHistoryBuffer(snapshot, { limit, minIntervalMs });

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

  const reserveBundle = React.useMemo(() => {
    const reservePoints = [];
    const dexSeries = [];

    for (const entry of history) {
      const label = entry?.tsLabel || "";
      const reserveNative = toNumberSafe(entry?.dex?.pair?.reserves?.native, 18);
      const reserveBiggi = toNumberSafe(
        entry?.dex?.pair?.reserves?.token,
        resolvedTokenDecimals,
      );
      const price =
        typeof entry?.derived?.priceNativePerToken === "number"
          ? entry.derived.priceNativePerToken
          : null;

      if (Number.isFinite(reserveNative)) {
        reservePoints.push({
          label,
          value: reserveNative,
          tokenValue: reserveBiggi,
        });
      }

      if (
        Number.isFinite(reserveNative) ||
        Number.isFinite(reserveBiggi) ||
        Number.isFinite(price)
      ) {
        dexSeries.push({
          time: label,
          reserveNative,
          reserveBiggi,
          price,
        });
      }
    }

    return { reservePoints, dexSeries };
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
    reservePoints: reserveBundle.reservePoints,
    lpPoints,
    dexSeries: reserveBundle.dexSeries,
  };
}
