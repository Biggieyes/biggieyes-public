import { createServer } from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { preview as createVitePreview } from "vite";

const HOST = "127.0.0.1";

async function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`);
    }),
  ]);
}

async function getFreePort(host = HOST) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate free port")));
        return;
      }
      const { port } = address;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

async function startPreview(port) {
  console.log(`[smoke] starting preview on ${HOST}:${port}`);
  return createVitePreview({
    root: process.cwd(),
    preview: {
      host: HOST,
      port,
      strictPort: true,
    },
  });
}

async function waitForServer(url, timeoutMs = 45_000) {
  const started = Date.now();
  console.log(`[smoke] waiting for server: ${url}`);
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log("[smoke] preview server is ready");
        return;
      }
    } catch {
      // server not ready yet
    }
    await delay(500);
  }
  throw new Error(`Preview server did not start within ${timeoutMs}ms`);
}

function isFatalConsoleError(text) {
  const fatalPatterns = [
    /Uncaught/i,
    /ReferenceError/i,
    /TypeError/i,
    /SyntaxError/i,
    /Cannot read properties/i,
    /is not defined/i,
    /Failed to resolve module/i,
  ];
  return fatalPatterns.some((rx) => rx.test(text));
}

function isNetworkConsoleError(text) {
  const networkPatterns = [
    /Failed to fetch/i,
    /NetworkError/i,
    /ERR_(?:NETWORK|CONNECTION|FAILED)/i,
    /Load failed/i,
    /CORS/i,
  ];
  return networkPatterns.some((rx) => rx.test(text));
}

async function runSmoke(baseUrl) {
  console.log("[smoke] launching browser");
  const browser = await withTimeout(
    chromium.launch({ headless: true, timeout: 60_000 }),
    90_000,
    "chromium.launch",
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });

    const pageErrors = [];
    const fatalConsoleErrors = [];
    const networkConsoleErrors = [];
    const consoleErrors = [];
    const httpErrorResponses = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err?.message || String(err));
    });

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      consoleErrors.push(text);
      if (isFatalConsoleError(text)) fatalConsoleErrors.push(text);
      if (isNetworkConsoleError(text)) networkConsoleErrors.push(text);
    });

    page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) httpErrorResponses.push(`${status} ${res.url()}`);
    });

    const appUrl = new URL("/app/", baseUrl).toString();
    console.log(`[smoke] goto app: ${appUrl}`);
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(
      '.gallery-section, #gallery, h2:has-text("My NFTs")',
      { timeout: 60_000 },
    );
    console.log("[smoke] app shell ready");

    // Gallery shell and filtering controls smoke.
    const gallery = page.locator(".gallery-section");
    await gallery
      .getByRole("heading", { name: /My Biggi COLLECTION/i })
      .waitFor({ state: "visible", timeout: 30_000 });
    const gallerySort = gallery.getByLabel("Sort");
    const galleryRarity = gallery.getByLabel("Rarity");
    await gallerySort.selectOption("token");
    await galleryRarity.selectOption("rare");
    await galleryRarity.selectOption("all");
    await gallery
      .getByText("Total Assets", { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
    console.log("[smoke] gallery shell and controls flow ok");

    // Live stats smoke (open Tokenomics modal and verify pools/allocation section).
    const liveStatsRoot = page.locator("#live-stats");
    await liveStatsRoot.first().scrollIntoViewIfNeeded();
    const tokenomicsBtn = liveStatsRoot
      .getByRole("button", { name: "TOKENOMICS" })
      .first();
    await tokenomicsBtn.waitFor({ state: "visible", timeout: 30_000 });
    await tokenomicsBtn.click();
    await page
      .getByText(/POOLS\s*&\s*ALLOCATION/i)
      .first()
      .waitFor({
        state: "visible",
        timeout: 30_000,
      });
    await page.getByRole("button", { name: "Close" }).first().click();
    console.log("[smoke] live stats flow ok");

    // Token rewards claim status smoke in REWARDS panel.
    const rewardsNavButton = page
      .getByRole("button", {
        name: /Open Rewards: token, NFT, and collection rewards/i,
      })
      .first();
    await rewardsNavButton.waitFor({ state: "visible", timeout: 20_000 });
    await rewardsNavButton.click();
    const rewardsPanel = page.locator("section.rewards-grid");
    await rewardsPanel.waitFor({ state: "visible", timeout: 45_000 });
    await rewardsPanel
      .locator("h2.rewards-grid__title")
      .waitFor({ state: "visible", timeout: 45_000 });
    await page
      .getByRole("heading", {
        name: /TOKEN REWARDS|COLLECTION REWARDS|NFT REWARDS/i,
      })
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
    await rewardsPanel
      .getByRole("heading", { name: "Claim preview", exact: true })
      .waitFor({ state: "visible", timeout: 45_000 });
    await rewardsPanel
      .getByRole("button", { name: /Connect wallet to claim|Claim REWARDS/i })
      .first()
      .waitFor({ state: "visible", timeout: 45_000 });
    console.log("[smoke] token rewards claim-status flow ok");

    if (
      pageErrors.length ||
      fatalConsoleErrors.length ||
      networkConsoleErrors.length
    ) {
      const details = [
        pageErrors.length ? `Page errors:\n- ${pageErrors.join("\n- ")}` : null,
        fatalConsoleErrors.length
          ? `Fatal console errors:\n- ${fatalConsoleErrors.join("\n- ")}`
          : null,
        networkConsoleErrors.length
          ? `Network console errors:\n- ${networkConsoleErrors.join("\n- ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      throw new Error(`Runtime smoke failed.\n${details}`);
    }

    await page.close();

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobileErrors = [];
    mobilePage.on("pageerror", (err) => {
      mobileErrors.push(err?.message || String(err));
    });
    mobilePage.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const message = msg.text();
      if (isFatalConsoleError(message) || isNetworkConsoleError(message)) {
        mobileErrors.push(message);
      }
    });

    try {
      console.log(`[smoke] goto mobile app: ${appUrl}`);
      await mobilePage.goto(appUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await mobilePage.waitForSelector(".live-stats-widget-new", {
        state: "visible",
        timeout: 60_000,
      });
      await mobilePage.waitForSelector(".gallery-section", {
        state: "attached",
        timeout: 60_000,
      });
      await mobilePage.locator(".gallery-section").scrollIntoViewIfNeeded();
      await mobilePage.locator(".gallery-section").waitFor({
        state: "visible",
        timeout: 30_000,
      });
      await mobilePage.locator("#live-stats").first().scrollIntoViewIfNeeded();
      await mobilePage.locator("#live-stats").first().waitFor({
        state: "visible",
        timeout: 30_000,
      });

      const layout = await mobilePage.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
      }));
      if (layout.contentWidth > layout.viewportWidth + 2) {
        throw new Error(
          `Mobile layout overflows horizontally (${layout.contentWidth}px > ${layout.viewportWidth}px)`,
        );
      }
      if (mobileErrors.length) {
        throw new Error(`Mobile runtime errors:\n- ${mobileErrors.join("\n- ")}`);
      }
      console.log("[smoke] mobile shell and responsive layout ok");
    } finally {
      await mobilePage.close().catch(() => {});
    }

    console.log("Desktop and mobile runtime smoke passed.");
    if (consoleErrors.length) {
      console.log(`Non-fatal console errors observed: ${consoleErrors.length}`);
      const nonFatalConsoleErrors = consoleErrors.filter(
        (text) =>
          !fatalConsoleErrors.includes(text) &&
          !networkConsoleErrors.includes(text),
      );
      if (nonFatalConsoleErrors.length) {
        const sample = nonFatalConsoleErrors.slice(0, 10).join("\n- ");
        console.log(`Non-fatal console error sample:\n- ${sample}`);
      }
    }
    if (httpErrorResponses.length) {
      const sample = [...new Set(httpErrorResponses)].slice(0, 10).join("\n- ");
      console.log(`HTTP error response sample:\n- ${sample}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  const port = await getFreePort(HOST);
  const baseUrl = `http://${HOST}:${port}`;
  const preview = await startPreview(port);
  try {
    await waitForServer(baseUrl);
    await runSmoke(baseUrl);
  } finally {
    await withTimeout(preview.close(), 5_000, "preview.close").catch((error) => {
      console.warn(`[smoke] ${error.message}`);
    });
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  },
);
