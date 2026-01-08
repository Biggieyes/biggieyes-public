// src/hooks/useBiggiToken.js
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getTokenRO } from "../utils/contract";
import { getCached } from "../utils/fetchCache";

function toNumber(value) {
  if (value == null) return 0;
  try {
    return Number(value?.toString?.() ?? value);
  } catch {
    return 0;
  }
}

export default function useBiggiToken(walletAddress = "") {
  const [data, setData] = React.useState({
    address: null,
    name: "",
    symbol: "",
    decimals: 18,
    totalSupply: "0",
    cap: "0",
    remainingMintable: "0",
    reserveAddr: null,
    tokenRewardsAddr: null,
    dripDistributorAddr: null,
    rewardsOperator: null,
    distributed: false,
    paused: false,
    owner: null,
    balance: "0",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(
    async (options = {}) => {
      setLoading(true);
      setError(null);
      try {
        const contract = getTokenRO();
        if (!contract) throw new Error("Token contract not found");
        const cacheKey = `biggiToken:${contract.address}:${walletAddress || "anon"}`;
        // ...existing code...
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  return { data, loading, error, refresh };
}

