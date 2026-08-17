const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function parseArgs(argv) {
  const opts = {
    addressesFile: null,
    strict: false,
    requireCode: false,
    chapterId: null,
    expectPaidNative: false,
    reportFile: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--addresses" || arg === "--addresses-file") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${arg} requires a path`);
      opts.addressesFile = next;
      i++;
    } else if (arg === "--strict") {
      opts.strict = true;
    } else if (arg === "--require-code") {
      opts.requireCode = true;
    } else if (arg === "--chapter-id") {
      const next = argv[i + 1];
      if (!next) throw new Error("--chapter-id requires a number");
      const value = Number(next);
      if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid --chapter-id: ${next}`);
      opts.chapterId = value;
      i++;
    } else if (arg === "--expect-paid-native") {
      opts.expectPaidNative = true;
    } else if (arg === "--report") {
      const next = argv[i + 1];
      if (!next) throw new Error("--report requires a path");
      opts.reportFile = next;
      i++;
    }
  }

  if (process.env.CORE_CHECK_STRICT === "1") opts.strict = true;
  if (process.env.CORE_CHECK_REQUIRE_CODE === "1") opts.requireCode = true;
  if (process.env.CORE_EXPECT_PAID_NATIVE === "1") opts.expectPaidNative = true;
  if (process.env.CORE_CHAPTER_ID) {
    const value = Number(process.env.CORE_CHAPTER_ID);
    if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid CORE_CHAPTER_ID: ${process.env.CORE_CHAPTER_ID}`);
    opts.chapterId = value;
  }
  if (process.env.CORE_RELATIONSHIP_REPORT) opts.reportFile = process.env.CORE_RELATIONSHIP_REPORT;

  return opts;
}

function resolveAddressesPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CORE_ADDRESSES_FILE,
    process.env.MASTER_ADDRESSES_FILE,
    "./addresses.visibility.polygon.json",
    "./addresses.master.json",
    "./addresses.json",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) return resolved;
  }

  throw new Error("Addresses file not found. Use --addresses <file>.");
}

function resolveReportPath(explicitPath) {
  if (explicitPath) return path.resolve(process.cwd(), explicitPath);
  return path.resolve(process.cwd(), `reports/core-relationships-${network.name}.json`);
}

function isAddress(value) {
  try {
    return !!value && ethers.utils.getAddress(value) !== ZERO;
  } catch {
    return false;
  }
}

function pickAddress(raw, keys) {
  for (const key of keys) {
    if (isAddress(raw[key])) return ethers.utils.getAddress(raw[key]);
  }
  return ZERO;
}

