import * as React from "react";
import { ADDR, DEFAULT_CHAIN_ID } from "@/shared/utils/addresses";

const PROJECT_NAME = "BiggiEyes";
const TAGLINE =
  "Dynamic NFT collection with VRF reveal, on-chain rewards, and tokenomics.";

const FAQ = [
  {
    q: "How do I mint?",
    a: "Connect your wallet and mint a ticket. Tickets are redeemed to reveal NFTs.",
  },
  {
    q: "How do I reveal?",
    a: "Redeem a ticket to trigger VRF. The final NFT appears after confirmation.",
  },
  {
    q: "Where do prices come from?",
    a: "Block prices are read on-chain and shown live in the stats panels.",
  },
  {
    q: "How do rewards work?",
    a: "Weekly rewards depend on owned NFTs and block weights.",
  },
];

const COMMUNITY = [
  { label: "X / Twitter", href: "#", placeholder: true },
  { label: "Discord", href: "#", placeholder: true },
  { label: "Telegram", href: "#", placeholder: true },
  { label: "eyesbiggi@gmail.com", href: "mailto:eyesbiggi@gmail.com" },
];

const LINKS = [
  { label: "Live Stats", href: "#live-stats" },
  { label: "Gallery", href: "#gallery" },
  { label: "Back to Top", href: "#top" },
  { label: "Docs", href: "#", placeholder: true },
];

const LEGAL = [
  { label: "Terms of Service", href: "#", placeholder: true },
  { label: "Privacy Policy", href: "#", placeholder: true },
  { label: "Risk Disclaimer", href: "#", placeholder: true },
];

const CONTRACTS = [
  { label: "Main (VRF)", addr: ADDR.MAIN },
  { label: "Main2 (Public)", addr: ADDR.MAIN2 },
  { label: "BIGGI Token", addr: ADDR.BIGGI },
  { label: "Collection Rewards", addr: ADDR.COLLECTION_REWARDS },
  { label: "Token Rewards", addr: ADDR.TOKEN_REWARDS },
  { label: "NFT Rewards", addr: ADDR.NFT_REWARDS },
  { label: "Treasury", addr: ADDR.TREASURY },
  { label: "Buyback Agent", addr: ADDR.BUYBACK_AGENT },
];

const RPC_URL =
  import.meta.env.VITE_JSON_RPC_URL ||
  import.meta.env.VITE_POLYGON_RPC_URL ||
  import.meta.env.VITE_RPC_URL_ACTIVE_CHAIN ||
  "";

const safeRpcLabel = (url) => {
  if (!url) return "TBD (set VITE_JSON_RPC_URL)";
  try {
    const parsed = new URL(url);
    return parsed.hostname || "RPC configured";
  } catch {
    return "RPC configured";
  }
};

const shortAddr = (addr) => {
  if (!addr) return "TBD";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const explorerUrl = (addr) =>
  addr ? `https://polygonscan.com/address/${addr}` : "#";
const EXPLORER_BASE = "https://polygonscan.com";

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="footer">
      <div className="site-footer__inner">
        <div className="site-footer__hero">
          <div className="site-footer__brand">
            <div className="site-footer__title">{PROJECT_NAME}</div>
            <div className="site-footer__tagline">{TAGLINE}</div>
            <div className="site-footer__badges">
              <span className="site-footer__pill">Polygon mainnet</span>
              <span className="site-footer__pill">Chain {DEFAULT_CHAIN_ID}</span>
              <span className="site-footer__pill">VRF Reveal</span>
              <span className="site-footer__pill">Weekly Rewards</span>
            </div>
          </div>
          <div className="site-footer__cta">
            <div className="site-footer__cta-title">Need help?</div>
            <div className="site-footer__cta-text">
              Use Community Center or contact support.
            </div>
            <a className="site-footer__cta-link" href="#top">
              Open Dashboard
            </a>
          </div>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__card">
            <h4>FAQ</h4>
            <div className="site-footer__faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="site-footer__card">
            <h4>Contacts</h4>
            <ul className="site-footer__list">
              {COMMUNITY.map((item) => (
                <li key={item.label}>
                  <a
                    className={`site-footer__link${item.placeholder ? " is-placeholder" : ""}`}
                    href={item.href}
                  >
                    {item.label}
                  </a>
                  {item.placeholder ? " (TBD)" : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__card">
            <h4>Links</h4>
            <ul className="site-footer__list">
              {LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    className={`site-footer__link${item.placeholder ? " is-placeholder" : ""}`}
                    href={item.href}
                  >
                    {item.label}
                  </a>
                  {item.placeholder ? " (TBD)" : ""}
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__card">
            <h4>Legal</h4>
            <ul className="site-footer__list">
              {LEGAL.map((item) => (
                <li key={item.label}>
                  <a
                    className={`site-footer__link${item.placeholder ? " is-placeholder" : ""}`}
                    href={item.href}
                  >
                    {item.label}
                  </a>
                  {item.placeholder ? " (TBD)" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__grid site-footer__grid--wide">
          <div className="site-footer__card">
            <h4>Status</h4>
            <ul className="site-footer__list">
              <li>
                <span className="site-footer__muted">Network:</span> Polygon mainnet
              </li>
              <li>
                <span className="site-footer__muted">Chain ID:</span>{" "}
                {DEFAULT_CHAIN_ID}
              </li>
              <li>
                <span className="site-footer__muted">RPC:</span>{" "}
                {safeRpcLabel(RPC_URL)}
              </li>
              <li>
                <span className="site-footer__muted">Explorer:</span>{" "}
                <a className="site-footer__link" href={EXPLORER_BASE} target="_blank" rel="noreferrer">
                  polygonscan.com
                </a>
              </li>
              <li>
                <span className="site-footer__muted">Deploy block:</span>{" "}
                {ADDR.DEPLOY_BLOCK || "TBD"}
              </li>
            </ul>
          </div>

          <div className="site-footer__card">
            <h4>Contracts</h4>
            <ul className="site-footer__list site-footer__list--cols">
              {CONTRACTS.map((item) => (
                <li key={item.label}>
                  <span className="site-footer__muted">{item.label}:</span>{" "}
                  {item.addr ? (
                    <a
                      className="site-footer__link"
                      href={explorerUrl(item.addr)}
                      target="_blank"
                      rel="noreferrer"
                      title={item.addr}
                    >
                      {shortAddr(item.addr)}
                    </a>
                  ) : (
                    "TBD"
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          © {new Date().getFullYear()} {PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
