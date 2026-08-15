// src/components/INFO/ProjectInfoModal.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import "../../components/CollectionBlocksGrid.css";
import "../../features/rewards/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import TrustPanel from "../../features/info/trust/TrustPanel.jsx";

const SECTIONS = [
  { id: "overview", label: "Overview & How It Works", icon: "O" },
  { id: "guide", label: "User Guide", icon: "U" },
  { id: "pricing", label: "Pricing, Blocks & Mechanics", icon: "$" },
  { id: "transparency", label: "Transparency & On-Chain Proofs", icon: "#" },
  { id: "trust", label: "Trust", icon: "T" },
  { id: "trading", label: "Trading & User Experience", icon: "X" },
  { id: "roadmap", label: "Roadmap, Community & Legal", icon: "R" },
  { id: "troubleshooting", label: "Troubleshooting", icon: "!" },
  { id: "faq", label: "FAQ", icon: "?" },
  { id: "token", label: "BIGGI Ecosystem & Weekly Rewards", icon: "B" },
  { id: "liquidity", label: "Liquidity, Router & LP Controls", icon: "L" },
];

const COLORS = {
  text: "#f6f7fb",
  dim: "#cfd2db",
  line: "rgba(255,255,255,.12)",
  y: "#FFE800",
  p: "#FF5DA2",
  v: "#9B7BFF",
  c: "#27D9D2",
  g: "#6BEE5B",
};

const gradientBackdrop = "#0a0b10";

