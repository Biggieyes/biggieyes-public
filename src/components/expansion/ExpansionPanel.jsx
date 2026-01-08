// src/components/panels/ExpansionPanel.jsx
import * as React from "react";
import { ethers } from "ethers";
import {
  ADDR,
  getROProvider,
  getMultiCollectionDistributorRO,
} from "../../utils/contract";

/* ====== CONFIG - nastav adresu distributor kontraktu ===== */
const DISTRIBUTOR_ADDRESS = ADDR.MULTI_COLLECTION_DISTRIBUTOR;
/* ======================================================= */

/* Minimal ABI (read-only + events) */
import BiggiMultiCollectionDistributor from "../../config/abi/BiggiMultiCollectionDistributor.json";
const DISTRIBUTOR_ABI = BiggiMultiCollectionDistributor;

const THEME = {
  bgStart: "#07070a",
  bgEnd: "#0f1014",
  gold: "#FFE800",
  cyan: "#5ddcff",
  dim: "#cfd2db",
  surface: "rgba(255,255,255,0.03)",
  glass: "rgba(255,255,255,0.04)",
  border: "rgba(255,232,0,0.16)",
  accentSoft:
    "linear-gradient(135deg, rgba(255,232,0,0.06), rgba(93,220,255,0.03))",
};

const styles = {
  page: {
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#f6f7fb",
    background: `radial-gradient(900px 400px at 10% 0%, rgba(93,220,255,0.04), transparent), linear-gradient(180deg, ${THEME.bgStart}, ${THEME.bgEnd})`,
    minHeight: "calc(100vh - 90px)",
    padding: 20,
    boxSizing: "border-box",
  },
  container: {
    margin: "0 auto",
    maxWidth: 1200,
    display: "grid",
    gap: 18,
    gridTemplateColumns: "1fr 420px",
    alignItems: "start",
  },
  headerCard: {
    gridColumn: "1 / -1",
    borderRadius: 16,
    padding: 20,
    background: `linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18))`,
    border: `1px solid ${THEME.border}`,
    boxShadow:
      "0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(255,232,0,0.03) inset",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  titleGroup: { display: "flex", gap: 12, alignItems: "center" },
  logoBadge: {
    width: 74,
    height: 74,
    borderRadius: 12,
    background: `linear-gradient(135deg, rgba(255,232,0,0.14), rgba(93,220,255,0.06))`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#0b0b0b",
    fontSize: 22,
    boxShadow: "0 8px 30px rgba(0,0,0,0.6), 0 6px 20px rgba(255,232,0,0.06)",
  },
  h1: { margin: 0, fontSize: 20, letterSpacing: "0.06em", color: THEME.gold },
  subtitle: { margin: 0, color: THEME.dim, fontSize: 13 },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },

  // hero stats row
  heroRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    borderRadius: 12,
    padding: 14,
    background: THEME.surface,
    border: `1px solid rgba(255,255,255,0.03)`,
    boxShadow: "0 8px 22px rgba(0,0,0,0.6)",
    minHeight: 88,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  statLabel: { fontSize: 12, color: THEME.dim, fontWeight: 700 },
  statValue: { fontSize: 20, fontWeight: 900, color: THEME.gold },

  // main left column
  leftPanel: {
    borderRadius: 14,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.14))",
    border: `1px solid ${THEME.border}`,
    boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
  },
  infoText: { color: THEME.dim, fontSize: 14, lineHeight: 1.6 },

  // events
  eventsCard: {
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid rgba(255,255,255,0.03)`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.012), rgba(0,0,0,0.16))",
  },
  eventsHeader: {
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.02)",
    background: THEME.accentSoft,
  },
  eventsList: { maxHeight: 320, overflowY: "auto", padding: 12 },

  // right panel
  rightPanel: {
    borderRadius: 14,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.01), rgba(0,0,0,0.13))",
    border: `1px solid ${THEME.border}`,
    boxShadow: "0 10px 26px rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  primaryBtn: {
    background: `linear-gradient(90deg, ${THEME.gold}, rgba(255,232,0,0.9))`,
    border: "none",
    color: "#101010",
    fontWeight: 800,
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(255,232,0,0.08), 0 2px 6px rgba(0,0,0,0.6)",
  },
  ghostBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.06)",
    color: THEME.dim,
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  },
  explorerBtn: {
    background: `linear-gradient(90deg, rgba(93,220,255,0.12), rgba(255,232,0,0.06))`,
    border: `1px solid rgba(93,220,255,0.12)`,
    color: THEME.cyan,
    fontWeight: 800,
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
  },
  smallNote: { color: THEME.dim, fontSize: 12 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(8px)",
  },
  modalCard: {
    width: "min(940px, 96vw)",
    borderRadius: 20,
    padding: 24,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.25))",
    border: `1px solid rgba(255,232,0,0.15)`,
    boxShadow:
      "0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(255,232,0,0.05) inset",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  placeholderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginTop: 20,
  },
  placeCard: {
    borderRadius: 16,
    padding: 20,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))",
    border: "1px solid rgba(255,255,255,0.05)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    alignItems: "center",
    justifyContent: "space-between",
    transition: "all 0.3s ease",
    position: "relative",
    overflow: "hidden",
  },
  placeThumb: {
    width: 120,
    height: 120,
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(255,232,0,0.1), rgba(93,220,255,0.05))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.gold,
    fontWeight: 800,
    fontSize: 24,
    boxShadow: "0 8px 25px rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,232,0,0.1)",
  },
  collectionBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    background: "rgba(255,232,0,0.1)",
    color: THEME.gold,
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid rgba(255,232,0,0.2)",
  },
  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },
  statMini: {
    flex: 1,
    textAlign: "center",
    padding: 8,
    background: "rgba(255,255,255,0.02)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.03)",
  },
  progressBar: {
    width: "100%",
    height: 6,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    overflow: "hidden",
    margin: "8px 0",
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${THEME.gold}, ${THEME.cyan})`,
    borderRadius: 10,
  },
};

