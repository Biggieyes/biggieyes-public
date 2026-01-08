import * as React from "react";
import { mapBuybackHistoryToChartPoints } from "../../services/tokenomics/buybackTreasury.mappers";

const HISTORY_LIMIT = 24;

export default function useBuybackTreasuryHistory(snapshot) {
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
      mapBuybackHistoryToChartPoints(
        history,
        (entry) => entry?.buyback?.totalNativeSpentNumeric ?? null,
      ),
    [history],
  );
  const biggiSeries = React.useMemo(
    () =>
      mapBuybackHistoryToChartPoints(
        history,
        (entry) => entry?.buyback?.totalBiggiAcquiredNumeric ?? null,
      ),
    [history],
  );
  const treasurySeries = React.useMemo(
    () =>
      mapBuybackHistoryToChartPoints(
        history,
        (entry) => entry?.treasury?.biggiBalanceNumeric ?? null,
      ),
    [history],
  );

  return { history, nativeSeries, biggiSeries, treasurySeries };
}
