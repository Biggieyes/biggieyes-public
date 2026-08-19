import * as React from "react";
import {
  BACKGROUND_BONUS_PCT,
  BACKGROUND_GROWTH_PCT,
  BASE_PRICES,
  DEFAULT_BLOCKS,
  MAX_SUPPLY_BY_BLOCK,
} from "@/shared/blocks";
import "./BackgroundsWidget.css";
import "./InfoTables.css";

// Constants
const MOBILE_BREAKPOINT = 700;
const ANIMATION_DURATION = 2.8;

const BLOCK_COLORS = {
  ORANGE: "#ff9000",
  BLACK: "#222222",
  WHITE: "#ffffff",
  BROWN: "#A0522D",
  BLUE: "#0093ff",
  GREEN: "#39c048",
  VIOLET: "#9256d9",
  RED: "#e34e4e",
  PINK: "#ff63c2",
  RAINBOW: "linear-gradient(90deg,#ff3,#0ff,#9f3,#f0f,#3cf,#f66,#ffe800)",
};

const getBlockColor = (name) => {
  const upperName = String(name || "").toUpperCase();
  let textColor = upperName === "WHITE" ? "#111" : "#fff";
  if (upperName === "RAINBOW") textColor = "#fff";
  return {
    background: BLOCK_COLORS[upperName] || "#ffe800",
    color: textColor,
    fontWeight: "bold",
    border: "2px solid #ffe800",
    boxShadow:
      upperName === "RAINBOW" ? "0 0 14px #ffe80055" : "0 0 7px #ffe80050",
    textShadow:
      upperName === "RAINBOW" ? "0 1px 4px #fff9, 0 0 8px #ffe80044" : "none",
    borderRadius: 8,
    padding: "6px 4px",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "all 0.3s ease",
    minWidth: "80px",
  };
};

const cellBase = {
  textAlign: "center",
  padding: "6px 4px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  textShadow: "none",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const priceStyle = {
  ...cellBase,
  color: "#5ddcff",
  textShadow: "0 0 5px #5ddcff55",
};
const priceStyleWhite = {
  ...cellBase,
  color: "#ffffff",
  textShadow: "0 0 5px #ffffff33",
};
const mintedStyle = {
  ...cellBase,
  color: "#ff6b6b",
  textShadow: "0 0 5px #ff6b6b55",
};
const maxSupplyStyle = {
  ...cellBase,
  color: "#ffffff",
  textShadow: "0 0 5px #ffffff33",
};
const linkedBlockStyle = {
  ...cellBase,
  color: "#ffffff",
  textShadow: "0 0 5px #ffffff33",
};

const pretty = (upper) => upper.charAt(0) + upper.slice(1).toLowerCase();

const fmt2 = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("cs-CZ", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)
    : "--";

