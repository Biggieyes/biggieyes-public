import * as React from "react";

const SITE_ORIGIN = "https://biggieyes.com";
const APP_URL = `${SITE_ORIGIN}/app/`;
const DEFAULT_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const NOINDEX_ROBOTS =
  "noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const PANEL_META = {
  REWARDS: {
    title: "BiggiEyes Rewards | Polygon NFT Collection Rewards Overview",
    description:
      "See how BiggiEyes collection rewards work, how rarity-based rewards connect to completed sets, and where to claim in the Polygon app dashboard.",
  },
  COLLECTION: {
    title: "BiggiEyes Collection | Polygon NFT Blocks, Prices And Mint Grid",
    description:
      "Explore the BiggiEyes collection structure, live block pricing, mint counts, and rarity-oriented NFT progression inside the Polygon dashboard.",
  },
  "VRF MINT": {
    title: "BiggiEyes VRF Mint | Ticket Redeem And Verifiable NFT Reveal",
    description:
      "Follow the BiggiEyes ticket-to-reveal flow on Polygon: mint tickets, redeem with VRF, and verify how randomness determines the final NFT outcome.",
  },
  "BIGGI ECOSYSTEM": {
    title: "BiggiEyes Ecosystem | BIGGI Tokenomics, Liquidity And Treasury",
    description:
      "Review the BiggiEyes ecosystem dashboard with token flows, liquidity, treasury visibility, and the broader Polygon NFT economy behind the app.",
  },
  USERS: {
    title: "BiggiEyes User Dashboard | Wallet, Mint, Redeem And Claim",
    description:
      "Open the BiggiEyes user dashboard to connect a wallet, mint tickets, redeem VRF reveals, and monitor Polygon NFT and rewards activity.",
  },
  "COMMUNITY CENTER": {
    title: "BiggiEyes Community Center | Project Access, Updates And Expansion",
    description:
      "Browse the BiggiEyes community center for project access points, ecosystem expansion context, and the bridge between the app and community tools.",
  },
};

function resolvePanelAlt(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase();

  if (!key) return "";
  if (["rewards", "reward", "weekly"].includes(key)) return "REWARDS";
  if (["collection", "blocks", "nft"].includes(key)) return "COLLECTION";
  if (["vrf", "mint", "vrf-mint", "vrf mint"].includes(key)) return "VRF MINT";
  if (
    ["ecosystem", "biggi ecosystem", "token", "tokenomics", "biggi"].includes(
      key,
    )
  )
    return "BIGGI ECOSYSTEM";
  if (["users", "user", "wallet"].includes(key)) return "USERS";
  if (
    [
      "community",
      "community center",
      "community-center",
      "communitycenter",
      "expansion",
    ].includes(key)
  ) {
    return "COMMUNITY CENTER";
  }
  return "";
}

function readPanelFromLocation() {
  if (typeof window === "undefined") return "";

  try {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const rawHash = url.hash ? String(url.hash) : "";
    const hash = rawHash.replace(/^#/, "");

    if (hash.includes("?")) {
      const query = hash.split("?")[1];
      if (query) {
        for (const [key, value] of new URLSearchParams(query)) {
          params.set(key, value);
        }
      }
    } else if (hash && !hash.startsWith("/")) {
      for (const [key, value] of new URLSearchParams(hash)) {
        params.set(key, value);
      }
    }

    return resolvePanelAlt(params.get("panel") || params.get("p"));
  } catch {
    return "";
  }
}

function upsertMetaByName(name, content) {
  if (typeof document === "undefined") return;
  let node = document.head.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("name", name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertMetaByProperty(property, content) {
  if (typeof document === "undefined") return;
  let node = document.head.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (typeof document === "undefined") return;
  let node = document.head.querySelector(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertJsonLd(id, value) {
  if (typeof document === "undefined") return;
  let node = document.head.querySelector(`script[data-seo-managed="${id}"]`);
  if (!node) {
    node = document.createElement("script");
    node.setAttribute("type", "application/ld+json");
    node.setAttribute("data-seo-managed", id);
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(value);
}

export default function SEOManager({ navAlt }) {
  const seo = React.useMemo(() => {
    const activePanel = navAlt || readPanelFromLocation();
    const panelMeta = PANEL_META[activePanel] || null;
    const hasPanelView = Boolean(activePanel);
    const shareUrl = hasPanelView
      ? `${APP_URL}?panel=${encodeURIComponent(activePanel)}`
      : APP_URL;

    const title =
      panelMeta?.title ||
      "BiggiEyes App | Polygon NFT Ticket, VRF Reveal And Rewards Dashboard";
    const description =
      panelMeta?.description ||
      "Use the BiggiEyes Polygon dashboard to mint tradable ticket entries, redeem with VRF, and track collection, rewards, and ecosystem activity.";
    const robots = hasPanelView ? NOINDEX_ROBOTS : DEFAULT_ROBOTS;
    const about = activePanel
      ? [activePanel, "Polygon NFT", "Web3 dashboard", "BiggiEyes"]
      : ["Polygon NFT", "VRF mint", "collection rewards", "BiggiEyes"];

    return {
      title,
      description,
      canonical: APP_URL,
      robots,
      shareUrl,
      schema: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${shareUrl}#webpage`,
        url: shareUrl,
        name: title,
        description,
        inLanguage: "en",
        isPartOf: {
          "@id": "https://biggieyes.com/#website",
        },
        mainEntity: {
          "@id": "https://biggieyes.com/app/#webapp",
        },
        about,
      },
    };
  }, [navAlt]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = seo.title;
    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", seo.robots);
    upsertMetaByName("googlebot", seo.robots);

    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", seo.shareUrl);
    upsertMetaByProperty("og:type", "website");

    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertMetaByName("twitter:url", seo.shareUrl);

    upsertLink("canonical", seo.canonical);
    upsertJsonLd("app-webpage", seo.schema);
  }, [seo]);

  return null;
}
