import * as React from "react";

const PROJECT_NAME = "BiggiEyes";

const FAQ_ITEMS = [
  "Mint a ticket, then redeem it to trigger VRF reveal.",
  "Rewards are calculated from owned NFTs and weekly pool rules.",
  "Use Polygon Amoy network in wallet for all on-chain actions.",
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
            <ul className="site-footer__list">
              {FAQ_ITEMS.map((item) => (
                <li key={item}>{item}</li>
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
