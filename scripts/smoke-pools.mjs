import { createServer } from "vite";
import { chromium } from "playwright";
import { resolve } from "node:path";

// Exercise the real LiveStats panel and styles with read-only, offline RPC fixtures.
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/index.css';
import '/src/App.css';
import LiveStats from '/src/components/LiveStats.jsx';
import {DEFAULT_BLOCKS} from '/src/shared/blocks.js';
import {state} from '/__pools-state';
window.poolFixture = state;
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null,
  React.createElement(LiveStats, {maxSupply:550, blockNames:DEFAULT_BLOCKS,
    lastImage:'/images/blocks/ORANGE/Biggi_1_ORANGE_O.png', lastNftId:1,
    lastBlockName:'ORANGE', lastBackgroundName:'ORANGE'})));
`;
const stateModule = `
export const state = {mode:'error', snapshots:0, resets:0};
export const ADDR = Object.fromEntries(['BIGGI','PAIR','RESERVE','TREASURY','BUYBACK_AGENT',
 'COLLECTION_REWARDS','COMMUNITY_CENTER','TOKEN_REWARDS','NFT_REWARDS','LIQUIDITY_VAULT','LM',
 'DISTRIBUTOR'].map((key,i)=>[key,'0x'+(i+1).toString(16).padStart(40,'0')]));
const unit = 10n**18n;
const provider = {
 getBlockNumber:async()=>{if(state.mode==='error') throw Error('no runners?!'); return 123;},
 getBalance:async(address)=>{
   if(state.mode==='partial' && address===ADDR.RESERVE) throw Error('Fixture balance unavailable');
   return unit;
 }
};
state.token = {balanceOf:async()=>2n*unit, decimals:async()=>18n, symbol:async()=>'BIGGI',totalSupply:async()=>100n*unit};
state.lp = {balanceOf:async()=>3n*unit, decimals:async()=>18n, symbol:async()=>'LP',totalSupply:async()=>10n*unit};
export const getROProvider = ()=>provider;
export const resetROProvider = ()=>{state.resets++;};
export const getTokenRO = ()=>state.token;
export const getTokenREWARDSRO = ()=>null;
export const getReaderRO = ()=>null;
export const getReadOnlyMain = ()=>null;
export const getReadOnlyChapterMain = ()=>null;
export const getReadOnlyChapterMain2 = ()=>null;
export const getPairRO = ()=>null;
export const getReadOnlyLiquidityContract = ()=>null;
export const getInjectedProvider = ()=>null;
export const fetchDistributorSnapshot = async()=>{
 state.snapshots++;
 return {reserve:ADDR.RESERVE, BUYBACKAgent:ADDR.BUYBACK_AGENT,treasury:ADDR.TREASURY,
   COLLECTIONREWARDS:ADDR.COLLECTION_REWARDS,COMMUNITYCENTER:ADDR.COMMUNITY_CENTER,
   pendingReserve:0n,pendingBUYBACK:0n,pendingTreasury:0n,pendingCOLLECTIONREWARDS:0n,pendingCOMMUNITYCENTER:0n};
};
export default ()=>({displayed:null,syncWeeklyInfo:()=>{}});
`;
const ethersModule = `
export * from 'ethers';
import {state,ADDR} from '/__pools-state';
export function Contract(address){return address===ADDR.BIGGI?state.token:address===ADDR.PAIR?state.lp:{}};
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
      "lucide-react",
      "clipboard-copy",
    ],
  },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "pools-read-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "/__pools-entry.js") return "\0pools-entry";
        if (id === "/__pools-state") return "\0pools-state";
        if (!importer?.replaceAll("\\", "/").endsWith("/LiveStats.jsx")) return;
        if (id === "ethers") return "\0pools-ethers";
        if (
          /shared\/utils\/contract$|distributor\.reader$|useWeeklyCountdown$/.test(
            id,
          )
        )
          return "\0pools-state";
      },
      load(id) {
        if (id === "\0pools-entry") return entry;
        if (id === "\0pools-state") return stateModule;
        if (id === "\0pools-ethers") return ethersModule;
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__pools-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#090b15;color:#ffe800;font-family:monospace}</style><div id="root"></div><script type="module" src="/__pools-entry.js"></script>',
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
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin === origin)
        return route.continue();
      errors.push("Unexpected external request");
      return route.abort();
    });
    await page.goto(`${origin}/__pools-fixture`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "TOKENOMICS", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Tokenomics" });
    await dialog
      .getByText("Pool data is unavailable.", { exact: true })
      .waitFor();
    const failed = await page.evaluate(() => ({
      ...window.poolFixture,
      token: undefined,
      lp: undefined,
    }));
    if (failed.snapshots !== 0 || failed.resets !== 1)
      throw Error(
        "Bootstrap failure started downstream reads or did not reset the provider",
      );
    const refresh = dialog.getByRole("button", { name: "Refresh pool data" });
    if (!(await refresh.isEnabled()))
      throw Error("Refresh disabled after failure");
    const iconSize = await refresh.locator("svg").boundingBox();
    const buttonSize = await refresh.boundingBox();
    if (
      !iconSize ||
      iconSize.width !== 16 ||
      iconSize.height !== 16 ||
      buttonSize?.width !== 32 ||
      buttonSize?.height !== 32
    )
      throw Error(
        "Global styles collapsed the refresh icon or changed its button dimensions",
      );
    await page.evaluate(() => {
      window.poolFixture.mode = "partial";
    });
    await refresh.click();
    await dialog.getByText("Some pool data is unavailable.").waitFor();
    const reserve = dialog
      .locator(
        ".ls-tokenomics-modal__section--allocation .collection-stat-card",
      )
      .filter({ hasText: "Reserve" });
    if ((await reserve.locator(".collection-stat-value").textContent()) !== "-")
      throw Error("Failed balance rendered as a number");
    await page.screenshot({
      path: `tmp-pools-partial-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      window.poolFixture.mode = "success";
    });
    await refresh.click();
    await reserve.getByText("1.0000 POL", { exact: true }).waitFor();
    await page.screenshot({ path: `tmp-pools-${width}.png`, fullPage: true });
    const layout = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const buttons = [...element.querySelectorAll("button")].map((button) =>
        button.getBoundingClientRect(),
      );
      return {
        overflow: element.scrollWidth > element.clientWidth + 1,
        outside:
          rect.left < 0 ||
          rect.right > innerWidth + 1 ||
          rect.bottom > innerHeight + 1,
        buttonsOutside: buttons.some(
          (b) =>
            b.left < rect.left ||
            b.right > rect.right ||
            b.top < rect.top ||
            b.bottom > rect.bottom,
        ),
        buttonsOverlap: buttons.some((a, i) =>
          buttons
            .slice(i + 1)
            .some(
              (b) =>
                a.left < b.right &&
                a.right > b.left &&
                a.top < b.bottom &&
                a.bottom > b.top,
            ),
        ),
      };
    });
    if (Object.values(layout).some(Boolean) || errors.length)
      throw Error(JSON.stringify({ width, layout, errors }));
    await dialog.getByRole("button", { name: "Close pools" }).click();
    if (await dialog.count()) throw Error("Close did not dismiss the modal");
    console.log(
      JSON.stringify({
        width,
        errorRecovery: "PASS",
        partial: "PASS",
        layout: "PASS",
      }),
    );
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
