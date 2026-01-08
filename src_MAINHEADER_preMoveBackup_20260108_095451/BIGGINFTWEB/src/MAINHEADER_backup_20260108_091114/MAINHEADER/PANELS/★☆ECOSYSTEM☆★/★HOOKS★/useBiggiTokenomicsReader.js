// src/HOOKS/useBiggiTokenomicsReader.js
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getBiggiTokenomicsReaderRO } from "../utils/contract.js";
import { getFullStatusSafe } from "../utils/tokenomicsFullStatus.js";
import { canPoll, getPollInterval } from "../utils/polling.js";

const POLL_INTERVAL_MS = getPollInterval(20_000, "VITE_TOKENOMICS_POLL_MS");

function toEther(bn) {
  try {
    return formatEther(bn || 0);
  } catch {
    return "0";
  }
}

function normalizeFullStatus(raw) {
  if (!raw) return null;
  const [core, dist, buy, res, DRIP, tr] = Array.isArray(raw)
    ? raw
    : [raw.core, raw.dist, raw.buy, raw.res, raw.DRIP, raw.tr];
  return {
    core,
    dist,
    buy,
    res,
    DRIP,
    tr,
    derived: {
      priceNativePerBiggi: core?.nativePerBiggi
        ? toEther(core.nativePerBiggi)
        : null,
      priceBiggiPerNative: core?.biggiPerNative
        ? toEther(core.biggiPerNative)
        : null,
      reserveBiggi: core?.reserveBiggi ? toEther(core.reserveBiggi) : null,
      reserveNative: core?.reserveNative ? toEther(core.reserveNative) : null,
      DRIPAvailable: DRIP?.availableTokens
        ? toEther(DRIP.availableTokens)
        : null,
      tokenREWARDSBalance: tr?.balance ? toEther(tr.balance) : null,
      tokenREWARDSCap: tr?.REWARDSCap ? toEther(tr.REWARDSCap) : null,
    },
  };
}

export default function useBiggiTokenomicsReader() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const reader = React.useRef(null);
  const inFlightRef = React.useRef(false);

  React.useEffect(() => {
    reader.current = null;
    try {
      reader.current = getBiggiTokenomicsReaderRO();
    } catch (e) {
      console.warn("Cannot create reader RO:", e.message || e);
    }
    // ...existing code...
  }, []);

  return { loading, error, status };
}




