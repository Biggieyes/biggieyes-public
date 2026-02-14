import * as React from "react";

/**
 * Minimal status provider for Ecosystem panels.
 * Phase-B: returns stable shape; real on-chain reading can be layered later.
 */
export default function useBiggiTokenomicsReader() {
  const status = React.useMemo(() => ({
    derived: {},
    ok: true,
  }), []);

  return { status, loading: false, error: null, refresh: async () => status };
}
