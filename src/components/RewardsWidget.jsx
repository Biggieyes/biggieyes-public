// REWARDSWidget.jsx — shared width with Backgrounds (maxWidth 678, minWidth 558) + mobile adjustments
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import { getROProvider, ADDR, getREWARDSRO } from "../utils/contract";
import { canPoll, getPollInterval } from "../utils/polling";
import "./REWARDSWidget.css";
import "./InfoTables.css";

const cellStyle = {
  color: "#5ddcff",
  textAlign: "left",
  padding: "8px 10px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  overFLOW: "hidden",
  textOverFLOW: "ellipsis",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
};
const claimedStyle = {
  color: "#ff6b6b",
  textAlign: "center",
  padding: "8px 6px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overFLOW: "hidden",
  textOverFLOW: "ellipsis",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
  textShadow: "0 0 5px #ff6b6b55",
};
const maxStyle = {
  color: "#ffffff",
  textAlign: "center",
  padding: "8px 6px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overFLOW: "hidden",
  textOverFLOW: "ellipsis",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
  textShadow: "0 0 5px #ffffff33",
};
const priceStyle = {
  color: "#5ddcff",
  textAlign: "center",
  padding: "8px 6px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overFLOW: "hidden",
  textOverFLOW: "ellipsis",
  borderBottom: "1px solid rgba(255,232,0,0.2)",
  textShadow: "0 0 5px #5ddcff55",
};

