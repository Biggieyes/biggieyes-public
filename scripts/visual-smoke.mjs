import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "reports", "visual-smoke");
const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_TIMEOUT_MS = 45_000;
const PAGE_TIMEOUT_MS = 45_000;

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  {
    name: "tablet",
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  },
];

const PANELS = [
  {
    name: "rewards",
    button: /Open Rewards/i,
    ready: /Next claim window|Token rewards|NFT Rewards/i,
  },
  {
    name: "collections",
    button: /Open Collections/i,
    ready: /Collection|Series|Chapter|Public collection/i,
  },
  {
    name: "vrf-mint",
    button: /Open VRF Mint/i,
    ready: /VRF|Redeem|Randomness|Reveal/i,
  },
  {
    name: "ecosystem-flow",
    button: /Open BIGGI Ecosystem/i,
    ready: /FLOW|DISTRIBUTOR|BUYBACK|DRIP|RESERVE/i,
  },
  {
    name: "user-panel",
    button: /Open User panel/i,
    ready: /Wallet|Tickets|Transactions|Rewards/i,
  },
  {
    name: "community-center",
    button: /Open Community Center/i,
    ready: /Community|Voting|Moderator|Claims/i,
  },
];

const ECOSYSTEM_TABS = [
  { name: "ecosystem-flow-tab", tab: /^FLOW$/i },
  { name: "ecosystem-distributor", tab: /^DISTRIBUTOR$/i },
  { name: "ecosystem-buyback", tab: /^BUYBACK$/i },
  { name: "ecosystem-drip", tab: /^DRIP$/i },
  { name: "ecosystem-liquidity", tab: /RESERVE\s*\/\s*LM/i },
  { name: "ecosystem-dex", tab: /TOKEN\s*\/\s*DEX/i },
  { name: "ecosystem-history", tab: /^HISTORY$/i },
  { name: "ecosystem-transparency", tab: /^TRANSPARENCY$/i },
  { name: "ecosystem-policy", tab: /^POLICY$/i },
];

const COLLECTION_TABS = [
  { name: "collections-public", tab: /^Public Collection$/i },
  { name: "collections-chapters", tab: /^Chapters$/i },
];

const VRF_TABS = [
  { name: "vrf-requests", tab: /^Requests$/i },
  { name: "vrf-history", tab: /^History$/i },
  { name: "vrf-post-redeem", tab: /^Post-Redeem$/i },
  { name: "vrf-health", tab: /^VRF Health$/i },
  { name: "vrf-proof-log", tab: /^Proof Log$/i },
];

function log(msg) {
  console.log(`[visual-smoke] ${msg}`);
}

function slug(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, PREVIEW_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < PREVIEW_TIMEOUT_MS) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Preview server did not start at ${url}: ${lastError?.message || "timeout"}`,
  );
}

function startPreview(port) {
  const command = `${npmCmd} run preview -- --host ${PREVIEW_HOST} --port ${port} --strictPort`;
  log(`starting preview: ${command}`);
  const child = spawn(command, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: true,
  });

  child.stdout.on("data", (data) => process.stdout.write(data));
  child.stderr.on("data", (data) => process.stderr.write(data));

  return child;
}

async function stopPreview(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        {
          stdio: "ignore",
          shell: false,
        },
      );
      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
      setTimeout(resolve, 3_000).unref();
    });
    return;
  }
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
    setTimeout(resolve, 3_000).unref();
  });
}

async function closeOpenPanel(page) {
  const closeButtons = await page
    .getByRole("button", { name: /^Close$/i })
    .all()
    .catch(() => []);
  if (closeButtons.length > 0) {
    await closeButtons[closeButtons.length - 1].click({ timeout: 3_000 });
    await page.waitForTimeout(350);
    return;
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(350);
}

async function openPanel(page, panel) {
  await closeOpenPanel(page);
  const button = page.getByRole("button", { name: panel.button }).first();
  await button.scrollIntoViewIfNeeded({ timeout: 8_000 }).catch(() => {});
  await button.click({ timeout: 12_000 });
  await page
    .getByText(panel.ready)
    .first()
    .waitFor({ timeout: 18_000 })
    .catch(() => page.waitForTimeout(2_000));
  await page.waitForTimeout(900);
}

async function clickTab(page, tab) {
  const button = page
    .getByRole("tab", { name: tab.tab })
    .or(page.getByRole("button", { name: tab.tab }))
    .first();
  await button.scrollIntoViewIfNeeded({ timeout: 6_000 }).catch(() => {});
  await button.click({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
}

async function detectOverflow(page) {
  return await page.evaluate(() => {
    const DECORATIVE_CLASSES = ["biggi-card__glow"];
    const isIgnoredDecor = (el) => {
      const cls = String(el.className || "");
      return DECORATIVE_CLASSES.some((name) => cls.includes(name));
    };
    const hasHorizontalScrollAncestor = (el) => {
      let node = el.parentElement;
      while (
        node &&
        node !== document.body &&
        node !== document.documentElement
      ) {
        const style = window.getComputedStyle(node);
        const canScroll = /(auto|scroll)/.test(style.overflowX || "");
        if (canScroll && node.scrollWidth > node.clientWidth + 4) return true;
        node = node.parentElement;
      }
      return false;
    };
    const root = document.documentElement;
    const body = document.body;
    const rootOverflow = Math.max(
      0,
      Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth,
    );
    const offenders = [];
    const nodes = Array.from(document.querySelectorAll("body *"));
    for (const el of nodes) {
      if (offenders.length >= 10) break;
      if (isIgnoredDecor(el) || hasHorizontalScrollAncestor(el)) continue;
      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right > window.innerWidth + 4 || rect.left < -4) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.className || "").slice(0, 120),
          text: String(el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 100),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    return { rootOverflow: Math.round(rootOverflow), offenders };
  });
}

async function capture(
  page,
  viewportName,
  name,
  failures,
  { fullPage = true } = {},
) {
  const screenshotPath = path.join(
    OUT_DIR,
    `${viewportName}-${slug(name)}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage });
  const overflow = await detectOverflow(page);
  if (overflow.rootOverflow > 8 || overflow.offenders.length > 0) {
    failures.push({
      viewport: viewportName,
      screen: name,
      overflow,
    });
  }
  log(`saved ${path.relative(ROOT, screenshotPath)}`);
}

