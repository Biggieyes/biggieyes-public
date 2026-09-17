import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";

// Real cards and import controls with a simulated wallet; no RPC or transactions.
const bootstrap = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import NftCard from '/src/components/NftCard.jsx';
import '/src/components/Gallery.css';
const items = [
  { tokenId: '1001', name: 'Biggi NFT #1', image: '/images/blocks/ORANGE/Biggi_1_ORANGE_O.png', mint: {ticketPrice:500,blockPrice:100,finalPrice:105}},
  { tokenId: '1002', name: 'Biggi NFT #2', image: '/images/blocks/ORANGE/Biggi_1_ORANGE_P.png'},
  { tokenId: '3', name: 'BIGGI Original Random Mint Ticket', image: '/images/blocks/ORANGE/Biggi_1_ORANGE_G.png', isTicket:true, chapterId:1},
  { tokenId: '1004', name: 'Biggi NFT #4', image: '/images/blocks/ORANGE/Biggi_1_ORANGE_RB.png', mint: {ticketPrice:500,blockPrice:0,finalPrice:0}},
];
createRoot(document.getElementById('root')).render(React.createElement('div',{className:'gallery__grid'},items.map(item => React.createElement(NftCard,{
 key:item.tokenId, ownerAddress:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', nft:{...item,contractAddress:item.isTicket ? '0x2222222222222222222222222222222222222222' : '0x1111111111111111111111111111111111111111',meta:{name:item.name,image:item.image,attributes:item.isTicket ? [] : [{trait_type:'Eye Color',value:'Orange'},{trait_type:'Background',value:'Orange'},{trait_type:'Chapter',value:'1'},{trait_type:'Series',value:'Originals'},{trait_type:'Test detail',value:'Visible'}]}},
 liveTicketPrice:500,activeTicketChapterId:1,activeTicketChapterCount:1,dynamicTraits:{currentBlockPrice:150}
}))));
`;
const server = await createServer({
  configFile: false,
  envFile: false,
  envPrefix: "AUDIT_DISABLED_",
  logLevel: "error",
  resolve: { alias: { "@": resolve("src") } },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
      "ethers",
      "lucide-react",
    ],
  },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "nft-audit-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "/__nft-audit.js") return "\0nft-audit-entry";
        if (importer?.replaceAll("\\", "/").endsWith("/NftCard.jsx")) {
          if (id.includes("ContractsContext")) return "\0nft-audit-contracts";
        }
      },
      load(id) {
        if (id === "\0nft-audit-entry") return bootstrap;
        if (id === "\0nft-audit-contracts")
          return "export const useOptionalContracts = () => null;";
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__nft-audit") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#090b15;color:#ffe800;font-family:monospace}</style><div id="root"></div><script type="module" src="/__nft-audit.js"></script>',
          );
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  console.log("Fixture server ready");
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  console.log("Fixture browser ready");
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    await page.addInitScript(() => {
      window.importCalls = [];
      window.importUnsupported = false;
      let chain = "0x13882";
      window.ethereum = {
        isMetaMask: true,
        async request({ method, params }) {
          if (method === "eth_chainId") return chain;
          if (method === "eth_accounts")
            return ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"];
          if (method === "wallet_switchEthereumChain") {
            chain = params[0].chainId;
            return null;
          }
          if (method === "wallet_watchAsset") {
            if (window.importUnsupported)
              throw Object.assign(new Error("Unsupported"), { code: 4200 });
            window.importCalls.push({ chain, ...params });
            return true;
          }
          throw Error(`Unexpected wallet request: ${method}`);
        },
      };
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === `http://127.0.0.1:${port}`) return route.continue();
      errors.push(`Unexpected external request to ${url.origin}`);
      return route.abort();
    });
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("Fixture page error:", e.message);
    });
    page.on("console", (m) => {
      if (m.type() === "error")
        console.log(
          "Fixture console:",
          m.text().replace(/https?:\/\/[^\s]+/g, "[URL]"),
        );
    });
    await page.goto(`http://127.0.0.1:${port}/__nft-audit`, {
      waitUntil: "networkidle",
    });
    await page.locator(".nft-card").first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".nft-card img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await page.getByRole("button", { name: "Show details" }).first().click();
    await page.getByText("Visible", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Hide details" }).first().click();
    await page.getByRole("button", { name: "Zoom image" }).first().click();
    await page.keyboard.press("Escape");
    if (await page.locator(".nft-card--image-zoomed").count())
      throw Error("Zoom did not close");
    if (
      (await page
        .getByRole("button", { name: "Import", exact: true })
        .count()) !== 4
    )
      throw Error("An NFT or ticket is missing its import button");
    await page.screenshot({
      path: `tmp-nft-import-${width}.png`,
      fullPage: true,
    });
    for (const card of await page.locator(".nft-card").all()) {
      await card.getByRole("button", { name: "Import", exact: true }).click();
      await card.getByRole("button", { name: "Re-import" }).waitFor();
    }
    const imports = await page.evaluate(() => window.importCalls);
    for (const [index, id] of ["1001", "1002", "3", "1004"].entries()) {
      const call = imports[index];
      const contract =
        index === 2
          ? "0x2222222222222222222222222222222222222222"
          : "0x1111111111111111111111111111111111111111";
      if (
        call?.type !== "ERC721" ||
        call.chain !== "0x89" ||
        call.options.address !== contract ||
        call.options.tokenId !== id
      )
        throw Error("Incorrect NFT import payload");
    }
    await page.evaluate(() => {
      window.importUnsupported = true;
    });
    await page.getByRole("button", { name: "Re-import" }).last().click();
    await page.getByText("Manual import details:", { exact: false }).waitFor();
    const result = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      cards: document.querySelectorAll(".nft-card").length,
      images: [...document.querySelectorAll(".nft-card img")].filter(
        (i) => i.naturalWidth > 0,
      ).length,
      imports: window.importCalls.length,
      importOverlap: [...document.querySelectorAll(".nft-card")].some(
        (card) => {
          const button = card
            .querySelector(".import-button")
            .getBoundingClientRect();
          const image = card.querySelector("img").getBoundingClientRect();
          return button.top < image.bottom;
        },
      ),
      cardOverflow: [...document.querySelectorAll(".nft-card")].filter(
        (e) => e.scrollWidth > e.clientWidth + 2,
      ).length,
      narrowText: [
        ...document.querySelectorAll(
          ".nft-card__stats span, .nft-card__stats strong",
        ),
      ].filter((e) => e.clientWidth < 55).length,
    }));
    if (
      result.overflow ||
      result.importOverlap ||
      result.cardOverflow ||
      result.narrowText ||
      errors.length ||
      result.cards !== 4 ||
      result.images !== 4
    )
      throw Error(JSON.stringify({ ...result, errors }));
    await page.screenshot({
      path: `tmp-nft-cards-${width}.png`,
      fullPage: true,
    });
    console.log(JSON.stringify({ ...result, errors: errors.length }));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
