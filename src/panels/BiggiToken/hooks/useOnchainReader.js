import * as React from "react";
import { Contract } from "ethers";
import { formatEther, formatUnits } from "ethers/lib.esm/utils.js";
import { ADDR, getROProvider } from "../../../utils/contract";
import { BiggiTreasuryReader as ABI_TREASURY_READER } from "../../../config/abi/index.js";

const SUMMARY_ABI = [
  "function simpleSummary() view returns (uint256 biggiHeld, uint256 maticHeld)",
];

const initialState = {
  biggi: null,
  matic: null,
  loading: false,
  error: null,
};

function useSummary(address, abi = SUMMARY_ABI) {
  const [state, setState] = React.useState(initialState);

  React.useEffect(() => {
    let cancelled = false;
    if (!address) {
      setState((prev) => ({ ...prev, loading: false }));
      return () => {
        cancelled = true;
      };
    }

    async function fetchSummary() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const provider = getROProvider();
        const reader = new Contract(address, abi, provider);
        const summary = await reader.simpleSummary();
        if (cancelled) return;
        setState({
          biggi: Number(formatUnits(summary.biggiHeld, 18)),
          matic: Number(formatEther(summary.maticHeld)),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || String(err),
        }));
      }
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [address, abi]);

  return state;
}

export default function useOnchainReader() {
  const buyback = useSummary(ADDR.BUYBACK_READER, SUMMARY_ABI);
  const drip = useSummary(ADDR.DRIP_READER, SUMMARY_ABI);
  const treasury = useSummary(
    ADDR.TREASURY_READER,
    ABI_TREASURY_READER || SUMMARY_ABI,
  );

  return { buyback, drip, treasury };
}
