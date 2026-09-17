import fs from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const output = process.argv[2] || "tmp-startup-profile.json";
if (!/^tmp-[a-z0-9-]+\.json$/i.test(output)) {
  throw new Error("Use a tmp-*.json output name in the repository root");
}
const runs = Number(process.argv[3] || 3);
if (!Number.isInteger(runs) || runs < 1 || runs > 5)
  throw new Error("Runs must be 1-5");
const referenceDir = process.argv[4];
if (referenceDir && !/^tmp-[a-z0-9-]+$/i.test(referenceDir)) {
  throw new Error("Reference must be a tmp-* artifact directory");
}
const server = await preview({
  preview: { host: "127.0.0.1", port: 0, strictPort: true },
});
const variants = [{ name: "current", server }];
const results = [];
let browser;
try {
  if (referenceDir)
    variants.unshift({
      name: "reference",
      server: await preview({
        build: { outDir: referenceDir },
        preview: { host: "127.0.0.1", port: 0, strictPort: true },
      }),
    });
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    for (let run = 1; run <= runs; run++) {
      for (const variant of run % 2 ? variants : [...variants].reverse()) {
        const origin = `http://127.0.0.1:${
          variant.server.httpServer.address().port
        }`;
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 900 },
          isMobile: width === 390,
          hasTouch: width === 390,
        });
        try {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Network.enable");
          // Each context starts cold; retain normal preload reuse within a page.
          await cdp.send("Performance.enable");
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 40,
            downloadThroughput: 500_000,
            uploadThroughput: 250_000,
          });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          const rpc = {};
          let rpcRequests = 0;
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.name));
          page.on("request", (request) => {
            if (request.method() !== "POST") return;
            try {
              const payload = request.postDataJSON();
              const items = Array.isArray(payload) ? payload : [payload];
              const calls = items.filter(
                (item) => item?.jsonrpc === "2.0" && item.method
              );
              if (calls.length) rpcRequests++;
              for (const call of calls)
                rpc[call.method] = (rpc[call.method] || 0) + 1;
            } catch {
              /* Non-JSON POSTs are not RPC. */
            }
          });
          await page.addInitScript(() => {
            const profile = (window.__startupProfile = {
              lcp: [],
              longTasks: [],
              shellMs: null,
              unlockedMs: null,
            });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                profile.lcp.push({
                  startTime: entry.startTime,
                  size: entry.size,
                  element: entry.element?.tagName,
                  className: String(entry.element?.className || ""),
                  url: entry.url ? new URL(entry.url).pathname : null,
                });
            }).observe({ type: "largest-contentful-paint", buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                profile.longTasks.push({
                  startTime: entry.startTime,
                  duration: entry.duration,
                });
            }).observe({ type: "longtask", buffered: true });
            const check = () => {
              if (document.querySelector(".live-stats-widget-new")) {
                profile.shellMs ??= performance.now();
                if (!document.querySelector(".loading-overlay")) {
                  profile.unlockedMs ??= performance.now();
                  observer.disconnect();
                }
              }
            };
            const observer = new MutationObserver(check);
            observer.observe(document, { childList: true, subtree: true });
          });
          await page.goto(`${origin}/app/`, {
            waitUntil: "commit",
            timeout: 60_000,
          });
          await page.waitForFunction(() => performance.now() >= 15_000, null, {
            timeout: 30_000,
          });
          const data = await page.evaluate(() => ({
            ...window.__startupProfile,
            navigation: performance
              .getEntriesByType("navigation")
              .map((entry) => ({
                domContentLoaded: entry.domContentLoadedEventEnd,
                load: entry.loadEventEnd,
              }))[0],
            resources: performance
              .getEntriesByType("resource")
              .filter((entry) => new URL(entry.name).origin === location.origin)
              .map((entry) => ({
                name: new URL(entry.name).pathname,
                type: entry.initiatorType,
                start: entry.startTime,
                end: entry.responseEnd,
                bytes: entry.encodedBodySize,
              })),
          }));
          const { metrics } = await cdp.send("Performance.getMetrics");
          const summary = {
            variant: variant.name,
            width,
            run,
            shellMs: data.shellMs,
            unlockedMs: data.unlockedMs,
            lcp: data.lcp.at(-1),
            longTaskMs: data.longTasks.reduce(
              (sum, item) => sum + item.duration,
              0
            ),
            blockingMs: data.longTasks.reduce(
              (sum, item) => sum + Math.max(0, item.duration - 50),
              0
            ),
            jsBytes: data.resources
              .filter((item) => item.name.endsWith(".js"))
              .reduce((sum, item) => sum + item.bytes, 0),
            rpcRequests,
            rpc,
            errors,
            renderMetrics: metrics.filter((item) =>
              /^(Layout|RecalcStyle|Script|Task)Duration$/.test(item.name)
            ),
          };
          results.push({ ...summary, data });
          console.log(JSON.stringify(summary));
        } finally {
          await context.close();
        }
      }
    }
  }
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        conditions: {
          cache: "fresh browser context, normal in-page reuse",
          cpuSlowdown: 4,
          downloadBytesPerSecond: 500_000,
          latencyMs: 40,
          observationMs: 15_000,
          wallet: "not connected",
          origin: "local production preview",
        },
        results,
      },
      null,
      2
    ) + "\n"
  );
} finally {
  await browser?.close();
  for (const variant of variants) await variant.server.close();
}
