// src/panels/BiggiToken/expansion/ExpansionPanel.jsx
import * as React from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from "ethers";
import {
  ADDR,
  getProviderForContract,
} from "@/shared/utils/contract";
import { getRpcUrls } from "@/shared/utils/rpcConfig";
import {
  queryLogsBatched,
  getSafeDeployBlock,
  isFullHistoryEnabled,
} from "@/shared/utils/shared";
import { FUTURE_COLLECTIONS } from "../../rewards/COLLECTION/CollectionBlocksGrid.constants";

/* ====== CONFIG - nastav adresu distributor kontraktu ===== */
const DISTRIBUTOR_ADDRESS =
  ADDR.MULTI_COLLECTION_DISTRIBUTOR || ADDR.DISTRIBUTOR;
/* ======================================================= */

/* Minimal ABI (read-only + events) */
import { BiggiMultiCollectionDistributor } from "@/config/abi/index.js";
const DISTRIBUTOR_ABI = BiggiMultiCollectionDistributor;
const FULL_HISTORY = isFullHistoryEnabled();

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
  futureGrid: {
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
  COLLECTIONBadge: {
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

function getReadProvider() {
  const urls = getRpcUrls();
  const primary = urls && urls.length ? urls[0] : null;
  if (!primary) return null;
  try {
    return new JsonRpcProvider(primary);
  } catch {
    return null;
  }
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
  const mintShareFilter = React.useMemo(() => {
    if (!contract || !contract.filters || !contract.interface) return null;
    const candidates = ["MintShareReceived", "MintShareAccepted"];
    for (const name of candidates) {
      try {
        // Avoid touching filters for events not present in ABI
        try {
          contract.interface.getEvent(name);
        } catch {
          continue;
        }
        const fn = contract.filters?.[name];
        if (typeof fn === "function") {
          return fn();
        }
      } catch {
        // Ignore if event is missing in ABI or proxy throws
      }
    }
    return null;
  }, [contract]);

  const extractCollection = React.useCallback((evt) => {
    if (!evt || !evt.args) return null;
    return (
      evt.args.COLLECTION ??
      evt.args.collection ??
      evt.args.coll ??
      evt.args[0] ??
      null
    );
  }, []);

  const extractAmount = React.useCallback((evt) => {
    if (!evt || !evt.args) return 0n;
    return evt.args.amount ?? evt.args[1] ?? 0n;
  }, []);

  React.useEffect(() => {
    const init = async () => {
      try {
        // preferuj injektovaný provider pokud je, jinak RPC provider (ethers v6)
        const prov =
          getReadProvider() ||
          (typeof window !== "undefined" && window.ethereum
            ? new BrowserProvider(window.ethereum, "any")
            : null);
        if (!prov) throw new Error("No provider available");
        setProvider(prov);
        // nastav contract proti read-only provider (ne defaultProvider)
        setContract(
          new Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, prov),
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
      const prov = new BrowserProvider(window.ethereum, "any");
      await prov.send("eth_requestAccounts", []);
      const s = await prov.getSigner();
      const addr = await s.getAddress();
      setProvider(prov);
      setSigner(s);
      setAccount(addr);
      // použij signer pro contract, aby read/write a events byly konzistentní
      setContract(new Contract(DISTRIBUTOR_ADDRESS, DISTRIBUTOR_ABI, s));
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
      setTotalReceived(formatEther(tot || 0));
        if (account) {
          const rec = await (async () => {
            if (typeof contract.receivedByAddress === "function") {
              return await contract.receivedByAddress(account);
            }
            if (typeof contract.receivedByCOLLECTION === "function") {
              return await contract.receivedByCOLLECTION(account);
            }
            return 0n;
          })();
          setReceivedForAddr(formatEther(rec || 0));
          const wh = await (async () => {
            if (typeof contract.isCOLLECTION === "function") {
              return await contract.isCOLLECTION(account);
            }
            if (typeof contract.tryGetRecipients === "function") {
              const recipients = await contract.tryGetRecipients();
              if (!Array.isArray(recipients)) return false;
              const target = String(account).toLowerCase();
              return recipients.some(
                (addr) => String(addr).toLowerCase() === target,
              );
            }
            return false;
          })();
          setIsWhitelisted(Boolean(wh));
        } else {
          setReceivedForAddr("0");
          setIsWhitelisted(false);
        }

      const logProvider = getProviderForContract(contract);
      const latest = logProvider ? await logProvider.getBlockNumber() : null;
      const baseFrom =
        logProvider && typeof logProvider.getBlockNumber === "function"
          ? await getSafeDeployBlock(logProvider)
          : 0;
      const safeFetchLogs = async (from, to) => {
        if (from > to) return [];
        try {
          return await queryLogsBatched(contract, mintShareFilter, from, to);
        } catch (err) {
          const msg = String(err?.message || err || "");
          if (msg.toLowerCase().includes("pruned")) {
            return [];
          }
          throw err;
        }
      };
      const evts =
        latest != null && mintShareFilter
          ? await (async () => {
              const span = 5_000;
              const fromBlock = FULL_HISTORY
                ? Math.max(0, baseFrom)
                : Math.max(0, Math.max(baseFrom, latest - span));
              let logs = await safeFetchLogs(fromBlock, latest);
              if (!FULL_HISTORY && logs.length === 0 && span > 1_000) {
                logs = await safeFetchLogs(
                  Math.max(0, Math.max(baseFrom, latest - 1_000)),
                  latest,
                );
              }
              return logs;
            })()
          : [];
      const mapped = (evts || [])
        .slice(-12)
        .reverse()
        .map((e) => {
          const col = extractCollection(e);
          const amt = extractAmount(e);
          return {
            tx: e.transactionHash,
            block: e.blockNumber,
            COLLECTION: String(col),
            amount: formatEther(amt),
          };
        });
      setEvents(mapped);
      if (!mintShareFilter) {
        setStatus("Mint-share event not available in ABI");
      } else {
        setStatus("");
      }
    } catch (e) {
      console.error(e);
      setStatus("Load failed");
    } finally {
      setLoading(false);
    }
  }, [contract, account, provider, mintShareFilter, extractCollection, extractAmount]);

  React.useEffect(() => {
    loadOnChain();
  }, [contract, account, loadOnChain]);

  React.useEffect(() => {
    if (!contract || !contract.on || !mintShareFilter) return;
    const handler = (COLLECTION, amount, ev) => {
      const item = {
        tx: ev.transactionHash,
        block: ev.blockNumber,
        COLLECTION: String(COLLECTION),
        amount: formatEther(amount),
      };
      setEvents((prev) => [item, ...prev].slice(0, 12));
      loadOnChain();
    };
    contract.on(mintShareFilter, handler);
    return () => {
      try {
        contract.off(mintShareFilter, handler);
      } catch (e) {}
    };
  }, [contract, loadOnChain, mintShareFilter]);

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

  const futureCOLLECTIONs = Array.isArray(FUTURE_COLLECTIONS)
    ? FUTURE_COLLECTIONS
    : [];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div style={styles.titleGroup}>
            <div style={styles.logoBadge}>BG</div>
            <div>
              <h1 style={styles.h1}>{"Expansion -> Distributor"}</h1>
              <p style={styles.subtitle}>
                User dashboard — overview of the mint-share FLOW and your
                COLLECTION status
              </p>
            </div>
          </div>

          <div style={styles.headerActions}>
            {futureCOLLECTIONs.length ? (
              <button
                onClick={() => setFutureOpen(true)}
                style={styles.primaryBtn}
              >
                Future COLLECTIONs
              </button>
            ) : null}
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
                <div style={styles.statLabel}>Your COLLECTION received</div>
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
                  from whitelisted COLLECTIONs and routes it into reserves,
                  REWARDS, BUYBACK, and the treasury. In this user panel you can
                  see how much was received in total, how much was credited to
                  your COLLECTION, and the most recent mint-share events.
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
                        <th style={{ padding: "8px 6px" }}>COLLECTION</th>
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
                            {shortAddr(ev.COLLECTION)}
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
                    If you manage a COLLECTION and want to be whitelisted,
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

      {/* Future COLLECTION modal */}
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
                  Future COLLECTIONs
                </div>
                <div
                  style={{ color: THEME.dim, fontSize: 15, lineHeight: 1.5 }}
                >
                  Discover upcoming NFT COLLECTIONs in our ECOSYSTEM. Each
                  COLLECTION brings unique artwork and utility to the platform.
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

            <div style={styles.futureGrid}>
              {futureCOLLECTIONs.length ? (
                futureCOLLECTIONs.map((COLLECTION) => {
                  const detailsUrl =
                    COLLECTION?.detailsUrl || COLLECTION?.details || null;
                  const waitlistUrl =
                    COLLECTION?.waitlistUrl || COLLECTION?.waitlist || null;
                  return (
                    <div key={COLLECTION.id} style={styles.placeCard}>
                      <div style={styles.COLLECTIONBadge}>
                        {COLLECTION.status}
                      </div>

                      <div style={styles.placeThumb}>
                        {COLLECTION.name
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
                          {COLLECTION.name}
                        </div>
                        <div
                          style={{
                            color: THEME.dim,
                            fontSize: 13,
                            lineHeight: 1.4,
                            marginBottom: 12,
                          }}
                        >
                          {COLLECTION.description}
                        </div>
                      </div>

                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${COLLECTION.progress}%`,
                          }}
                        />
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
                        Launch Progress: {COLLECTION.progress}%
                      </div>

                      <div style={styles.statsRow}>
                        <div style={styles.statMini}>
                          <div style={{ color: THEME.dim, fontSize: 11 }}>
                            Items
                          </div>
                          <div
                            style={{
                              color: "#fff",
                              fontWeight: 700,
                              marginTop: 4,
                            }}
                          >
                            {COLLECTION.items}
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
                            {COLLECTION.mintPrice}
                          </div>
                        </div>
                      </div>

                      {detailsUrl || waitlistUrl ? (
                        <div style={{ display: "flex", gap: 10, width: "100%" }}>
                          {detailsUrl ? (
                            <button
                              style={{
                                ...styles.ghostBtn,
                                flex: 1,
                                padding: "10px",
                                background: "rgba(255,232,0,0.05)",
                                border: `1px solid rgba(255,232,0,0.2)`,
                                color: THEME.gold,
                              }}
                              onClick={() => window.open(detailsUrl, "_blank")}
                            >
                              View Details
                            </button>
                          ) : null}
                          {waitlistUrl ? (
                            <button
                              style={{
                                ...styles.ghostBtn,
                                flex: 1,
                                padding: "10px",
                                background: "rgba(93,220,255,0.05)",
                                border: `1px solid rgba(93,220,255,0.2)`,
                                color: THEME.cyan,
                              }}
                              onClick={() => window.open(waitlistUrl, "_blank")}
                            >
                              Join Waitlist
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div style={{ color: THEME.dim, fontSize: 14 }}>
                  No upcoming COLLECTIONs are configured yet.
                </div>
              )}
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
                About Future COLLECTIONs
              </div>
              <div style={{ color: THEME.dim, fontSize: 13, lineHeight: 1.6 }}>
                These COLLECTIONs are currently in development and will be
                integrated with the Distributor system upon launch. Each
                COLLECTION undergoes a thorough review process to ensure quality
                and compatibility with our ECOSYSTEM.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
