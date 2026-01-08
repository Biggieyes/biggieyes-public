import * as React from "react";

export function useTokenPanelLoader({
  isTokenPanelOpen,
  onRefreshTokenMeta,
  onRefreshRouterInfo,
  onRefreshLiquidityPreview,
  onRefreshBUYBACKInfo,
  fetchReserveInfo,
  fetchTreasuryInfo,
}) {
  React.useEffect(() => {
    if (!isTokenPanelOpen) return undefined;
    let cancelled = false;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const loadTokenSuite = async () => {
      try {
        await onRefreshTokenMeta();
        if (cancelled) return;
        const tasks = [
          onRefreshRouterInfo,
          onRefreshLiquidityPreview,
          onRefreshBUYBACKInfo,
          fetchReserveInfo,
          fetchTreasuryInfo,
        ];
        for (const task of tasks) {
          if (cancelled) return;
          try {
            await task();
          } catch {
            // ignore individual refresh failures
          }
          if (cancelled) return;
          await wait(200); // soften burst to avoid RPC 429s
        }
      } catch (err) {
        console.error("init BiggiToken data", err);
      }
    };
    loadTokenSuite();
    return () => {
      cancelled = true;
    };
  }, [
    isTokenPanelOpen,
    onRefreshTokenMeta,
    onRefreshRouterInfo,
    onRefreshLiquidityPreview,
    onRefreshBUYBACKInfo,
    fetchReserveInfo,
    fetchTreasuryInfo,
  ]);
}