const REWARDSWidget = ({
  REWARDSData = {},
  REWARDSPool = 0,
  myClaimable = null,
  onBack,
  mintVolumeMatic = null,
  sharePercent = 22,
}) => {
  const [infoVisible, setInfoVisible] = React.useState(false);

  // === On-chain pool with failover ===
  const [onChainPoolMatic, setOnChainPoolMatic] = React.useState(null);
  const [poolWei, setPoolWei] = React.useState("0");
  const [REWARDSAddr, setREWARDSAddr] = React.useState("");
  const poolInFlightRef = React.useRef(false);

  React.useEffect(() => {
    let mounted = true;

    async function loadPool() {
      if (!canPoll() || poolInFlightRef.current) return;
      poolInFlightRef.current = true;
      try {
        // primary path: via contract (validate address + provider)
        try {
          const r = getREWARDSRO();
          const addr = r.address;
          setREWARDSAddr(addr);
          const bal = await r.provider.getBalance(addr);
          if (!mounted) return;
          setPoolWei(bal.toString());
          setOnChainPoolMatic(Number(formatEther(bal)));
          return;
        } catch {
          // fallback: via provider + ADDR
        }

        try {
          const provider = getROProvider();
          const bal = await provider.getBalance(ADDR.COLLECTION_REWARDS);
          if (!mounted) return;
          setREWARDSAddr(ADDR.COLLECTION_REWARDS);
          setPoolWei(bal.toString());
          setOnChainPoolMatic(Number(formatEther(bal)));
        } catch {
          // leave null and use fallback below
        }
      } finally {
        poolInFlightRef.current = false;
      }
    }

    loadPool();
    const id = setInterval(
      loadPool,
      getPollInterval(20_000, "VITE_REWARDS_POOL_POLL_MS"),
    );
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // === mobile detection ===
  const [isPhone, setIsPhone] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 700px)").matches
      : false,
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 700px)");
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

  // === NAVIGATION ===
  const goTo = React.useCallback((anchorId) => {
    if (typeof window === "undefined") return;
    const clean = String(anchorId || "").replace(/^#/, "");
    const targetHash = clean ? `#/REWARDS#${clean}` : "#/REWARDS";

    const scrollToElement = () => {
      if (!clean || typeof document === "undefined") return;
      const el = document.getElementById(clean);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (window.location.hash === targetHash) {
      try {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch {}
      requestAnimationFrame(scrollToElement);
    } else {
      window.location.hash = targetHash;
    }
  }, []);

  // map claimed counts
  const orangeClaimed =
    Number(REWARDSData.orange ?? REWARDSData.orangeBlock ?? 0) || 0;
  const blockWinnersClaimed =
    Number(REWARDSData.blockWinners ?? REWARDSData.blocksREWARDS ?? 0) || 0;
  const rainbowClaimed =
    typeof REWARDSData.rainbow === "boolean"
      ? REWARDSData.rainbow
        ? 1
        : 0
      : Number(REWARDSData.rainbowREWARDS ?? 0) || 0;
  const charactersClaimed =
    Number(
      REWARDSData.charactersMinted ?? REWARDSData.specialCharacterNFT ?? 0,
    ) || 0;
  const specialRainbowNFTClaimed =
    Number(REWARDSData.specialRainbowNFT ?? 0) || 0;

  const REWARDS = React.useMemo(
    () => [
      {
        name: "CHARACTER NFT",
        kind: "NFT",
        claimed: charactersClaimed,
        max: 10,
        price: "NFT",
      },
      {
        name: "SPECIAL NFT",
        kind: "NFT",
        claimed: specialRainbowNFTClaimed,
        max: 9,
        price: "NFT",
      },
      {
        name: "ORANGE BLOCK",
        kind: "Money",
        claimed: orangeClaimed,
        max: 3,
        price: "3000 $",
      },
      {
        name: "BLOCKS REWARDS",
        kind: "Money",
        claimed: blockWinnersClaimed,
        max: 3,
        price: "5000 $",
      },
      {
        name: "RAINBOW REWARDS",
        kind: "Money",
        claimed: rainbowClaimed,
        max: 1,
        price: "10000 $",
      },
    ],
    [
      charactersClaimed,
      specialRainbowNFTClaimed,
      orangeClaimed,
      blockWinnersClaimed,
      rainbowClaimed,
    ],
  );

  // pick value: on-chain or computed from mints or fallback prop
  const volNum = mintVolumeMatic != null ? Number(mintVolumeMatic) : null;
  const shareNum = Number(sharePercent ?? 22);
  const computedFromVolume =
    volNum != null &&
    Number.isFinite(volNum) &&
    volNum >= 0 &&
    Number.isFinite(shareNum)
      ? (volNum * shareNum) / 100
      : null;

  const poolValue =
    onChainPoolMatic != null
      ? onChainPoolMatic
      : computedFromVolume != null && Number.isFinite(computedFromVolume)
        ? computedFromVolume
        : Number.isFinite(Number(REWARDSPool))
          ? Number(REWARDSPool)
          : 0;

  const poolStr = Number.isFinite(poolValue)
    ? poolValue.toFixed(6)
    : "0.000000";
  const claimStr =
    typeof myClaimable === "number" ? myClaimable.toFixed(6) : null;

  const poolLabel =
    onChainPoolMatic != null
      ? "REWARDS Pool (on-chain)"
      : computedFromVolume != null
        ? `REWARDS Pool (${shareNum}% of mints)`
        : "REWARDS Pool";

  return (
    <div
      className="REWARDS-widget"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <style>{`
        .rw-th { position: relative; overFLOW: hidden; cursor: default; transition: transform .18s ease, box-shadow .18s ease, text-shadow .18s ease; }
        .rw-th:hover { transform: translateY(-1px); box-shadow: inset 0 -1px 0 rgba(255,232,0,.55); text-shadow: 0 0 12px rgba(255,232,0,.55); }
        .rw-th::after { content: ""; position: absolute; left: -30%; bottom: 0; height: 2px; width: 60%; background: linear-gradient(90deg, transparent, #ffe800, transparent); opacity: 0; transform: translateX(-120%); }
        .rw-th:hover::after { opacity: 1; animation: rw-sweep 0.9s ease-out forwards; }
        @keyframes rw-sweep { 0%{transform:translateX(-130%)} 100%{transform:translateX(230%)} }
        .rw-sheen { position: absolute; top: 0; left: -120%; width: 120%; height: 100%; background: linear-gradient(110deg, rgba(255,232,0,0) 0%, rgba(255,232,0,0.18) 45%, rgba(255,232,0,0) 100%); transform: skewX(-18deg); pointer-events: none; }
        .rw-th:hover .rw-sheen { animation: rw-sheen 1.1s ease forwards; }
        @keyframes rw-sheen { to { left: 130%; } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 12,
          width: "100%",
          maxWidth: 678,
        }}
      >
        <div
          style={{
            border: "2px solid #ffe800",
            padding: "4px 8px",
            borderRadius: 6,
            marginBottom: 8,
            color: "#ff3355",
            fontWeight: "bold",
            letterSpacing: "1px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.45) 100%), url("/images/bg-tab0.png")',
            backgroundSize: "cover, cover",
            backgroundPosition: "center, center",
            backgroundRepeat: "no-repeat, no-repeat",
          }}
        >
          REWARDS
          <button
            style={{
              fontSize: "0.85em",
              padding: "4px 7px",
              cursor: "pointer",
              border: "2px solid #fff",
              background: "transparent",
              color: "#5ddcff",
              borderRadius: "50%",
              marginLeft: 12,
              ...(isPhone
                ? {
                    width: 100,
                    height: 100,
                    padding: 0,
                    borderRadius: 14,
                    fontSize: "1rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }
                : {}),
            }}
            onClick={() => setInfoVisible(!infoVisible)}
          >
            i
          </button>
        </div>

        <div
          style={{
            borderRadius: 9,
            padding: "8px 10px",
            width: "100%",
            backgroundImage:
              'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.45) 100%), url("/images/widget-bg-dark.png")',
            backgroundSize: "cover, cover",
            backgroundPosition: "center, center",
            backgroundRepeat: "no-repeat, no-repeat",
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ color: "#fff", letterSpacing: "1px", fontWeight: 700 }}
          >
            {poolLabel}
          </span>
          <span
            title={`${poolWei} wei${REWARDSAddr ? ` @ ${REWARDSAddr}` : ""}`}
            style={{ color: "#5ddcff", fontWeight: 900, fontSize: "1.3em" }}
          >
            {poolStr} POL
          </span>
          {claimStr !== null && (
            <>
              <span
                style={{
                  color: "#9ee5ff",
                  letterSpacing: "1px",
                  fontWeight: 700,
                  marginLeft: 10,
                }}
              >
                Your claimable
              </span>
              <span style={{ color: "#9ee5ff", fontWeight: 900 }}>
                {claimStr} POL
              </span>
            </>
          )}
        </div>
      </div>

      {/* REWARDS table */}
      <div
        className="rw-table-wrapper"
        style={{
          overFLOWX: isPhone ? "auto" : "visible",
          WebkitOverFLOWScrolling: "touch",
        }}
      >
        <table className="rw-head">
          <thead>
            <tr>
              <th className="rw-th">
                <div className="rw-sheen" />
                Reward Type
              </th>
              <th className="rw-th">
                <div className="rw-sheen" />
                Kind
              </th>
              <th className="rw-th">
                <div className="rw-sheen" />
                Claimed
              </th>
              <th className="rw-th">
                <div className="rw-sheen" />
                Max
              </th>
              <th className="rw-th">
                <div className="rw-sheen" />
                Payout
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                name: "CHARACTER NFT",
                kind: "NFT",
                claimed: charactersClaimed,
                max: 10,
                price: "NFT",
              },
              {
                name: "SPECIAL NFT",
                kind: "NFT",
                claimed: specialRainbowNFTClaimed,
                max: 9,
                price: "NFT",
              },
              {
                name: "ORANGE BLOCK",
                kind: "Money",
                claimed: orangeClaimed,
                max: 3,
                price: "3000 $",
              },
              {
                name: "BLOCKS REWARDS",
                kind: "Money",
                claimed: blockWinnersClaimed,
                max: 3,
                price: "5000 $",
              },
              {
                name: "RAINBOW REWARDS",
                kind: "Money",
                claimed: rainbowClaimed,
                max: 1,
                price: "10000 $",
              },
            ].map((r, index) => (
              <tr key={r.name}>
                <td
                  style={{
                    ...cellStyle,
                    color:
                      r.name === "ORANGE BLOCK"
                        ? "#ff7b00"
                        : r.name === "BLOCKS REWARDS"
                          ? "#ffe800"
                          : r.name === "RAINBOW REWARDS"
                            ? "#ff3355"
                            : "#5ddcff",
                    fontWeight: 800,
                    textShadow:
                      r.name === "ORANGE BLOCK"
                        ? "0 0 8px #ff7b0055"
                        : r.name === "BLOCKS REWARDS"
                          ? "0 0 8px #ffe80055"
                          : r.name === "RAINBOW REWARDS"
                            ? "0 0 8px #ff335555"
                            : "0 0 8px #5ddcff55",
                  }}
                >
                  {r.name}
                </td>
                <td style={priceStyle}>{r.kind}</td>
                <td style={claimedStyle}>{r.claimed}</td>
                <td style={maxStyle}>{r.max}</td>
                <td style={priceStyle}>{r.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginTop: "12px",
          width: "100%",
          maxWidth: 678,
          flexWrap: isPhone ? "wrap" : "nowrap",
        }}
      >
        <button
          onClick={() => goTo("orange-block-REWARDS")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "2px solid #ff7b00",
            background: "rgba(255, 123, 0, 0.2)",
            color: "#ff7b00",
            fontWeight: "bold",
            cursor: "pointer",
            minWidth: "90px",
            textShadow: "0 0 8px #ff7b0055",
            boxShadow: "0 0 10px #ff7b0044",
            transition: "all 0.2s ease",
          }}
        >
          ORANGE
        </button>
        <button
          onClick={() => goTo("block-REWARDS")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "2px solid #ffe800",
            background: "rgba(255, 232, 0, 0.2)",
            color: "#ffe800",
            fontWeight: "bold",
            cursor: "pointer",
            minWidth: "90px",
            textShadow: "0 0 8px #ffe80055",
            boxShadow: "0 0 10px #ffe80044",
            transition: "all 0.2s ease",
          }}
        >
          BLOCKS
        </button>
        <button
          onClick={() => goTo("rainbow-REWARDS")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "2px solid #ff3355",
            background: "rgba(255, 51, 85, 0.2)",
            color: "#ff3355",
            fontWeight: "bold",
            cursor: "pointer",
            minWidth: "90px",
            textShadow: "0 0 8px #ff335555",
            boxShadow: "0 0 10px #ff335544",
            transition: "all 0.2s ease",
          }}
        >
          RAINBOW
        </button>
      </div>

      {/* Back */}
      <div
        style={{
          width: "100%",
          maxWidth: 678,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "#08ffe6",
            color: "#111",
            border: "2px solid #ffe800",
            fontWeight: "bold",
            marginTop: 12,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          BACK
        </button>
      </div>

      {/* Info modal */}
      {infoVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(3px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            padding: 10,
          }}
          onClick={() => setInfoVisible(false)}
          role="dialog"
          aria-labelledby="rw-modal-title"
          aria-modal="true"
        >
          <div
            style={{
              width: "min(640px, 94vw)",
              maxHeight: "70vh",
              background: "#0f1116",
              borderRadius: 14,
              boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
              overFLOW: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="rw-modal-title"
              style={{
                textAlign: "center",
                padding: "12px",
                color: "#e9edf6",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "0.2px",
                background: "#151823",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              REWARDS Info
            </div>

            <div style={{ padding: 12, overFLOWY: "auto" }}>
              <style>{`
                  .rw-info-table { width: 100%; border-collapse: separate; border-spacing: 0;
                    background: #0f1116;
                    border: 1px solid rgba(255,255,255,.12); border-radius: 12px; overFLOW: hidden;
                    font-size: 13px; }
                  .rw-info-table thead th { position: sticky; top: 0; padding: 10px 12px; text-align: left;
                    color: #e9edf6; background: #151823;
                    border-bottom: 1px solid rgba(255,255,255,.12); letter-spacing: .2px; font-weight: 800; }
                  .rw-info-table tbody td { padding: 10px 12px; color: #d7dbe6; border-bottom: 1px solid rgba(255,255,255,.08);
                    vertical-align: top; line-height: 1.5; }
                  .rw-k { font-weight: 700; color: #e9edf6; white-space: nowrap; width: 36%; }
                  .rw-v { width: 64%; }
                  .rw-chip { display: inline-block; padding: 2px 8px; border-radius: 8px;
                    border: 1px solid rgba(255,255,255,.18);
                    background: #161a22;
                    font-weight: 700; color: #e9edf6; }
                `}</style>

              <table className="rw-info-table">
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="rw-k">{poolLabel}</td>
                    <td className="rw-v">
                      <strong>{poolStr} POL</strong>
                      {onChainPoolMatic != null
                        ? " — on-chain balance."
                        : computedFromVolume != null
                          ? ` — ${shareNum}% of total mints.`
                          : " — current pool size."}
                      {REWARDSAddr ? ` @ ${REWARDSAddr}` : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Your Claimable</td>
                    <td className="rw-v">
                      {claimStr !== null ? (
                        <strong>{claimStr} POL</strong>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Reward Type</td>
                    <td className="rw-v">
                      Specific reward category (e.g., ORANGE BLOCK, RAINBOW
                      REWARDS, CHARACTER NFT).
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Kind</td>
                    <td className="rw-v">
                      Whether the reward is{" "}
                      <span className="rw-chip">Money</span> or an{" "}
                      <span className="rw-chip">NFT</span>.
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Claimed</td>
                    <td className="rw-v">
                      How many REWARDS of that type have already been
                      distributed.
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Max</td>
                    <td className="rw-v">
                      Maximum number of REWARDS available for that category.
                    </td>
                  </tr>
                  <tr>
                    <td className="rw-k">Payout</td>
                    <td className="rw-v">
                      Dollar value or NFT item granted when the reward is won.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <button
                style={{
                  background: "#151823",
                  color: "#e9edf6",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontWeight: 700,
                  padding: "6px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
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

export default REWARDSWidget;




