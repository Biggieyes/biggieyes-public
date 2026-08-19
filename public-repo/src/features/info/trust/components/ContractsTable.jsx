import * as React from "react";
import { ADDR, CORE_CHAPTERS } from "@/shared/utils/addresses";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 10,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  color: "#9aa3b2",
  fontWeight: 700,
};

const tdStyle = {
  padding: "8px 6px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  verticalAlign: "middle",
};

const mono = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: 12,
};

const buttonStyle = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0f1116",
  color: "#cfd6e6",
  padding: "4px 8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const explorerBase = "https://polygonscan.com/address/";

function isAddressLike(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || ""));
}

function pickAddress(...values) {
  return values.find(isAddressLike) || "";
}

const chapterContracts = CORE_CHAPTERS.flatMap((chapter) => [
  {
    name: `Chapter ${chapter.chapterId} ${chapter.displayName} VRF`,
    address: pickAddress(chapter.main),
    role: `Series ${chapter.seriesId} VRF collection`,
  },
  {
    name: `Chapter ${chapter.chapterId} ${chapter.displayName} Public`,
    address: pickAddress(chapter.main2),
    role: `Series ${chapter.seriesId} public collection`,
  },
]);

const contracts = [
  ...chapterContracts,
  {
    name: "TicketHub",
    address: pickAddress(ADDR.TICKET_HUB),
    role: "Ticket mint and redeem hub",
  },
  {
    name: "MainReader",
    address: pickAddress(ADDR.MAIN_READER, ADDR.READER),
    role: "Core frontend snapshot reader",
  },
  {
    name: "ChapterSeriesReader",
    address: pickAddress(ADDR.CHAPTER_SERIES_READER),
    role: "Series and chapter visibility reader",
  },
  {
    name: "VRFRouter",
    address: pickAddress(ADDR.VRF_ROUTER),
    role: "Chainlink VRF coordinator adapter",
  },
  {
    name: "BiggiToken",
    address: pickAddress(ADDR.BIGGI_TOKEN, ADDR.BIGGI),
    role: "ERC-20 token",
  },
  {
    name: "Reserve",
    address: pickAddress(ADDR.RESERVE),
    role: "Reserve bucket",
  },
  {
    name: "LiquidityManager",
    address: pickAddress(ADDR.LM, ADDR.LIQUIDITY_MANAGER),
    role: "LP manager",
  },
  {
    name: "LiquidityVault",
    address: pickAddress(ADDR.LIQUIDITY_VAULT),
    role: "LP custody vault",
  },
  {
    name: "Treasury",
    address: pickAddress(ADDR.TREASURY),
    role: "Treasury wallet",
  },
  {
    name: "BuybackAgent",
    address: pickAddress(ADDR.BUYBACK_AGENT),
    role: "Buyback executor",
  },
  {
    name: "DripDistributor",
    address: pickAddress(ADDR.DRIP_DISTRIBUTOR),
    role: "DRIP emission",
  },
  {
    name: "DripLM",
    address: pickAddress(ADDR.DRIP_LM),
    role: "DRIP sell and routing logic",
  },
  {
    name: "TokenRewards",
    address: pickAddress(ADDR.TOKEN_REWARDS),
    role: "Token rewards",
  },
  {
    name: "NFTRewards",
    address: pickAddress(ADDR.NFT_REWARDS),
    role: "NFT reward layer",
  },
  {
    name: "CollectionRewards",
    address: pickAddress(ADDR.COLLECTION_REWARDS),
    role: "Collection reward bucket",
  },
  {
    name: "MultiCollectionDistributor",
    address: pickAddress(ADDR.MULTI_COLLECTION_DISTRIBUTOR, ADDR.DISTRIBUTOR),
    role: "Multi-collection distribution",
  },
  {
    name: "MCDReaderV2",
    address: pickAddress(ADDR.MCD_READER_V2, ADDR.MULTI_COLLECTION_READER),
    role: "Distributor frontend reader",
  },
  {
    name: "TokenomicsStatusReader",
    address: pickAddress(ADDR.BIGGI_TOKENOMICS_READER, ADDR.TOKENOMIK_READER),
    role: "Aggregated tokenomics status reader",
  },
  {
    name: "TokenomicsAddonReader",
    address: pickAddress(ADDR.TOKENOMICS_SYSTEM_ADDON_READER),
    role: "Extended ecosystem reader",
  },
  {
    name: "TokenRewardsReader",
    address: pickAddress(ADDR.TOKEN_REWARDS_READER),
    role: "Token rewards reader",
  },
  {
    name: "ReserveTreasuryReader",
    address: pickAddress(ADDR.RESERVE_TREASURY_READER),
    role: "Reserve and treasury reader",
  },
  {
    name: "BuybackReader",
    address: pickAddress(ADDR.BUYBACK_READER),
    role: "Buyback reader",
  },
  {
    name: "LiquidityHelperReader",
    address: pickAddress(ADDR.LIQUIDITY_HELPER_READER, ADDR.LIQ_HELPER_READER),
    role: "Liquidity helper reader",
  },
  {
    name: "DEX Pair",
    address: pickAddress(ADDR.PAIR),
    role: "BIGGI/WPOL pair",
  },
  {
    name: "DEX Router",
    address: pickAddress(ADDR.ROUTER),
    role: "QuickSwap/UniswapV2 router",
  },
].filter((row) => isAddressLike(row.address));

function shortAddr(addr) {
  if (!addr) return "-";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

export default function ContractsTable() {
  const [copied, setCopied] = React.useState("");

  const handleCopy = React.useCallback(async (addr, name) => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(name);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      try {
        const input = document.createElement("input");
        input.value = addr;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopied(name);
        setTimeout(() => setCopied(""), 1200);
      } catch {
        setCopied("");
      }
    }
  }, []);

  return (
    <section style={cardStyle}>
      <h3 style={titleStyle}>Contracts</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Contract</th>
              <th style={thStyle}>Address</th>
              <th style={thStyle}>Explorer</th>
              <th style={thStyle}>Verified</th>
              <th style={thStyle}>Role</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((row) => (
              <tr key={row.name}>
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <span style={mono}>{shortAddr(row.address)}</span>
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => handleCopy(row.address, row.name)}
                      aria-label={`Copy ${row.name} address`}
                    >
                      {copied === row.name ? "Copied" : "Copy"}
                    </button>
                  </div>
                </td>
                <td style={tdStyle}>
                  {row.address ? (
                    <a
                      href={`${explorerBase}${row.address}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#8fd3ff", textDecoration: "none" }}
                      aria-label={`Open ${row.name} on explorer`}
                    >
                      Open
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{ color: "#9ef0a1", fontWeight: 700 }}>
                    true
                  </span>
                </td>
                <td style={tdStyle}>{row.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
