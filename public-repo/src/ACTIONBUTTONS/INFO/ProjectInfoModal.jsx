// src/components/INFO/ProjectInfoModal.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import "../../components/CollectionBlocksGrid.css";
import "../../features/rewards/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";
import TrustPanel from "../../features/info/trust/TrustPanel.jsx";
import "./ProjectInfoModal.css";

const SECTIONS = [
  { id: "overview", label: "Overview & How It Works" },
  { id: "guide", label: "User Guide" },
  { id: "pricing", label: "Pricing, Blocks & Mechanics" },
  { id: "transparency", label: "Transparency & On-Chain Proofs" },
  { id: "trust", label: "Trust" },
  { id: "trading", label: "Trading & User Experience" },
  { id: "roadmap", label: "Roadmap, Community & Legal" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "faq", label: "FAQ" },
  { id: "token", label: "BIGGI Ecosystem & Weekly Rewards" },
  { id: "liquidity", label: "Liquidity, Router & LP Controls" },
  { id: "schema", label: "Protocol Map" },
];

const PROJECT_FAQ_ITEMS = [
  {
    question: "What is BiggiEyes?",
    answer:
      "BiggiEyes is a Polygon mainnet NFT protocol with ticket minting, Chainlink VRF reveals, paired collection chapters, BIGGI rewards, and transparent on-chain tokenomics.",
  },
  {
    question: "What do I buy first?",
    answer:
      "You mint a ticket first. The ticket is then redeemed to request Chainlink VRF, which finalizes the NFT outcome and mints the revealed NFT to your wallet.",
  },
  {
    question: "Why does the project use Chainlink VRF?",
    answer:
      "VRF gives the reveal process verifiable randomness. That matters because block tier and traits affect rarity, pricing context, and reward weight.",
  },
  {
    question: "What is the difference between VRF and Public collections?",
    answer:
      "The VRF collection uses ticket redemption and random assignment. The paired Public collection is a smaller direct-mint collection for the same chapter and follows the chapter's block pricing without background variants.",
  },
  {
    question: "How many NFTs are in the Public collection?",
    answer:
      "The Public collection has 100 NFTs per chapter, ten per block. It does not clone each block across background colors because that mechanic belongs to the VRF collection.",
  },
  {
    question: "How do ticket and block prices work?",
    answer:
      "Marketing tickets are handled separately. After the public sale begins, contract logic controls ticket pricing, block pricing, and chapter-specific state. The dashboard displays the current mainnet values.",
  },
  {
    question: "How do BIGGI weekly rewards work?",
    answer:
      "Eligible revealed NFTs can claim weekly BIGGI rewards. The amount depends on live reward settings and the NFT's block tier weight.",
  },
  {
    question: "Where does mint revenue go?",
    answer:
      "A POL-paid mint sends 40% to the dev wallet and 60% to the MultiCollectionDistributor. That distributor share is split 25% to CollectionRewards, 35% to Reserve, 20% to Buyback, 10% to Treasury, and 10% to Community. BIGGI-paid mints use the separate Treasury 34/33/33 route.",
  },
  {
    question: "Is CRE part of core minting?",
    answer:
      "No. Core minting and VRF fulfillment are handled by contracts. CRE is planned for automation around buyback, drip, liquidity, reserve checks, and reward maintenance.",
  },
  {
    question: "How do I verify contract data?",
    answer:
      "Use the Trust tab, explorer links, OpenSea contract pages, and repository documentation. Mainnet transactions, balances, source verification, and events should be independently checkable.",
  },
];

const SidebarButton = ({ active, index, children, ...props }) => (
  <button
    {...props}
    type="button"
    className={`project-info-tab${active ? " is-active" : ""}`}
  >
    <span className="project-info-tab__index" aria-hidden>
      {String(index + 1).padStart(2, "0")}
    </span>
    <span className="project-info-tab__label">{children}</span>
  </button>
);

const Card = ({ tone = "v", title, children }) => (
  <article className={`project-info-card project-info-card--${tone}`}>
    <header className="project-info-card__header">
      <h3 className="project-info-card__title">{title}</h3>
    </header>
    <div className="project-info-card__body">{children}</div>
  </article>
);

const Heading = ({ children }) => (
  <h4 className="project-info-heading">{children}</h4>
);

const Divider = () => <hr className="project-info-divider" />;

