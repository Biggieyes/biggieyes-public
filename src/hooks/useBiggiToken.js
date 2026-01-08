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

        const snapshot = await getCached(
          cacheKey,
          async () => {
            let name = "";
            let symbol = "";
            let decimals = 18;
            try {
              const meta = await contract.tokenMeta?.();
              if (meta) {
                name = meta.name_ ?? meta[0] ?? "";
                symbol = meta.symbol_ ?? meta[1] ?? "";
                decimals = toNumber(meta.decimals_ ?? meta[2] ?? 18) || 18;
              }
            } catch {
              // fallback to direct getters below
            }

            const [
              nameRaw,
              symbolRaw,
              decimalsRaw,
              totalSupply,
              cap,
              remainingMintable,
              reserveAddr,
              tokenRewardsAddr,
              dripDistributorAddr,
              rewardsOperator,
              distributed,
              paused,
              owner,
            ] = await Promise.all([
              name ? Promise.resolve(name) : contract.name?.().catch(() => ""),
              symbol
                ? Promise.resolve(symbol)
                : contract.symbol?.().catch(() => ""),
              name || symbol
                ? Promise.resolve(decimals)
                : contract.decimals?.().catch(() => 18),
              contract.totalSupply?.().catch(() => 0n),
              contract.CAP?.().catch(() => 0n),
              contract.remainingMintable?.().catch(() => 0n),
              contract.reserveAddr?.().catch(() => null),
              contract.tokenRewardsAddr?.().catch(() => null),
              contract.dripDistributorAddr?.().catch(() => null),
              contract.rewardsOperator?.().catch(() => null),
              contract.distributed?.().catch(() => false),
              contract.paused?.().catch(() => false),
              contract.owner?.().catch(() => null),
            ]);

            const finalDecimals = toNumber(decimalsRaw) || decimals || 18;
            const fmt = (v) => {
              try {
                return ethers.utils.formatUnits(v ?? 0, finalDecimals);
              } catch {
                return "0";
              }
            };

            let balance = "0";
            if (walletAddress) {
              try {
                const bal = await contract.balanceOf(walletAddress);
                balance = fmt(bal);
              } catch {
                balance = "0";
              }
            }

            return {
              address: contract.address,
              name: nameRaw || "",
              symbol: symbolRaw || "",
              decimals: finalDecimals,
              totalSupply: fmt(totalSupply),
              cap: fmt(cap),
              remainingMintable: fmt(remainingMintable),
              reserveAddr: reserveAddr || null,
              tokenRewardsAddr: tokenRewardsAddr || null,
              dripDistributorAddr: dripDistributorAddr || null,
              rewardsOperator: rewardsOperator || null,
              distributed: Boolean(distributed),
              paused: Boolean(paused),
              owner: owner || null,
              balance,
            };
          },
          { force: options?.force === true },
        );

        setData(snapshot);
      } catch (e) {
        console.error("useBiggiToken.refresh", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

