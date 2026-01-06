import * as React from "react";
import { mapHistoryToChartPoints } from "../../services/tokenomics/liquidity.mappers";

const HISTORY_LIMIT = 16;

export default function useLiquidityHistory(snapshot) {
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

  const chartPoints = React.useMemo(
    () => mapHistoryToChartPoints(history),
    [history],
  );

  return { history, chartPoints };
}
