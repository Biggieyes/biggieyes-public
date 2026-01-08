// src/components/REWARDSBlockSummary.jsx
import * as React from "react";
import { parseEther, Contract, formatEther } from "ethers";
import { ADDR, getROProvider, getTokenREWARDSRO } from "../../../utils/contract";

const DEFAULT_WEIGHTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // index = blockIdx (1..10)
const DEFAULT_UNIT_REWARD = parseEther("1"); // 1 BIGGI (wei)

const FALLBACK_ABI = [
  "function getBlockWeights() view returns (uint8[11])",
  "function unitReward() view returns (uint256)",
];

export default function REWARDSBlockSummary({
  items = [],
  blockNames = [],
  weights = DEFAULT_WEIGHTS,
}) {
  const [onChainWeights, setOnChainWeights] = React.useState(null); // array number[11]
  const [unitRewardWei, setUnitRewardWei] = React.useState(DEFAULT_UNIT_REWARD);
  const [providerError, setProviderError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // provider: use shared RO provider (injected or RPC fallback)
        let provider = null;
        try {
          provider = getROProvider();
        } catch (err) {
          provider = null;
        }
        if (!provider) {
          setProviderError("Read-only provider not available");
          return;
        }

        let contract = null;
        try {
          contract = getTokenREWARDSRO(provider);
        } catch {
          if (!ADDR?.TOKEN_REWARDS) return;
          contract = new Contract(
            ADDR.TOKEN_REWARDS,
            FALLBACK_ABI,
            provider,
          );
        }
        // Load weights and unit reward
        const w = await contract.getBlockWeights();
        const u = await contract.unitReward();
        if (!mounted) return;

        // convert uint8[11] to JS number array
        const wnums = Array.from(w).map((n) => Number(n));
        setOnChainWeights(wnums);
        setUnitRewardWei(BigInt(u));
      } catch (err) {
        // pokud cokoliv selže, nech fallback (props.weights)
        console.warn("REWARDSBlockSummary: on-chain load failed:", err);
        setProviderError(String(err?.message || err));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // spočítej, kolik Biggi NFT (ne tikety) má uživatel v jednotlivých blocích (1..10)
  const counts = React.useMemo(() => {
    const arr = new Array(10).fill(0);

    const parseBlockIdx = (meta = {}) => {
      const attrs = Array.isArray(meta.attributes) ? meta.attributes : [];
      const blockIdAttr = attrs.find((a) =>
        ["block", "block id", "block id", "block/eye color"].includes(
          String(a?.trait_type || a?.traitType || "").toLowerCase(),
        ),
      );
      if (blockIdAttr && !Number.isNaN(Number(blockIdAttr.value))) {
        const n = Number(blockIdAttr.value);
        if (n >= 1 && n <= 10) return n;
      }
      const eyeAttr = attrs.find((a) =>
        ["eye color", "eyes", "block/eye color"].includes(
          String(a?.trait_type || a?.traitType || "").toLowerCase(),
        ),
      );
      if (eyeAttr?.value) {
        const name = String(eyeAttr.value).trim().toUpperCase();
        const i = blockNames.findIndex((n) => String(n).toUpperCase() === name);
        if (i !== -1) return i + 1;
      }
      return null;
    };

    for (const it of items) {
      if (!it || it.isTicket) continue; // počítáme jen NFT, ne tikety
      const idx = parseBlockIdx(it.meta || {});
      if (idx && idx >= 1 && idx <= 10) arr[idx - 1] += 1;
    }
    return arr;
  }, [items, blockNames]);

  // vybereme váhy: on-chain pokud dostupné, jinak props
  const effectiveWeights = React.useMemo(() => {
    if (Array.isArray(onChainWeights) && onChainWeights.length >= 11) {
      // contract returns index 0..10, we use 1..10 (index 0 is placeholder)
      return onChainWeights;
    }
    return weights;
  }, [onChainWeights, weights]);

  // rows a totals (biggi počítáme přes unitRewardWei)
  const rows = React.useMemo(() => {
    const rowsArr = counts.map((cnt, i) => {
      const blkIdx = i + 1;
      const weight = Number(effectiveWeights[blkIdx] ?? blkIdx);
      const units = cnt * weight;
      // biggi amount (string) = units * unitRewardWei (in wei) => formatEther
      const biggiWei = BigInt(unitRewardWei) * BigInt(units);
      const biggi = Number(formatEther(biggiWei)); // number for display
      return {
        name: blockNames[i] || `Block ${blkIdx}`,
        count: cnt,
        weight,
        units,
        biggi,
      };
    });
    return rowsArr;
  }, [counts, effectiveWeights, unitRewardWei, blockNames]);

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.count += r.count;
        acc.units += r.units;
        acc.biggi += r.biggi;
        return acc;
      },
      { count: 0, units: 0, biggi: 0 },
    );
  }, [rows]);

  return (
    <div style={{ width: "100%" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          overFLOW: "hidden",
          borderRadius: 12,
          border: "2px solid #ffe800",
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%), url("/images/widget-bg-dark.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 15px #ffe80055",
          fontFamily: "monospace",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>EYES COLOR</th>
            <th style={thStyle}>YOU OWN</th>
            <th style={thStyle}>WEIGHT</th>
            <th style={thStyle}>WEEKLY BIGGI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr
              key={r.name}
              style={{
                background:
                  index % 2 === 0
                    ? "rgba(255,232,0,0.05)"
                    : "rgba(255,232,0,0.02)",
                transition: "all 0.2s ease",
              }}
            >
              <td
                style={{
                  ...tdStyle,
                  fontWeight: 800,
                  color: "#ffe800",
                  textShadow: "0 0 8px #ffe80044",
                }}
              >
                {r.name}
              </td>
              <td style={tdStyle}>{r.count}</td>
              <td style={tdStyle}>{r.weight}</td>
              <td
                style={{
                  ...tdStyle,
                  color: "#5ddcff",
                  fontWeight: 800,
                  textShadow: "0 0 8px #5ddcff44",
                }}
              >
                {Number.isFinite(r.biggi) ? r.biggi : "-"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "rgba(255,232,0,0.1)" }}>
            <td
              style={{
                ...tdStyle,
                fontWeight: 900,
                color: "#ffe800",
                fontSize: "1.1em",
                borderTop: "2px solid #ffe800",
              }}
            >
              TOTAL
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: 800,
                fontSize: "1.1em",
                borderTop: "2px solid #ffe800",
              }}
            >
              {totals.count}
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: 800,
                fontSize: "1.1em",
                borderTop: "2px solid #ffe800",
              }}
            >
              {totals.units}
            </td>
            <td
              style={{
                ...tdStyle,
                fontWeight: 900,
                color: "#5ddcff",
                fontSize: "1.1em",
                borderTop: "2px solid #ffe800",
              }}
            >
              {Number.isFinite(totals.biggi) ? totals.biggi : "-"}
            </td>
          </tr>
        </tfoot>
      </table>
      <div
        style={{
          marginTop: 8,
          color: "#bbb",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        * Výpočet používá on-chain block weights & unit reward pokud jsou
        dostupné. Pokud ne, použije lokální fallback.
        {providerError ? ` (on-chain load error: ${providerError})` : null}
      </div>
    </div>
  );
}

const thStyle = {
  color: "#ffe800",
  fontWeight: "bold",
  textAlign: "center",
  fontSize: "0.95em",
  padding: "16px 10px",
  textTransform: "uppercase",
  textShadow: "1px 1px 3px #000, 0 0 10px #ffe80055",
  borderBottom: "2px solid #ffe800",
  background: "rgba(0,0,0,0.3)",
  letterSpacing: "0.5px",
};

const tdStyle = {
  color: "#fff",
  textAlign: "center",
  padding: "14px 10px",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
  fontSize: "0.95em",
  fontWeight: 600,
};




