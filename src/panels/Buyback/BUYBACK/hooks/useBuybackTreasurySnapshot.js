import * as React from "react";
import { fetchBUYBACKTreasurySnapshot } from "../../../../services/tokenomics/BUYBACKTreasury.reader";
import { mapBUYBACKSnapshotToUI } from "../../../../services/tokenomics/BUYBACKTreasury.mappers";
import { canPoll, getPollInterval } from "../../../../utils/polling";

const DEFAULT_POLL_INTERVAL = getPollInterval(15_000, "VITE_BUYBACK_POLL_MS");

export default function useBUYBACKTreasurySnapshot({
  chainId,
  provider,
  pollingInterval = DEFAULT_POLL_INTERVAL,
  enabled = true,
} = {}) {
  const [snapshot, setSnapshot] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const inFlightRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function refresh() {
      if (cancelled || inFlightRef.current) return;
      if (!canPoll()) return;
      inFlightRef.current = true;
      setLoading(true);
      try {
        const raw = await fetchBUYBACKTreasurySnapshot({ chainId, provider });
        if (!cancelled) {
          setSnapshot(mapBUYBACKSnapshotToUI(raw));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setLoading(false);
      }
    }

    refresh();
    const handle = setInterval(refresh, pollingInterval);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [chainId, provider, pollingInterval, enabled]);

  return { snapshot, loading, error };
}