const ArrowButton = ({ onClick, title, children }) => (
  <button
    type="button"
    className="project-info-icon-button"
    onClick={(event) => {
      event.stopPropagation();
      onClick?.();
    }}
    title={title}
    aria-label={title}
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
  const scrollRef = React.useRef(null);
  const closeButtonRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || asPanel) return;
    const onKey = (event) => event.key === "Escape" && onClose();
    const previouslyFocused = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, asPanel, onClose]);

  React.useEffect(() => {
    if (sections.every((section) => section.id !== active)) {
      setActive(sections[0].id);
    }
  }, [sections, active]);

  if (!open) return null;

  const handleSectionChange = (sectionId) => {
    setActive(sectionId);
    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const Sidebar = (
    <nav
      className="project-info-nav"
      role="tablist"
      aria-label="Project information sections"
    >
      {sections.map((section, index) => (
        <SidebarButton
          key={section.id}
          active={active === section.id}
          index={index}
          id={`project-info-tab-${section.id}`}
          role="tab"
          aria-selected={active === section.id}
          aria-controls="project-info-active-panel"
          onClick={() => handleSectionChange(section.id)}
        >
          {section.label}
        </SidebarButton>
      ))}
    </nav>
  );

  const Content = (
    <div
      className="project-info-content"
      id="project-info-active-panel"
      role="tabpanel"
      aria-labelledby={`project-info-tab-${active}`}
    >
      <Card
        tone="c"
        title={sections.find((entry) => entry.id === active)?.label ?? ""}
      >
      <div className="project-info-copy">
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

            <Heading>Collections and chapters</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>VRF Collection: ticket to redeem to VRF to NFT.</li>
              <li>
                Public Collection: direct mint by id when enabled, shown as a
                separate collection in the dashboard.
              </li>
              <li>
                Each chapter pairs one VRF collection with one Public collection.
                Chapters become available sequentially.
              </li>
            </ul>

            <Divider />

            <Heading>On-chain flow (high level)</Heading>
            <p>
              POL and BIGGI payments use separate on-chain routes. The native
              distributor split and the BIGGI treasury split are fixed by the
              deployed contract libraries and are independently verifiable.
            </p>
            <div className="project-info-flow">
{`POL mint
|- 40% -> Dev wallet
+- 60% -> MultiCollectionDistributor
   |- 25% -> CollectionRewards
   |- 35% -> Reserve
   |- 20% -> Buyback
   |- 10% -> Treasury
   +- 10% -> Community

BIGGI mint -> Treasury
|- 34% -> TokenRewards
|- 33% -> Reserve
+- 33% -> DripDistributor`}
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
              <li>
                Public contains 100 NFTs, ten per block, without background
                variants; its block prices come from the paired VRF collection.
              </li>
            </ul>

            <Heading>Chapter sequencing</Heading>
            <p>
              Only one chapter can be available at a time. Future chapter pairs
              remain inactive until their configuration and launch gates are
              complete.
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
              <li>Future chapters, community events, and marketplace integrations.</li>
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
            <Heading>Essential questions</Heading>
            <div className="project-info-faq">
              {PROJECT_FAQ_ITEMS.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
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

        {active === "schema" && (
          <>
            <div className="project-info-map-notes">
              <p>
                <strong>POL route:</strong> 40% dev wallet and 60% distributor;
                the diagram shows the distributor branches.
              </p>
              <p>
                <strong>BIGGI route:</strong> 100% enters BiggiTreasury and is
                split 34% / 33% / 33% to TokenRewards, Reserve, and
                DripDistributor.
              </p>
            </div>
            <div className="project-info-map">
              <img
                src="/diagrams/tokenomics-map.png"
                alt="End-to-end protocol flow from minting to tokenomics"
                loading="lazy"
                decoding="async"
              />
            </div>
          </>
        )}

      </div>
      </Card>
    </div>
  );

  const Body = (
    <>
      <header className="project-info-header">
        <div className="project-info-title-group">
          <h2 className="project-info-title">PROJECT INFO</h2>
          <span className="project-info-network">Polygon mainnet</span>
        </div>
        <div className="project-info-header-actions">
          {typeof onPrev === "function" && (
            <ArrowButton onClick={onPrev} title="Previous">
              {"\u25c0"}
            </ArrowButton>
          )}
          {typeof onNext === "function" && (
            <ArrowButton onClick={onNext} title="Next">
              {"\u25b6"}
            </ArrowButton>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="project-info-icon-button"
          >
            {"\u00d7"}
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="project-info-scroll">
        <div className="project-info-layout">
          {Sidebar}
          {Content}
        </div>

        <footer className="project-info-footer">
          &copy; {new Date().getFullYear()} BIGGI / BiggiEyes. All rights reserved.
          {" | "}Nothing here is financial advice.{" | "}Use at your own risk.
        </footer>
      </div>
    </>
  );

  const Container = (
    <div
      className={`block-fullscreen__content project-info-shell${
        asPanel ? " project-info-shell--panel" : ""
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      {Body}
    </div>
  );

  if (asPanel) {
    return Container;
  }

  const overlay = (
    <div
      className="block-fullscreen project-info-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Project information"
      onClick={onClose}
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
