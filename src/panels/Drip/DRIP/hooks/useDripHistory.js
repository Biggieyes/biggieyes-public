import * as React from "react";
import { mapDRIPHistoryToChartPoints } from "../../../../services/tokenomics/DRIP.mappers";

const HISTORY_LIMIT = 20;

export default function useDRIPHistory(snapshot) {
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

  const availableSeries = React.useMemo(
    () =>
      mapDRIPHistoryToChartPoints(
        history,
        (entry) => entry?.distributor?.availableNumeric ?? null,
      ),
    [history],
  );
  const capSeries = React.useMemo(
    () =>
      mapDRIPHistoryToChartPoints(
        history,
        (entry) => entry?.distributor?.capRemainingNumeric ?? null,
      ),
    [history],
  );
  const nativeSeries = React.useMemo(
    () =>
      mapDRIPHistoryToChartPoints(
        history,
        (entry) => entry?.DRIPLM?.nativeBalanceNumeric ?? null,
      ),
    [history],
  );

  return { history, availableSeries, capSeries, nativeSeries };
}


