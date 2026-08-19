const { spawnSync } = require("child_process");
const path = require("path");

function parseArgs(argv) {
  const opts = {
    network: null,
    addressesFile: null,
    strict: false,
    requireCode: false,
    expectPaidNative: false,
    chapterId: null,
    reportFile: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--network") {
      const next = argv[i + 1];
      if (!next) throw new Error("--network requires a value");
      opts.network = next;
      i++;
    } else if (arg === "--addresses" || arg === "--addresses-file") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${arg} requires a file path`);
      opts.addressesFile = next;
      i++;
    } else if (arg === "--strict") {
      opts.strict = true;
    } else if (arg === "--require-code") {
      opts.requireCode = true;
    } else if (arg === "--expect-paid-native") {
      opts.expectPaidNative = true;
    } else if (arg === "--chapter-id") {
      const next = argv[i + 1];
      if (!next) throw new Error("--chapter-id requires a value");
      opts.chapterId = next;
      i++;
    } else if (arg === "--report") {
      const next = argv[i + 1];
      if (!next) throw new Error("--report requires a file path");
      opts.reportFile = next;
      i++;
    } else if (!arg.startsWith("-") && !opts.addressesFile) {
      opts.addressesFile = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cwd = path.resolve(__dirname, "../..");
  const args = [
    "hardhat",
    "run",
    "--config",
    "hardhat.biggi-master.cjs",
    "scripts/master/checkCoreRelationships.js",
  ];

  if (opts.network) {
    args.push("--network", opts.network);
  }

  const env = { ...process.env };
  if (opts.addressesFile) env.CORE_ADDRESSES_FILE = opts.addressesFile;
  if (opts.strict) env.CORE_CHECK_STRICT = "1";
  if (opts.requireCode) env.CORE_CHECK_REQUIRE_CODE = "1";
  if (opts.expectPaidNative) env.CORE_EXPECT_PAID_NATIVE = "1";
  if (opts.chapterId) env.CORE_CHAPTER_ID = opts.chapterId;
  if (opts.reportFile) env.CORE_RELATIONSHIP_REPORT = opts.reportFile;

  const result = spawnSync("npx", args, { cwd, env, stdio: "inherit", shell: true });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status == null ? 1 : result.status);
}

main();