function shortAddr(a = "") {
  if (!a) return "";
  return `${String(a).slice(0, 6)}...${String(a).slice(-4)}`;
}
function explorerUrlFor(address, networkName) {
  if (!address) return "#";
  const n = (networkName || "").toLowerCase();
  if (n.includes("polygon") || n.includes("matic"))
    return `https://polygonscan.com/address/${address}`;
  if (n.includes("goerli"))
    return `https://goerli.etherscan.io/address/${address}`;
  if (n.includes("sepolia"))
    return `https://sepolia.etherscan.io/address/${address}`;
  if (n.includes("mainnet") || n === "homestead")
    return `https://etherscan.io/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

export default function ExpansionPanel() {
  const [provider, setProvider] = React.useState(null);
  const [signer, setSigner] = React.useState(null);
  const [account, setAccount] = React.useState(null);
  const [contract, setContract] = React.useState(null);
  const [totalReceived, setTotalReceived] = React.useState("0");
  const [receivedForAddr, setReceivedForAddr] = React.useState("0");
  const [isWhitelisted, setIsWhitelisted] = React.useState(false);
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [futureOpen, setFutureOpen] = React.useState(false);

  React.useEffect(() => {
    const init = async () => {
      try {
        // preferuj injektovaný provider pokud je, jinak centrální read-only provider
        const prov =
          typeof window !== "undefined" && window.ethereum
            ? new ethers.providers.Web3Provider(window.ethereum, "any")
            : getROProvider();
        setProvider(prov);
        // nastav contract proti read-only provider (ne defaultProvider)
        setContract(
          new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, prov),
        );
      } catch (e) {
        console.error(e);
        setStatus("Init error");
      }
    };
    init();
  }, []);

  const connect = React.useCallback(async () => {
    try {
      if (!window.ethereum) {
        setStatus("No injected wallet");
        return;
      }
      const prov = new ethers.providers.Web3Provider(window.ethereum, "any");
      await prov.send("eth_requestAccounts", []);
      const s = prov.getSigner();
      const addr = await s.getAddress();
      setProvider(prov);
      setSigner(s);
      setAccount(addr);
      // použij signer pro contract, aby read/write a events byly konzistentní
      setContract(new ethers.Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, s));
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Connect failed");
    }
  }, []);

  const loadOnChain = React.useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const tot = await contract.totalReceived();
      setTotalReceived(ethers.utils.formatEther(tot || 0));
      if (account) {
        const rec = await contract.receivedByCollection(account);
        setReceivedForAddr(ethers.utils.formatEther(rec || 0));
        const wh = await contract.isCollection(account);
        setIsWhitelisted(Boolean(wh));
      } else {
        setReceivedForAddr("0");
        setIsWhitelisted(false);
      }

      const latest = provider ? await provider.getBlockNumber() : null;
      const fromBlock = Math.max(0, (latest || 0) - 200_000);
      const evts = await contract.queryFilter(
        contract.filters.MintShareAccepted(),
        fromBlock,
        latest || "latest",
      );
      const mapped = (evts || [])
        .slice(-12)
        .reverse()
        .map((e) => {
          const col =
            e.args && e.args.collection ? e.args.collection : e.args[0] || null;
          const amt =
            e.args && e.args.amount
              ? e.args.amount
              : e.args[1] || ethers.BigNumber.from(0);
          return {
            tx: e.transactionHash,
            block: e.blockNumber,
            collection: String(col),
            amount: ethers.utils.formatEther(amt),
          };
        });
      setEvents(mapped);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("Load failed");
    } finally {
      setLoading(false);
    }
  }, [contract, account, provider]);

  React.useEffect(() => {
    loadOnChain();
  }, [contract, account, loadOnChain]);

  React.useEffect(() => {
    if (!contract || !contract.on) return;
    const handler = (collection, amount, ev) => {
      const item = {
        tx: ev.transactionHash,
        block: ev.blockNumber,
        collection: String(collection),
        amount: ethers.utils.formatEther(amount),
      };
      setEvents((prev) => [item, ...prev].slice(0, 12));
      loadOnChain();
    };
    contract.on(contract.filters.MintShareAccepted(), handler);
    return () => {
      try {
        contract.off(contract.filters.MintShareAccepted(), handler);
      } catch (e) {}
    };
  }, [contract, loadOnChain]);

  const copyAddress = React.useCallback(() => {
    if (!account) return;
    navigator.clipboard?.writeText(account);
    setStatus("Address copied");
    setTimeout(() => setStatus(""), 1400);
  }, [account]);

  const openExplorer = React.useCallback(async () => {
    const net = provider
      ? await provider
          .getNetwork()
          .then((n) => n.name)
          .catch(() => "")
      : "";
    const url = explorerUrlFor(DISTRIBUTOR_ADDRESS, net);
    window.open(url, "_blank");
  }, [provider]);

  // Mock data for future collections
  const futureCollections = [
    {
      id: 1,
      name: "Cyber Samurai",
      status: "Upcoming",
      progress: 65,
      items: "2,500",
      mintPrice: "0.08 ETH",
      description: "Futuristic samurai warriors in digital realm",
    },
    {
      id: 2,
      name: "Neon Dreams",
      status: "Whitelist",
      progress: 30,
      items: "3,333",
      mintPrice: "0.05 ETH",
      description: "Vibrant neon-themed abstract art collection",
    },
    {
      id: 3,
      name: "Quantum Beings",
      status: "Live Soon",
      progress: 85,
      items: "1,000",
      mintPrice: "0.12 ETH",
      description: "Interdimensional entities from quantum space",
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div style={styles.titleGroup}>
            <div style={styles.logoBadge}>BG</div>
            <div>
              <h1 style={styles.h1}>{"Expansion -> Distributor"}</h1>
              <p style={styles.subtitle}>
                User dashboard — overview of the mint-share flow and your
                collection status
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => setFutureOpen(true)}
              style={styles.primaryBtn}
            >
              FutureCollection
            </button>
            <button onClick={openExplorer} style={styles.explorerBtn}>
              Open explorer
            </button>
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "stretch",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total received (contract)</div>
                <div style={styles.statValue}>{totalReceived} POL</div>
                <div style={{ color: THEME.dim, fontSize: 12, marginTop: 6 }}>
                  Total POL received by the Distributor contract
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Your collection received</div>
                <div
                  style={{ fontSize: 20, fontWeight: 900, color: THEME.cyan }}
                >
                  {receivedForAddr} POL
                </div>
                <div style={{ color: THEME.dim, fontSize: 12, marginTop: 6 }}>
                  {isWhitelisted ? "You are whitelisted" : "Not whitelisted"}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Quick actions</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={copyAddress}
                    style={{ ...styles.ghostBtn, flex: 1 }}
                    disabled={!account}
                  >
                    Copy my address
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText(DISTRIBUTOR_ADDRESS)
                    }
                    style={{ ...styles.ghostBtn, flex: 1 }}
                  >
                    Copy distributor
                  </button>
                </div>
                <div style={{ color: THEME.dim, fontSize: 12, marginTop: 8 }}>
                  Read-only UI for users — for whitelist requests contact the
                  project team.
                </div>
              </div>
            </div>
          </div>

          <div style={styles.leftPanel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 16, fontWeight: 800, color: THEME.gold }}
                >
                  What is Distributor?
                </div>
                <div style={styles.infoText}>
                  The Distributor receives the mint-share (part of every mint)
                  from whitelisted collections and routes it into reserves,
                  rewards, buyback, and the treasury. In this user panel you can
                  see how much was received in total, how much was credited to
                  your collection, and the most recent mint-share events.
                </div>
              </div>
              <div style={{ minWidth: 160 }}>
                <div
                  style={{ fontSize: 13, color: THEME.dim, marginBottom: 8 }}
                >
                  Status
                </div>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: THEME.glass,
                    border: "1px solid rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontWeight: 800, color: THEME.cyan }}>
                    {isWhitelisted ? "Whitelisted" : "Not whitelisted"}
                  </div>
                  <div style={{ color: THEME.dim, marginTop: 6 }}>
                    {status || "Ready"}
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.eventsCard}>
              <div style={styles.eventsHeader}>
                <div style={{ fontWeight: 800, color: THEME.gold }}>
                  Recent mint-share events
                </div>
                <div style={{ color: THEME.dim, fontSize: 13 }}>
                  {events.length} items
                </div>
              </div>

              <div style={styles.eventsList}>
                {loading ? (
                  <div style={{ color: THEME.dim }}>Loading events...</div>
                ) : events.length === 0 ? (
                  <div style={{ color: THEME.dim }}>No recent events found</div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ color: THEME.dim, textAlign: "left" }}>
                        <th style={{ padding: "8px 6px" }}>Collection</th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>
                          Amount
                        </th>
                        <th style={{ padding: "8px 6px", textAlign: "right" }}>
                          Block
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <tr
                          key={i}
                          style={{
                            borderTop: "1px solid rgba(255,255,255,0.02)",
                          }}
                        >
                          <td style={{ padding: "10px 6px", color: "#e9f9ff" }}>
                            {shortAddr(ev.collection)}
                          </td>
                          <td
                            style={{
                              padding: "10px 6px",
                              textAlign: "right",
                              color: "#fff",
                            }}
                          >
                            {ev.amount}
                          </td>
                          <td
                            style={{
                              padding: "10px 6px",
                              textAlign: "right",
                              color: THEME.dim,
                            }}
                          >
                            {ev.block}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <aside style={styles.rightPanel}>
            <div>
              <div
                style={{ fontWeight: 800, color: THEME.gold, marginBottom: 6 }}
              >
                Your quick tools
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <button onClick={connect} style={styles.primaryBtn}>
                  {account ? "Connected" : "Connect Wallet"}
                </button>
                <button onClick={loadOnChain} style={styles.ghostBtn}>
                  Refresh on-chain
                </button>
                <button onClick={openExplorer} style={styles.ghostBtn}>
                  Open distributor on explorer
                </button>
                <div style={{ marginTop: 8, color: THEME.dim }}>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>Tip</div>
                  <div style={{ fontSize: 13 }}>
                    If you manage a collection and want to be whitelisted,
                    contact the project team. This panel is informational only.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div
                style={{ fontWeight: 800, color: THEME.cyan, marginBottom: 6 }}
              >
                Mini status
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: 10,
                  borderRadius: 10,
                }}
              >
                <div style={{ color: THEME.dim }}>Contract</div>
                <div
                  style={{ color: THEME.gold, fontWeight: 800, marginTop: 6 }}
                >
                  {DISTRIBUTOR_ADDRESS ? shortAddr(DISTRIBUTOR_ADDRESS) : "-"}
                </div>
                <div style={{ color: THEME.dim, marginTop: 8, fontSize: 12 }}>
                  {loading ? "Updating..." : "Synchronized"}
                </div>
              </div>
            </div>

            <div style={{ color: THEME.dim, fontSize: 12, marginTop: 6 }}>
              <strong>Security</strong>: never call admin functions when the UI
              is unfamiliar. This panel does not change anything on-chain
              (read-only) — apart from an optional wallet connection.
            </div>
          </aside>
        </div>
      </div>

      {/* FutureCollection modal with enhanced placeholders */}
      {futureOpen && (
        <div style={styles.modalOverlay} onClick={() => setFutureOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 20,
                marginBottom: 24,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 900,
                    color: THEME.gold,
                    fontSize: 24,
                    marginBottom: 8,
                  }}
                >
                  Future Collections
                </div>
                <div
                  style={{ color: THEME.dim, fontSize: 15, lineHeight: 1.5 }}
                >
                  Discover upcoming NFT collections in our ecosystem. Each
                  collection brings unique artwork and utility to the platform.
                </div>
              </div>
              <div>
                <button
                  onClick={() => setFutureOpen(false)}
                  style={{
                    ...styles.ghostBtn,
                    padding: "10px 16px",
                    border: `1px solid ${THEME.border}`,
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={styles.placeholderGrid}>
              {futureCollections.map((collection) => (
                <div key={collection.id} style={styles.placeCard}>
                  <div style={styles.collectionBadge}>{collection.status}</div>

                  <div style={styles.placeThumb}>
                    {collection.name
                      .split(" ")
                      .map((word) => word[0])
                      .join("")}
                  </div>

                  <div style={{ width: "100%", textAlign: "center" }}>
                    <div
                      style={{
                        color: THEME.gold,
                        fontWeight: 800,
                        fontSize: 18,
                        marginBottom: 6,
                      }}
                    >
                      {collection.name}
                    </div>
                    <div
                      style={{
                        color: THEME.dim,
                        fontSize: 13,
                        lineHeight: 1.4,
                        marginBottom: 12,
                      }}
                    >
                      {collection.description}
                    </div>
                  </div>

                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${collection.progress}%`,
                      }}
                    ></div>
                  </div>
                  <div
                    style={{
                      color: THEME.cyan,
                      fontSize: 12,
                      fontWeight: 700,
                      width: "100%",
                      textAlign: "center",
                    }}
                  >
                    Launch Progress: {collection.progress}%
                  </div>

                  <div style={styles.statsRow}>
                    <div style={styles.statMini}>
                      <div style={{ color: THEME.dim, fontSize: 11 }}>
                        Items
                      </div>
                      <div
                        style={{ color: "#fff", fontWeight: 700, marginTop: 4 }}
                      >
                        {collection.items}
                      </div>
                    </div>
                    <div style={styles.statMini}>
                      <div style={{ color: THEME.dim, fontSize: 11 }}>
                        Mint Price
                      </div>
                      <div
                        style={{
                          color: THEME.gold,
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                      >
                        {collection.mintPrice}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, width: "100%" }}>
                    <button
                      style={{
                        ...styles.ghostBtn,
                        flex: 1,
                        padding: "10px",
                        background: "rgba(255,232,0,0.05)",
                        border: `1px solid rgba(255,232,0,0.2)`,
                        color: THEME.gold,
                      }}
                    >
                      View Details
                    </button>
                    <button
                      style={{
                        ...styles.ghostBtn,
                        flex: 1,
                        padding: "10px",
                        background: "rgba(93,220,255,0.05)",
                        border: `1px solid rgba(93,220,255,0.2)`,
                        color: THEME.cyan,
                      }}
                    >
                      Join Waitlist
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 30,
                padding: 20,
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{ color: THEME.gold, fontWeight: 700, marginBottom: 8 }}
              >
                About Future Collections
              </div>
              <div style={{ color: THEME.dim, fontSize: 13, lineHeight: 1.6 }}>
                These collections are currently in development and will be
                integrated with the Distributor system upon launch. Each
                collection undergoes a thorough review process to ensure quality
                and compatibility with our ecosystem.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
