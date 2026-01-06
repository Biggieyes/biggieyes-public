// src/hooks/useBiggiTokenomicsReader.js
import * as React from "react";
import { ethers } from "ethers";
import { getBiggiTokenomicsReaderRO } from "../utils/contract";
import { getFullStatusSafe } from "../utils/tokenomicsFullStatus.js";
import { canPoll, getPollInterval } from "../utils/polling";

const POLL_INTERVAL_MS = getPollInterval(20_000, "VITE_TOKENOMICS_POLL_MS");

function toEther(bn) {
  try {
    return ethers.utils.formatEther(bn || 0);
  } catch {
    return "0";
  }
}

function normalizeFullStatus(raw) {
  if (!raw) return null;
  const [core, dist, buy, res, drip, tr] = Array.isArray(raw)
    ? raw
    : [raw.core, raw.dist, raw.buy, raw.res, raw.drip, raw.tr];
  return {
    core,
    dist,
    buy,
    res,
    drip,
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
      dripAvailable: drip?.availableTokens
        ? toEther(drip.availableTokens)
        : null,
      tokenRewardsBalance: tr?.balance ? toEther(tr.balance) : null,
      tokenRewardsCap: tr?.rewardsCap ? toEther(tr.rewardsCap) : null,
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
      reader.current = null;
      setError(e);
    }
  }, []);

  React.useEffect(() => {
    if (!reader.current) return;
    let cancelled = false;

    async function loadAll() {
      if (!reader.current || cancelled) return;
      if (!canPoll() || inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const snap = await getFullStatusSafe(reader.current);
        if (!cancelled) {
          setStatus(normalizeFullStatus(snap));
        }
      } catch (e) {
        console.error("useBiggiTokenomicsReader loadAll failed", e);
        if (!cancelled) setError(e);
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    const t = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return {
    loading,
    error,
    status,
    refresh: async () => {
      if (!reader.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const snap = await getFullStatusSafe(reader.current);
        setStatus(normalizeFullStatus(snap));
      } catch (e) {
        setError(e);
      } finally {
        inFlightRef.current = false;
      }
    },
  };
}