const SidebarButton = ({ active, icon, children, style, labelStyle, ...props }) => (
  <button
    {...props}
    className={`rewards-grid__tab${active ? " is-active" : ""}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      justifyContent: "flex-start",
      textAlign: "left",
      ...style,
    }}
  >
    <span aria-hidden>{icon}</span>
    <span
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0, // required for ellipsis inside flex containers
        flex: "1 1 auto",
        ...labelStyle,
      }}
    >
      {children}
    </span>
  </button>
);

const Card = ({ tone = "v", title, children }) => (
  <article className={`rewards-grid__card biggi-card biggi-card--${tone}`}>
    <div className="biggi-card__glow" aria-hidden />
    <div className="rewards-grid__card-header biggi-card__header">
      <div className="biggi-card__heading">
        <h3>{title}</h3>
      </div>
    </div>
    <div className="biggi-card__body">{children}</div>
  </article>
);

const Heading = ({ children }) => (
  <h4 style={{ margin: "6px 0", fontWeight: 900, color: COLORS.y }}>
    {children}
  </h4>
);

const Divider = ({ tone = COLORS.v }) => (
  <hr style={{ border: "none", height: 1, opacity: 0.18, background: tone }} />
);

const ArrowButton = ({ onClick, title, children }) => (
  <button
    type="button"
    className="biggi-ghost-btn"
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    title={title}
    aria-label={title}
    style={{
      width: 40,
      height: 40,
      borderRadius: 12,
      marginRight: 6,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLORS.y,
      fontWeight: 900,
    }}
  >
    {children}
  </button>
);

const ProjectInfoModal = ({
  open,
  onClose = () => {},
  onPrev,
  onNext,
  asPanel = false,
}) => {
  const sections = React.useMemo(() => SECTIONS, []);
  const [active, setActive] = React.useState(sections[0].id);
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  React.useEffect(() => {
    if (!open || asPanel) return;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, asPanel, onClose]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const handler = (event) => setIsMobile(event.matches);
    try {
      media.addEventListener("change", handler);
    } catch {
      media.addListener(handler);
    }
    return () => {
      try {
        media.removeEventListener("change", handler);
      } catch {
        media.removeListener(handler);
      }
    };
  }, []);

  React.useEffect(() => {
    if (sections.every((section) => section.id !== active)) {
      setActive(sections[0].id);
    }
  }, [sections, active]);

  if (!open) return null;

  const Sidebar = (
    <aside
      style={{
        background: "#14161c",
        border: `1px solid ${COLORS.v}33`,
        borderRadius: 16,
        padding: 12,
        display: "flex",
        flexDirection: isMobile ? "row" : "column",
        gap: 8,
        overflowX: isMobile ? "auto" : "visible",
      }}
    >
      {sections.map((section) => (
        <SidebarButton
          key={section.id}
          active={active === section.id}
          icon={section.icon}
          onClick={() => setActive(section.id)}
          aria-pressed={active === section.id}
          style={isMobile ? { width: "auto", flex: "0 0 auto" } : undefined}
          labelStyle={
            isMobile
              ? { whiteSpace: "nowrap" }
              : { whiteSpace: "normal", lineHeight: 1.25, wordBreak: "break-word" }
          }
        >
          {section.label}
        </SidebarButton>
      ))}
    </aside>
  );

  const Content = (
    <Card
      tone="c"
      title={sections.find((entry) => entry.id === active)?.label ?? ""}
    >
      <div
        className="rewards-info"
        style={{ display: "grid", gap: 16, lineHeight: 1.7 }}
      >
        {active === "overview" && (
          <>
            <Heading>Two-minute overview</Heading>
            <p>
              BiggiEyes is an on-chain NFT economy on Polygon mainnet.
              You mint a ticket, redeem it, and Chainlink VRF assigns a block
              and background before the NFT is minted to your wallet. Blocks
              act as rarity tiers, and backgrounds plus block state drive
              dynamic pricing.
            </p>

            <Heading>Collections and episodes</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>VRF Collection: ticket to redeem to VRF to NFT.</li>
              <li>
                Public Collection: direct mint by id when enabled, shown as a
                separate collection in the dashboard.
              </li>
              <li>
                Episodes (seasonal phases) group drops and rewards; when active,
                the UI highlights the current episode.
              </li>
            </ul>

            <Divider />

            <Heading>On-chain flow (high level)</Heading>
            <p>
              Mint revenue is routed on-chain through the protocol flow
              (Distributor to Reserve to Liquidity to Rewards to Buyback).
              Exact splits are defined by contracts and are verifiable on-chain.
            </p>
            <div
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                opacity: 0.9,
              }}
            >
{`Mint to Ticket NFT
Mint fees to Distributor
Distributor to Reserve | Buyback | Treasury | CollectionRewards
Buyback to Treasury
Treasury to TokenRewards + Reserve
Reserve to LiquidityManager to LiquidityVault`}
            </div>

            <Divider />

            <Heading>Why it matters</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>All critical state is on-chain and verifiable.</li>
              <li>Randomness is provable via Chainlink VRF.</li>
              <li>The dashboard is a read-only window into live data.</li>
            </ul>
          </>
        )}

        {active === "guide" && (
          <>
            <Heading>Quick start</Heading>
            <ol style={{ marginLeft: 18 }}>
              <li>Connect your wallet (MetaMask or WalletConnect).</li>
              <li>Mint a ticket with the native coin (POL).</li>
              <li>Redeem the ticket to request Chainlink VRF.</li>
              <li>Wait for VRF fulfillment and NFT mint confirmation.</li>
              <li>Track rarity in the gallery (block and background).</li>
              <li>Claim weekly BIGGI if your NFTs are eligible.</li>
            </ol>

            <Heading>Rarity and tracking</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Rarity is driven by block tier and background.</li>
              <li>Use filters and search to find specific traits.</li>
              <li>Ticket items are not eligible for rewards until redeemed.</li>
            </ul>

            <Heading>Dashboard tips</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Live stats show prices, supply, and pool balances.</li>
              <li>Status banners show pending, success, or errors.</li>
              <li>Use explorer links to verify any transaction.</li>
            </ul>

            <Heading>Mainnet note</Heading>
            <p style={{ marginTop: 6 }}>
              Network: Polygon mainnet (chainId 137). Keep a small POL balance
              for gas and confirm every wallet transaction carefully.
            </p>
          </>
        )}

        {active === "pricing" && (
          <>
            <Heading>Blocks and rarity tiers</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>The collection is split into blocks (rarity tiers).</li>
              <li>Each block has a base price, current price, and max supply.</li>
              <li>Block weights also drive weekly reward amounts.</li>
            </ul>

            <Heading>Dynamic pricing</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Ticket price increases gradually over time.</li>
              <li>Each mint applies a permanent background increase to its block.</li>
              <li>Final price = current block price + one-time background bonus.</li>
              <li>Redeem finalizes the mint and applies pricing on-chain.</li>
            </ul>

            <Heading>VRF vs Public collection</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>VRF collection uses ticket to redeem to random assignment.</li>
              <li>Public collection enables direct mint by id when active.</li>
              <li>Both collections use the same block and background pricing model.</li>
            </ul>

            <Heading>Episodes</Heading>
            <p>
              Episodes (seasonal phases) group drops and rewards. When an episode
              is active, the dashboard highlights it and surfaces its rules and
              progress.
            </p>
          </>
        )}

        {active === "transparency" && (
          <>
            <Heading>On-chain proofs</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>VRF requests and fulfillments are visible on the explorer.</li>
              <li>All mints, redeems, and claims emit on-chain events.</li>
              <li>Reserve, rewards, liquidity, and buyback balances are public.</li>
            </ul>

            <Heading>What the UI shows</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Live ticket price and block prices.</li>
              <li>Minted supply by block and remaining capacity.</li>
              <li>Reward pool balance and claim eligibility.</li>
              <li>NFT metadata stores ticketPrice, blockPrice, and finalPrice.</li>
            </ul>

            <Heading>How to verify</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Open the Trust tab for contract addresses.</li>
              <li>Use explorer links to audit transactions and balances.</li>
              <li>Snapshots are read-only and refreshed from chain data.</li>
            </ul>
          </>
        )}

        {active === "trust" && (
          <>
            <p>
              Trust is built on verifiable contracts. Administrative roles are
              explicit on-chain, and all parameter changes are recorded in
              transactions. The UI never holds keys or funds.
            </p>
            <TrustPanel />
          </>
        )}

        {active === "trading" && (
          <>
            <Heading>Secondary markets</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>NFTs are standard tokens and can be transferred or listed.</li>
              <li>Metadata and traits appear after VRF fulfillment.</li>
              <li>Use wallet approvals only when you intend to trade.</li>
            </ul>

            <Heading>User experience</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Status banners explain pending, success, or error states.</li>
              <li>IPFS images can load slowly on first view.</li>
              <li>Use the dashboard to track prices, rarity, and rewards.</li>
            </ul>

            <Heading>Recommended workflow</Heading>
            <p>
              Mint ticket to Redeem to Wait for VRF to View NFT to Claim weekly
              rewards.
            </p>
          </>
        )}

        {active === "roadmap" && (
          <>
            <Heading>Roadmap</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Mainnet monitoring and launch hardening (current focus).</li>
              <li>Security review and audit planning.</li>
              <li>Public mint launch after validation and review.</li>
              <li>Episodes, community events, and marketplace integrations.</li>
            </ul>

            <Heading>Community</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Use official links listed in the app.</li>
              <li>Beware of impersonators and verify addresses.</li>
            </ul>

            <Heading>Legal</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Not financial advice; use at your own risk.</li>
              <li>Mainnet transactions use real assets and are irreversible.</li>
              <li>Terms and privacy policy apply where provided.</li>
            </ul>
          </>
        )}

        {active === "troubleshooting" && (
          <>
            <Heading>Common issues</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Wallet not connected: connect MetaMask or WalletConnect.</li>
              <li>Wrong network: switch to Polygon mainnet (chainId 137).</li>
              <li>RPC errors: retry or switch to another RPC.</li>
              <li>Pending tx: wait, or speed up/cancel in wallet.</li>
              <li>NFT not showing: wait for VRF, then refresh metadata.</li>
              <li>Claim failed: not eligible or already claimed this week.</li>
            </ul>

            <Heading>Quick checks</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Verify on-chain status with the explorer link.</li>
              <li>Keep enough POL for gas.</li>
              <li>Do not resend a tx unless it is dropped on explorer.</li>
            </ul>
          </>
        )}

        {active === "faq" && (
          <>
            <Heading>FAQ</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li><strong>What is VRF?</strong> Verifiable randomness from Chainlink.</li>
              <li><strong>How do rewards work?</strong> Weekly, based on block weight.</li>
              <li><strong>What is BIGGI?</strong> The rewards token of the protocol.</li>
              <li><strong>How many NFTs exist?</strong> Fixed max per block, shown in the UI.</li>
              <li><strong>What if something fails?</strong> Check the explorer and retry.</li>
            </ul>
          </>
        )}

        {active === "token" && (
          <>
            <Heading>BIGGI token</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>BIGGI is the rewards token for the ecosystem.</li>
              <li>Supply, balances, and emissions are on-chain and verifiable.</li>
              <li>Rewards are distributed through the weekly claim system.</li>
            </ul>

            <Heading>Weekly rewards</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Each NFT can claim once per week.</li>
              <li>Claim amount depends on block weight (rarity tier).</li>
              <li>Eligibility and totals are shown in the claim center.</li>
            </ul>

            <Heading>Why NFTs create value</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Mint activity routes value to rewards and liquidity.</li>
              <li>Rarity impacts rewards, creating long-term incentives.</li>
            </ul>
          </>
        )}

        {active === "liquidity" && (
          <>
            <Heading>Core roles</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Reserve holds protocol balances on-chain.</li>
              <li>Liquidity Manager handles swaps and LP actions.</li>
              <li>LP Vault holds LP tokens for long-term liquidity.</li>
              <li>Buyback can acquire BIGGI from the market.</li>
              <li>Drip Distributor releases tokens or rewards over time.</li>
            </ul>

            <Heading>Router and LP controls</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Router and swap path are configurable on-chain.</li>
              <li>Slippage and balance usage are controlled by parameters.</li>
            </ul>

            <Heading>Protections</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Emergency actions exist for exceptional cases.</li>
              <li>All changes are on-chain and visible in the Trust tab.</li>
            </ul>
          </>
        )}

        </div>
    </Card>
  );

  const Body = (
    <>
      <div
        className="block-fullscreen__topbar"
        style={{
          background: "#14161c",
          border: `1px solid ${COLORS.line}`,
          borderRadius: 14,
          padding: isMobile ? "10px 12px" : "10px 14px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: isMobile ? 10 : 0,
          color: COLORS.text,
        }}
      >
        <h2
          style={{
            margin: 0,
            letterSpacing: 0.5,
            color: COLORS.y,
            textAlign: isMobile ? "center" : "left",
          }}
        >
          PROJECT INFO
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "center" : "flex-end",
            gap: 6,
          }}
        >
          {typeof onPrev === "function" && (
            <ArrowButton onClick={onPrev} title="Previous">
              ◄
            </ArrowButton>
          )}
          {typeof onNext === "function" && (
            <ArrowButton onClick={onNext} title="Next">
              ►
            </ArrowButton>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="biggi-ghost-btn"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: `1px solid ${COLORS.line}`,
              background: "#1a1d24",
              color: COLORS.y,
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="block-fullscreen__body" style={{ paddingTop: 12 }}>
        <div
          style={{
            display: isMobile ? "flex" : "grid",
            flexDirection: isMobile ? "column" : undefined,
            gridTemplateColumns: isMobile ? undefined : "320px 1fr",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          {Sidebar}
          {Content}
        </div>

        <div style={{ marginTop: 16 }}>
          <Card tone="v" title="Project Schema (overview)">
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                background: "#161920",
                border: `1px solid ${COLORS.line}`,
                display: "grid",
                placeItems: "center",
                minHeight: "48vh",
              }}
            >
              <img
                src="/diagrams/tokenomics-map.png"
                alt="Project schema – end-to-end FLOW from mint to tokenomics"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          </Card>
        </div>
      </div>

      <footer
        style={{
          marginTop: 14,
          padding: "10px 6px 4px",
          borderTop: `1px solid ${COLORS.line}`,
          color: COLORS.dim,
          fontSize: 12,
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} BIGGI / BiggiEyes. All rights reserved. •
        Nothing here is financial advice. • Use at your own risk.
      </footer>
    </>
  );

  const containerStyle = asPanel
    ? {
        background: gradientBackdrop,
        borderRadius: isMobile ? 12 : 18,
        border: `1px solid ${COLORS.line}`,
        height: isMobile ? "100%" : "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        color: COLORS.text,
      }
    : {
        background: gradientBackdrop,
        borderRadius: 0,
        border: "none",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        color: COLORS.text,
        padding: isMobile ? "14px 12px" : "24px 30px",
        boxSizing: "border-box",
      };

  const Container = (
    <div
      className="block-fullscreen__content"
      onClick={(event) => event.stopPropagation()}
      style={containerStyle}
    >
      <style>{`
        .rewards-table, .rewards-table * { transition: none !important; }
        .rewards-table:hover { background: #12141a !important; border-color: inherit !important; box-shadow: none !important; }
        .rewards-table:hover *, .rewards-table *:hover { background: transparent !important; color: inherit !important; box-shadow: none !important; filter: none !important; transform: none !important; }
      `}</style>
      {Body}
    </div>
  );

  if (asPanel) {
    return Container;
  }

  const overlay = (
    <div
      className="block-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Project information"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "center",
        padding: isMobile ? "16px 12px" : 0,
        background: "rgba(0, 0, 0, 0.75)",
        overflowY: isMobile ? "auto" : undefined,
      }}
    >
      {Container}
    </div>
  );

  if (typeof document !== "undefined") {
    const target = document.body;
    return ReactDOM.createPortal(overlay, target);
  }

  return overlay;
};

export default ProjectInfoModal;