async function scrollPanel(page, selector, position) {
  const target = page.locator(selector).first();
  await target.evaluate((element, nextPosition) => {
    element.scrollTop = nextPosition === "bottom" ? element.scrollHeight : 0;
  }, position);
  await page.waitForTimeout(500);
}

async function checkLiveStatsTables(page, viewport, failures) {
  const widget = page.locator(".live-stats-widget-new").first();
  await widget.scrollIntoViewIfNeeded({ timeout: 8_000 }).catch(() => {});

  const measure = async () => ({
    widget: await widget.boundingBox(),
    bodyHeight: await page.evaluate(() => document.body.scrollHeight),
    documentWidth: await page.evaluate(
      () => document.documentElement.scrollWidth,
    ),
  });
  const baseline = await measure();
  const tables = [
    { name: "live-stats-blocks", button: "BLOCKS", selector: ".bw-container" },
    {
      name: "live-stats-backgrounds",
      button: "BACKGROUNDS",
      selector: ".bgw-container",
    },
  ];

  for (const table of tables) {
    await widget
      .getByRole("button", { name: table.button, exact: true })
      .click({ timeout: 10_000 });
    await page.locator(table.selector).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(250);

    const opened = await measure();
    const before = baseline.widget;
    const after = opened.widget;
    const widgetMoved =
      !before ||
      !after ||
      ["x", "y", "width", "height"].some(
        (key) => Math.abs(Number(before?.[key]) - Number(after?.[key])) > 1,
      );
    if (
      widgetMoved ||
      opened.bodyHeight !== baseline.bodyHeight ||
      opened.documentWidth !== baseline.documentWidth
    ) {
      failures.push({
        viewport: viewport.name,
        screen: table.name,
        layoutShift: { baseline, opened },
      });
    }

    const tableWrapper = page
      .locator(
        table.selector === ".bw-container"
          ? ".bw-table-wrapper"
          : ".bgw-table-wrapper",
      )
      .first();
    const tableOverflow = await tableWrapper.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    if (
      viewport.isMobile &&
      tableOverflow.scrollWidth > tableOverflow.clientWidth + 4
    ) {
      failures.push({
        viewport: viewport.name,
        screen: table.name,
        tableOverflow,
      });
    }

    await capture(page, viewport.name, table.name, failures, {
      fullPage: false,
    });
    await page
      .locator(
        table.selector === ".bw-container" ? ".bw-button" : ".bgw-button",
      )
      .click({ timeout: 10_000 });
    await page
      .locator(table.selector)
      .waitFor({ state: "detached", timeout: 10_000 });
  }
}

