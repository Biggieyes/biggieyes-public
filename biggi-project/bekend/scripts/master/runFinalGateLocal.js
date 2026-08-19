const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { ethers } = require("ethers");

const cwd = path.resolve(__dirname, "../..");
const reportsDir = path.resolve(cwd, "reports");
const reportPath = path.resolve(reportsDir, "master-final-gate-local.json");

function parseArgs(argv) {
  const opts = {
    skipCompile: false,
    skipTests: false,
    skipDeploy: false,
    expectedLiquidityPath: process.env.EXPECT_LIQUIDITY_PATH || "keeper_proxy",
    expectedOwner: process.env.EXPECT_OWNER || "",
    requireCode: process.env.CHECK_REQUIRE_CODE === "0" ? false : true,
    strictCheck: process.env.CHECK_STRICT === "0" ? false : true,
    timeoutMs: 120000,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--skip-compile") {
      opts.skipCompile = true;
    } else if (a === "--skip-tests") {
      opts.skipTests = true;
    } else if (a === "--skip-deploy") {
      opts.skipDeploy = true;
    } else if (a === "--expect-liquidity-path") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-liquidity-path requires value");
      opts.expectedLiquidityPath = next;
      i++;
    } else if (a === "--expect-owner") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-owner requires address");
      opts.expectedOwner = next;
      i++;
    } else if (a === "--timeout-ms") {
      const next = argv[i + 1];
      if (!next) throw new Error("--timeout-ms requires integer");
      const ms = Number(next);
      if (!Number.isInteger(ms) || ms < 10000) {
        throw new Error("--timeout-ms must be integer >= 10000");
      }
      opts.timeoutMs = ms;
      i++;
    }
  }

  const p = String(opts.expectedLiquidityPath || "").toLowerCase();
  if (p && !["keeper_proxy", "automation", "none"].includes(p)) {
    throw new Error("Invalid --expect-liquidity-path (keeper_proxy|automation|none)");
  }
  opts.expectedLiquidityPath = p;

  return opts;
}

function runStep(stepName, command, args, envExtra, report) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  console.log(`\n==> ${stepName}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...(envExtra || {}) },
  });
  const durationMs = Date.now() - t0;
  const status = result.status == null ? 1 : result.status;
  report.steps.push({
    name: stepName,
    command: [command, ...args].join(" "),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs,
    status,
  });
  if (status !== 0) {
    throw new Error(`${stepName} failed with status ${status}`);
  }
}

async function waitForRpc(timeoutMs) {
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

function startLocalNode() {
  const proc = spawn("npx", ["hardhat", "node", "--config", "hardhat.biggi-master.cjs"], {
    cwd,
    stdio: "ignore",
    detached: false,
    shell: process.platform === "win32",
    windowsHide: true,
  });
  return proc;
}

function stopProcess(proc) {
  if (!proc || proc.killed) return;
  try {
    proc.kill();
  } catch {
    // no-op
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const report = {
    startedAt: new Date().toISOString(),
    options: opts,
    steps: [],
    status: "running",
  };

  let startedNodeProc = null;
  let startedNodeByScript = false;

  try {
    if (!opts.skipCompile) {
      runStep("compile:master", "npm", ["run", "compile:master"], null, report);
    }

    if (!opts.skipTests) {
      runStep("test:master", "npm", ["run", "test:master"], null, report);
    }

    const rpcReady = await waitForRpc(3000);
    if (!rpcReady) {
      console.log("\n==> starting local hardhat node");
      startedNodeProc = startLocalNode();
      startedNodeByScript = true;
      const ready = await waitForRpc(opts.timeoutMs);
      if (!ready) {
        throw new Error("Local hardhat node did not become ready in time.");
      }
    } else {
      console.log("\n==> local hardhat node already running (reusing)");
    }

    if (!opts.skipDeploy) {
      const deployEnv = {};
      if (opts.expectedLiquidityPath) {
        deployEnv.LIQUIDITY_PATH = opts.expectedLiquidityPath;
        deployEnv.EXPECT_LIQUIDITY_PATH = opts.expectedLiquidityPath;
      }
      runStep("deploy:master:local", "npm", ["run", "deploy:master:local"], deployEnv, report);
    }

    const checkEnv = {
      CHECK_STRICT: opts.strictCheck ? "1" : "0",
      CHECK_REQUIRE_CODE: opts.requireCode ? "1" : "0",
    };

    if (opts.expectedLiquidityPath) {
      checkEnv.LIQUIDITY_PATH = opts.expectedLiquidityPath;
      checkEnv.EXPECT_LIQUIDITY_PATH = opts.expectedLiquidityPath;
    }
    if (opts.expectedOwner) {
      checkEnv.EXPECT_OWNER = opts.expectedOwner;
    }

    runStep("check:master:local", "npm", ["run", "check:master:local"], checkEnv, report);

    report.status = "ok";
    console.log("\nFinal gate local: OK");
  } catch (err) {
    report.status = "failed";
    report.error = String(err && err.message ? err.message : err);
    console.error(`\nFinal gate local failed: ${report.error}`);
    process.exitCode = 1;
  } finally {
    if (startedNodeByScript && startedNodeProc) {
      stopProcess(startedNodeProc);
    }
    report.finishedAt = new Date().toISOString();
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${reportPath}`);
  }
}

main();
