// Cross-platform runner for configureMasterEssence.js.
// Hardhat 2 rejects unknown script args on `hardhat run`, so this wrapper maps
// CLI flags to env vars and then launches Hardhat with only Hardhat-supported args.

const { spawn } = require("child_process");

function parseArgs(argv) {
  const opts = {
    network: null,
    execute: false,
    strict: false,
    requireCode: false,
    initialDistribute: false,
    expectLiquidityPath: null,
    addressesFile: null,
    report: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--network") {
      if (!argv[i + 1]) throw new Error("--network requires a value");
      opts.network = argv[++i];
    } else if (a === "--execute") {
      opts.execute = true;
    } else if (a === "--strict") {
      opts.strict = true;
    } else if (a === "--require-code") {
      opts.requireCode = true;
    } else if (a === "--initial-distribute") {
      opts.initialDistribute = true;
    } else if (a === "--expect-liquidity-path") {
      if (!argv[i + 1]) throw new Error("--expect-liquidity-path requires keeper_proxy|automation|none");
      opts.expectLiquidityPath = argv[++i];
    } else if (a === "--addresses" || a === "--addresses-file") {
      if (!argv[i + 1]) throw new Error(`${a} requires a file path`);
      opts.addressesFile = argv[++i];
    } else if (a === "--report") {
      if (!argv[i + 1]) throw new Error("--report requires a file path");
      opts.report = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const env = { ...process.env };

  if (opts.execute) env.CONFIGURE_EXECUTE = "1";
  if (opts.strict) env.CONFIGURE_STRICT = "1";
  if (opts.requireCode) env.CONFIGURE_REQUIRE_CODE = "1";
  if (opts.initialDistribute) env.CONFIGURE_INITIAL_DISTRIBUTE = "1";
  if (opts.expectLiquidityPath) env.EXPECT_LIQUIDITY_PATH = opts.expectLiquidityPath;
  if (opts.addressesFile) env.MASTER_ADDRESSES_FILE = opts.addressesFile;
  if (opts.report) env.CONFIGURE_REPORT = opts.report;

  const args = [
    "hardhat",
    "run",
    "--config",
    "hardhat.biggi-master.cjs",
    "scripts/master/configureMasterEssence.js",
  ];
  if (opts.network) args.push("--network", opts.network);

  const bin = "npx";
  const child = spawn(bin, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => process.exit(code == null ? 1 : code));
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
