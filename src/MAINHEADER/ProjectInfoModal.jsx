// src/components/INFO/ProjectInfoModal.jsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import "../../components/COLLECTIONBlocksGrid.css";
import "../../MAINHEADER/PANELS/REWARDS/REWARDSPanel.css";
import "../../styles/biggi-token.skin.css";

const SECTIONS = [
  { id: "overview", label: "Overview & How It Works", icon: "đź“" },
  { id: "pricing", label: "Pricing, Blocks & Mechanics", icon: "đź’°" },
  { id: "transparency", label: "Transparency & On-Chain Proofs", icon: "đź”—" },
  { id: "trading", label: "Trading & User Experience", icon: "đź§­" },
  { id: "roadmap", label: "Roadmap, Community & Legal", icon: "đź—şď¸Ź" },
  { id: "faq", label: "FAQ", icon: "âť“" },
  { id: "token", label: "BIGGI ECOSYSTEM & Weekly REWARDS", icon: "đźŽ" },
  { id: "liquidity", label: "Liquidity, Router & LP Controls", icon: "đźŚŠ" },
  { id: "videos", label: "Video Manual", icon: "đźŽ¬" },
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

const SidebarButton = ({ active, icon, children, ...props }) => (
  <button
    {...props}
    className={`REWARDS-grid__tab${active ? " is-active" : ""}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      justifyContent: "flex-start",
    }}
  >
    <span aria-hidden>{icon}</span>
    <span
      style={{
        overFLOW: "hidden",
        textOverFLOW: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  </button>
);

const Card = ({ tone = "v", title, children }) => (
  <article className={`REWARDS-grid__card biggi-card biggi-card--${tone}`}>
    <div className="biggi-card__glow" aria-hidden />
    <div className="REWARDS-grid__card-header biggi-card__header">
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

const VideoPill = ({ index, tone }) => (
  <button
    type="button"
    aria-disabled="true"
    title={`Video ${index} (coming soon)`}
    className="biggi-ghost-btn"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 12,
      border: `1px solid ${tone}66`,
      background: "#1a1d24",
      color: COLORS.text,
      cursor: "default",
    }}
  >
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        border: `1px solid ${tone}66`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
      }}
    >
      â–¶
    </span>
    <span style={{ fontSize: 12 }}>{`Video ${index}`}</span>
  </button>
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
        overFLOWX: isMobile ? "auto" : "visible",
      }}
    >
      {sections.map((section) => (
        <SidebarButton
          key={section.id}
          active={active === section.id}
          icon={section.icon}
          onClick={() => setActive(section.id)}
          aria-pressed={active === section.id}
          style={
            isMobile
              ? {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  flex: "0 0 auto",
                  whiteSpace: "nowrap",
                }
              : undefined
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
        className="REWARDS-info"
        style={{ display: "grid", gap: 16, lineHeight: 1.7 }}
      >
        {active === "overview" && (
          <>
            <Heading>How it works â€” 3 steps</Heading>
            <ol style={{ marginLeft: 18 }}>
              <li>
                <strong>Mint ticket:</strong> pay in ETH or BIGGI.
              </li>
              <li>
                <strong>Redeem:</strong> redeem the ticket and request
                randomness via Chainlink VRF.
              </li>
              <li>
                <strong>Mint NFT:</strong> VRF assigns block, background and
                mainId, and the NFT is minted immediately.
              </li>
            </ol>

            <Divider />

            <Heading>Pricing in a nutshell</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                <strong>Permanent background effect:</strong> each background
                permanently increases the price of its own block.
              </li>
              <li>
                <strong>Final price:</strong> current price of the block at mint
                time plus background bonus.
              </li>
              <li>
                We store three values: <code>ticketPrice</code>,{" "}
                <code>blockPrice</code> and <code>finalPrice</code>.
              </li>
            </ul>
          </>
        )}

        {active === "pricing" && (
          <>
            <Heading>Core principles</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                Each mint stores <code>ticketPrice</code>,{" "}
                <code>blockPrice</code> (current block price at mint) and{" "}
                <code>finalPrice</code>.
              </li>
              <li>
                Backgrounds permanently raise the price of their own block.
              </li>
              <li>
                Ticket price increases independently on every mint (~0.33%).
              </li>
            </ul>

            <Heading>Order of calculation</Heading>
            <ol style={{ marginLeft: 18 }}>
              <li>Apply the permanent background increase.</li>
              <li>Use the current price of the minted block as base.</li>
              <li>Add the one-time background bonus to get the final price.</li>
            </ol>
          </>
        )}

        {active === "transparency" && (
          <>
            <Heading>On-chain data</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Live ticket price, block prices, minted/remaining supply.</li>
              <li>
                Background increases, reward pool balance, claim eligibility.
              </li>
              <li>
                Per NFT: <code>ticketPrice</code>, <code>blockPrice</code>,{" "}
                <code>finalPrice</code>.
              </li>
            </ul>

            <Heading>Provably fair randomness</Heading>
            <p>Chainlink VRF requests and fulfillments are fully auditable.</p>
          </>
        )}

        {active === "trading" && (
          <>
            <Heading>UX elements</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                Gallery with filters by block/background/mainId and search.
              </li>
              <li>Live redeem/VRF state and detailed mint price breakdown.</li>
              <li>
                Claim preview with exact reasons why an NFT is (not) claimable.
              </li>
            </ul>
          </>
        )}

        {active === "roadmap" && (
          <>
            <Heading>Roadmap (status: live)</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Expanded frontend, full claim centre, VRF view, timeline.</li>
              <li>Liquidity tools, LP overview, historical snapshots.</li>
              <li>
                Token utilities: sink routing, conversion controls, guides.
              </li>
            </ul>

            <Heading>Community & Legal</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>Moderated community space with verified addresses.</li>
              <li>Crypto/NFT risks apply; nothing is financial advice.</li>
              <li>
                Using the app implies acceptance of Terms & Privacy POLICY.
              </li>
            </ul>
          </>
        )}

        {active === "faq" && (
          <>
            <Heading>FAQ</Heading>
            <p>
              Coming soon â€” we will cover claims, pricing, metadata,
              transactions and wallets.
            </p>
          </>
        )}

        {active === "token" && (
          <>
            <Heading>Token overview</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                BIGGI is the REWARDS token; the app shows address, meta and
                remaining emission.
              </li>
            </ul>

            <Heading>Weekly REWARDS</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                Each NFT can claim once per week based on block weight (1â€“10).
              </li>
              <li>
                The interface highlights the current reward week and next
                eligible claim date.
              </li>
            </ul>
          </>
        )}

        {active === "liquidity" && (
          <>
            <Heading>Router & path</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                Shows DEX router, wrapped native token and swap path (typically
                WNATIVE â†’ BIGGI).
              </li>
            </ul>

            <Heading>LP workFLOW</Heading>
            <ul style={{ marginLeft: 18 }}>
              <li>
                <code>bootstrapLiquidity</code> creates the pool and mints LP
                tokens.
              </li>
              <li>
                <code>addLiquidityFromBalance</code> swaps part to BIGGI, keeps
                part in native and deposits both.
              </li>
            </ul>
          </>
        )}

        {active === "videos" && (
          <>
            <Heading>Video manuals (placeholders)</Heading>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.y}33`,
                  background: "#1a1d24",
                }}
              >
                <VideoPill index={1} tone={COLORS.y} />
                <div>
                  <strong>Mint / Redeem:</strong> buying tickets, redeem FLOW
                  and VRF fulfillment.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.p}33`,
                  background: "#1a1d24",
                }}
              >
                <VideoPill index={2} tone={COLORS.p} />
                <div>
                  <strong>Blocks / Backgrounds:</strong> permanent block
                  increases and one-off background bonuses.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.v}33`,
                  background: "#1a1d24",
                }}
              >
                <VideoPill index={3} tone={COLORS.v} />
                <div>
                  <strong>VRF:</strong> provably fair randomness,
                  request/fulfill and auditing on explorer.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.c}33`,
                  background: "#1a1d24",
                }}
              >
                <VideoPill index={4} tone={COLORS.c} />
                <div>
                  <strong>Liquidity:</strong> router, pair,
                  bootstrap/add-liquidity and LP token FLOW.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.g}33`,
                  background: "#1a1d24",
                }}
              >
                <VideoPill index={5} tone={COLORS.g} />
                <div>
                  <strong>Users:</strong> wallet connection, NFT import, gallery
                  and REWARDS claim.
                </div>
              </div>
            </div>
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
              â—„
            </ArrowButton>
          )}
          {typeof onNext === "function" && (
            <ArrowButton onClick={onNext} title="Next">
              â–ş
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
            âś•
          </button>
        </div>
      </div>

      <div className="block-fullscreen__body" style={{ paddingTop: 12 }}>
        <div
          style={{
            display: isMobile ? "flex" : "grid",
            flexDirection: isMobile ? "column" : undefined,
            gridTemplateColumns: isMobile ? undefined : "260px 1fr",
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
                overFLOW: "hidden",
                background: "#161920",
                border: `1px solid ${COLORS.line}`,
                display: "grid",
                placeItems: "center",
                minHeight: "48vh",
              }}
            >
              <img
                src="/schema-biggi.png"
                alt="Project schema â€“ end-to-end FLOW from mint to tokenomics"
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
        Â© {new Date().getFullYear()} BIGGI / BiggiEyes. All rights reserved. â€˘
        Nothing here is financial advice. â€˘ Use at your own risk.
      </footer>
    </>
  );

  const containerStyle = asPanel
    ? {
        background: gradientBackdrop,
        borderRadius: isMobile ? 12 : 18,
        border: `1px solid ${COLORS.line}`,
        height: isMobile ? "100%" : "90vh",
        overFLOW: "hidden",
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
        overFLOWY: "auto",
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
        .REWARDS-table, .REWARDS-table * { transition: none !important; }
        .REWARDS-table:hover { background: #12141a !important; border-color: inherit !important; box-shadow: none !important; }
        .REWARDS-table:hover *, .REWARDS-table *:hover { background: transparent !important; color: inherit !important; box-shadow: none !important; filter: none !important; transform: none !important; }
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
        overFLOWY: isMobile ? "auto" : undefined,
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








