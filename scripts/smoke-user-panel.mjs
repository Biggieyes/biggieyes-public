import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";

// Real panel and CSS, deterministic read-only fixtures, no external requests.
const bootstrap = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import UserPanel from '/src/features/user/USERPANEL.jsx';
import {state} from '/__user-fixture-state';
const root = createRoot(document.getElementById('root'));
window.renderUserFixture = (mode) => {
  state.fail = mode === 'error';
  state.account = '0x' + (mode === 'other' ? '2' : '1').repeat(40);
  state.contracts = {...state.contracts};
  root.render(React.createElement(UserPanel, {
    walletAddress: state.account,
    claimable: state.fail ? null : 5,
    ticketPrice: 500,
    onMint: () => {}, onRedeem: () => {}, onClaim: () => {},
    myNFTs: state.fail ? [] : [{tokenId: '1', image: '/images/blocks/ORANGE/Biggi_1_ORANGE_O.png'}]
  }));
};
window.renderUserFixture('success');
`;
const fixtureState = `
export const state = {fail:false, account:'0x'+'1'.repeat(40)};
const amount = (value) => state.fail ? Promise.reject(Error('Fixture read unavailable')) : Promise.resolve(value);
const provider = {getNetwork:async()=>({chainId:137n}), getBalance:()=>amount(2n*10n**18n)};
state.contracts = {
 _effectiveROProvider:()=>provider,
 chapterCollectionsRead:()=>[{contract:{balanceOf:()=>amount(1n)}}],
 tokenRead:()=>({balanceOf:()=>amount(3n*10n**18n),decimals:async()=>18n}),
 ticketHubRead:()=>({balanceOf:()=>amount(1n)})
};
export const useWeb3 = () => ({account:state.account,chainId:137,provider,connectMetaMask:()=>{}});
export const useContracts = () => state.contracts;
export default function community(){return {
 snapshot:{configured:true,paused:false,claimableEvents:state.fail?null:0,claimableAmount:state.fail?null:0n},
 loading:false,error:state.fail?Error('Fixture read unavailable'):null,refresh:()=>{}
};}
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
      "react-dom",
      "react-dom/client",
      "react/jsx-dev-runtime",
      "react/jsx-runtime",
      "ethers",
      "clipboard-copy",
    ],
  },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "user-panel-read-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "/__user-fixture.js") return "\0user-fixture-entry";
        if (id === "/__user-fixture-state") return "\0user-fixture-state";
        if (
          importer?.replaceAll("\\", "/").endsWith("/USERPANEL.jsx") &&
          /Web3Context|ContractsContext|useCommunityCenterUserSnapshot/.test(
            id,
          )
        )
          return "\0user-fixture-state";
      },
      load(id) {
        if (id === "\0user-fixture-entry") return bootstrap;
        if (id === "\0user-fixture-state") return fixtureState;
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__user-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#090b15;color:#ffe800;font-family:monospace}</style><div id="root"></div><script type="module" src="/__user-fixture.js"></script>',
          );
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.log("Fixture page error:", error.stack || error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log(
          "Fixture console:",
          message.text().replace(/https?:\/\/[^\s]+/g, "[URL]"),
        );
      }
    });
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin)
        return route.continue();
      errors.push("Unexpected external request");
      return route.abort();
    });
    await page.goto(`${origin}/__user-fixture`, { waitUntil: "networkidle" });
    if (errors.length) throw new Error(errors.join("; "));
    await page.getByText("2 POL", { exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    );
    await page.screenshot({
      path: `tmp-user-panel-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => window.renderUserFixture("error"));
    await page
      .getByText("Some wallet balances could not be refreshed.")
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Claim rewards", exact: true })
        .isEnabled()
    )
      throw Error("Claim enabled after unknown read");
    const result = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      balances: [
        ...document.querySelectorAll(".user-panel__balance-item strong"),
      ].map((n) => n.textContent),
      claim: document.querySelectorAll(".user-panel__key-metrics strong")[1]
        .textContent,
      buttonOverflow: [
        ...document.querySelectorAll(".user-panel button"),
      ].filter((e) => e.scrollWidth > e.clientWidth + 2).length,
    }));
    if (
      result.overflow ||
      result.buttonOverflow ||
      errors.length ||
      result.balances.some((v) => v !== "--") ||
      result.claim !== "--"
    )
      throw Error(JSON.stringify({ ...result, errors }));
    await page.evaluate(() => window.renderUserFixture("other"));
    await page.getByText("2 POL", { exact: true }).waitFor();
    if (
      !(await page
        .getByRole("button", { name: "Claim rewards", exact: true })
        .isEnabled())
    )
      throw Error("Claim did not recover");
    console.log(
      JSON.stringify({ ...result, recovered: true, pageErrors: errors.length }),
    );
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
