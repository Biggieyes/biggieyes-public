import { spawn } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

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

function startPreview(port) {
  const command = `${npmCmd} run preview -- --host ${HOST} --port ${port} --strictPort`;
  console.log(`[smoke] starting preview: ${command}`);
  const child = spawn(command, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: true,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: false,
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
  await delay(400);
  if (!child.killed) child.kill("SIGKILL");
}

async function waitForServer(url, preview, timeoutMs = 45_000) {
  const started = Date.now();
  let exited = false;
  let exitCode = null;
  let exitSignal = null;
  const handleExit = (code, signal) => {
    exited = true;
    exitCode = code;
    exitSignal = signal;
  };
  preview.once("exit", handleExit);
  console.log(`[smoke] waiting for server: ${url}`);
  try {
    while (Date.now() - started < timeoutMs) {
      if (exited) {
        throw new Error(
          `Preview server exited before ready (code=${String(exitCode)} signal=${String(exitSignal)})`,
        );
      }
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
  } finally {
    preview.off("exit", handleExit);
  }
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const pageErrors = [];
    const fatalConsoleErrors = [];
    const networkConsoleErrors = [];
    const consoleErrors = [];

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

    const appUrl = new URL("/app/", baseUrl).toString();
    console.log(`[smoke] goto app: ${appUrl}`);
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(
      '.gallery-section, #gallery, h2:has-text("My NFTs")',
      { timeout: 60_000 },
    );
    console.log("[smoke] app shell ready");

    // Gallery + metadata/IPFS path smoke.
    const gallery = page.locator(".gallery-section");
    await gallery.getByRole("button", { name: "Open NFT card help" }).click();
    await page.waitForSelector("text=IPFS images", { timeout: 15_000 });
    await gallery.getByRole("button", { name: "Open NFT card help" }).click();
    console.log("[smoke] gallery metadata/ipfs flow ok");

    // Live stats smoke (open Tokenomics modal and verify pools/allocation section).
    const liveStatsRoot = page.locator("#live-stats");
    await liveStatsRoot.first().scrollIntoViewIfNeeded();
    const tokenomicsBtn = liveStatsRoot.getByRole("button", { name: "TOKENOMICS" }).first();
    await tokenomicsBtn.waitFor({ state: "visible", timeout: 30_000 });
    await tokenomicsBtn.click();
    await page.getByText(/POOLS\s*&\s*ALLOCATION/i).first().waitFor({
      state: "visible",
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Close" }).first().click();
    console.log("[smoke] live stats flow ok");

    // Token rewards claim status smoke in REWARDS panel.
    const rewardsNavButton = page.locator('button[aria-label="REWARDS"]').first();
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
        pageErrors.length
          ? `Page errors:\n- ${pageErrors.join("\n- ")}`
          : null,
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

    console.log("Runtime smoke passed.");
    if (consoleErrors.length) {
      console.log(`Non-fatal console errors observed: ${consoleErrors.length}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  const port = await getFreePort(HOST);
  const baseUrl = `http://${HOST}:${port}`;
  const preview = startPreview(port);
  try {
    await waitForServer(baseUrl, preview);
    await runSmoke(baseUrl);
  } finally {
    await stopProcessTree(preview);
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exitCode = 1;
});