async function runViewport(browser, baseUrl, viewport, failures) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: Boolean(viewport.hasTouch),
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(PAGE_TIMEOUT_MS);

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${baseUrl}/app/`, {
    waitUntil: "domcontentloaded",
    timeout: PAGE_TIMEOUT_MS,
  });
  await page.locator("body").waitFor({ timeout: 15_000 });
  await page
    .evaluate(() => document.fonts?.ready || Promise.resolve())
    .catch(() => {});
  await page.waitForTimeout(3_000);
  await capture(page, viewport.name, "app-home", failures);
  await checkLiveStatsTables(page, viewport, failures);

  for (const panel of PANELS) {
    await openPanel(page, panel);
    await capture(page, viewport.name, panel.name, failures, {
      fullPage: false,
    });

    if (panel.name === "ecosystem-flow") {
      for (const tab of ECOSYSTEM_TABS) {
        await clickTab(page, tab);
        await capture(page, viewport.name, tab.name, failures, {
          fullPage: false,
        });
      }
    }

    if (panel.name === "collections") {
      const universeButton = page
        .getByRole("button", { name: /^Universe$/i })
        .first();
      await universeButton.click({ timeout: 10_000 });
      await page.getByText(/^SOON$/i).first().waitFor({ timeout: 10_000 });
      await capture(
        page,
        viewport.name,
        "collections-vrf-universe",
        failures,
        { fullPage: false },
      );
      await page
        .getByRole("button", { name: /^Back to Original$/i })
        .click({ timeout: 10_000 });

      for (const tab of COLLECTION_TABS) {
        await clickTab(page, tab);
        await capture(page, viewport.name, tab.name, failures, {
          fullPage: false,
        });
        if (tab.name === "collections-public") {
          await page
            .getByRole("button", { name: /^Universe$/i })
            .click({ timeout: 10_000 });
          await page.getByText(/^SOON$/i).first().waitFor({ timeout: 10_000 });
          await capture(
            page,
            viewport.name,
            "collections-public-universe",
            failures,
            { fullPage: false },
          );
          await page
            .getByRole("button", { name: /^Back to Original$/i })
            .click({ timeout: 10_000 });
        }
        if (tab.name === "collections-chapters") {
          await scrollPanel(page, ".fullscreen-panel__container", "bottom");
          await capture(
            page,
            viewport.name,
            "collections-chapters-bottom",
            failures,
            { fullPage: false },
          );
          await scrollPanel(page, ".fullscreen-panel__container", "top");
        }
      }
    }

    if (panel.name === "vrf-mint") {
      for (const tab of VRF_TABS) {
        await clickTab(page, tab);
        await capture(page, viewport.name, tab.name, failures, {
          fullPage: false,
        });
        await scrollPanel(page, ".fullscreen-panel__container", "bottom");
        await capture(page, viewport.name, `${tab.name}-bottom`, failures, {
          fullPage: false,
        });
        await scrollPanel(page, ".fullscreen-panel__container", "top");
      }
    }

    if (
      panel.name === "rewards" ||
      panel.name === "user-panel" ||
      panel.name === "community-center"
    ) {
      await scrollPanel(page, ".fullscreen-panel__container", "bottom");
      await capture(page, viewport.name, `${panel.name}-bottom`, failures, {
        fullPage: false,
      });
      await scrollPanel(page, ".fullscreen-panel__container", "top");
    }
  }

  if (pageErrors.length > 0) {
    failures.push({
      viewport: viewport.name,
      screen: "page-errors",
      errors: pageErrors,
    });
  }

  const fatalConsoleErrors = consoleErrors.filter(
    (line) =>
      !/Failed to load resource/i.test(line) &&
      !/favicon/i.test(line) &&
      !/ResizeObserver loop/i.test(line),
  );
  if (fatalConsoleErrors.length > 0) {
    failures.push({
      viewport: viewport.name,
      screen: "console-errors",
      errors: fatalConsoleErrors.slice(0, 20),
    });
  }

  await context.close();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const port = await getFreePort();
  const baseUrl = `http://${PREVIEW_HOST}:${port}`;
  const preview = startPreview(port);
  const failures = [];

  try {
    log(`waiting for ${baseUrl}`);
    await waitForServer(baseUrl);
    log("launching browser");
    const browser = await chromium.launch();
    try {
      for (const viewport of VIEWPORTS) {
        log(`checking ${viewport.name}`);
        await runViewport(browser, baseUrl, viewport, failures);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await stopPreview(preview);
  }

  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    throw new Error(`Visual smoke found ${failures.length} issue group(s).`);
  }

  log("passed");
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});
