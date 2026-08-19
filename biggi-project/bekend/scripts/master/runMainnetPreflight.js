const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

const cwd = path.resolve(__dirname, "../..");
const reportsDir = path.resolve(cwd, "reports");

function parseArgs(argv) {
  const opts = {
    network: String(process.env.DEPLOY_NETWORK || "polygon").toLowerCase(),
    envFile: path.resolve(cwd, ".env"),
    addressesFile: "",
    expectLiquidityPath: String(process.env.EXPECT_LIQUIDITY_PATH || process.env.LIQUIDITY_PATH || "").toLowerCase(),
    expectOwner: process.env.EXPECT_OWNER || "",
    skipCompile: false,
    skipTests: false,
    skipValidate: false,
    skipCheck: false,
    requireCode: false,
    withForkTests: false,
    reportPath: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      const next = argv[i + 1];
      if (!next) throw new Error("--network requires value: polygon");
      opts.network = String(next).toLowerCase();
      i++;
    } else if (a === "--env") {
      const next = argv[i + 1];
      if (!next) throw new Error("--env requires file path");
      opts.envFile = path.resolve(cwd, next);
      i++;
    } else if (a === "--addresses") {
      const next = argv[i + 1];
      if (!next) throw new Error("--addresses requires file path");
      opts.addressesFile = path.resolve(cwd, next);
      i++;
    } else if (a === "--expect-liquidity-path") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-liquidity-path requires keeper_proxy|automation|none");
      opts.expectLiquidityPath = String(next).toLowerCase();
      i++;
    } else if (a === "--expect-owner") {
      const next = argv[i + 1];
      if (!next) throw new Error("--expect-owner requires address");
      opts.expectOwner = next;
      i++;
    } else if (a === "--skip-compile") {
      opts.skipCompile = true;
    } else if (a === "--skip-tests") {
      opts.skipTests = true;
    } else if (a === "--skip-validate") {
      opts.skipValidate = true;
    } else if (a === "--skip-check") {
      opts.skipCheck = true;
    } else if (a === "--require-code") {
      opts.requireCode = true;
    } else if (a === "--with-fork-tests") {
      opts.withForkTests = true;
    } else if (a === "--report") {
      const next = argv[i + 1];
      if (!next) throw new Error("--report requires file path");
      opts.reportPath = path.resolve(cwd, next);
      i++;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (opts.network !== "polygon") {
    throw new Error(`Unsupported network: ${opts.network}. Use polygon.`);
  }
  if (opts.expectLiquidityPath && !["keeper_proxy", "automation", "none"].includes(opts.expectLiquidityPath)) {
    throw new Error("Invalid --expect-liquidity-path (keeper_proxy|automation|none).");
  }
  if (!opts.reportPath) {
    opts.reportPath = path.resolve(reportsDir, `master-mainnet-preflight-${opts.network}.json`);
  }

  return opts;
}

function printHelp() {
  console.log(`Usage:
  node scripts/master/runMainnetPreflight.js --network polygon [options]

Options:
  --env <path>                      env file (default: ./biggi-project/bekend/.env)
  --addresses <path>                deployed addresses file for strict on-chain check, including MAIN metadata gate
  --expect-owner <address>          expected final owner / Safe
  --expect-liquidity-path <path>    keeper_proxy | automation | none
  --require-code                    fail if configured addresses have no code
  --with-fork-tests                 include npm run test:master:fork
  --skip-compile                    skip compile step
  --skip-tests                      skip test:master step
  --skip-validate                   skip strict env validation
  --skip-check                      skip on-chain consistency check
  --report <path>                   custom report output path
  --help                            show this help`);
}

function markSkipped(report, stepName, reason) {
  report.steps.push({
    name: stepName,
    status: "skipped",
    reason,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 0,
  });
  console.log(`\n==> ${stepName} (skipped: ${reason})`);
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

function ensureFileExists(label, filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function writeReport(reportPath, report) {
  const outDir = path.dirname(reportPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
}

function main() {
  let opts;
  const report = {
    startedAt: new Date().toISOString(),
    status: "running",
    options: null,
    steps: [],
  };

  try {
    opts = parseArgs(process.argv.slice(2));
    if (fs.existsSync(opts.envFile)) {
      dotenv.config({ path: opts.envFile, override: true });
      if (!opts.expectOwner) opts.expectOwner = process.env.EXPECT_OWNER || "";
      if (!opts.expectLiquidityPath) {
        opts.expectLiquidityPath = process.env.EXPECT_LIQUIDITY_PATH || process.env.LIQUIDITY_PATH || "";
      }
    }
    report.options = {
      ...opts,
      envFile: opts.envFile,
      addressesFile: opts.addressesFile || null,
    };

    ensureFileExists("Env file", opts.envFile);
    if (opts.addressesFile) {
      ensureFileExists("Addresses file", opts.addressesFile);
    }

    if (opts.skipCompile) {
      markSkipped(report, "compile:master", "requested by flag");
    } else {
      runStep("compile:master", "npm", ["run", "compile:master"], null, report);
    }

    if (opts.skipTests) {
      markSkipped(report, "test:master", "requested by flag");
    } else {
      runStep("test:master", "npm", ["run", "test:master"], null, report);
    }

    if (opts.withForkTests) {
      runStep("test:master:fork", "npm", ["run", "test:master:fork"], null, report);
    } else {
      markSkipped(report, "test:master:fork", "not requested");
    }

    if (opts.skipValidate) {
      markSkipped(report, `validate:master:${opts.network}:strict`, "requested by flag");
    } else {
      const validateArgs = [
        "scripts/master/validateMainnetEnv.js",
        "--network",
        opts.network,
        "--strict",
        "--env",
        opts.envFile,
      ];
      if (opts.expectLiquidityPath) {
        validateArgs.push("--expect-liquidity-path", opts.expectLiquidityPath);
      }
      if (opts.expectOwner) {
        validateArgs.push("--expect-owner", opts.expectOwner);
      }
      runStep(`validate:master:${opts.network}:strict`, "node", validateArgs, null, report);
    }

    if (opts.skipCheck) {
      markSkipped(report, `check:master:${opts.network}`, "requested by flag");
    } else if (!opts.addressesFile) {
      markSkipped(report, `check:master:${opts.network}`, "no addresses file provided");
    } else {
      const checkEnv = {
        CHECK_STRICT: "1",
        CHECK_REQUIRE_CODE: opts.requireCode ? "1" : "0",
        MASTER_ADDRESSES_FILE: opts.addressesFile,
      };
      if (opts.expectOwner) {
        checkEnv.EXPECT_OWNER = opts.expectOwner;
      }
      if (opts.expectLiquidityPath) {
        checkEnv.EXPECT_LIQUIDITY_PATH = opts.expectLiquidityPath;
        checkEnv.LIQUIDITY_PATH = opts.expectLiquidityPath;
      }
      runStep(
        `check:master:${opts.network}`,
        "npx",
        ["hardhat", "run", "--config", "hardhat.biggi-master.cjs", "scripts/master/checkMasterStatus.js", "--network", opts.network],
        checkEnv,
        report
      );
    }

    report.status = "ok";
    console.log("\nMainnet preflight: OK");
  } catch (err) {
    report.status = "failed";
    report.error = String(err && err.message ? err.message : err);
    console.error(`\nMainnet preflight failed: ${report.error}`);
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    if (opts && opts.reportPath) {
      writeReport(opts.reportPath, report);
    } else {
      writeReport(path.resolve(reportsDir, "master-mainnet-preflight-unknown.json"), report);
    }
  }
}

main();
