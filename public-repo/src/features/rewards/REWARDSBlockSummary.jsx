import * as React from "react";
import { Contract, parseEther } from "ethers";
import {
  ADDR,
  getROProvider,
  getTokenREWARDSRO,
} from "@/shared/utils/contract";
import { formatTokenDisplay } from "@/features/tokenomics/utils/amountFormatting.js";

const DEFAULT_WEIGHTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_UNIT_REWARD = parseEther("1");

const FALLBACK_ABI = [
  "function getBlockWeights() view returns (uint8[11])",
  "function unitReward() view returns (uint256)",
];

function normalizeBlockIdxFromName(value, blockNames = []) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();

  const directIndex = blockNames.findIndex(
    (name) => String(name || "").toUpperCase() === upper,
  );
  if (directIndex !== -1) return directIndex + 1;

  const partialIndex = blockNames.findIndex((name) =>
    upper.includes(String(name || "").toUpperCase()),
  );
  return partialIndex !== -1 ? partialIndex + 1 : null;
}

export default function REWARDSBlockSummary({
  items = [],
  blockNames = [],
  weights = DEFAULT_WEIGHTS,
}) {
  const [onChainWeights, setOnChainWeights] = React.useState(null);
  const [unitRewardWei, setUnitRewardWei] = React.useState(DEFAULT_UNIT_REWARD);
  const [providerError, setProviderError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let provider = null;
        try {
          provider = getROProvider();
        } catch {
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
          contract = new Contract(ADDR.TOKEN_REWARDS, FALLBACK_ABI, provider);
        }

        const [w, u] = await Promise.all([
          contract.getBlockWeights(),
          contract.unitReward(),
        ]);
        if (!mounted) return;

        setOnChainWeights(Array.from(w).map((n) => Number(n)));
        setUnitRewardWei(BigInt(u));
      } catch (err) {
        console.warn("REWARDSBlockSummary: on-chain load failed:", err);
        setProviderError(String(err?.message || err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = React.useMemo(() => {
    const arr = new Array(10).fill(0);

    const parseBlockIdx = (item = {}) => {
      const directBlock = normalizeBlockIdxFromName(
        item?.blockName || item?.dynamicTraits?.blockName,
        blockNames,
      );
      if (directBlock != null) return directBlock;

      const meta = item?.meta || {};
      const attrs = Array.isArray(meta?.attributes) ? meta.attributes : [];

      const blockIdAttr = attrs.find((a) =>
        ["block", "block id", "block/eye color"].includes(
          String(a?.trait_type || a?.traitType || "").toLowerCase(),
        ),
      );
      if (blockIdAttr?.value != null) {
        const numeric = Number(blockIdAttr.value);
        if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 10) {
          return numeric;
        }
        const named = normalizeBlockIdxFromName(blockIdAttr.value, blockNames);
        if (named != null) return named;
      }

      const eyeAttr = attrs.find((a) =>
        ["eye color", "eyes", "block/eye color"].includes(
          String(a?.trait_type || a?.traitType || "").toLowerCase(),
        ),
      );
      if (eyeAttr?.value != null) {
        return normalizeBlockIdxFromName(eyeAttr.value, blockNames);
      }

      return null;
    };

    for (const item of items) {
      if (!item || item.isTicket) continue;
      const idx = parseBlockIdx(item);
      if (idx && idx >= 1 && idx <= 10) arr[idx - 1] += 1;
    }

    return arr;
  }, [items, blockNames]);

  const effectiveWeights = React.useMemo(() => {
    if (Array.isArray(onChainWeights) && onChainWeights.length >= 11) {
      return onChainWeights;
    }
    return weights;
  }, [onChainWeights, weights]);

  const rows = React.useMemo(() => {
    return counts.map((count, i) => {
      const blockIdx = i + 1;
      const weight = Number(effectiveWeights[blockIdx] ?? blockIdx);
      const units = count * weight;
      const biggiWei = BigInt(unitRewardWei) * BigInt(units);
      return {
        name: blockNames[i] || `Block ${blockIdx}`,
        count,
        weight,
        units,
        biggiWei,
        biggiDisplay: formatTokenDisplay(biggiWei, 18, 4, "BIGGI"),
      };
    });
  }, [counts, effectiveWeights, unitRewardWei, blockNames]);

  const totals = React.useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.count += row.count;
          acc.units += row.units;
          acc.biggiWei += row.biggiWei;
          return acc;
        },
        { count: 0, units: 0, biggiWei: 0n },
      ),
    [rows],
  );

  return (
    <div style={{ width: "100%" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          overflow: "hidden",
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
          {rows.map((row, index) => (
            <tr
              key={row.name}
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
                {row.name}
              </td>
              <td style={tdStyle}>{row.count}</td>
              <td style={tdStyle}>{row.weight}</td>
              <td
                style={{
                  ...tdStyle,
                  color: "#5ddcff",
                  fontWeight: 800,
                  textShadow: "0 0 8px #5ddcff44",
                }}
              >
                {row.biggiDisplay === "--" ? "-" : row.biggiDisplay}
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
              {formatTokenDisplay(totals.biggiWei, 18, 4, "BIGGI")}
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
        * Uses on-chain block weights and unit reward when available. Falls back
        to local defaults otherwise.
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