const finiteNumber = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const BackgroundsWidget = ({
  blockNames = [],
  backgroundMintCounts = [],
  blockPrices = [],
  lastRedeemedTokenId = "",
  lastRedeemedBlock = "",
  lastRedeemedBackground = "",
  onBack,
}) => {
  const [infoVisible, setInfoVisible] = React.useState(false);

  const [isPhone, setIsPhone] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
      : false,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e) => setIsPhone(e.matches);
    try {
      mq.addEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
    }
    return () => {
      try {
        mq.removeEventListener("change", onChange);
      } catch {
        mq.removeListener(onChange);
      }
    };
  }, []);

  const { countByName, priceByName, maxSupplyByName, normalizedNames } =
    React.useMemo(() => {
      const namesUC = (
        Array.isArray(blockNames) && blockNames.length
          ? blockNames
          : DEFAULT_BLOCKS
      )
        .map((n) =>
          String(n || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean);
      const countMap = {};
      const priceMap = {};
      const supplyMap = {};
      namesUC.forEach((N, i) => {
        countMap[N] = finiteNumber(backgroundMintCounts[i]);
        priceMap[N] = finiteNumber(blockPrices[i]);
        supplyMap[N] = finiteNumber(MAX_SUPPLY_BY_BLOCK[N]);
      });
      return {
        countByName: countMap,
        priceByName: priceMap,
        maxSupplyByName: supplyMap,
        normalizedNames: namesUC,
      };
    }, [blockNames, backgroundMintCounts, blockPrices]);

  const headerTitles = [
    "Background",
    "Minted",
    "Linked Block",
    "BG Bonus",
    "Block Growth",
    "Max Supply",
    "Block Price Delta",
  ];

  const normalizedLastBlock = String(lastRedeemedBlock || "")
    .trim()
    .toUpperCase();
  const normalizedLastBg = String(lastRedeemedBackground || "")
    .trim()
    .toUpperCase();
  const normalizedLastTokenRaw = String(lastRedeemedTokenId || "").trim();
  const normalizedLastToken =
    normalizedLastTokenRaw === "-" ? "" : normalizedLastTokenRaw;

  const headerLastRedeemedId = normalizedLastToken
    ? `NFT #${normalizedLastToken} (${normalizedLastBlock || "-"}/${normalizedLastBg || "-"})`
    : "";
  const headerLastRedeemedLabel = headerLastRedeemedId
    ? `Last redeem: ${headerLastRedeemedId}`
    : "";

  const getRowBaseBackground = React.useCallback((index, isLastRedeemed) => {
    if (isLastRedeemed) {
      return "linear-gradient(135deg, rgba(109,255,138,0.24), rgba(71,255,154,0.12))";
    }
    return index % 2 === 0 ? "rgba(255,232,0,0.05)" : "rgba(255,232,0,0.02)";
  }, []);

  return (
    <div className="bgw-container">
      <div className="bgw-header">
        <span className="bgw-header-text">BACKGROUND COLOR</span>
        {headerLastRedeemedId ? (
          <span className="bgw-header-last-id" title={headerLastRedeemedLabel}>
            {headerLastRedeemedId}
          </span>
        ) : null}
        <button
          className={`bgw-info-button ${isPhone ? "bgw-info-button--phone" : ""}`}
          onClick={() => setInfoVisible(!infoVisible)}
          aria-label="Toggle background information"
        >
          i
        </button>
      </div>

      <div className="bgw-table-wrapper">
        <table className="bgw-head">
          <thead>
            <tr>
              {headerTitles.map((title, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === headerTitles.length - 1;
                return (
                  <th
                    key={title}
                    className={isLast ? "no-sweep" : undefined}
                    style={{
                      color: "#9ee5ff",
                      borderRight:
                        idx === headerTitles.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.08)",
                      borderTopLeftRadius: isFirst ? 10 : 0,
                      borderTopRightRadius: isLast ? 10 : 0,
                    }}
                  >
                    {title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {normalizedNames.map((upper, i) => {
              const isLastRedeemed = upper === normalizedLastBg;
              const minted = finiteNumber(countByName[upper]);
              const currentPrice = finiteNumber(priceByName[upper]);
              const basePrice = finiteNumber(BASE_PRICES[upper]);
              const rawDiff =
                currentPrice != null && basePrice != null
                  ? currentPrice - basePrice
                  : null;
              const sign =
                rawDiff == null
                  ? ""
                  : rawDiff > 0
                    ? "+"
                    : rawDiff < 0
                      ? "-"
                      : "";
              const priceDiff =
                rawDiff == null
                  ? "--"
                  : `${sign}${fmt2(Math.abs(rawDiff))} POL`;
              const maxSupply = finiteNumber(maxSupplyByName[upper]);
              const bonusPct = finiteNumber(BACKGROUND_BONUS_PCT[upper]);
              const growthPct = finiteNumber(BACKGROUND_GROWTH_PCT[upper]);

              return (
                <tr
                  key={upper}
                  style={{
                    transition: "all 0.2s ease",
                    background: getRowBaseBackground(i, isLastRedeemed),
                    boxShadow: isLastRedeemed
                      ? "inset 0 0 0 1px rgba(109,255,138,0.85), 0 0 16px rgba(71,255,154,0.32)"
                      : "none",
                  }}
                >
                  <td style={getBlockColor(upper)} data-label={headerTitles[0]}>
                    {upper}
                  </td>
                  <td style={mintedStyle} data-label={headerTitles[1]}>
                    {minted ?? "--"}
                  </td>
                  <td style={linkedBlockStyle} data-label={headerTitles[2]}>
                    {pretty(upper)}
                  </td>
                  <td style={priceStyleWhite} data-label={headerTitles[3]}>
                    {bonusPct == null ? "--" : `${bonusPct}%`}
                  </td>
                  <td style={priceStyleWhite} data-label={headerTitles[4]}>
                    {growthPct == null ? "--" : `${growthPct}%`}
                  </td>
                  <td style={maxSupplyStyle} data-label={headerTitles[5]}>
                    {maxSupply ?? "--"}
                  </td>
                  <td style={priceStyle} data-label={headerTitles[6]}>
                    {priceDiff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bgw-button-container">
        <button onClick={onBack} className="bgw-button">
          BACK
        </button>
      </div>

      {infoVisible && (
        <div
          className="bgw-modal-overlay"
          onClick={() => setInfoVisible(false)}
          role="dialog"
          aria-labelledby="bgw-modal-title"
          aria-modal="true"
        >
          <div
            className="bgw-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bgw-modal-header" id="bgw-modal-title">
              Backgrounds Info
            </div>

            <div className="bgw-modal-body">
              <table className="bgw-info-table">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="info-row--core">
                    <td className="bgw-k">Background</td>
                    <td className="bgw-v">
                      Background color of the NFT; also used to determine a
                      one-time price bonus.
                    </td>
                  </tr>
                  <tr className="info-row--mint">
                    <td className="bgw-k">Minted</td>
                    <td className="bgw-v">
                      How many NFTs with this background have been minted.
                    </td>
                  </tr>
                  <tr className="info-row--link">
                    <td className="bgw-k">Linked Block</td>
                    <td className="bgw-v">
                      Human-readable name of the linked block (same as
                      background name).
                    </td>
                  </tr>
                  <tr className="info-row--bonus">
                    <td className="bgw-k">BG Bonus</td>
                    <td className="bgw-v">
                      One-time background bonus stored with the NFT metadata and
                      final mint price context (5-50%).
                    </td>
                  </tr>
                  <tr className="info-row--mint">
                    <td className="bgw-k">Block Growth</td>
                    <td className="bgw-v">
                      Permanent price growth used by the linked block when
                      background mints increase that block price.
                    </td>
                  </tr>
                  <tr className="info-row--supply">
                    <td className="bgw-k">Max Supply</td>
                    <td className="bgw-v">
                      Maximum number of NFTs in that segment (informational).
                    </td>
                  </tr>
                  <tr className="info-row--delta">
                    <td className="bgw-k">Block Price Delta</td>
                    <td className="bgw-v">
                      Current block price minus base block price.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bgw-modal-footer">
              <button
                className="bgw-modal-close-button"
                onClick={() => setInfoVisible(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundsWidget;