function pickNumber(raw, keys, fallback = null) {
  for (const key of keys) {
    const value = raw[key];
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return fallback;
}

function normalizeAddresses(raw) {
  return {
    OWNER: pickAddress(raw, ["OWNER", "SAFE", "MULTISIG", "DEV_WALLET"]),
    MAIN: pickAddress(raw, ["MAIN", "COLLECTION", "COLLECTION_VRF"]),
    MAIN2: pickAddress(raw, ["MAIN2", "COLLECTION2", "COLLECTION_PUBLIC"]),
    TICKET_HUB: pickAddress(raw, ["TICKET_HUB"]),
    COMPUTE: pickAddress(raw, ["COMPUTE"]),
    VRF_ROUTER: pickAddress(raw, ["VRF_ROUTER"]),
    REGISTRY: pickAddress(raw, ["REGISTRY"]),
    CHAPTER_CONTROLLER: pickAddress(raw, ["CHAPTER_CONTROLLER"]),
    DISTRIBUTOR: pickAddress(raw, ["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"]),
    COLLECTION_REWARDS: pickAddress(raw, ["COLLECTION_REWARDS"]),
    TOKEN_REWARDS: pickAddress(raw, ["TOKEN_REWARDS"]),
    NFT_REWARDS: pickAddress(raw, ["NFT_REWARDS", "BIGGI_NFT_REWARDS"]),
    RESERVE: pickAddress(raw, ["RESERVE", "RESERVE_ADDRESS"]),
    BUYBACK_AGENT: pickAddress(raw, ["BUYBACK_AGENT", "BUYBACK"]),
    TREASURY: pickAddress(raw, ["TREASURY", "TOKEN_SINK"]),
    COMMUNITY_CENTER: pickAddress(raw, ["COMMUNITY_CENTER", "COMMUNITY", "COMMUNITYCENTER"]),
    MAIN_READER: pickAddress(raw, ["MAIN_READER", "READER"]),
    CHAPTER_SERIES_READER: pickAddress(raw, ["CHAPTER_SERIES_READER", "CHAPTER_READER", "SERIES_READER"]),
    MULTI_COLLECTION_READER: pickAddress(raw, ["MULTI_COLLECTION_READER", "MCD_READER", "MULTI_COLLECTION_DISTRIBUTOR_READER"]),
    NFT_REWARDS_READER: pickAddress(raw, ["NFT_REWARDS_READER"]),
    CHAPTER_ID: pickNumber(raw, ["CHAPTER_ID"], null),
    SALE_CAP: pickNumber(raw, ["SALE_CAP"], null),
    MARKETING_CAP: pickNumber(raw, ["MARKETING_CAP"], null),
  };
}

function contractAt(address, abi) {
  return new ethers.Contract(address, abi, ethers.provider);
}

function eqAddress(a, b) {
  if (!isAddress(a) || !isAddress(b)) return false;
  return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function valueToString(value) {
  if (value == null) return "null";
  if (ethers.BigNumber.isBigNumber(value)) return value.toString();
  if (Array.isArray(value)) return value.map(valueToString);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = valueToString(item);
    return out;
  }
  return String(value);
}

function createRecorder() {
  const report = {
    network: network.name,
    chainId: null,
    checkedAt: new Date().toISOString(),
    checks: [],
    warnings: [],
    issues: [],
  };

  function record(status, label, details = {}) {
    report.checks.push({ status, label, ...details });
    const suffix = details.message ? ` - ${details.message}` : "";
    console.log(`${status.toUpperCase()} ${label}${suffix}`);
  }

  function ok(label, details = {}) {
    record("ok", label, details);
  }

  function warn(label, message, details = {}) {
    report.warnings.push({ label, message, ...details });
    record("warn", label, { ...details, message });
  }

  function issue(label, message, details = {}) {
    report.issues.push({ label, message, ...details });
    record("issue", label, { ...details, message });
  }

  return { report, ok, warn, issue };
}

async function hasCode(address) {
  if (!isAddress(address)) return false;
  return (await ethers.provider.getCode(address)) !== "0x";
}

async function ensureReadable(name, address, requireCode, recorder) {
  if (!isAddress(address)) {
    recorder.warn(name, "address not set");
    return false;
  }
  if (await hasCode(address)) {
    recorder.ok(`${name}.code`, { address });
    return true;
  }
  const message = `no code at ${address} on ${network.name}`;
  if (requireCode) recorder.issue(`${name}.code`, message, { address });
  else recorder.warn(`${name}.code`, message, { address });
  return false;
}

async function readValue(recorder, label, fn) {
  try {
    const value = await fn();
    recorder.ok(label, { actual: valueToString(value) });
    return value;
  } catch (err) {
    recorder.warn(label, err.message);
    return null;
  }
}

function expectAddress(recorder, label, actual, expected) {
  if (!isAddress(expected)) {
    recorder.warn(label, "expected address not set", { actual: valueToString(actual), expected: ZERO });
    return;
  }
  if (eqAddress(actual, expected)) {
    recorder.ok(label, { actual, expected });
  } else {
    recorder.issue(label, "address mismatch", {
      actual: isAddress(actual) ? ethers.utils.getAddress(actual) : valueToString(actual),
      expected,
    });
  }
}

function expectBool(recorder, label, actual, expected) {
  if (Boolean(actual) === Boolean(expected)) {
    recorder.ok(label, { actual: Boolean(actual), expected: Boolean(expected) });
  } else {
    recorder.issue(label, "boolean mismatch", { actual: Boolean(actual), expected: Boolean(expected) });
  }
}

function expectNumber(recorder, label, actual, expected) {
  if (expected == null) {
    recorder.warn(label, "expected number not set", { actual: valueToString(actual) });
    return;
  }
  const actualNum = ethers.BigNumber.isBigNumber(actual) ? actual.toNumber() : Number(actual);
  const expectedNum = Number(expected);
  if (actualNum === expectedNum) {
    recorder.ok(label, { actual: actualNum, expected: expectedNum });
  } else {
    recorder.issue(label, "number mismatch", { actual: actualNum, expected: expectedNum });
  }
}

function expectNonZero(recorder, label, address, severity = "issue") {
  if (isAddress(address)) {
    recorder.ok(label, { actual: address });
  } else if (severity === "warn") {
    recorder.warn(label, "zero address", { actual: ZERO });
  } else {
    recorder.issue(label, "zero address", { actual: ZERO });
  }
}

async function checkMainBranch(addresses, opts, recorder) {
  if (!(await ensureReadable("MAIN", addresses.MAIN, opts.requireCode, recorder))) return {};

  const main = contractAt(addresses.MAIN, [
    "function ticketHub() view returns (address)",
    "function compute() view returns (address)",
    "function vrfRouter() view returns (address)",
    "function metadataConsistency() view returns (uint256 configuredCount,bool fullyConfigured,bool rewardMatrixConsistent)",
    "function assertMetadataConsistency() view returns (bool)",
  ]);

  const ticketHub = await readValue(recorder, "MAIN.ticketHub", () => main.ticketHub());
  const compute = await readValue(recorder, "MAIN.compute", () => main.compute());
  const vrfRouter = await readValue(recorder, "MAIN.vrfRouter", () => main.vrfRouter());
  const metadata = await readValue(recorder, "MAIN.metadataConsistency", async () => {
    const [configuredCount, fullyConfigured, rewardMatrixConsistent] = await main.metadataConsistency();
    return {
      configuredCount: configuredCount.toString(),
      fullyConfigured,
      rewardMatrixConsistent,
    };
  });

  expectAddress(recorder, "MAIN.ticketHub == TICKET_HUB", ticketHub, addresses.TICKET_HUB);
  expectAddress(recorder, "MAIN.compute == COMPUTE", compute, addresses.COMPUTE);
  expectAddress(recorder, "MAIN.vrfRouter == VRF_ROUTER", vrfRouter, addresses.VRF_ROUTER);

  if (metadata) {
    if (metadata.fullyConfigured && metadata.rewardMatrixConsistent) {
      recorder.ok("MAIN.metadata launch-ready", metadata);
    } else if (opts.strict) {
      recorder.issue("MAIN.metadata launch-ready", "metadata is not fully configured", metadata);
    } else {
      recorder.warn("MAIN.metadata launch-ready", "metadata is not fully configured; redeem is not ready", metadata);
    }
  }

  if (opts.strict) {
    const asserted = await readValue(recorder, "MAIN.assertMetadataConsistency", () => main.assertMetadataConsistency());
    expectBool(recorder, "MAIN.assertMetadataConsistency == true", asserted, true);
  }

  return { ticketHub, compute, vrfRouter, metadata };
}

async function checkTicketHub(addresses, opts, recorder) {
  if (!(await ensureReadable("TICKET_HUB", addresses.TICKET_HUB, opts.requireCode, recorder))) return {};

  const hub = contractAt(addresses.TICKET_HUB, [
    "function mainCollection() view returns (address)",
    "function chapterMainCollection(uint256) view returns (address)",
    "function distributor() view returns (address)",
    "function devWallet() view returns (address)",
    "function saleCap() view returns (uint16)",
    "function marketingCap() view returns (uint16)",
    "function chapterSaleCap(uint256) view returns (uint16)",
    "function chapterMarketingCap(uint256) view returns (uint16)",
    "function MAX_TICKETS() view returns (uint16)",
    "function ticketMinted() view returns (uint16)",
    "function saleMinted() view returns (uint16)",
    "function marketingMinted() view returns (uint16)",
    "function isFullyExhausted() view returns (bool)",
    "function paused() view returns (bool)",
    "function BIGGI() view returns (address)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function reserveAddress() view returns (address)",
  ]);

  const mainCollection = await readValue(recorder, "TICKET_HUB.mainCollection", () => hub.mainCollection());
  const distributor = await readValue(recorder, "TICKET_HUB.distributor", () => hub.distributor());
  const devWallet = await readValue(recorder, "TICKET_HUB.devWallet", () => hub.devWallet());
  const saleCap = await readValue(recorder, "TICKET_HUB.saleCap", () => hub.saleCap());
  const marketingCap = await readValue(recorder, "TICKET_HUB.marketingCap", () => hub.marketingCap());
  const maxTickets = await readValue(recorder, "TICKET_HUB.MAX_TICKETS", () => hub.MAX_TICKETS());
  const chapterId = addresses.CHAPTER_ID == null ? 1 : Number(addresses.CHAPTER_ID);
  let effectiveMainCollection = mainCollection;
  let effectiveSaleCap = saleCap;
  let effectiveMarketingCap = marketingCap;
  if (chapterId !== 1) {
    effectiveMainCollection = await readValue(recorder, "TICKET_HUB.chapterMainCollection", () =>
      hub.chapterMainCollection(chapterId)
    );
    effectiveSaleCap = await readValue(recorder, "TICKET_HUB.chapterSaleCap", () => hub.chapterSaleCap(chapterId));
    effectiveMarketingCap = await readValue(recorder, "TICKET_HUB.chapterMarketingCap", () =>
      hub.chapterMarketingCap(chapterId)
    );
  }
  await readValue(recorder, "TICKET_HUB.ticketMinted", () => hub.ticketMinted());
  await readValue(recorder, "TICKET_HUB.saleMinted", () => hub.saleMinted());
  await readValue(recorder, "TICKET_HUB.marketingMinted", () => hub.marketingMinted());
  await readValue(recorder, "TICKET_HUB.isFullyExhausted", () => hub.isFullyExhausted());
  await readValue(recorder, "TICKET_HUB.paused", () => hub.paused());
  const biggi = await readValue(recorder, "TICKET_HUB.BIGGI", () => hub.BIGGI());
  const tokenSink = await readValue(recorder, "TICKET_HUB.tokenSink", () => hub.tokenSink());
  await readValue(recorder, "TICKET_HUB.tokenSinkBps", () => hub.tokenSinkBps());
  await readValue(recorder, "TICKET_HUB.tokenSinkDepositMode", () => hub.tokenSinkDepositMode());
  const reserveAddress = await readValue(recorder, "TICKET_HUB.reserveAddress", () => hub.reserveAddress());

  expectAddress(recorder, "TICKET_HUB chapter main == MAIN", effectiveMainCollection, addresses.MAIN);
  expectNonZero(recorder, "TICKET_HUB.distributor is configured", distributor);
  if (isAddress(addresses.DISTRIBUTOR)) {
    expectAddress(recorder, "TICKET_HUB.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR);
  }
  if (isAddress(addresses.OWNER)) expectAddress(recorder, "TICKET_HUB.devWallet == OWNER/DEV_WALLET", devWallet, addresses.OWNER);
  if (addresses.SALE_CAP != null) {
    expectNumber(recorder, "TICKET_HUB.saleCap == manifest SALE_CAP", effectiveSaleCap, addresses.SALE_CAP);
  }
  if (addresses.MARKETING_CAP != null) {
    expectNumber(recorder, "TICKET_HUB.marketingCap == manifest MARKETING_CAP", effectiveMarketingCap, addresses.MARKETING_CAP);
  }

  const sale = effectiveSaleCap == null ? 0 : Number(effectiveSaleCap);
  const marketing = effectiveMarketingCap == null ? 0 : Number(effectiveMarketingCap);
  const max = maxTickets == null ? 550 : Number(maxTickets);
  if (sale + marketing === max) {
    recorder.ok("TICKET_HUB saleCap + marketingCap == MAX_TICKETS", { actual: sale + marketing, expected: max });
  } else {
    recorder.issue("TICKET_HUB saleCap + marketingCap == MAX_TICKETS", "cap sum mismatch", {
      saleCap: sale,
      marketingCap: marketing,
      maxTickets: max,
    });
  }

  if (isAddress(biggi)) {
    expectNonZero(recorder, "TICKET_HUB BIGGI payment reserveAddress", reserveAddress);
    if (!isAddress(tokenSink)) {
      recorder.warn("TICKET_HUB BIGGI payment tokenSink", "BIGGI token is set but token sink is not set");
    }
  }

  if (sale > 0 && !isAddress(distributor)) {
    const message = "paid native sale requires distributor; mintTicket() will revert without it";
    if (opts.expectPaidNative) recorder.issue("TICKET_HUB paid native readiness", message);
    else recorder.warn("TICKET_HUB paid native readiness", message);
  }

  return { distributor, saleCap: sale, marketingCap: marketing };
}

async function checkVrf(addresses, opts, recorder) {
  if (!(await ensureReadable("VRF_ROUTER", addresses.VRF_ROUTER, opts.requireCode, recorder))) return;

  const router = contractAt(addresses.VRF_ROUTER, [
    "function main() view returns (address)",
    "function approvedMains(address) view returns (bool)",
    "function approvedRewardConsumers(address) view returns (bool)",
    "function keyHash() view returns (bytes32)",
    "function subId() view returns (uint256)",
    "function callbackGasLimit() view returns (uint32)",
    "function requestConfirmations() view returns (uint16)",
  ]);

  const main = await readValue(recorder, "VRF_ROUTER.main", () => router.main());
  const approved = isAddress(addresses.MAIN)
    ? await readValue(recorder, "VRF_ROUTER.approvedMains[MAIN]", () => router.approvedMains(addresses.MAIN))
    : null;
  await readValue(recorder, "VRF_ROUTER.keyHash", () => router.keyHash());
  await readValue(recorder, "VRF_ROUTER.subId", () => router.subId());
  await readValue(recorder, "VRF_ROUTER.callbackGasLimit", () => router.callbackGasLimit());
  await readValue(recorder, "VRF_ROUTER.requestConfirmations", () => router.requestConfirmations());

  if (isAddress(addresses.MAIN)) {
    const directMainOk = eqAddress(main, addresses.MAIN);
    const approvedMainOk = approved === true;
    if (directMainOk || approvedMainOk) {
      recorder.ok("VRF_ROUTER routes MAIN", {
        main: valueToString(main),
        expected: addresses.MAIN,
        approved: String(approvedMainOk),
      });
    } else {
      recorder.issue(
        "VRF_ROUTER routes MAIN",
        "router must either have main == MAIN or approvedMains[MAIN] == true",
        {
          main: valueToString(main),
          expected: addresses.MAIN,
          approved: String(approvedMainOk),
        }
      );
    }
  }

  if (isAddress(addresses.NFT_REWARDS)) {
    const approvedRewards = await readValue(
      recorder,
      "VRF_ROUTER.approvedRewardConsumers[NFT_REWARDS]",
      () => router.approvedRewardConsumers(addresses.NFT_REWARDS)
    );
    if (opts.strict) expectBool(recorder, "VRF_ROUTER NFT rewards approved == true", approvedRewards, true);
  }
}

async function resolveChapterId(addresses, cliChapterId, recorder) {
  if (cliChapterId != null) return cliChapterId;
  if (addresses.CHAPTER_ID != null) return addresses.CHAPTER_ID;
  if (!isAddress(addresses.REGISTRY) || !isAddress(addresses.MAIN) || !(await hasCode(addresses.REGISTRY))) return null;

  const registry = contractAt(addresses.REGISTRY, ["function chapterByCollection(address) view returns (uint256)"]);
  const chapterId = await readValue(recorder, "REGISTRY.chapterByCollection[MAIN]", () => registry.chapterByCollection(addresses.MAIN));
  const parsed = chapterId == null ? 0 : Number(chapterId);
  return parsed > 0 ? parsed : null;
}

async function checkChapterStack(addresses, opts, recorder, chapterId) {
  const hasRegistry = await ensureReadable("REGISTRY", addresses.REGISTRY, opts.requireCode, recorder);
  const hasController = await ensureReadable("CHAPTER_CONTROLLER", addresses.CHAPTER_CONTROLLER, opts.requireCode, recorder);
  if (!hasRegistry || !hasController) return {};

  if (chapterId == null) {
    recorder.warn("CHAPTER_ID", "not set and could not be derived from registry");
    return {};
  }

  const registry = contractAt(addresses.REGISTRY, [
    "function chapterByCollection(address) view returns (uint256)",
    "function getChapterCollections(uint256) view returns (address vrfCollection,address publicCollection,address ticketHub)",
    "function getChapterMeta(uint256) view returns (uint256 seriesId,uint256 chapterNumber)",
    "function isTicketHubForChapter(address ticketHub,uint256 chapterId) view returns (bool)",
    "function isTokenRewardsCollection(address) view returns (bool)",
    "function isCollectionRewardsCollection(address) view returns (bool)",
  ]);
  const controller = contractAt(addresses.CHAPTER_CONTROLLER, [
    "function registry() view returns (address)",
    "function chapterConfig(uint256) view returns (bool exists,uint16 saleCap,uint16 marketingCap,uint16 totalCap)",
    "function isChapterStackConsistent(uint256) view returns (bool)",
    "function isChapterCapConsistent(uint256) view returns (bool)",
    "function isPublicMintUnlocked(uint256) view returns (bool)",
    "function getChapterPriceProvider(uint256) view returns (address)",
    "function chapterMintProgress(uint256) view returns (uint256 saleMinted,uint256 marketingMinted,uint256 totalMinted,uint256 saleCap,uint256 marketingCap,uint256 totalCap,bool publicUnlocked)",
  ]);

  const controllerRegistry = await readValue(recorder, "CHAPTER_CONTROLLER.registry", () => controller.registry());
  expectAddress(recorder, "CHAPTER_CONTROLLER.registry == REGISTRY", controllerRegistry, addresses.REGISTRY);

  const mainChapter = await readValue(recorder, "REGISTRY.chapterByCollection[MAIN]", () => registry.chapterByCollection(addresses.MAIN));
  const main2Chapter = isAddress(addresses.MAIN2)
    ? await readValue(recorder, "REGISTRY.chapterByCollection[MAIN2]", () => registry.chapterByCollection(addresses.MAIN2))
    : null;
  const hubChapter = await readValue(recorder, "REGISTRY.chapterByCollection[TICKET_HUB]", () => registry.chapterByCollection(addresses.TICKET_HUB));
  const hubForChapter = await readValue(recorder, "REGISTRY.isTicketHubForChapter[TICKET_HUB, CHAPTER_ID]", () =>
    registry.isTicketHubForChapter(addresses.TICKET_HUB, chapterId)
  );

  expectNumber(recorder, "REGISTRY MAIN chapter == CHAPTER_ID", mainChapter, chapterId);
  if (main2Chapter != null) expectNumber(recorder, "REGISTRY MAIN2 chapter == CHAPTER_ID", main2Chapter, chapterId);
  if (hubForChapter != null) {
    expectBool(recorder, "REGISTRY TICKET_HUB belongs to CHAPTER_ID", hubForChapter, true);
  } else if (hubChapter != null) {
    expectNumber(recorder, "REGISTRY TICKET_HUB chapter == CHAPTER_ID", hubChapter, chapterId);
  }

  const collections = await readValue(recorder, "REGISTRY.getChapterCollections", () => registry.getChapterCollections(chapterId));
  if (collections) {
    expectAddress(recorder, "REGISTRY.chapter.vrfCollection == MAIN", collections.vrfCollection || collections[0], addresses.MAIN);
    if (isAddress(addresses.MAIN2)) {
      expectAddress(recorder, "REGISTRY.chapter.publicCollection == MAIN2", collections.publicCollection || collections[1], addresses.MAIN2);
    }
    expectAddress(recorder, "REGISTRY.chapter.ticketHub == TICKET_HUB", collections.ticketHub || collections[2], addresses.TICKET_HUB);
  }

  await readValue(recorder, "REGISTRY.getChapterMeta", () => registry.getChapterMeta(chapterId));
  await readValue(recorder, "REGISTRY.isTokenRewardsCollection[MAIN]", () => registry.isTokenRewardsCollection(addresses.MAIN));
  if (isAddress(addresses.MAIN2)) {
    await readValue(recorder, "REGISTRY.isTokenRewardsCollection[MAIN2]", () => registry.isTokenRewardsCollection(addresses.MAIN2));
  }
  await readValue(recorder, "REGISTRY.isCollectionRewardsCollection[MAIN]", () => registry.isCollectionRewardsCollection(addresses.MAIN));

  const config = await readValue(recorder, "CHAPTER_CONTROLLER.chapterConfig", () => controller.chapterConfig(chapterId));
  const stackConsistent = await readValue(recorder, "CHAPTER_CONTROLLER.isChapterStackConsistent", () => controller.isChapterStackConsistent(chapterId));
  const capConsistent = await readValue(recorder, "CHAPTER_CONTROLLER.isChapterCapConsistent", () => controller.isChapterCapConsistent(chapterId));
  const priceProvider = await readValue(recorder, "CHAPTER_CONTROLLER.getChapterPriceProvider", () => controller.getChapterPriceProvider(chapterId));
  const publicUnlocked = await readValue(recorder, "CHAPTER_CONTROLLER.isPublicMintUnlocked", () => controller.isPublicMintUnlocked(chapterId));
  await readValue(recorder, "CHAPTER_CONTROLLER.chapterMintProgress", () => controller.chapterMintProgress(chapterId));

  if (config) {
    expectBool(recorder, "CHAPTER_CONTROLLER.chapterConfig.exists == true", config.exists || config[0], true);
    const saleCap = Number(config.saleCap || config[1]);
    const marketingCap = Number(config.marketingCap || config[2]);
    const totalCap = Number(config.totalCap || config[3]);
    if (saleCap + marketingCap === totalCap) {
      recorder.ok("CHAPTER_CONTROLLER saleCap + marketingCap == totalCap", { saleCap, marketingCap, totalCap });
    } else {
      recorder.issue("CHAPTER_CONTROLLER saleCap + marketingCap == totalCap", "cap sum mismatch", { saleCap, marketingCap, totalCap });
    }
  }

  expectBool(recorder, "CHAPTER_CONTROLLER.isChapterStackConsistent == true", stackConsistent, true);
  expectBool(recorder, "CHAPTER_CONTROLLER.isChapterCapConsistent == true", capConsistent, true);
  expectAddress(recorder, "CHAPTER_CONTROLLER.priceProvider == MAIN", priceProvider, addresses.MAIN);

  return { chapterId, publicUnlocked };
}

async function checkMain2(addresses, opts, recorder, chapterId) {
  if (!isAddress(addresses.MAIN2)) {
    recorder.warn("MAIN2", "address not set; public branch not deployed");
    return {};
  }
  if (!(await ensureReadable("MAIN2", addresses.MAIN2, opts.requireCode, recorder))) return {};

  const main2 = contractAt(addresses.MAIN2, [
    "function chapterController() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function distributor() view returns (address)",
    "function priceProvider() view returns (address)",
    "function paused() view returns (bool)",
    "function metadataConsistency() view returns (uint256 configuredCount,bool fullyConfigured,bool rewardMatrixConsistent)",
  ]);

  const controller = await readValue(recorder, "MAIN2.chapterController", () => main2.chapterController());
  const configuredChapterId = await readValue(recorder, "MAIN2.chapterId", () => main2.chapterId());
  const distributor = await readValue(recorder, "MAIN2.distributor", () => main2.distributor());
  const priceProvider = await readValue(recorder, "MAIN2.priceProvider", () => main2.priceProvider());
  await readValue(recorder, "MAIN2.paused", () => main2.paused());
  const metadata = await readValue(recorder, "MAIN2.metadataConsistency", async () => {
    const [configuredCount, fullyConfigured, rewardMatrixConsistent] = await main2.metadataConsistency();
    return {
      configuredCount: configuredCount.toString(),
      fullyConfigured,
      rewardMatrixConsistent,
    };
  });

  expectAddress(recorder, "MAIN2.chapterController == CHAPTER_CONTROLLER", controller, addresses.CHAPTER_CONTROLLER);
  if (chapterId != null) expectNumber(recorder, "MAIN2.chapterId == CHAPTER_ID", configuredChapterId, chapterId);
  if (isAddress(addresses.DISTRIBUTOR)) expectAddress(recorder, "MAIN2.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR);
  if (isAddress(priceProvider) && isAddress(addresses.MAIN)) {
    expectAddress(recorder, "MAIN2.priceProvider == MAIN", priceProvider, addresses.MAIN);
  }

  if (metadata) {
    if (metadata.fullyConfigured && metadata.rewardMatrixConsistent) {
      recorder.ok("MAIN2.metadata launch-ready", metadata);
    } else {
      recorder.warn("MAIN2.metadata launch-ready", "public metadata is not fully configured", metadata);
    }
  }

  return { distributor };
}

async function checkDistributor(addresses, opts, recorder, ticketHubState, main2State) {
  const distributorAddress = isAddress(addresses.DISTRIBUTOR)
    ? addresses.DISTRIBUTOR
    : isAddress(ticketHubState.distributor)
      ? ethers.utils.getAddress(ticketHubState.distributor)
      : isAddress(main2State.distributor)
        ? ethers.utils.getAddress(main2State.distributor)
        : ZERO;

  if (!isAddress(distributorAddress)) {
    if (opts.expectPaidNative) {
      recorder.issue("DISTRIBUTOR", "required for paid native mint but address is not set");
    } else {
      recorder.warn("DISTRIBUTOR", "not set; paid native mint must remain closed");
    }
    return;
  }

  if (!(await ensureReadable("DISTRIBUTOR", distributorAddress, opts.requireCode, recorder))) return;

  const distributor = contractAt(distributorAddress, [
    "function collectionRewards() view returns (address)",
    "function reserve() view returns (address)",
    "function buybackAgent() view returns (address)",
    "function treasury() view returns (address)",
    "function communityCenter() view returns (address)",
    "function registry() view returns (address)",
    "function collections(address) view returns (bool)",
    "function paused() view returns (bool)",
  ]);

  const collectionRewards = await readValue(recorder, "DISTRIBUTOR.collectionRewards", () => distributor.collectionRewards());
  const reserve = await readValue(recorder, "DISTRIBUTOR.reserve", () => distributor.reserve());
  const buybackAgent = await readValue(recorder, "DISTRIBUTOR.buybackAgent", () => distributor.buybackAgent());
  const treasury = await readValue(recorder, "DISTRIBUTOR.treasury", () => distributor.treasury());
  const communityCenter = await readValue(recorder, "DISTRIBUTOR.communityCenter", () => distributor.communityCenter());
  const registry = await readValue(recorder, "DISTRIBUTOR.registry", () => distributor.registry());
  await readValue(recorder, "DISTRIBUTOR.paused", () => distributor.paused());

  const recipientSeverity =
    opts.expectPaidNative || isAddress(ticketHubState.distributor) || isAddress(main2State.distributor)
      ? "issue"
      : "warn";
  expectNonZero(recorder, "DISTRIBUTOR.collectionRewards non-zero", collectionRewards, recipientSeverity);
  expectNonZero(recorder, "DISTRIBUTOR.reserve non-zero", reserve, recipientSeverity);
  expectNonZero(recorder, "DISTRIBUTOR.buybackAgent non-zero", buybackAgent, recipientSeverity);
  expectNonZero(recorder, "DISTRIBUTOR.treasury non-zero", treasury, recipientSeverity);
  expectNonZero(recorder, "DISTRIBUTOR.communityCenter non-zero", communityCenter, recipientSeverity);
  if (isAddress(addresses.REGISTRY)) expectAddress(recorder, "DISTRIBUTOR.registry == REGISTRY", registry, addresses.REGISTRY);

  if (isAddress(addresses.TICKET_HUB)) {
    const hubAllowed = await readValue(recorder, "DISTRIBUTOR.collections[TICKET_HUB]", () => distributor.collections(addresses.TICKET_HUB));
    if (isAddress(ticketHubState.distributor)) expectBool(recorder, "DISTRIBUTOR whitelists TICKET_HUB", hubAllowed, true);
  }
  if (isAddress(addresses.MAIN2)) {
    const main2Allowed = await readValue(recorder, "DISTRIBUTOR.collections[MAIN2]", () => distributor.collections(addresses.MAIN2));
    if (isAddress(main2State.distributor)) expectBool(recorder, "DISTRIBUTOR whitelists MAIN2", main2Allowed, true);
  }
}

async function checkRewardsAndReaders(addresses, opts, recorder) {
  if (isAddress(addresses.COLLECTION_REWARDS) && await ensureReadable("COLLECTION_REWARDS", addresses.COLLECTION_REWARDS, opts.requireCode, recorder)) {
    const rewards = contractAt(addresses.COLLECTION_REWARDS, [
      "function defaultMain() view returns (address)",
      "function registry() view returns (address)",
      "function distributor() view returns (address)",
    ]);
    const defaultMain = await readValue(recorder, "COLLECTION_REWARDS.defaultMain", () => rewards.defaultMain());
    const registry = await readValue(recorder, "COLLECTION_REWARDS.registry", () => rewards.registry());
    const distributor = await readValue(recorder, "COLLECTION_REWARDS.distributor", () => rewards.distributor());
    expectAddress(recorder, "COLLECTION_REWARDS.defaultMain == MAIN", defaultMain, addresses.MAIN);
    if (isAddress(addresses.REGISTRY)) expectAddress(recorder, "COLLECTION_REWARDS.registry == REGISTRY", registry, addresses.REGISTRY);
    if (isAddress(addresses.DISTRIBUTOR)) expectAddress(recorder, "COLLECTION_REWARDS.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR);
  }

  if (isAddress(addresses.NFT_REWARDS) && await ensureReadable("NFT_REWARDS", addresses.NFT_REWARDS, opts.requireCode, recorder)) {
    const nftRewards = contractAt(addresses.NFT_REWARDS, [
      "function mainContract() view returns (address)",
      "function vrfRouter() view returns (address)",
      "function registry() view returns (address)",
      "function allowedMainCollections(address) view returns (bool)",
    ]);
    const mainContract = await readValue(recorder, "NFT_REWARDS.mainContract", () => nftRewards.mainContract());
    const vrfRouter = await readValue(recorder, "NFT_REWARDS.vrfRouter", () => nftRewards.vrfRouter());
    const registry = await readValue(recorder, "NFT_REWARDS.registry", () => nftRewards.registry());
    expectAddress(recorder, "NFT_REWARDS.mainContract == MAIN", mainContract, addresses.MAIN);
    expectAddress(recorder, "NFT_REWARDS.vrfRouter == VRF_ROUTER", vrfRouter, addresses.VRF_ROUTER);
    if (isAddress(addresses.REGISTRY)) expectAddress(recorder, "NFT_REWARDS.registry == REGISTRY", registry, addresses.REGISTRY);
    if (isAddress(addresses.MAIN2)) {
      await readValue(recorder, "NFT_REWARDS.allowedMainCollections[MAIN2]", () => nftRewards.allowedMainCollections(addresses.MAIN2));
    }
  }

  const readerChecks = [
    ["MAIN_READER", addresses.MAIN_READER, [
      ["main", "function main() view returns (address)", addresses.MAIN],
      ["ticketHub", "function ticketHub() view returns (address)", addresses.TICKET_HUB],
      ["collectionRewards", "function collectionRewards() view returns (address)", addresses.COLLECTION_REWARDS],
    ]],
    ["CHAPTER_SERIES_READER", addresses.CHAPTER_SERIES_READER, [
      ["chapterController", "function chapterController() view returns (address)", addresses.CHAPTER_CONTROLLER],
      ["registry", "function registry() view returns (address)", addresses.REGISTRY],
    ]],
    ["MULTI_COLLECTION_READER", addresses.MULTI_COLLECTION_READER, [
      ["distributor", "function distributor() view returns (address)", addresses.DISTRIBUTOR],
    ]],
    ["NFT_REWARDS_READER", addresses.NFT_REWARDS_READER, [
      ["nftRewards", "function nftRewards() view returns (address)", addresses.NFT_REWARDS],
    ]],
  ];

  for (const [name, address, getters] of readerChecks) {
    if (!isAddress(address)) continue;
    if (!(await ensureReadable(name, address, opts.requireCode, recorder))) continue;
    for (const [getter, signature, expected] of getters) {
      if (!isAddress(expected)) continue;
      const reader = contractAt(address, [signature]);
      const actual = await readValue(recorder, `${name}.${getter}`, () => reader[getter]());
      expectAddress(recorder, `${name}.${getter} expected`, actual, expected);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const addressesPath = resolveAddressesPath(opts.addressesFile);
  const raw = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const addresses = normalizeAddresses(raw);
  const recorder = createRecorder();
  recorder.report.chainId = Number((await ethers.provider.getNetwork()).chainId);
  recorder.report.addressesFile = addressesPath;
  recorder.report.strict = opts.strict;
  recorder.report.requireCode = opts.requireCode;
  recorder.report.expectPaidNative = opts.expectPaidNative;

  console.log("Network:", network.name);
  console.log("Addresses file:", addressesPath);
  console.log("Strict:", opts.strict);
  console.log("Require code:", opts.requireCode);
  console.log("Expect paid native:", opts.expectPaidNative);

  await checkMainBranch(addresses, opts, recorder);
  const ticketHubState = await checkTicketHub(addresses, opts, recorder);
  await checkVrf(addresses, opts, recorder);
  const chapterId = await resolveChapterId(addresses, opts.chapterId, recorder);
  recorder.report.chapterId = chapterId;
  await checkChapterStack(addresses, opts, recorder, chapterId);
  const main2State = await checkMain2(addresses, opts, recorder, chapterId);
  await checkDistributor(addresses, opts, recorder, ticketHubState, main2State);
  await checkRewardsAndReaders(addresses, opts, recorder);

  const reportPath = resolveReportPath(opts.reportFile);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(recorder.report, null, 2));
  console.log(`Report written to ${reportPath}`);

  if (recorder.report.issues.length === 0) {
    console.log("CORE relationship check: OK (no issues).");
    return;
  }

  console.log(`CORE relationship check: ${recorder.report.issues.length} issue(s).`);
  recorder.report.issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.label}: ${issue.message}`);
  });

  if (opts.strict) {
    throw new Error(`Strict CORE relationship check failed with ${recorder.report.issues.length} issue(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
