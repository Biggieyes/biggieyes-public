import * as React from "react";
import "./BackgroundsWidget.css";
import "./InfoTables.css";

// Constants
const MOBILE_BREAKPOINT = 700;
const ANIMATION_DURATION = 2.8;

const BLOCK_MAX_SUPPLY = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

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

const BACKGROUND_INCREASES = {
  ORANGE: "5%",
  BLACK: "10%",
  WHITE: "15%",
  BROWN: "20%",
  BLUE: "25%",
  GREEN: "30%",
  VIOLET: "35%",
  RED: "40%",
  PINK: "45%",
  RAINBOW: "50%",
};

const BLOCK_BASE_PRICES = {
  ORANGE: 1,
  BLACK: 2,
  WHITE: 3,
  BROWN: 4,
  BLUE: 5,
  GREEN: 6,
  VIOLET: 7,
  RED: 8,
  PINK: 9,
  RAINBOW: 10,
};

const GROWTH_BY_BG_INDEX = [5, 2, 2, 3, 3, 4, 4, 5, 5, 10];

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
    overFLOW: "hidden",
    textOverFLOW: "ellipsis",
    transition: "all 0.3s ease",
    minWidth: "80px",
  };
};

const cellBase = {
  textAlign: "center",
  padding: "6px 4px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overFLOW: "hidden",
  textOverFLOW: "ellipsis",
  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
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
    : "0,00";

const BackgroundsWidget = ({
  blockNames = [],
  backgroundMintCounts = [],
  blockPrices = [],
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
      const namesUC = blockNames.map((n) => String(n || "").toUpperCase());
      const countMap = {};
      const priceMap = {};
      const supplyMap = {};
      namesUC.forEach((N, i) => {
        countMap[N] = Number(backgroundMintCounts[i] ?? 0);
        priceMap[N] = Number(blockPrices[i] ?? 0);
        supplyMap[N] = Number(BLOCK_MAX_SUPPLY[i] ?? 0);
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
    "BG Inc",
    "Mint %",
    "Max Supply",
    "Block Price Δ",
  ];

  const handleRowHoverEnter = React.useCallback((e, bgIndex) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
  }, []);

  const handleRowHoverLeave = React.useCallback((e, bgIndex) => {
    e.currentTarget.style.background =
      bgIndex % 2 === 0 ? "rgba(255,232,0,0.05)" : "rgba(255,232,0,0.02)";
  }, []);

  return (
    <div className="bgw-container">
      <div className="bgw-header">
        <span>BACKGROUND COLOR</span>
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
                const color = isFirst || isLast ? "#ffe800" : "#5ddcff";
                return (
                  <th
                    key={title}
                    className={isFirst || isLast ? "no-sweep" : undefined}
                    style={{
                      color,
                      borderRight:
                        idx === headerTitles.length - 1
                          ? "none"
                          : "1px solid rgba(255,232,0,0.22)",
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
              const minted = Number(countByName[upper] ?? 0);
              const currentPrice = Number(priceByName[upper] ?? 0);
              const basePrice = Number(BLOCK_BASE_PRICES[upper] ?? 0);
              const safeCurrent = Number.isFinite(currentPrice)
                ? currentPrice
                : basePrice;
              const rawDiff = Number.isFinite(safeCurrent - basePrice)
                ? safeCurrent - basePrice
                : 0;
              const sign = rawDiff > 0 ? "+" : rawDiff < 0 ? "-" : "";
              const priceDiff = `${sign}${fmt2(Math.abs(rawDiff))}`;
              const maxSupply = Number(
                maxSupplyByName[upper] ?? BLOCK_MAX_SUPPLY[i] ?? 0,
              );
              const growthPct = `${GROWTH_BY_BG_INDEX[i] || 0}%`;

              return (
                <tr
                  key={upper}
                  style={{
                    transition: "all 0.2s ease",
                    background:
                      i % 2 === 0
                        ? "rgba(255,232,0,0.05)"
                        : "rgba(255,232,0,0.02)",
                  }}
                  onMouseEnter={(e) => handleRowHoverEnter(e, i)}
                  onMouseLeave={(e) => handleRowHoverLeave(e, i)}
                >
                  <td style={getBlockColor(upper)} data-label={headerTitles[0]}>
                    {upper}
                  </td>
                  <td style={mintedStyle} data-label={headerTitles[1]}>
                    {minted}
                  </td>
                  <td style={linkedBlockStyle} data-label={headerTitles[2]}>
                    {pretty(upper)}
                  </td>
                  <td style={priceStyleWhite} data-label={headerTitles[3]}>
                    {BACKGROUND_INCREASES[upper] || "-"}
                  </td>
                  <td style={priceStyleWhite} data-label={headerTitles[4]}>
                    {growthPct}
                  </td>
                  <td style={maxSupplyStyle} data-label={headerTitles[5]}>
                    {maxSupply}
                  </td>
                  <td style={priceStyle} data-label={headerTitles[6]}>
                    {priceDiff} POL
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
                  <tr>
                    <td className="bgw-k">Background</td>
                    <td className="bgw-v">
                      Background color of the NFT; also used to determine a
                      one-time price bonus.
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">Minted</td>
                    <td className="bgw-v">
                      How many NFTs with this background have been minted.
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">Linked Block</td>
                    <td className="bgw-v">
                      Human-readable name of the linked block (same as
                      background name).
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">BG Inc</td>
                    <td className="bgw-v">
                      One-off bonus applied to the current block price (5–50%).
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">Mint %</td>
                    <td className="bgw-v">
                      Derived helper percentage based on the background index
                      (1..10).
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">Max Supply</td>
                    <td className="bgw-v">
                      Maximum number of NFTs in that segment (informational).
                    </td>
                  </tr>
                  <tr>
                    <td className="bgw-k">Block Price Δ</td>
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


