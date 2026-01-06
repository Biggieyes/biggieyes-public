import * as React from "react";
import "./BlocksWidget.css";
import "./InfoTables.css";

// Constants
const MOBILE_BREAKPOINT = 700;
const ANIMATION_DURATION = 2.8;

const BLOCK_MAX_SUPPLY = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
const BASE_PRICES = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

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

const LINKED_BG = {
  ORANGE: "O",
  BLACK: "B",
  WHITE: "W",
  BROWN: "BR",
  BLUE: "BL",
  GREEN: "G",
  VIOLET: "V",
  RED: "R",
  PINK: "P",
  RAINBOW: "RB",
};

const getBlockColor = (name) => {
  const upperName = String(name || "").toUpperCase();
  let textColor = "#ffffff";
  if (upperName === "WHITE") textColor = "#000000";

  return {
    background: BLOCK_COLORS[upperName] || "#ffe800",
    color: textColor,
    fontWeight: "bold",
    border: "2px solid #ffe800",
    boxShadow: "0 0 7px #ffe80050",
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
  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
};

const mintedStyle = {
  ...cellBase,
  color: "#ff6b6b",
  textShadow: "0 0 5px #ff6b6b55",
};
const priceStyle = {
  ...cellBase,
  color: "#5ddcff",
  textShadow: "0 0 5px #5ddcff55",
};
const cellStyle = {
  ...cellBase,
  color: "#ffffff",
  textShadow: "0 0 5px #ffffff33",
};

const BlocksWidget = ({ blockNames, blockMintCounts, blockPrices, onBack }) => {
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

  const headerTitles = [
    "Eyes Color",
    "Minted Eyes",
    "Linked BG",
    "Max Supply",
    "Base Price",
    "Current Price",
  ];

  const handleRowHoverEnter = React.useCallback((e) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
  }, []);

  const handleRowHoverLeave = React.useCallback((e, bgIndex) => {
    e.currentTarget.style.background =
      bgIndex % 2 === 0 ? "rgba(255,232,0,0.05)" : "rgba(255,232,0,0.02)";
  }, []);

  return (
    <div className="bw-container">
      <div className="bw-header">
        <span className="bw-header-text">EYES COLOR</span>
        <button
          className={`bw-info-button ${isPhone ? "bw-info-button--phone" : ""}`}
          onClick={() => setInfoVisible(!infoVisible)}
          aria-label="Toggle blocks information"
        >
          i
        </button>
      </div>

      <div className="bw-table-wrapper">
        <table className="bw-head">
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
            {blockNames.map((name, i) => (
              <tr
                key={name}
                style={{
                  transition: "all 0.2s ease",
                  background:
                    i % 2 === 0
                      ? "rgba(255,232,0,0.05)"
                      : "rgba(255,232,0,0.02)",
                }}
                onMouseEnter={handleRowHoverEnter}
                onMouseLeave={(e) => handleRowHoverLeave(e, i)}
              >
                <td style={getBlockColor(name)}>{name}</td>
                <td style={mintedStyle}>{blockMintCounts[i]}</td>
                <td style={cellStyle}>
                  {LINKED_BG[name.toUpperCase()] || "-"}
                </td>
                <td style={cellStyle}>{BLOCK_MAX_SUPPLY[i]}</td>
                <td style={cellStyle}>{BASE_PRICES[i]}</td>
                <td style={priceStyle}>
                  {Math.round(Number(blockPrices[i]))} POL
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bw-button-container">
        <button onClick={onBack} className="bw-button">
          BACK
        </button>
      </div>

      {infoVisible && (
        <div
          className="bw-modal-overlay"
          onClick={() => setInfoVisible(false)}
          role="dialog"
          aria-labelledby="bw-modal-title"
          aria-modal="true"
        >
          <div
            className="bw-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bw-modal-header" id="bw-modal-title">
              Blocks Info
            </div>

            <div className="bw-modal-body">
              <table className="bw-info-table">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="bw-k">Eyes Color</td>
                    <td className="bw-v">
                      Block name (NFT eye color). Example:{" "}
                      <span className="bw-chip">BLUE</span>,{" "}
                      <span className="bw-chip">GREEN</span>.
                    </td>
                  </tr>
                  <tr>
                    <td className="bw-k">Minted Eyes</td>
                    <td className="bw-v">
                      Number of NFTs already minted in this block.
                    </td>
                  </tr>
                  <tr>
                    <td className="bw-k">Linked BG</td>
                    <td className="bw-v">
                      Abbreviation of the background linked to the block (e.g.,{" "}
                      <span className="bw-chip bw-mono">BL</span>,{" "}
                      <span className="bw-chip bw-mono">G</span>).
                    </td>
                  </tr>
                  <tr>
                    <td className="bw-k">Max Supply</td>
                    <td className="bw-v">
                      Maximum number of NFTs in this block.
                    </td>
                  </tr>
                  <tr>
                    <td className="bw-k">Base Price</td>
                    <td className="bw-v">
                      Starting price of the block before any increases.
                    </td>
                  </tr>
                  <tr>
                    <td className="bw-k">Current Price</td>
                    <td className="bw-v">
                      Live price after increases driven solely by background
                      mints (<span className="bw-chip">BG Inc</span>).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bw-modal-footer">
              <button
                className="bw-modal-close-button"
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

export default BlocksWidget;
