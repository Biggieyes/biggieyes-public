import * as React from "react";

const PROJECT_NAME = "BiggiEyes";

const FAQ_ITEMS = [
  {
    question: "What is BiggiEyes?",
    answer:
      "BiggiEyes is a Polygon mainnet NFT protocol built around ticket minting, Chainlink VRF reveals, collection chapters, BIGGI token rewards, and transparent on-chain tokenomics.",
  },
  {
    question: "How does minting work?",
    answer:
      "A user mints a ticket first. A redeem action then requests Chainlink VRF, assigns the final traits, and mints the revealed NFT to the wallet when the request is fulfilled.",
  },
  {
    question: "What are chapters and paired collections?",
    answer:
      "Each chapter can contain a VRF collection and a paired Public collection. The VRF side controls the rarity and block-price logic; the Public side follows the paired chapter rules without background variants.",
  },
  {
    question: "How do prices increase?",
    answer:
      "Marketing tickets are priced separately. After the public sale starts, ticket price and block prices follow the contract rules, including block and trait-based mechanics visible in the dashboard.",
  },
  {
    question: "How do BIGGI rewards work?",
    answer:
      "Eligible revealed NFTs can participate in weekly BIGGI rewards. Reward weight comes from the NFT block tier and the live on-chain reward configuration.",
  },
  {
    question: "What happens to mint funds?",
    answer:
      "Mint value is routed by contracts into protocol branches such as treasury, reserve, drip, buyback, liquidity, and token rewards. The dashboard reads those balances from mainnet contracts.",
  },
  {
    question: "Is CRE required for minting?",
    answer:
      "No. Core minting and VRF fulfillment are contract-level mechanics. CRE is planned for protocol automation such as buyback, drip, liquidity, reserve checks, and reward maintenance.",
  },
  {
    question: "How can I verify the project?",
    answer:
      "Use the in-app Trust and ecosystem panels, explorer links, OpenSea contract pages, and the public repository to verify deployed addresses, events, balances, and source documentation.",
  },
];

const LINKS = [
  { label: "Dashboard", href: "#top" },
  { label: "Live Stats", href: "#live-stats" },
  { label: "Gallery", href: "#gallery" },
  {
    label: "GitHub",
    href: "https://github.com/Biggieyes/biggieyes-public",
    external: true,
  },
];

const CONTACTS = [
  { label: "eyesbiggi@gmail.com", href: "mailto:eyesbiggi@gmail.com" },
  { label: "X / Twitter", href: "https://x.com/EyesBiggi", external: true },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/biggi-eyes-660639398/",
    external: true,
  },
  {
    label: "Discord",
    href: "https://discord.com/channels/1405985959815942175/1405985961006858282",
    external: true,
  },
];

export default function SiteFooter() {
  const [openFaq, setOpenFaq] = React.useState(FAQ_ITEMS[0]?.question ?? "");

  const handleInternalLink = React.useCallback((event, href) => {
    if (!href?.startsWith("#") || typeof window === "undefined") return;
    event.preventDefault();
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    window.history.replaceState(null, "", href);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <footer className="site-footer" id="footer">
      <div className="site-footer__inner site-footer__inner--minimal">
        <div className="site-footer__header">
          <div className="site-footer__title">{PROJECT_NAME}</div>
          <div className="site-footer__tagline">FAQ, links, contacts</div>
        </div>

        <div className="site-footer__grid site-footer__grid--minimal">
          <div className="site-footer__card site-footer__card--links">
            <h4>Links</h4>
            <ul className="site-footer__list">
              {LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    className="site-footer__link"
                    href={item.href}
                    onClick={(event) =>
                      !item.external && handleInternalLink(event, item.href)
                    }
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__card site-footer__card--faq">
            <h4>FAQ</h4>
            <ul className="site-footer__list site-footer__faq-list">
              {FAQ_ITEMS.map((item) => (
                <li key={item.question} className="site-footer__faq-item">
                  <button
                    type="button"
                    className="site-footer__faq-question"
                    aria-expanded={openFaq === item.question}
                    onClick={() =>
                      setOpenFaq((current) =>
                        current === item.question ? "" : item.question,
                      )
                    }
                  >
                    <span>{item.question}</span>
                    <span aria-hidden>{openFaq === item.question ? "-" : "+"}</span>
                  </button>
                  {openFaq === item.question && (
                    <p className="site-footer__faq-answer">{item.answer}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__card site-footer__card--contacts">
            <h4>Contacts</h4>
            <ul className="site-footer__list">
              {CONTACTS.map((item) => (
                <li key={item.label}>
                  <a
                    className="site-footer__link"
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          (c) {new Date().getFullYear()} {PROJECT_NAME}
        </div>
      </div>
    </footer>
  );
}
