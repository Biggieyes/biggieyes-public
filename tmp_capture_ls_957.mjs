import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

const port = 61777;
const host = "127.0.0.1";
const base = `http://${host}:${port}`;
const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
const ps = spawn(cmd, ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"], { stdio: "pipe" });

let ready = false;
const onData = (d) => {
  const s = d.toString();
  if (s.includes("Local") || s.includes("http://")) ready = true;
};
ps.stdout.on("data", onData);
ps.stderr.on("data", onData);

for (let i = 0; i < 120 && !ready; i++) await sleep(500);
if (!ready) {
  ps.kill("SIGTERM");
  throw new Error("preview not ready");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 957, height: 608 } });
await page.goto(`${base}/app/`, { waitUntil: "networkidle" });
await sleep(2500);
await page.screenshot({ path: "tmp_ls_957x608_before_center_fix.png", fullPage: true });
await browser.close();
ps.kill("SIGTERM");
