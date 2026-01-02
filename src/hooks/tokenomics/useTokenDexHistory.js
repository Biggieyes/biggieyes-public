import * as React from "react";

const HISTORY_LIMIT = 24;

export default function useTokenDexHistory(snapshot) {
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

  return { history };
}
