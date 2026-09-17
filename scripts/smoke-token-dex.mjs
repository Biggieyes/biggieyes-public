import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import '/src/App.css';
import TokenDexTab from '/src/features/tokenomics/tabs/TokenDexTab.jsx';
const address = n => '0x' + String(n).padStart(40, '0');
const unit = 10n ** 18n;
function Fixture() {
  const [mode, setMode] = React.useState('empty');
  window.setDexFixtureMode = setMode;
  const funded = mode !== 'empty';
  const snapshot = {
    ts: Date.UTC(2026, 8, 13),
    token: { address: address(1), name: 'BIGGI', symbol: 'BIGGI', decimals: 18,
      totalSupply: 1000000n * unit, cap: 10000000n * unit,
      remainingMintable: 9000000n * unit, balances: { reserve: 2000n * unit } },
    dex: { weth: address(2), router: address(4), quoteStatus: funded ? 'ready' : 'no_liquidity',
      routerNativeOut: funded ? unit / 1000n : null,
      pair: { address: address(3), token0: address(1), token1: address(2),
        totalSupply: funded ? unit : 0n,
        reserves: { token: funded ? 100000n * unit : 0n, native: funded ? 100n * unit : 0n } } },
  };
  return React.createElement(TokenDexTab, { tokenDexSnapshot: snapshot,
    error: mode === 'stale' ? Error('Fixture RPC failure') : null,
    onRefresh: () => setMode('funded') });
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;

const server = await createServer({
  configFile: false,
  envFile: false,
  envPrefix: "AUDIT_DISABLED_",
  logLevel: "error",
  resolve: { alias: { "@": resolve("src") } },
  server: { host: "127.0.0.1", port: 0, watch: null },
  plugins: [
    {
      name: "token-dex-fixture",
      resolveId(id) {
        if (id === "/__dex-entry.js") return "\0dex-entry";
      },
      load(id) {
        if (id === "\0dex-entry") return entry;
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url !== "/__dex-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#090b15;color:#ffe800}</style><div id="root"></div><script type="module" src="/__dex-entry.js"></script>',
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
    try {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.name));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === origin || url.protocol === "data:"
          ? route.continue()
          : route.abort();
      });
      await page.goto(`${origin}/__dex-fixture`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const panel = page.locator(".token-dex-tab");
      await panel
        .getByText("No liquidity", { exact: true })
        .first()
        .waitFor({ timeout: 45000 });
      await page.screenshot({ path: `tmp-dex-empty-${width}.png` });
      await page.evaluate(() => window.setDexFixtureMode("stale"));
      await page
        .getByRole("status")
        .filter({ hasText: "Showing the last successful snapshot" })
        .waitFor();
      await page.screenshot({ path: `tmp-dex-stale-${width}.png` });
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "Showing the last successful snapshot" })
        .waitFor({ state: "detached" });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 2,
      );
      assert.equal(overflow, false, `Document overflow at ${width}px`);
      assert.deepEqual(errors, [], `Page errors at ${width}px`);
      console.log(
        JSON.stringify({
          width,
          status: "PASS",
          states: ["empty", "stale", "recovered"],
        }),
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
