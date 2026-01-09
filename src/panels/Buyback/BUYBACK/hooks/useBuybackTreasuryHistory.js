import * as React from "react";
import { mapBUYBACKHistoryToChartPoints } from "../../../../services/tokenomics/BUYBACKTreasury.mappers";

const HISTORY_LIMIT = 24;

export default function useBUYBACKTreasuryHistory(snapshot) {
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    if (!snapshot) return;
    setHistory((previous) => {
      const last = previous[previous.length - 1];
      if (last && last.ts === snapshot.ts) return previous;
      const updated = [...previous, snapshot];
      return updated.slice(-HISTORY_LIMIT);
    });
  }, [snapshot]);

  const nativeSeries = React.useMemo(
    () =>
      mapBUYBACKHistoryToChartPoints(
        history,
        (entry) => entry?.BUYBACK?.totalNativeSpentNumeric ?? null,
      ),
    [history],
  );
  const biggiSeries = React.useMemo(
    () =>
      mapBUYBACKHistoryToChartPoints(
        history,
        (entry) => entry?.BUYBACK?.totalBiggiAcquiredNumeric ?? null,
      ),
    [history],
  );
  const treasurySeries = React.useMemo(
    () =>
      mapBUYBACKHistoryToChartPoints(
        history,
        (entry) => entry?.treasury?.biggiBalanceNumeric ?? null,
      ),
    [history],
  );

  return { history, nativeSeries, biggiSeries, treasurySeries };
}


