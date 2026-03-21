// Reads deployed addresses and prints status + wiring checks for:
// - scaling collections
// - token/drip/tokenRewards
// - chapter/series reader + collectionRewards/distributor/community/moderator readers
// - supply controller + dex reserve guard
// - liquidity and keeper automation branches
// - master config bundles
//
// Usage:
//   npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network <net>
//   CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network <net>
//   MASTER_ADDRESSES_FILE=./addresses.json npx hardhat run --config hardhat.biggi-master.cjs scripts/master/checkMasterStatus.js --network <net>

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers, network } = hre;

const ZERO = ethers.constants.AddressZero;

function isAddress(v) {
  try {
    return !!v && ethers.utils.getAddress(v) !== ZERO;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = {
    strict: false,
    requireCode: false,
    addressesFile: null,
    expectOwner: null,
    expectLiquidityPath: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") {
      opts.strict = true;
    } else if (a === "--require-code") {
      opts.requireCode = true;
    } else if (a === "--addresses" || a === "--addresses-file") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires a file path`);
      opts.addressesFile = next;
      i++;
    } else if (a === "--expect-owner") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires an address`);
      opts.expectOwner = next;
      i++;
    } else if (a === "--expect-liquidity-path") {
      const next = argv[i + 1];
      if (!next) throw new Error(`${a} requires one of: keeper_proxy | automation | none`);
      opts.expectLiquidityPath = next;
      i++;
    }
  }

  return opts;
}

function resolveAddressesPath(explicitPath) {
  if (explicitPath) {
    const p = path.resolve(process.cwd(), explicitPath);
    if (!fs.existsSync(p)) throw new Error(`Addresses file not found: ${p}`);
    return p;
  }

  const masterPath = path.resolve(__dirname, "../../addresses.master.json");
  if (fs.existsSync(masterPath)) return masterPath;

  const legacyPath = path.resolve(__dirname, "../../addresses.json");
  if (fs.existsSync(legacyPath)) return legacyPath;

  throw new Error("Missing addresses file. Expected ./addresses.master.json or ./addresses.json");
}

function pickAddress(raw, keys) {
  for (const key of keys) {
    if (isAddress(raw[key])) return ethers.utils.getAddress(raw[key]);
  }
  return ZERO;
}

function pickNumber(raw, keys, fallback = null) {
  for (const key of keys) {
    const v = raw[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeAddresses(raw) {
  return {
    MAIN: pickAddress(raw, ["MAIN", "COLLECTION", "COLLECTION_VRF"]),
    MAIN2: pickAddress(raw, ["MAIN2", "COLLECTION2", "COLLECTION_PUBLIC"]),
    TICKET_HUB: pickAddress(raw, ["TICKET_HUB"]),
    COMPUTE: pickAddress(raw, ["COMPUTE"]),
    VRF_ROUTER: pickAddress(raw, ["VRF_ROUTER"]),
    REGISTRY: pickAddress(raw, ["REGISTRY"]),
    CHAPTER_CONTROLLER: pickAddress(raw, ["CHAPTER_CONTROLLER"]),
    CHAPTER_ID: pickNumber(raw, ["CHAPTER_ID"], null),

    BIGGI_TOKEN: pickAddress(raw, ["BIGGI_TOKEN", "BIGGI"]),
    RESERVE: pickAddress(raw, ["RESERVE"]),
    TREASURY: pickAddress(raw, ["TREASURY"]),
    MARKETING_SUPPORT: pickAddress(raw, ["MARKETING_SUPPORT", "MARKETING_SUPPORT_WALLET"]),
    DRIP_DISTRIBUTOR: pickAddress(raw, ["DRIP_DISTRIBUTOR"]),
    DRIP_LM: pickAddress(raw, ["DRIP_LM"]),
    TOKEN_REWARDS: pickAddress(raw, ["TOKEN_REWARDS"]),
    NFT_REWARDS: pickAddress(raw, ["NFT_REWARDS", "BIGGI_NFT_REWARDS"]),
    COLLECTION_REWARDS: pickAddress(raw, ["COLLECTION_REWARDS"]),
    DISTRIBUTOR: pickAddress(raw, ["DISTRIBUTOR", "MULTI_COLLECTION_DISTRIBUTOR"]),
    COMMUNITY_CENTER: pickAddress(raw, ["COMMUNITY_CENTER", "COMMUNITY", "COMMUNITYCENTER"]),
    COMMUNITY_CENTER_EFFECTIVE: pickAddress(raw, [
      "COMMUNITY_CENTER_EFFECTIVE",
      "COMMUNITY_CENTER",
      "COMMUNITY",
      "COMMUNITYCENTER",
    ]),
    MODERATOR_CENTER: pickAddress(raw, ["MODERATOR_CENTER"]),
    BUYBACK_AGENT: pickAddress(raw, ["BUYBACK_AGENT", "BUYBACK"]),
    BUYBACK_AGENT_EFFECTIVE: pickAddress(raw, ["BUYBACK_AGENT_EFFECTIVE", "BUYBACK_AGENT", "BUYBACK"]),
    BUYBACK_ROUTER: pickAddress(raw, ["BUYBACK_ROUTER", "ROUTER"]),
    POLICY: pickAddress(raw, ["POLICY"]),
    MASTER_CONFIG: pickAddress(raw, ["MASTER_CONFIG"]),
    MULTICALL: pickAddress(raw, ["MULTICALL", "MULTICALL2"]),
    MULTI_COLLECTION_READER: pickAddress(raw, [
      "MULTI_COLLECTION_READER",
      "MULTI_COLLECTION_DISTRIBUTOR_READER",
      "MCD_READER",
    ]),
    CHAPTER_SERIES_READER: pickAddress(raw, [
      "CHAPTER_SERIES_READER",
      "CHAPTER_READER",
      "SERIES_READER",
    ]),

    SUPPLY_CONTROLLER: pickAddress(raw, ["SUPPLY_CONTROLLER"]),
    SUPPLY_GUARDIAN: pickAddress(raw, ["SUPPLY_GUARDIAN"]),
    DEX_RESERVE_GUARD: pickAddress(raw, ["DEX_RESERVE_GUARD"]),
    PAIR: pickAddress(raw, ["PAIR"]),
    QUOTE_TOKEN: pickAddress(raw, ["QUOTE_TOKEN"]),
    ROUTER: pickAddress(raw, ["ROUTER"]),
    FACTORY: pickAddress(raw, ["FACTORY"]),
    WETH: pickAddress(raw, ["WETH"]),
    LIQUIDITY_MANAGER: pickAddress(raw, ["LIQUIDITY_MANAGER", "LM"]),
    LIQUIDITY_VAULT: pickAddress(raw, ["LIQUIDITY_VAULT", "LM_VAULT"]),
    LIQUIDITY_ORCHESTRATOR: pickAddress(raw, ["LIQUIDITY_ORCHESTRATOR", "ORCHESTRATOR"]),
    LIQUIDITY_KEEPER_PROXY: pickAddress(raw, ["LIQUIDITY_KEEPER_PROXY", "KEEPER_PROXY"]),
    LIQUIDITY_AUTOMATION: pickAddress(raw, ["LIQUIDITY_AUTOMATION"]),
    DRIP_KEEPER_PROXY: pickAddress(raw, ["DRIP_KEEPER_PROXY"]),
    BUYBACK_UPKEEP_PROXY: pickAddress(raw, ["BUYBACK_UPKEEP_PROXY", "UPKEEP_PROXY"]),
  };
}

async function safe(label, fn) {
  try {
    const value = await fn();
    console.log(`${label}:`, value);
    return value;
  } catch (e) {
    console.log(`${label}: <error> ${e.message}`);
    return null;
  }
}

async function hasCode(addr) {
  const code = await ethers.provider.getCode(addr);
  return code && code !== "0x";
}

function viewContract(addr, abi) {
  return new ethers.Contract(addr, abi, ethers.provider);
}

function eqAddress(a, b) {
  if (!isAddress(a) || !isAddress(b)) return false;
  return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

async function section(name, addr, requireCode, issues, fn) {
  if (!isAddress(addr)) return;
  if (!(await hasCode(addr))) {
    const msg = `${name}: no code at ${addr} on ${network.name}`;
    console.log(msg + ", skipping.");
    if (requireCode) issues.push(msg);
    return;
  }
  await fn();
}

function expectAddressMatch(label, actual, expected, issues) {
  if (!isAddress(actual) || !isAddress(expected)) return;
  const ok = eqAddress(actual, expected);
  console.log(`${ok ? "OK" : "MISMATCH"} ${label}: actual=${actual} expected=${expected}`);
  if (!ok) issues.push(`${label}: actual=${actual}, expected=${expected}`);
}

function expectBool(label, actual, expected, issues) {
  if (actual == null) return;
  const ok = Boolean(actual) === Boolean(expected);
  console.log(`${ok ? "OK" : "MISMATCH"} ${label}: actual=${Boolean(actual)} expected=${Boolean(expected)}`);
  if (!ok) issues.push(`${label}: actual=${Boolean(actual)}, expected=${Boolean(expected)}`);
}

function expectNumberMatch(label, actual, expected, issues) {
  if (actual == null || expected == null) return;
  const a = Number(actual);
  const e = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(e)) return;
  const ok = a === e;
  console.log(`${ok ? "OK" : "MISMATCH"} ${label}: actual=${a} expected=${e}`);
  if (!ok) issues.push(`${label}: actual=${a}, expected=${e}`);
}

function expectAddressSet(label, value, issues) {
  const ok = isAddress(value);
  console.log(`${ok ? "OK" : "MISMATCH"} ${label}: actual=${value || ZERO}`);
  if (!ok) issues.push(`${label}: zero address`);
}

function envIntOpt(name) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer env ${name}: ${raw}`);
  return n;
}

function envBoolOpt(name) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  const v = String(raw).toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  throw new Error(`Invalid boolean env ${name}: ${raw}`);
}

function envTokenOpt(name) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  return ethers.utils.parseUnits(String(raw), 18);
}

function expectBigNumberishMatch(label, actual, expected, issues) {
  if (actual == null || expected == null) return;
  let a;
  let e;
  try {
    a = ethers.BigNumber.from(actual);
    e = ethers.BigNumber.from(expected);
  } catch {
    return;
  }
  const ok = a.eq(e);
  console.log(`${ok ? "OK" : "MISMATCH"} ${label}: actual=${a.toString()} expected=${e.toString()}`);
  if (!ok) issues.push(`${label}: actual=${a.toString()}, expected=${e.toString()}`);
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const strict = cli.strict || process.env.CHECK_STRICT === "1";
  const requireCode = cli.requireCode || process.env.CHECK_REQUIRE_CODE === "1";
  const expectStrictNotify =
    process.env.EXPECT_STRICT_NOTIFY == null ? strict : process.env.EXPECT_STRICT_NOTIFY === "1";

  const addressesPath = resolveAddressesPath(cli.addressesFile || process.env.MASTER_ADDRESSES_FILE || null);
  const rawAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const addresses = normalizeAddresses(rawAddresses);
  const expectedOwnerInput =
    cli.expectOwner ||
    process.env.EXPECT_OWNER ||
    rawAddresses.MULTISIG ||
    rawAddresses.TIMELOCK ||
    rawAddresses.SAFE ||
    rawAddresses.OWNER ||
    null;
  const expectedOwner = isAddress(expectedOwnerInput) ? ethers.utils.getAddress(expectedOwnerInput) : ZERO;
  const expectedLiquidityPath = String(
    cli.expectLiquidityPath || process.env.EXPECT_LIQUIDITY_PATH || ""
  ).toLowerCase();

  console.log("Network:", network.name);
  console.log("Addresses file:", addressesPath);
  console.log("Strict mode:", strict);
  console.log("Require deployed code:", requireCode);
  console.log("Expected owner:", expectedOwner === ZERO ? "<unset>" : expectedOwner);
  console.log("Expected liquidity path:", expectedLiquidityPath || "<auto>");

  const issues = [];
  let observedLiquidityKeeper = ZERO;
  let observedOrchestratorKeeper = ZERO;

  await section("MAIN", addresses.MAIN, requireCode, issues, async () => {
    const mainC = viewContract(addresses.MAIN, [
      "function ticketHub() view returns (address)",
      "function compute() view returns (address)",
      "function vrfRouter() view returns (address)",
      "function biggiMinted() view returns (uint16)",
      "function getCurrentBlockPrice(uint16) view returns (uint256)",
    ]);
    const ticketHub = await safe("MAIN.ticketHub", () => mainC.ticketHub());
    const compute = await safe("MAIN.compute", () => mainC.compute());
    const vrfRouter = await safe("MAIN.vrfRouter", () => mainC.vrfRouter());
    await safe("MAIN.biggiMinted", () => mainC.biggiMinted());
    await safe("MAIN.block1Price", () => mainC.getCurrentBlockPrice(1));

    expectAddressMatch("MAIN.ticketHub == TICKET_HUB", ticketHub, addresses.TICKET_HUB, issues);
    expectAddressMatch("MAIN.compute == COMPUTE", compute, addresses.COMPUTE, issues);
    if (isAddress(addresses.VRF_ROUTER)) {
      expectAddressMatch("MAIN.vrfRouter == VRF_ROUTER", vrfRouter, addresses.VRF_ROUTER, issues);
    }
  });

  await section("VRF_ROUTER", addresses.VRF_ROUTER, requireCode, issues, async () => {
    const vrfRouter = viewContract(addresses.VRF_ROUTER, [
      "function main() view returns (address)",
      "function approvedMains(address) view returns (bool)",
      "function keyHash() view returns (bytes32)",
      "function subId() view returns (uint256)",
      "function callbackGasLimit() view returns (uint32)",
      "function requestConfirmations() view returns (uint16)",
      "function numWords() view returns (uint32)",
    ]);
    const mainAddr = await safe("VRF_ROUTER.main", () => vrfRouter.main());
    const mainApproved = isAddress(addresses.MAIN)
      ? await safe("VRF_ROUTER.approved[main]", () => vrfRouter.approvedMains(addresses.MAIN))
      : null;
    const main2Approved = isAddress(addresses.MAIN2)
      ? await safe("VRF_ROUTER.approved[main2]", () => vrfRouter.approvedMains(addresses.MAIN2))
      : null;
    await safe("VRF_ROUTER.keyHash", () => vrfRouter.keyHash());
    await safe("VRF_ROUTER.subId", () => vrfRouter.subId());
    await safe("VRF_ROUTER.callbackGasLimit", () => vrfRouter.callbackGasLimit());
    await safe("VRF_ROUTER.requestConfirmations", () => vrfRouter.requestConfirmations());
    await safe("VRF_ROUTER.numWords", () => vrfRouter.numWords());

    if (isAddress(addresses.MAIN)) {
      expectAddressMatch("VRF_ROUTER.main == MAIN", mainAddr, addresses.MAIN, issues);
    }
    if (strict && mainApproved != null) {
      expectBool("VRF_ROUTER.approved[main]", mainApproved, true, issues);
    }
    if (strict && main2Approved != null) {
      expectBool("VRF_ROUTER.approved[main2]", main2Approved, true, issues);
    }
  });

  await section("MAIN2", addresses.MAIN2, requireCode, issues, async () => {
    const main2 = viewContract(addresses.MAIN2, [
      "function distributor() view returns (address)",
      "function chapterController() view returns (address)",
      "function chapterId() view returns (uint256)",
      "function priceProvider() view returns (address)",
      "function getCurrentBlockPrice(uint16) view returns (uint256)",
    ]);
    const distributor = await safe("MAIN2.distributor", () => main2.distributor());
    const chapterController = await safe("MAIN2.chapterController", () => main2.chapterController());
    const chapterId = await safe("MAIN2.chapterId", () => main2.chapterId());
    const priceProvider = await safe("MAIN2.priceProvider", () => main2.priceProvider());
    await safe("MAIN2.block1Price", () => main2.getCurrentBlockPrice(1));

    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("MAIN2.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR, issues);
    }
    if (isAddress(addresses.CHAPTER_CONTROLLER)) {
      expectAddressMatch("MAIN2.chapterController == CHAPTER_CONTROLLER", chapterController, addresses.CHAPTER_CONTROLLER, issues);
    }
    if (addresses.CHAPTER_ID != null) {
      expectNumberMatch("MAIN2.chapterId == CHAPTER_ID", chapterId, addresses.CHAPTER_ID, issues);
    }
    if (isAddress(addresses.MAIN)) {
      expectAddressMatch("MAIN2.priceProvider == MAIN", priceProvider, addresses.MAIN, issues);
    }
  });

  await section("TICKET_HUB", addresses.TICKET_HUB, requireCode, issues, async () => {
    const hub = viewContract(addresses.TICKET_HUB, [
      "function saleMinted() view returns (uint16)",
      "function marketingMinted() view returns (uint16)",
      "function totalMinted() view returns (uint256)",
      "function saleCap() view returns (uint16)",
      "function marketingCap() view returns (uint16)",
      "function mainCollection() view returns (address)",
      "function distributor() view returns (address)",
    ]);
    await safe("TICKET_HUB.saleMinted", () => hub.saleMinted());
    await safe("TICKET_HUB.marketingMinted", () => hub.marketingMinted());
    await safe("TICKET_HUB.totalMinted", () => hub.totalMinted());
    await safe("TICKET_HUB.saleCap", () => hub.saleCap());
    await safe("TICKET_HUB.marketingCap", () => hub.marketingCap());
    const mainCollection = await safe("TICKET_HUB.mainCollection", () => hub.mainCollection());
    const distributor = await safe("TICKET_HUB.distributor", () => hub.distributor());

    if (isAddress(addresses.MAIN)) {
      expectAddressMatch("TICKET_HUB.mainCollection == MAIN", mainCollection, addresses.MAIN, issues);
    }
    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("TICKET_HUB.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR, issues);
    }
  });

  if (isAddress(addresses.CHAPTER_CONTROLLER) && addresses.CHAPTER_ID != null) {
    await section("CHAPTER_CONTROLLER", addresses.CHAPTER_CONTROLLER, requireCode, issues, async () => {
      const chapter = viewContract(addresses.CHAPTER_CONTROLLER, [
        "function isPublicMintUnlocked(uint256) view returns (bool)",
        "function chapterMintProgress(uint256) view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool)",
      ]);
      const chapterId = Number(addresses.CHAPTER_ID);
      await safe("CHAPTER.isPublicMintUnlocked", () => chapter.isPublicMintUnlocked(chapterId));
      await safe("CHAPTER.progress", () => chapter.chapterMintProgress(chapterId));
    });
  }

  await section("REGISTRY", addresses.REGISTRY, requireCode, issues, async () => {
    const registry = viewContract(addresses.REGISTRY, [
      "function seriesCount() view returns (uint256)",
      "function chapterCount() view returns (uint256)",
      "function chapterByCollection(address) view returns (uint256)",
      "function getChapterCollections(uint256) view returns (address,address,address)",
      "function getChapterMeta(uint256) view returns (uint256,uint256)",
      "function isTokenRewardsCollection(address) view returns (bool)",
      "function isCollectionRewardsCollection(address) view returns (bool)",
    ]);
    await safe("REGISTRY.seriesCount", () => registry.seriesCount());
    await safe("REGISTRY.chapterCount", () => registry.chapterCount());

    if (addresses.CHAPTER_ID != null) {
      const chapterId = Number(addresses.CHAPTER_ID);
      const collections = await safe("REGISTRY.chapterCollections", () => registry.getChapterCollections(chapterId));
      await safe("REGISTRY.chapterMeta", () => registry.getChapterMeta(chapterId));

      if (Array.isArray(collections) && collections.length >= 3) {
        if (isAddress(addresses.MAIN)) {
          expectAddressMatch("REGISTRY.vrfCollection == MAIN", collections[0], addresses.MAIN, issues);
        }
        if (isAddress(addresses.MAIN2)) {
          expectAddressMatch("REGISTRY.publicCollection == MAIN2", collections[1], addresses.MAIN2, issues);
        }
        if (isAddress(addresses.TICKET_HUB)) {
          expectAddressMatch("REGISTRY.ticketHub == TICKET_HUB", collections[2], addresses.TICKET_HUB, issues);
        }
      }
    }

    if (isAddress(addresses.MAIN)) {
      await safe("REGISTRY.chapterByCollection[main]", () => registry.chapterByCollection(addresses.MAIN));
      await safe("REGISTRY.collectionRewardsEligible[main]", () => registry.isCollectionRewardsCollection(addresses.MAIN));
      await safe("REGISTRY.tokenRewardsEligible[main]", () => registry.isTokenRewardsCollection(addresses.MAIN));
    }
    if (isAddress(addresses.MAIN2)) {
      await safe("REGISTRY.chapterByCollection[main2]", () => registry.chapterByCollection(addresses.MAIN2));
      await safe("REGISTRY.tokenRewardsEligible[main2]", () => registry.isTokenRewardsCollection(addresses.MAIN2));
    }
    if (isAddress(addresses.TICKET_HUB)) {
      await safe("REGISTRY.chapterByCollection[ticketHub]", () => registry.chapterByCollection(addresses.TICKET_HUB));
    }
  });

  await section("CHAPTER_SERIES_READER", addresses.CHAPTER_SERIES_READER, requireCode, issues, async () => {
    const reader = viewContract(addresses.CHAPTER_SERIES_READER, [
      "function globalSnapshot() view returns (tuple(address controller,address registry,uint256 seriesCount,uint256 chapterCount,address controllerRegistry,bool controllerMatchesRegistry))",
      "function seriesSnapshot(uint256) view returns (tuple(uint256 seriesId,bool exists,string name,uint256 chapterCount))",
      "function chapterSnapshot(uint256) view returns (tuple(uint256 chapterId,bool configured,bool chapterExists,uint256 seriesId,uint256 chapterNumber,address vrfCollection,address publicCollection,address ticketHub,uint16 saleCap,uint16 marketingCap,uint16 totalCap,uint256 saleMinted,uint256 marketingMinted,uint256 totalMinted,bool publicUnlocked,address priceProvider,bool tokenRewardsEligibleVRF,bool tokenRewardsEligiblePublic,bool collectionRewardsEligibleVRF,bool controllerRegistryMatch))",
      "function collectionSnapshot(address) view returns (tuple(address collection,uint256 chapterId,uint256 seriesId,uint256 chapterNumber,bool tokenRewardsEligible,bool collectionRewardsEligible,bool isVrfCollection,bool isPublicCollection,bool isTicketHubCollection))",
    ]);
    const global = await safe("CHAPTER_SERIES_READER.global", () => reader.globalSnapshot());
    const series = await safe("CHAPTER_SERIES_READER.series[1]", () => reader.seriesSnapshot(1));

    const chapterId = addresses.CHAPTER_ID != null ? Number(addresses.CHAPTER_ID) : 1;
    const chapter = await safe("CHAPTER_SERIES_READER.chapter", () => reader.chapterSnapshot(chapterId));

    let mainCollection = null;
    let main2Collection = null;
    let hubCollection = null;
    if (isAddress(addresses.MAIN)) {
      mainCollection = await safe("CHAPTER_SERIES_READER.collection[main]", () => reader.collectionSnapshot(addresses.MAIN));
    }
    if (isAddress(addresses.MAIN2)) {
      main2Collection = await safe("CHAPTER_SERIES_READER.collection[main2]", () => reader.collectionSnapshot(addresses.MAIN2));
    }
    if (isAddress(addresses.TICKET_HUB)) {
      hubCollection = await safe(
        "CHAPTER_SERIES_READER.collection[ticketHub]",
        () => reader.collectionSnapshot(addresses.TICKET_HUB)
      );
    }

    if (global) {
      if (isAddress(addresses.CHAPTER_CONTROLLER)) {
        expectAddressMatch(
          "CHAPTER_SERIES_READER.global.controller == CHAPTER_CONTROLLER",
          global.controller,
          addresses.CHAPTER_CONTROLLER,
          issues
        );
      }
      if (isAddress(addresses.REGISTRY)) {
        expectAddressMatch("CHAPTER_SERIES_READER.global.registry == REGISTRY", global.registry, addresses.REGISTRY, issues);
      }
      if (strict) {
        expectBool("CHAPTER_SERIES_READER.global.controllerMatchesRegistry", global.controllerMatchesRegistry, true, issues);
      }
    }
    if (series && strict) {
      expectBool("CHAPTER_SERIES_READER.series[1].exists", series.exists, true, issues);
    }
    if (chapter) {
      expectNumberMatch("CHAPTER_SERIES_READER.chapter.id", chapter.chapterId, chapterId, issues);
      if (isAddress(addresses.MAIN)) {
        expectAddressMatch("CHAPTER_SERIES_READER.chapter.vrfCollection == MAIN", chapter.vrfCollection, addresses.MAIN, issues);
      }
      if (isAddress(addresses.MAIN2)) {
        expectAddressMatch(
          "CHAPTER_SERIES_READER.chapter.publicCollection == MAIN2",
          chapter.publicCollection,
          addresses.MAIN2,
          issues
        );
      }
      if (isAddress(addresses.TICKET_HUB)) {
        expectAddressMatch(
          "CHAPTER_SERIES_READER.chapter.ticketHub == TICKET_HUB",
          chapter.ticketHub,
          addresses.TICKET_HUB,
          issues
        );
      }
      if (strict) {
        expectBool("CHAPTER_SERIES_READER.chapter.configured", chapter.configured, true, issues);
        expectBool("CHAPTER_SERIES_READER.chapter.exists", chapter.chapterExists, true, issues);
        expectBool("CHAPTER_SERIES_READER.chapter.controllerRegistryMatch", chapter.controllerRegistryMatch, true, issues);
      }
    }
    if (mainCollection) {
      expectNumberMatch("CHAPTER_SERIES_READER.main.chapterId", mainCollection.chapterId, chapterId, issues);
      if (strict) {
        expectBool("CHAPTER_SERIES_READER.main.isVrfCollection", mainCollection.isVrfCollection, true, issues);
        expectBool("CHAPTER_SERIES_READER.main.collectionRewardsEligible", mainCollection.collectionRewardsEligible, true, issues);
      }
    }
    if (main2Collection) {
      expectNumberMatch("CHAPTER_SERIES_READER.main2.chapterId", main2Collection.chapterId, chapterId, issues);
      if (strict) {
        expectBool("CHAPTER_SERIES_READER.main2.isPublicCollection", main2Collection.isPublicCollection, true, issues);
      }
    }
    if (hubCollection) {
      expectNumberMatch("CHAPTER_SERIES_READER.ticketHub.chapterId", hubCollection.chapterId, chapterId, issues);
      if (strict) {
        expectBool("CHAPTER_SERIES_READER.ticketHub.isTicketHubCollection", hubCollection.isTicketHubCollection, true, issues);
      }
    }
  });

  await section("BIGGI_TOKEN", addresses.BIGGI_TOKEN, requireCode, issues, async () => {
    const token = viewContract(addresses.BIGGI_TOKEN, [
      "function distributed() view returns (bool)",
      "function reserveAddr() view returns (address)",
      "function dripDistributorAddr() view returns (address)",
      "function tokenRewardsAddr() view returns (address)",
      "function marketingSupportAddr() view returns (address)",
      "function supplyController() view returns (address)",
      "function supplyGuardian() view returns (address)",
      "function guardianDexMinted() view returns (uint256)",
      "function guardianRewardsMinted() view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function remainingMintable() view returns (uint256)",
    ]);
    const distributed = await safe("TOKEN.distributed", () => token.distributed());
    const reserveAddr = await safe("TOKEN.reserveAddr", () => token.reserveAddr());
    const dripAddr = await safe("TOKEN.dripDistributorAddr", () => token.dripDistributorAddr());
    const rewardsAddr = await safe("TOKEN.tokenRewardsAddr", () => token.tokenRewardsAddr());
    const marketingAddr = await safe("TOKEN.marketingSupportAddr", () => token.marketingSupportAddr());
    const controllerAddr = await safe("TOKEN.supplyController", () => token.supplyController());
    const guardianAddr = await safe("TOKEN.supplyGuardian", () => token.supplyGuardian());
    await safe("TOKEN.guardianDexMinted", () => token.guardianDexMinted());
    await safe("TOKEN.guardianRewardsMinted", () => token.guardianRewardsMinted());
    await safe("TOKEN.totalSupply", () => token.totalSupply());
    await safe("TOKEN.remainingMintable", () => token.remainingMintable());

    if (strict) expectBool("TOKEN.distributed", distributed, true, issues);
    expectAddressMatch("TOKEN.reserveAddr == RESERVE", reserveAddr, addresses.RESERVE, issues);
    expectAddressMatch("TOKEN.dripDistributorAddr == DRIP_DISTRIBUTOR", dripAddr, addresses.DRIP_DISTRIBUTOR, issues);
    expectAddressMatch("TOKEN.tokenRewardsAddr == TOKEN_REWARDS", rewardsAddr, addresses.TOKEN_REWARDS, issues);
    const expectedMarketing = isAddress(addresses.MARKETING_SUPPORT) ? addresses.MARKETING_SUPPORT : addresses.TREASURY;
    if (isAddress(expectedMarketing)) {
      expectAddressMatch("TOKEN.marketingSupportAddr == MARKETING_SUPPORT", marketingAddr, expectedMarketing, issues);
    }
    expectAddressMatch("TOKEN.supplyController == SUPPLY_CONTROLLER", controllerAddr, addresses.SUPPLY_CONTROLLER, issues);
    expectAddressMatch("TOKEN.supplyGuardian == SUPPLY_GUARDIAN", guardianAddr, addresses.SUPPLY_GUARDIAN, issues);
  });

  await section("DRIP_DISTRIBUTOR", addresses.DRIP_DISTRIBUTOR, requireCode, issues, async () => {
    const drip = viewContract(addresses.DRIP_DISTRIBUTOR, [
      "function getAvailable() view returns (uint256)",
      "function getTotalReceived() view returns (uint256)",
      "function getTotalClaimed() view returns (uint256)",
      "function capRemaining() view returns (uint256)",
    ]);
    await safe("DRIP.available", () => drip.getAvailable());
    await safe("DRIP.totalReceived", () => drip.getTotalReceived());
    await safe("DRIP.totalClaimed", () => drip.getTotalClaimed());
    await safe("DRIP.capRemaining", () => drip.capRemaining());
  });

  await section("TREASURY", addresses.TREASURY, requireCode, issues, async () => {
    const treasury = viewContract(addresses.TREASURY, [
      "function distributor() view returns (address)",
      "function buybackAgent() view returns (address)",
      "function tokenRewards() view returns (address)",
      "function reserveAddr() view returns (address)",
      "function dripDistributor() view returns (address)",
      "function totalBiggiReceived() view returns (uint256)",
      "function totalPolReceived() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function polBalance() view returns (uint256)",
      "function totalBiggiReceivedFromBuyback() view returns (uint256)",
      "function totalPolReceivedFromDistributor() view returns (uint256)",
    ]);
    const distributor = await safe("TREASURY.distributor", () => treasury.distributor());
    const buybackAgent = await safe("TREASURY.buybackAgent", () => treasury.buybackAgent());
    const tokenRewards = await safe("TREASURY.tokenRewards", () => treasury.tokenRewards());
    const reserveAddr = await safe("TREASURY.reserveAddr", () => treasury.reserveAddr());
    const dripDistributor = await safe("TREASURY.dripDistributor", () => treasury.dripDistributor());
    await safe("TREASURY.totalBiggiReceived", () => treasury.totalBiggiReceived());
    await safe("TREASURY.totalPolReceived", () => treasury.totalPolReceived());
    await safe("TREASURY.biggiBalance", () => treasury.biggiBalance());
    await safe("TREASURY.polBalance", () => treasury.polBalance());
    await safe("TREASURY.totalBiggiReceivedFromBuyback", () => treasury.totalBiggiReceivedFromBuyback());
    await safe("TREASURY.totalPolReceivedFromDistributor", () => treasury.totalPolReceivedFromDistributor());

    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("TREASURY.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR, issues);
    }
    if (isAddress(addresses.BUYBACK_AGENT)) {
      expectAddressMatch("TREASURY.buybackAgent == BUYBACK_AGENT", buybackAgent, addresses.BUYBACK_AGENT, issues);
    }
    if (isAddress(addresses.TOKEN_REWARDS)) {
      expectAddressMatch("TREASURY.tokenRewards == TOKEN_REWARDS", tokenRewards, addresses.TOKEN_REWARDS, issues);
    }
    if (isAddress(addresses.RESERVE)) {
      expectAddressMatch("TREASURY.reserveAddr == RESERVE", reserveAddr, addresses.RESERVE, issues);
    }
    if (isAddress(addresses.DRIP_DISTRIBUTOR)) {
      expectAddressMatch("TREASURY.dripDistributor == DRIP_DISTRIBUTOR", dripDistributor, addresses.DRIP_DISTRIBUTOR, issues);
    }
  });

  await section("COLLECTION_REWARDS", addresses.COLLECTION_REWARDS, requireCode, issues, async () => {
    const rewards = viewContract(addresses.COLLECTION_REWARDS, [
      "function defaultMain() view returns (address)",
      "function distributor() view returns (address)",
      "function registry() view returns (address)",
      "function orangeReward() view returns (uint256)",
      "function blockReward() view returns (uint256)",
      "function rainbowReward() view returns (uint256)",
      "function orangeWinnersCount(address) view returns (uint8)",
      "function blockWinnersCount(address) view returns (uint8)",
      "function rainbowRewardClaimedGlobal(address) view returns (bool)",
    ]);
    const defaultMain = await safe("COLLECTION_REWARDS.defaultMain", () => rewards.defaultMain());
    const distributor = await safe("COLLECTION_REWARDS.distributor", () => rewards.distributor());
    const registry = await safe("COLLECTION_REWARDS.registry", () => rewards.registry());
    await safe("COLLECTION_REWARDS.orangeReward", () => rewards.orangeReward());
    await safe("COLLECTION_REWARDS.blockReward", () => rewards.blockReward());
    await safe("COLLECTION_REWARDS.rainbowReward", () => rewards.rainbowReward());
    if (isAddress(addresses.MAIN)) {
      await safe("COLLECTION_REWARDS.orangeWinners[main]", () => rewards.orangeWinnersCount(addresses.MAIN));
      await safe("COLLECTION_REWARDS.blockWinners[main]", () => rewards.blockWinnersCount(addresses.MAIN));
      await safe("COLLECTION_REWARDS.rainbowClaimed[main]", () => rewards.rainbowRewardClaimedGlobal(addresses.MAIN));
    }
    await safe("COLLECTION_REWARDS.balance", () => ethers.provider.getBalance(addresses.COLLECTION_REWARDS));

    if (isAddress(addresses.MAIN)) {
      expectAddressMatch("COLLECTION_REWARDS.defaultMain == MAIN", defaultMain, addresses.MAIN, issues);
    }
    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("COLLECTION_REWARDS.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR, issues);
    }
    if (isAddress(addresses.REGISTRY)) {
      expectAddressMatch("COLLECTION_REWARDS.registry == REGISTRY", registry, addresses.REGISTRY, issues);
      const registryView = viewContract(addresses.REGISTRY, [
        "function isCollectionRewardsCollection(address) view returns (bool)",
      ]);
      if (isAddress(addresses.MAIN)) {
        const mainEligible = await safe(
          "COLLECTION_REWARDS.registryEligible[main]",
          () => registryView.isCollectionRewardsCollection(addresses.MAIN)
        );
        if (strict) expectBool("COLLECTION_REWARDS.registryEligible[main]", mainEligible, true, issues);
      }
      if (isAddress(addresses.MAIN2)) {
        const main2Eligible = await safe(
          "COLLECTION_REWARDS.registryEligible[main2]",
          () => registryView.isCollectionRewardsCollection(addresses.MAIN2)
        );
        if (strict) expectBool("COLLECTION_REWARDS.registryEligible[main2]", main2Eligible, false, issues);
      }
    }
  });

  await section("DISTRIBUTOR", addresses.DISTRIBUTOR, requireCode, issues, async () => {
    const dist = viewContract(addresses.DISTRIBUTOR, [
      "function collectionRewards() view returns (address)",
      "function reserve() view returns (address)",
      "function buybackAgent() view returns (address)",
      "function treasury() view returns (address)",
      "function communityCenter() view returns (address)",
      "function registry() view returns (address)",
      "function totalReceived() view returns (uint256)",
      "function totalPending() view returns (uint256)",
      "function pending(address) view returns (uint256)",
      "function collections(address) view returns (bool)",
      "function receivedByCollection(address) view returns (uint256)",
      "function receivedByChapter(uint256) view returns (uint256)",
      "function receivedBySeries(uint256) view returns (uint256)",
    ]);
    const collectionRewards = await safe("DISTRIBUTOR.collectionRewards", () => dist.collectionRewards());
    const reserve = await safe("DISTRIBUTOR.reserve", () => dist.reserve());
    const buybackAgent = await safe("DISTRIBUTOR.buybackAgent", () => dist.buybackAgent());
    const treasury = await safe("DISTRIBUTOR.treasury", () => dist.treasury());
    const communityCenter = await safe("DISTRIBUTOR.communityCenter", () => dist.communityCenter());
    const registry = await safe("DISTRIBUTOR.registry", () => dist.registry());
    await safe("DISTRIBUTOR.totalReceived", () => dist.totalReceived());
    const totalPending = await safe("DISTRIBUTOR.totalPending", () => dist.totalPending());

    let mainWhitelisted = null;
    let main2Whitelisted = null;
    let hubWhitelisted = null;
    if (isAddress(addresses.MAIN)) {
      mainWhitelisted = await safe("DISTRIBUTOR.whitelisted[main]", () => dist.collections(addresses.MAIN));
      await safe("DISTRIBUTOR.receivedByCollection[main]", () => dist.receivedByCollection(addresses.MAIN));
    }
    if (isAddress(addresses.MAIN2)) {
      main2Whitelisted = await safe("DISTRIBUTOR.whitelisted[main2]", () => dist.collections(addresses.MAIN2));
      await safe("DISTRIBUTOR.receivedByCollection[main2]", () => dist.receivedByCollection(addresses.MAIN2));
    }
    if (isAddress(addresses.TICKET_HUB)) {
      hubWhitelisted = await safe("DISTRIBUTOR.whitelisted[ticketHub]", () => dist.collections(addresses.TICKET_HUB));
      await safe("DISTRIBUTOR.receivedByCollection[ticketHub]", () => dist.receivedByCollection(addresses.TICKET_HUB));
    }
    if (addresses.CHAPTER_ID != null) {
      const chapterId = Number(addresses.CHAPTER_ID);
      await safe("DISTRIBUTOR.receivedByChapter", () => dist.receivedByChapter(chapterId));
    }
    await safe("DISTRIBUTOR.receivedBySeries[1]", () => dist.receivedBySeries(1));

    if (isAddress(addresses.COLLECTION_REWARDS)) {
      expectAddressMatch("DISTRIBUTOR.collectionRewards == COLLECTION_REWARDS", collectionRewards, addresses.COLLECTION_REWARDS, issues);
    }
    if (isAddress(addresses.RESERVE)) {
      expectAddressMatch("DISTRIBUTOR.reserve == RESERVE", reserve, addresses.RESERVE, issues);
    }
    if (isAddress(addresses.TREASURY)) {
      expectAddressMatch("DISTRIBUTOR.treasury == TREASURY", treasury, addresses.TREASURY, issues);
    }
    if (isAddress(addresses.REGISTRY)) {
      expectAddressMatch("DISTRIBUTOR.registry == REGISTRY", registry, addresses.REGISTRY, issues);
    }
    if (isAddress(addresses.BUYBACK_AGENT_EFFECTIVE)) {
      expectAddressMatch(
        "DISTRIBUTOR.buybackAgent == BUYBACK_AGENT_EFFECTIVE",
        buybackAgent,
        addresses.BUYBACK_AGENT_EFFECTIVE,
        issues
      );
    }
    if (isAddress(addresses.COMMUNITY_CENTER_EFFECTIVE)) {
      expectAddressMatch(
        "DISTRIBUTOR.communityCenter == COMMUNITY_CENTER_EFFECTIVE",
        communityCenter,
        addresses.COMMUNITY_CENTER_EFFECTIVE,
        issues
      );
      if (totalPending != null) {
        await safe("DISTRIBUTOR.pending[communityCenter]", () => dist.pending(addresses.COMMUNITY_CENTER_EFFECTIVE));
      }
    }
    if (strict) {
      expectAddressSet("DISTRIBUTOR.collectionRewards is set", collectionRewards, issues);
      expectAddressSet("DISTRIBUTOR.reserve is set", reserve, issues);
      expectAddressSet("DISTRIBUTOR.buybackAgent is set", buybackAgent, issues);
      expectAddressSet("DISTRIBUTOR.treasury is set", treasury, issues);
      expectAddressSet("DISTRIBUTOR.communityCenter is set", communityCenter, issues);
      expectAddressSet("DISTRIBUTOR.registry is set", registry, issues);
      if (isAddress(addresses.MAIN)) expectBool("DISTRIBUTOR.whitelisted[main]", mainWhitelisted, true, issues);
      if (isAddress(addresses.MAIN2)) expectBool("DISTRIBUTOR.whitelisted[main2]", main2Whitelisted, true, issues);
      if (isAddress(addresses.TICKET_HUB)) expectBool("DISTRIBUTOR.whitelisted[ticketHub]", hubWhitelisted, true, issues);
    }
  });

  await section("DRIP_LM", addresses.DRIP_LM, requireCode, issues, async () => {
    const dripLm = viewContract(addresses.DRIP_LM, [
      "function dripDistributor() view returns (address)",
      "function reserve() view returns (address)",
      "function buybackAgent() view returns (address)",
      "function moderatorCenter() view returns (address)",
      "function sellPct() view returns (uint8)",
      "function reserveShareBps() view returns (uint16)",
      "function moderatorShareBps() view returns (uint16)",
      "function slippageBps() view returns (uint256)",
      "function txDeadlineSec() view returns (uint256)",
    ]);
    const dripDistributor = await safe("DRIP_LM.dripDistributor", () => dripLm.dripDistributor());
    const reserve = await safe("DRIP_LM.reserve", () => dripLm.reserve());
    const buyback = await safe("DRIP_LM.buybackAgent", () => dripLm.buybackAgent());
    const moderator = await safe("DRIP_LM.moderatorCenter", () => dripLm.moderatorCenter());
    await safe("DRIP_LM.sellPct", () => dripLm.sellPct());
    await safe("DRIP_LM.reserveShareBps", () => dripLm.reserveShareBps());
    await safe("DRIP_LM.moderatorShareBps", () => dripLm.moderatorShareBps());
    await safe("DRIP_LM.slippageBps", () => dripLm.slippageBps());
    await safe("DRIP_LM.txDeadlineSec", () => dripLm.txDeadlineSec());

    if (isAddress(addresses.DRIP_DISTRIBUTOR)) {
      expectAddressMatch("DRIP_LM.dripDistributor == DRIP_DISTRIBUTOR", dripDistributor, addresses.DRIP_DISTRIBUTOR, issues);
    }
    if (isAddress(addresses.RESERVE)) {
      expectAddressMatch("DRIP_LM.reserve == RESERVE", reserve, addresses.RESERVE, issues);
    }
    if (isAddress(addresses.BUYBACK_AGENT)) {
      expectAddressMatch("DRIP_LM.buybackAgent == BUYBACK_AGENT", buyback, addresses.BUYBACK_AGENT, issues);
    }
    if (isAddress(addresses.MODERATOR_CENTER)) {
      expectAddressMatch("DRIP_LM.moderatorCenter == MODERATOR_CENTER", moderator, addresses.MODERATOR_CENTER, issues);
    }
  });

  await section("BUYBACK_AGENT", addresses.BUYBACK_AGENT, requireCode, issues, async () => {
    const buyback = viewContract(addresses.BUYBACK_AGENT, [
      "function autoBuybackEnabled() view returns (bool)",
      "function paused() view returns (bool)",
      "function router() view returns (address)",
      "function wrappedNative() view returns (address)",
      "function treasury() view returns (address)",
      "function policy() view returns (address)",
      "function dripLM() view returns (address)",
      "function keeper() view returns (address)",
      "function lastBuybackAt() view returns (uint256)",
      "function totalNativeReceived() view returns (uint256)",
      "function totalNativeSpent() view returns (uint256)",
      "function totalBiggiAcquired() view returns (uint256)",
      "function nativeBalance() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function fallbackSwapSlippageBps() view returns (uint256)",
      "function fallbackTxDeadlineSec() view returns (uint256)",
      "function fallbackMinIntervalSec() view returns (uint256)",
    ]);
    await safe("BUYBACK.autoBuybackEnabled", () => buyback.autoBuybackEnabled());
    await safe("BUYBACK.paused", () => buyback.paused());
    const router = await safe("BUYBACK.router", () => buyback.router());
    await safe("BUYBACK.wrappedNative", () => buyback.wrappedNative());
    const treasury = await safe("BUYBACK.treasury", () => buyback.treasury());
    const policy = await safe("BUYBACK.policy", () => buyback.policy());
    const dripLm = await safe("BUYBACK.dripLM", () => buyback.dripLM());
    await safe("BUYBACK.keeper", () => buyback.keeper());
    await safe("BUYBACK.lastBuybackAt", () => buyback.lastBuybackAt());
    await safe("BUYBACK.totalNativeReceived", () => buyback.totalNativeReceived());
    await safe("BUYBACK.totalNativeSpent", () => buyback.totalNativeSpent());
    await safe("BUYBACK.totalBiggiAcquired", () => buyback.totalBiggiAcquired());
    await safe("BUYBACK.nativeBalance", () => buyback.nativeBalance());
    await safe("BUYBACK.biggiBalance", () => buyback.biggiBalance());
    const fallbackSlip = await safe("BUYBACK.fallbackSwapSlippageBps", () => buyback.fallbackSwapSlippageBps());
    const fallbackDeadline = await safe("BUYBACK.fallbackTxDeadlineSec", () => buyback.fallbackTxDeadlineSec());
    const fallbackCooldown = await safe("BUYBACK.fallbackMinIntervalSec", () => buyback.fallbackMinIntervalSec());

    const expectedBuybackRouter = isAddress(addresses.BUYBACK_ROUTER) ? addresses.BUYBACK_ROUTER : addresses.ROUTER;
    if (isAddress(expectedBuybackRouter)) {
      expectAddressMatch("BUYBACK.router == BUYBACK_ROUTER", router, expectedBuybackRouter, issues);
    }
    if (isAddress(addresses.TREASURY)) {
      expectAddressMatch("BUYBACK.treasury == TREASURY", treasury, addresses.TREASURY, issues);
    }
    if (isAddress(addresses.POLICY)) {
      expectAddressMatch("BUYBACK.policy == POLICY", policy, addresses.POLICY, issues);
    }
    if (isAddress(addresses.DRIP_LM)) {
      expectAddressMatch("BUYBACK.dripLM == DRIP_LM", dripLm, addresses.DRIP_LM, issues);
    }

    const expFallbackSlip = envIntOpt("BUYBACK_FALLBACK_SLIPPAGE_BPS");
    const expFallbackDeadline = envIntOpt("BUYBACK_FALLBACK_DEADLINE_SEC");
    const expFallbackCooldown = envIntOpt("BUYBACK_FALLBACK_COOLDOWN_SEC");
    if (expFallbackSlip != null) expectNumberMatch("BUYBACK.fallbackSwapSlippageBps", fallbackSlip, expFallbackSlip, issues);
    if (expFallbackDeadline != null) expectNumberMatch("BUYBACK.fallbackTxDeadlineSec", fallbackDeadline, expFallbackDeadline, issues);
    if (expFallbackCooldown != null) expectNumberMatch("BUYBACK.fallbackMinIntervalSec", fallbackCooldown, expFallbackCooldown, issues);
  });

  await section("POLICY", addresses.POLICY, requireCode, issues, async () => {
    const policy = viewContract(addresses.POLICY, [
      "function swapSlippageBps() view returns (uint256)",
      "function txDeadlineSec() view returns (uint256)",
      "function minBuybackInterval() view returns (uint256)",
      "function buybacksPaused() view returns (bool)",
      "function maxDailyBuybackNative() view returns (uint256)",
      "function usedToday() view returns (uint256)",
      "function dayIndex() view returns (uint64)",
    ]);
    const slip = await safe("POLICY.swapSlippageBps", () => policy.swapSlippageBps());
    const deadline = await safe("POLICY.txDeadlineSec", () => policy.txDeadlineSec());
    const minInterval = await safe("POLICY.minBuybackInterval", () => policy.minBuybackInterval());
    const paused_ = await safe("POLICY.buybacksPaused", () => policy.buybacksPaused());
    const maxDaily = await safe("POLICY.maxDailyBuybackNative", () => policy.maxDailyBuybackNative());
    await safe("POLICY.usedToday", () => policy.usedToday());
    await safe("POLICY.dayIndex", () => policy.dayIndex());

    const expSlip = envIntOpt("POLICY_SWAP_SLIPPAGE_BPS");
    const expDeadline = envIntOpt("POLICY_TX_DEADLINE_SEC");
    const expMinInterval = envIntOpt("POLICY_MIN_BUYBACK_INTERVAL_SEC");
    const expPaused = envBoolOpt("POLICY_BUYBACKS_PAUSED");
    const expMaxDaily = envTokenOpt("POLICY_MAX_DAILY_BUYBACK_NATIVE");

    if (expSlip != null) expectNumberMatch("POLICY.swapSlippageBps", slip, expSlip, issues);
    if (expDeadline != null) expectNumberMatch("POLICY.txDeadlineSec", deadline, expDeadline, issues);
    if (expMinInterval != null) expectNumberMatch("POLICY.minBuybackInterval", minInterval, expMinInterval, issues);
    if (expPaused != null) expectBool("POLICY.buybacksPaused", paused_, expPaused, issues);
    if (expMaxDaily != null) expectBigNumberishMatch("POLICY.maxDailyBuybackNative", maxDaily, expMaxDaily, issues);
  });

  await section("COMMUNITY_CENTER", addresses.COMMUNITY_CENTER, requireCode, issues, async () => {
    const community = viewContract(addresses.COMMUNITY_CENTER, [
      "function distributor() view returns (address)",
      "function poolBalance() view returns (uint256)",
      "function totalLocked() view returns (uint256)",
      "function nextEventId() view returns (uint256)",
      "function getEvents() view returns (uint256[])",
    ]);
    const distributor = await safe("COMMUNITY.distributor", () => community.distributor());
    const poolBalance = await safe("COMMUNITY.poolBalance", () => community.poolBalance());
    if (poolBalance != null) {
      await safe("COMMUNITY.totalLocked", () => community.totalLocked());
      await safe("COMMUNITY.nextEventId", () => community.nextEventId());
      await safe("COMMUNITY.events", () => community.getEvents());
    }
    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("COMMUNITY.distributor == DISTRIBUTOR", distributor, addresses.DISTRIBUTOR, issues);
    }
  });

  await section("MODERATOR_CENTER", addresses.MODERATOR_CENTER, requireCode, issues, async () => {
    const moderator = viewContract(addresses.MODERATOR_CENTER, [
      "function multiCollection() view returns (address)",
      "function globalUniquePerWeek() view returns (bool)",
      "function weekAllocated(uint256) view returns (uint256)",
    ]);
    const multiCollection = await safe("MODERATOR.multiCollection", () => moderator.multiCollection());
    await safe("MODERATOR.globalUniquePerWeek", () => moderator.globalUniquePerWeek());
    const latest = await ethers.provider.getBlock("latest");
    const week = Math.floor(Number(latest.timestamp) / (7 * 24 * 60 * 60));
    await safe("MODERATOR.weekAllocated[current]", () => moderator.weekAllocated(week));

    if (isAddress(addresses.DRIP_LM)) {
      expectAddressMatch("MODERATOR.multiCollection == DRIP_LM", multiCollection, addresses.DRIP_LM, issues);
    }
  });

  await section("MULTI_COLLECTION_READER", addresses.MULTI_COLLECTION_READER, requireCode, issues, async () => {
    const reader = viewContract(addresses.MULTI_COLLECTION_READER, [
      "function distributor() view returns (address)",
      "function recipients() view returns (address,address,address,address,address,address)",
      "function pendingSnapshot(address) view returns (uint256,uint256)",
      "function sourceSnapshot(address) view returns (bool,uint256,uint256,uint256,uint256,uint256,uint256)",
    ]);
    const readerDistributor = await safe("MCR.distributor", () => reader.distributor());
    const recipients = await safe("MCR.recipients", () => reader.recipients());
    const pendingTarget = isAddress(addresses.COMMUNITY_CENTER_EFFECTIVE) ? addresses.COMMUNITY_CENTER_EFFECTIVE : ZERO;
    await safe("MCR.pendingSnapshot", () => reader.pendingSnapshot(pendingTarget));
    const source = isAddress(addresses.MAIN) ? addresses.MAIN : addresses.TICKET_HUB;
    if (isAddress(source)) {
      await safe("MCR.sourceSnapshot", () => reader.sourceSnapshot(source));
    }

    if (isAddress(addresses.DISTRIBUTOR)) {
      expectAddressMatch("MCR.distributor == DISTRIBUTOR", readerDistributor, addresses.DISTRIBUTOR, issues);
    }
    if (Array.isArray(recipients) && recipients.length >= 6) {
      if (isAddress(addresses.COLLECTION_REWARDS)) {
        expectAddressMatch("MCR.collectionRewards == COLLECTION_REWARDS", recipients[0], addresses.COLLECTION_REWARDS, issues);
      }
      if (isAddress(addresses.RESERVE)) {
        expectAddressMatch("MCR.reserve == RESERVE", recipients[1], addresses.RESERVE, issues);
      }
      if (isAddress(addresses.BUYBACK_AGENT_EFFECTIVE)) {
        expectAddressMatch(
          "MCR.buybackAgent == BUYBACK_AGENT_EFFECTIVE",
          recipients[2],
          addresses.BUYBACK_AGENT_EFFECTIVE,
          issues
        );
      }
      if (isAddress(addresses.TREASURY)) {
        expectAddressMatch("MCR.treasury == TREASURY", recipients[3], addresses.TREASURY, issues);
      }
      if (isAddress(addresses.COMMUNITY_CENTER_EFFECTIVE)) {
        expectAddressMatch(
          "MCR.communityCenter == COMMUNITY_CENTER_EFFECTIVE",
          recipients[4],
          addresses.COMMUNITY_CENTER_EFFECTIVE,
          issues
        );
      }
      if (isAddress(addresses.REGISTRY)) {
        expectAddressMatch("MCR.registry == REGISTRY", recipients[5], addresses.REGISTRY, issues);
      }
    }
  });

  await section("RESERVE", addresses.RESERVE, requireCode, issues, async () => {
    const reserve = viewContract(addresses.RESERVE, [
      "function distributor() view returns (address)",
      "function liquidityManager() view returns (address)",
      "function notifyCallerCheckEnabled() view returns (bool)",
      "function notifyCallers(address) view returns (bool)",
      "function availableForDexRefill() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function polBalance() view returns (uint256)",
    ]);
    const distributorAddr = await safe("RESERVE.distributor", () => reserve.distributor());
    const lmAddr = await safe("RESERVE.liquidityManager", () => reserve.liquidityManager());
    const strictNotifyEnabled = await safe("RESERVE.notifyCallerCheckEnabled", () => reserve.notifyCallerCheckEnabled());
    let hubCaller = null;
    let main2Caller = null;
    let distCaller = null;
    if (isAddress(addresses.TICKET_HUB)) {
      hubCaller = await safe("RESERVE.notifyCaller[ticketHub]", () => reserve.notifyCallers(addresses.TICKET_HUB));
    }
    if (isAddress(addresses.MAIN2)) {
      main2Caller = await safe("RESERVE.notifyCaller[main2]", () => reserve.notifyCallers(addresses.MAIN2));
    }
    if (isAddress(addresses.DISTRIBUTOR)) {
      distCaller = await safe("RESERVE.notifyCaller[distributor]", () => reserve.notifyCallers(addresses.DISTRIBUTOR));
    }
    await safe("RESERVE.availableForDexRefill", () => reserve.availableForDexRefill());
    await safe("RESERVE.biggiBalance", () => reserve.biggiBalance());
    await safe("RESERVE.polBalance", () => reserve.polBalance());

    expectAddressMatch("RESERVE.distributor == DISTRIBUTOR", distributorAddr, addresses.DISTRIBUTOR, issues);
    if (isAddress(addresses.LIQUIDITY_MANAGER)) {
      expectAddressMatch("RESERVE.liquidityManager == LIQUIDITY_MANAGER", lmAddr, addresses.LIQUIDITY_MANAGER, issues);
    }
    if (expectStrictNotify) {
      expectBool("RESERVE.notifyCallerCheckEnabled", strictNotifyEnabled, true, issues);
    }
    if (isAddress(addresses.TICKET_HUB) && strictNotifyEnabled != null) {
      expectBool("RESERVE.notifyCaller[ticketHub]", hubCaller, true, issues);
    }
    if (isAddress(addresses.MAIN2) && strictNotifyEnabled != null) {
      expectBool("RESERVE.notifyCaller[main2]", main2Caller, true, issues);
    }
    if (isAddress(addresses.DISTRIBUTOR) && strictNotifyEnabled != null) {
      expectBool("RESERVE.notifyCaller[distributor]", distCaller, true, issues);
    }
  });

  await section("TOKEN_REWARDS", addresses.TOKEN_REWARDS, requireCode, issues, async () => {
    const rewards = viewContract(addresses.TOKEN_REWARDS, [
      "function rewardsStats() view returns (uint256,uint256)",
      "function rewardsCapRemaining() view returns (uint256)",
      "function currentWeek() view returns (uint64)",
      "function isRegistryModeEnabled() view returns (bool)",
      "function registry() view returns (address)",
      "function treasure() view returns (address)",
      "function isAllowedCollection(address) view returns (bool)",
    ]);
    await safe("TOKEN_REWARDS.rewardsStats", () => rewards.rewardsStats());
    await safe("TOKEN_REWARDS.capRemaining", () => rewards.rewardsCapRemaining());
    await safe("TOKEN_REWARDS.currentWeek", () => rewards.currentWeek());
    const registryMode = await safe("TOKEN_REWARDS.registryMode", () => rewards.isRegistryModeEnabled());
    const registryAddr = await safe("TOKEN_REWARDS.registry", () => rewards.registry());
    const treasureAddr = await safe("TOKEN_REWARDS.treasure", () => rewards.treasure());
    const mainAllowed = isAddress(addresses.MAIN)
      ? await safe("TOKEN_REWARDS.allowed[main]", () => rewards.isAllowedCollection(addresses.MAIN))
      : null;
    const main2Allowed = isAddress(addresses.MAIN2)
      ? await safe("TOKEN_REWARDS.allowed[main2]", () => rewards.isAllowedCollection(addresses.MAIN2))
      : null;
    const ticketHubAllowed = isAddress(addresses.TICKET_HUB)
      ? await safe("TOKEN_REWARDS.allowed[ticketHub]", () => rewards.isAllowedCollection(addresses.TICKET_HUB))
      : null;

    let regMainAllowed = null;
    let regMain2Allowed = null;
    if (isAddress(addresses.REGISTRY)) {
      const registryView = viewContract(addresses.REGISTRY, [
        "function isTokenRewardsCollection(address) view returns (bool)",
      ]);
      if (isAddress(addresses.MAIN)) {
        regMainAllowed = await safe(
          "TOKEN_REWARDS.registryExpected[main]",
          () => registryView.isTokenRewardsCollection(addresses.MAIN)
        );
      }
      if (isAddress(addresses.MAIN2)) {
        regMain2Allowed = await safe(
          "TOKEN_REWARDS.registryExpected[main2]",
          () => registryView.isTokenRewardsCollection(addresses.MAIN2)
        );
      }
    }

    if (isAddress(addresses.REGISTRY)) {
      expectAddressMatch("TOKEN_REWARDS.registry == REGISTRY", registryAddr, addresses.REGISTRY, issues);
      if (strict) expectBool("TOKEN_REWARDS.registryMode", registryMode, true, issues);
    }
    if (isAddress(addresses.TREASURY)) {
      expectAddressMatch("TOKEN_REWARDS.treasure == TREASURY", treasureAddr, addresses.TREASURY, issues);
    }
    if (regMainAllowed != null && mainAllowed != null) {
      expectBool("TOKEN_REWARDS.allowed[main] follows REGISTRY", mainAllowed, regMainAllowed, issues);
    }
    if (regMain2Allowed != null && main2Allowed != null) {
      expectBool("TOKEN_REWARDS.allowed[main2] follows REGISTRY", main2Allowed, regMain2Allowed, issues);
    }
    if (strict && ticketHubAllowed != null) {
      expectBool("TOKEN_REWARDS.allowed[ticketHub]", ticketHubAllowed, false, issues);
    }
  });

  await section("NFT_REWARDS", addresses.NFT_REWARDS, requireCode, issues, async () => {
    const nftRewards = viewContract(addresses.NFT_REWARDS, [
      "function mainContract() view returns (address)",
      "function vrfRouter() view returns (address)",
      "function registry() view returns (address)",
      "function allowedMainCollections(address) view returns (bool)",
      "function nextEventId() view returns (uint256)",
      "function nextRewardId() view returns (uint256)",
      "function name() view returns (string)",
      "function symbol() view returns (string)",
    ]);
    const mainContract = await safe("NFT_REWARDS.mainContract", () => nftRewards.mainContract());
    const vrfRouter = await safe("NFT_REWARDS.vrfRouter", () => nftRewards.vrfRouter());
    const registryAddr = await safe("NFT_REWARDS.registry", () => nftRewards.registry());
    const mainAllowed = isAddress(addresses.MAIN)
      ? await safe("NFT_REWARDS.allowedMain[main]", () => nftRewards.allowedMainCollections(addresses.MAIN))
      : null;
    const main2Allowed = isAddress(addresses.MAIN2)
      ? await safe("NFT_REWARDS.allowedMain[main2]", () => nftRewards.allowedMainCollections(addresses.MAIN2))
      : null;
    await safe("NFT_REWARDS.nextEventId", () => nftRewards.nextEventId());
    await safe("NFT_REWARDS.nextRewardId", () => nftRewards.nextRewardId());
    await safe("NFT_REWARDS.name", () => nftRewards.name());
    await safe("NFT_REWARDS.symbol", () => nftRewards.symbol());

    if (isAddress(addresses.MAIN)) {
      expectAddressMatch("NFT_REWARDS.mainContract == MAIN", mainContract, addresses.MAIN, issues);
    }
    if (isAddress(addresses.VRF_ROUTER)) {
      expectAddressMatch("NFT_REWARDS.vrfRouter == VRF_ROUTER", vrfRouter, addresses.VRF_ROUTER, issues);
    }
    if (isAddress(addresses.REGISTRY)) {
      expectAddressMatch("NFT_REWARDS.registry == REGISTRY", registryAddr, addresses.REGISTRY, issues);
    }
    if (strict && mainAllowed != null) {
      expectBool("NFT_REWARDS.allowedMain[main]", mainAllowed, true, issues);
    }
    if (strict && main2Allowed != null) {
      expectBool("NFT_REWARDS.allowedMain[main2]", main2Allowed, true, issues);
    }
  });

  await section("MASTER_CONFIG", addresses.MASTER_CONFIG, requireCode, issues, async () => {
    const config = viewContract(addresses.MASTER_CONFIG, [
      "function coreBundle() view returns (address,address,address,address)",
      "function rewardsBundle() view returns (address,address,address,address)",
      "function pumpBundle() view returns (address,address,address,address)",
      "function liquidityBundle() view returns (address,address,address,address,address)",
      "function collectionsBundle() view returns (address,address,address,address)",
      "function supplyController() view returns (address)",
      "function supplyGuardian() view returns (address)",
      "function dexReserveGuard() view returns (address)",
    ]);
    const core = await safe("MASTER.coreBundle", () => config.coreBundle());
    const rewards = await safe("MASTER.rewardsBundle", () => config.rewardsBundle());
    const pump = await safe("MASTER.pumpBundle", () => config.pumpBundle());
    const liquidity = await safe("MASTER.liquidityBundle", () => config.liquidityBundle());
    const collections = await safe("MASTER.collectionsBundle", () => config.collectionsBundle());
    const supplyController = await safe("MASTER.supplyController", () => config.supplyController());
    const supplyGuardian = await safe("MASTER.supplyGuardian", () => config.supplyGuardian());
    const dexReserveGuard = await safe("MASTER.dexReserveGuard", () => config.dexReserveGuard());

    if (Array.isArray(core) && core.length >= 4) {
      if (isAddress(addresses.BIGGI_TOKEN)) expectAddressMatch("MASTER.core.biggi == BIGGI_TOKEN", core[0], addresses.BIGGI_TOKEN, issues);
      if (isAddress(addresses.RESERVE)) expectAddressMatch("MASTER.core.reserve == RESERVE", core[1], addresses.RESERVE, issues);
      if (isAddress(addresses.TREASURY)) expectAddressMatch("MASTER.core.treasury == TREASURY", core[2], addresses.TREASURY, issues);
      if (isAddress(addresses.DISTRIBUTOR)) expectAddressMatch("MASTER.core.distributor == DISTRIBUTOR", core[3], addresses.DISTRIBUTOR, issues);
    }
    if (Array.isArray(rewards) && rewards.length >= 4) {
      if (isAddress(addresses.COLLECTION_REWARDS)) {
        expectAddressMatch("MASTER.rewards.collectionRewards == COLLECTION_REWARDS", rewards[0], addresses.COLLECTION_REWARDS, issues);
      }
      if (isAddress(addresses.TOKEN_REWARDS)) {
        expectAddressMatch("MASTER.rewards.tokenRewards == TOKEN_REWARDS", rewards[1], addresses.TOKEN_REWARDS, issues);
      }
      if (isAddress(addresses.NFT_REWARDS)) {
        expectAddressMatch("MASTER.rewards.nftRewards == NFT_REWARDS", rewards[2], addresses.NFT_REWARDS, issues);
      }
      if (isAddress(addresses.COMMUNITY_CENTER_EFFECTIVE)) {
        expectAddressMatch(
          "MASTER.rewards.communityCenter == COMMUNITY_CENTER_EFFECTIVE",
          rewards[3],
          addresses.COMMUNITY_CENTER_EFFECTIVE,
          issues
        );
      }
    }
    if (Array.isArray(pump) && pump.length >= 4) {
      if (isAddress(addresses.BUYBACK_AGENT)) expectAddressMatch("MASTER.pump.buybackAgent == BUYBACK_AGENT", pump[0], addresses.BUYBACK_AGENT, issues);
      if (isAddress(addresses.DRIP_LM)) expectAddressMatch("MASTER.pump.dripLM == DRIP_LM", pump[1], addresses.DRIP_LM, issues);
      if (isAddress(addresses.DRIP_DISTRIBUTOR)) {
        expectAddressMatch("MASTER.pump.dripDistributor == DRIP_DISTRIBUTOR", pump[2], addresses.DRIP_DISTRIBUTOR, issues);
      }
    }
    if (Array.isArray(liquidity) && liquidity.length >= 5) {
      if (isAddress(addresses.LIQUIDITY_MANAGER)) {
        expectAddressMatch("MASTER.liquidity.manager == LIQUIDITY_MANAGER", liquidity[0], addresses.LIQUIDITY_MANAGER, issues);
      }
      if (isAddress(addresses.LIQUIDITY_VAULT)) {
        expectAddressMatch("MASTER.liquidity.vault == LIQUIDITY_VAULT", liquidity[1], addresses.LIQUIDITY_VAULT, issues);
      }
    }
    if (Array.isArray(collections) && collections.length >= 4) {
      if (isAddress(addresses.MAIN)) expectAddressMatch("MASTER.collections.collection1 == MAIN", collections[0], addresses.MAIN, issues);
      if (isAddress(addresses.MAIN2)) expectAddressMatch("MASTER.collections.collection2 == MAIN2", collections[1], addresses.MAIN2, issues);
      if (isAddress(addresses.DISTRIBUTOR)) {
        expectAddressMatch("MASTER.collections.distributor == DISTRIBUTOR", collections[3], addresses.DISTRIBUTOR, issues);
      }
    }
    if (isAddress(addresses.SUPPLY_CONTROLLER)) {
      expectAddressMatch("MASTER.supplyController == SUPPLY_CONTROLLER", supplyController, addresses.SUPPLY_CONTROLLER, issues);
    }
    if (isAddress(addresses.SUPPLY_GUARDIAN)) {
      expectAddressMatch("MASTER.supplyGuardian == SUPPLY_GUARDIAN", supplyGuardian, addresses.SUPPLY_GUARDIAN, issues);
    }
    if (isAddress(addresses.DEX_RESERVE_GUARD)) {
      expectAddressMatch("MASTER.dexReserveGuard == DEX_RESERVE_GUARD", dexReserveGuard, addresses.DEX_RESERVE_GUARD, issues);
    }
  });

  await section("SUPPLY_CONTROLLER", addresses.SUPPLY_CONTROLLER, requireCode, issues, async () => {
    const controller = viewContract(addresses.SUPPLY_CONTROLLER, [
      "function baselineReserve() view returns (uint256)",
      "function currentPairReserve() view returns (uint256)",
      "function previewMaintenance() view returns (bool,bool,uint256,uint256)",
      "function pair() view returns (address)",
      "function paused() view returns (bool)",
      "function reserveDropBps() view returns (uint256)",
      "function dexRefillAmount() view returns (uint256)",
      "function dexCooldown() view returns (uint256)",
      "function minimumReserveFloor() view returns (uint256)",
      "function autoRefreshBaselineOnDexRefill() view returns (bool)",
      "function rewardsThreshold() view returns (uint256)",
      "function rewardsRefillAmount() view returns (uint256)",
      "function rewardsCooldown() view returns (uint256)",
      "function circuitBreakerEnabled() view returns (bool)",
      "function dexCriticalFloor() view returns (uint256)",
      "function rewardsCriticalFloor() view returns (uint256)",
      "function previewCriticalStatus() view returns (bool,bool,uint256,uint256)",
    ]);
    await safe("SUPPLY_CONTROLLER.baselineReserve", () => controller.baselineReserve());
    await safe("SUPPLY_CONTROLLER.currentPairReserve", () => controller.currentPairReserve());
    await safe("SUPPLY_CONTROLLER.previewMaintenance", () => controller.previewMaintenance());
    const pairAddr = await safe("SUPPLY_CONTROLLER.pair", () => controller.pair());
    await safe("SUPPLY_CONTROLLER.paused", () => controller.paused());
    const reserveDropBps = await safe("SUPPLY_CONTROLLER.reserveDropBps", () => controller.reserveDropBps());
    const dexRefillAmount = await safe("SUPPLY_CONTROLLER.dexRefillAmount", () => controller.dexRefillAmount());
    const dexCooldown = await safe("SUPPLY_CONTROLLER.dexCooldown", () => controller.dexCooldown());
    const minimumReserveFloor = await safe("SUPPLY_CONTROLLER.minimumReserveFloor", () => controller.minimumReserveFloor());
    const autoRefreshBaseline = await safe(
      "SUPPLY_CONTROLLER.autoRefreshBaselineOnDexRefill",
      () => controller.autoRefreshBaselineOnDexRefill()
    );
    const rewardsThreshold = await safe("SUPPLY_CONTROLLER.rewardsThreshold", () => controller.rewardsThreshold());
    const rewardsRefillAmount = await safe("SUPPLY_CONTROLLER.rewardsRefillAmount", () => controller.rewardsRefillAmount());
    const rewardsCooldown = await safe("SUPPLY_CONTROLLER.rewardsCooldown", () => controller.rewardsCooldown());
    const circuitBreakerEnabled_ = await safe("SUPPLY_CONTROLLER.circuitBreakerEnabled", () => controller.circuitBreakerEnabled());
    const dexCriticalFloor = await safe("SUPPLY_CONTROLLER.dexCriticalFloor", () => controller.dexCriticalFloor());
    const rewardsCriticalFloor = await safe("SUPPLY_CONTROLLER.rewardsCriticalFloor", () => controller.rewardsCriticalFloor());
    await safe("SUPPLY_CONTROLLER.previewCriticalStatus", () => controller.previewCriticalStatus());

    expectAddressMatch("SUPPLY_CONTROLLER.pair == PAIR", pairAddr, addresses.PAIR, issues);

    const expReserveDropBps = envIntOpt("SUPPLY_DEX_RESERVE_DROP_BPS");
    const expDexRefillAmount = envTokenOpt("SUPPLY_DEX_REFILL_AMOUNT");
    const expDexCooldown = envIntOpt("SUPPLY_DEX_COOLDOWN_SEC");
    const expMinReserveFloor = envTokenOpt("SUPPLY_MIN_RESERVE_FLOOR");
    const expAutoRefresh = envBoolOpt("SUPPLY_AUTO_REFRESH_BASELINE");
    const expRewardsThreshold = envTokenOpt("SUPPLY_REWARDS_THRESHOLD");
    const expRewardsRefillAmount = envTokenOpt("SUPPLY_REWARDS_REFILL_AMOUNT");
    const expRewardsCooldown = envIntOpt("SUPPLY_REWARDS_COOLDOWN_SEC");
    const expCircuitEnabled = envBoolOpt("CIRCUIT_BREAKER_ENABLED");
    const expDexCriticalFloor = envTokenOpt("CB_DEX_CRITICAL_FLOOR");
    const expRewardsCriticalFloor = envTokenOpt("CB_REWARDS_CRITICAL_FLOOR");

    if (expReserveDropBps != null) expectNumberMatch("SUPPLY.reserveDropBps", reserveDropBps, expReserveDropBps, issues);
    if (expDexRefillAmount != null) expectBigNumberishMatch("SUPPLY.dexRefillAmount", dexRefillAmount, expDexRefillAmount, issues);
    if (expDexCooldown != null) expectNumberMatch("SUPPLY.dexCooldown", dexCooldown, expDexCooldown, issues);
    if (expMinReserveFloor != null) expectBigNumberishMatch("SUPPLY.minimumReserveFloor", minimumReserveFloor, expMinReserveFloor, issues);
    if (expAutoRefresh != null) expectBool("SUPPLY.autoRefreshBaselineOnDexRefill", autoRefreshBaseline, expAutoRefresh, issues);
    if (expRewardsThreshold != null) expectBigNumberishMatch("SUPPLY.rewardsThreshold", rewardsThreshold, expRewardsThreshold, issues);
    if (expRewardsRefillAmount != null) expectBigNumberishMatch("SUPPLY.rewardsRefillAmount", rewardsRefillAmount, expRewardsRefillAmount, issues);
    if (expRewardsCooldown != null) expectNumberMatch("SUPPLY.rewardsCooldown", rewardsCooldown, expRewardsCooldown, issues);
    if (expCircuitEnabled != null) expectBool("SUPPLY.circuitBreakerEnabled", circuitBreakerEnabled_, expCircuitEnabled, issues);
    if (expDexCriticalFloor != null) expectBigNumberishMatch("SUPPLY.dexCriticalFloor", dexCriticalFloor, expDexCriticalFloor, issues);
    if (expRewardsCriticalFloor != null) expectBigNumberishMatch("SUPPLY.rewardsCriticalFloor", rewardsCriticalFloor, expRewardsCriticalFloor, issues);
  });

  await section("DEX_RESERVE_GUARD", addresses.DEX_RESERVE_GUARD, requireCode, issues, async () => {
    const guard = viewContract(addresses.DEX_RESERVE_GUARD, [
      "function baselineReserve() view returns (uint256)",
      "function minReserveRatioBps() view returns (uint256)",
      "function minAllowedReserve() view returns (uint256)",
      "function currentTokenReserve() view returns (uint256)",
      "function refillAmount() view returns (uint256)",
      "function cooldown() view returns (uint256)",
      "function autoRefreshBaselineOnRefill() view returns (bool)",
      "function priceCheckEnabled() view returns (bool)",
      "function maxPriceDeviationBps() view returns (uint256)",
      "function quoteOracle() view returns (address)",
      "function refillNeeded() view returns (bool,string)",
      "function pair() view returns (address)",
      "function supplyController() view returns (address)",
    ]);
    await safe("DEX_GUARD.baselineReserve", () => guard.baselineReserve());
    const minReserveRatioBps = await safe("DEX_GUARD.minReserveRatioBps", () => guard.minReserveRatioBps());
    await safe("DEX_GUARD.minAllowedReserve", () => guard.minAllowedReserve());
    await safe("DEX_GUARD.currentTokenReserve", () => guard.currentTokenReserve());
    const refillAmount = await safe("DEX_GUARD.refillAmount", () => guard.refillAmount());
    const cooldown = await safe("DEX_GUARD.cooldown", () => guard.cooldown());
    const autoRefreshBaseline = await safe("DEX_GUARD.autoRefreshBaselineOnRefill", () => guard.autoRefreshBaselineOnRefill());
    const priceCheckEnabled = await safe("DEX_GUARD.priceCheckEnabled", () => guard.priceCheckEnabled());
    const maxPriceDeviationBps = await safe("DEX_GUARD.maxPriceDeviationBps", () => guard.maxPriceDeviationBps());
    const quoteOracle = await safe("DEX_GUARD.quoteOracle", () => guard.quoteOracle());
    await safe("DEX_GUARD.refillNeeded", () => guard.refillNeeded());
    const guardPair = await safe("DEX_GUARD.pair", () => guard.pair());
    const guardController = await safe("DEX_GUARD.supplyController", () => guard.supplyController());

    expectAddressMatch("DEX_GUARD.pair == PAIR", guardPair, addresses.PAIR, issues);
    expectAddressMatch(
      "DEX_GUARD.supplyController == SUPPLY_CONTROLLER",
      guardController,
      addresses.SUPPLY_CONTROLLER,
      issues
    );

    const expMinReserveRatioBps = envIntOpt("DEX_GUARD_MIN_RESERVE_RATIO_BPS");
    const expRefillAmount = envTokenOpt("DEX_GUARD_REFILL_AMOUNT");
    const expCooldown = envIntOpt("DEX_GUARD_COOLDOWN_SEC");
    const expAutoRefreshBaseline = envBoolOpt("DEX_GUARD_AUTO_REFRESH_BASELINE");
    const expPriceCheckEnabled = envBoolOpt("DEX_GUARD_PRICE_CHECK_ENABLED");
    const expMaxDeviationBps = envIntOpt("DEX_GUARD_MAX_DEVIATION_BPS");
    const expQuoteOracle = process.env.DEX_GUARD_QUOTE_ORACLE;

    if (expMinReserveRatioBps != null) expectNumberMatch("DEX_GUARD.minReserveRatioBps", minReserveRatioBps, expMinReserveRatioBps, issues);
    if (expRefillAmount != null) expectBigNumberishMatch("DEX_GUARD.refillAmount", refillAmount, expRefillAmount, issues);
    if (expCooldown != null) expectNumberMatch("DEX_GUARD.cooldown", cooldown, expCooldown, issues);
    if (expAutoRefreshBaseline != null) expectBool("DEX_GUARD.autoRefreshBaselineOnRefill", autoRefreshBaseline, expAutoRefreshBaseline, issues);
    if (expPriceCheckEnabled != null) expectBool("DEX_GUARD.priceCheckEnabled", priceCheckEnabled, expPriceCheckEnabled, issues);
    if (expMaxDeviationBps != null) expectNumberMatch("DEX_GUARD.maxPriceDeviationBps", maxPriceDeviationBps, expMaxDeviationBps, issues);
    if (expQuoteOracle && isAddress(expQuoteOracle)) {
      expectAddressMatch("DEX_GUARD.quoteOracle", quoteOracle, expQuoteOracle, issues);
    }
  });

  await section("LIQUIDITY_MANAGER", addresses.LIQUIDITY_MANAGER, requireCode, issues, async () => {
    const lm = viewContract(addresses.LIQUIDITY_MANAGER, [
      "function router() view returns (address)",
      "function factory() view returns (address)",
      "function reserve() view returns (address)",
      "function liquidityVault() view returns (address)",
      "function keeper() view returns (address)",
      "function tokenPct() view returns (uint8)",
      "function slippageBps() view returns (uint256)",
      "function txDeadlineSec() view returns (uint256)",
      "function autoTopUpEnabled() view returns (bool)",
      "function autoTriggerMinPolWei() view returns (uint256)",
      "function autoRequestPolWei() view returns (uint256)",
    ]);
    await safe("LM.router", () => lm.router());
    await safe("LM.factory", () => lm.factory());
    const lmReserve = await safe("LM.reserve", () => lm.reserve());
    const lmVault = await safe("LM.liquidityVault", () => lm.liquidityVault());
    observedLiquidityKeeper = await safe("LM.keeper", () => lm.keeper());
    const lmTokenPct = await safe("LM.tokenPct", () => lm.tokenPct());
    const lmSlippageBps = await safe("LM.slippageBps", () => lm.slippageBps());
    const lmDeadlineSec = await safe("LM.txDeadlineSec", () => lm.txDeadlineSec());
    await safe("LM.autoTopUpEnabled", () => lm.autoTopUpEnabled());
    await safe("LM.autoTriggerMinPolWei", () => lm.autoTriggerMinPolWei());
    await safe("LM.autoRequestPolWei", () => lm.autoRequestPolWei());

    expectAddressMatch("LM.reserve == RESERVE", lmReserve, addresses.RESERVE, issues);
    if (isAddress(addresses.LIQUIDITY_VAULT)) {
      expectAddressMatch("LM.liquidityVault == LIQUIDITY_VAULT", lmVault, addresses.LIQUIDITY_VAULT, issues);
    }

    const expLmTokenPct = envIntOpt("LIQ_TOKEN_PCT");
    const expLmSlippageBps = envIntOpt("LIQ_SLIPPAGE_BPS");
    const expLmDeadlineSec = envIntOpt("LIQ_DEADLINE_SEC");
    if (expLmTokenPct != null) expectNumberMatch("LM.tokenPct", lmTokenPct, expLmTokenPct, issues);
    if (expLmSlippageBps != null) expectNumberMatch("LM.slippageBps", lmSlippageBps, expLmSlippageBps, issues);
    if (expLmDeadlineSec != null) expectNumberMatch("LM.txDeadlineSec", lmDeadlineSec, expLmDeadlineSec, issues);
  });

  await section("LIQUIDITY_VAULT", addresses.LIQUIDITY_VAULT, requireCode, issues, async () => {
    const vault = viewContract(addresses.LIQUIDITY_VAULT, [
      "function liquidityManager() view returns (address)",
    ]);
    const vaultLm = await safe("VAULT.liquidityManager", () => vault.liquidityManager());
    expectAddressMatch("VAULT.liquidityManager == LIQUIDITY_MANAGER", vaultLm, addresses.LIQUIDITY_MANAGER, issues);
  });

  await section("LIQUIDITY_ORCHESTRATOR", addresses.LIQUIDITY_ORCHESTRATOR, requireCode, issues, async () => {
    const orchestrator = viewContract(addresses.LIQUIDITY_ORCHESTRATOR, [
      "function reserve() view returns (address)",
      "function lm() view returns (address)",
      "function keeper() view returns (address)",
      "function minPolPerTx() view returns (uint256)",
      "function maxPolPerTx() view returns (uint256)",
      "function minDexRefillBiggi() view returns (uint256)",
      "function cooldownSec() view returns (uint256)",
      "function dailyQuotaPol() view returns (uint256)",
      "function lastRunTimestamp() view returns (uint256)",
    ]);
    const orchReserve = await safe("ORCH.reserve", () => orchestrator.reserve());
    const orchLm = await safe("ORCH.lm", () => orchestrator.lm());
    observedOrchestratorKeeper = await safe("ORCH.keeper", () => orchestrator.keeper());
    const orchMinPolPerTx = await safe("ORCH.minPolPerTx", () => orchestrator.minPolPerTx());
    const orchMaxPolPerTx = await safe("ORCH.maxPolPerTx", () => orchestrator.maxPolPerTx());
    const orchMinDexRefillBiggi = await safe("ORCH.minDexRefillBiggi", () => orchestrator.minDexRefillBiggi());
    const orchCooldownSec = await safe("ORCH.cooldownSec", () => orchestrator.cooldownSec());
    const orchDailyQuotaPol = await safe("ORCH.dailyQuotaPol", () => orchestrator.dailyQuotaPol());
    await safe("ORCH.lastRunTimestamp", () => orchestrator.lastRunTimestamp());

    expectAddressMatch("ORCH.reserve == RESERVE", orchReserve, addresses.RESERVE, issues);
    expectAddressMatch("ORCH.lm == LIQUIDITY_MANAGER", orchLm, addresses.LIQUIDITY_MANAGER, issues);

    const expOrchMinPolPerTx = envTokenOpt("LIQ_ORCH_MIN_POL_PER_TX");
    const expOrchMaxPolPerTx = envTokenOpt("LIQ_ORCH_MAX_POL_PER_TX");
    const expOrchMinDexRefillBiggi = envTokenOpt("LIQ_ORCH_MIN_DEX_REFILL_BIGGI");
    const expOrchCooldownSec = envIntOpt("LIQ_ORCH_COOLDOWN_SEC");
    const expOrchDailyQuotaPol = envTokenOpt("LIQ_ORCH_DAILY_QUOTA_POL");
    if (expOrchMinPolPerTx != null) expectBigNumberishMatch("ORCH.minPolPerTx", orchMinPolPerTx, expOrchMinPolPerTx, issues);
    if (expOrchMaxPolPerTx != null) expectBigNumberishMatch("ORCH.maxPolPerTx", orchMaxPolPerTx, expOrchMaxPolPerTx, issues);
    if (expOrchMinDexRefillBiggi != null) expectBigNumberishMatch("ORCH.minDexRefillBiggi", orchMinDexRefillBiggi, expOrchMinDexRefillBiggi, issues);
    if (expOrchCooldownSec != null) expectNumberMatch("ORCH.cooldownSec", orchCooldownSec, expOrchCooldownSec, issues);
    if (expOrchDailyQuotaPol != null) expectBigNumberishMatch("ORCH.dailyQuotaPol", orchDailyQuotaPol, expOrchDailyQuotaPol, issues);
  });

  await section("LIQUIDITY_KEEPER_PROXY", addresses.LIQUIDITY_KEEPER_PROXY, requireCode, issues, async () => {
    const keeper = viewContract(addresses.LIQUIDITY_KEEPER_PROXY, [
      "function orchestrator() view returns (address)",
      "function reserve() view returns (address)",
      "function allowedCaller() view returns (address)",
      "function amountMode() view returns (uint8)",
      "function fixedAmount() view returns (uint256)",
      "function percentBps() view returns (uint256)",
      "function minIntervalSec() view returns (uint256)",
      "function minReservePol() view returns (uint256)",
      "function maxPerTx() view returns (uint256)",
      "function minDexRefillBiggi() view returns (uint256)",
      "function lastPerformTs() view returns (uint256)",
      "function paused() view returns (bool)",
    ]);
    const kpOrch = await safe("LKP.orchestrator", () => keeper.orchestrator());
    const kpReserve = await safe("LKP.reserve", () => keeper.reserve());
    await safe("LKP.allowedCaller", () => keeper.allowedCaller());
    const kpAmountMode = await safe("LKP.amountMode", () => keeper.amountMode());
    const kpFixedAmount = await safe("LKP.fixedAmount", () => keeper.fixedAmount());
    const kpPercentBps = await safe("LKP.percentBps", () => keeper.percentBps());
    const kpMinIntervalSec = await safe("LKP.minIntervalSec", () => keeper.minIntervalSec());
    const kpMinReservePol = await safe("LKP.minReservePol", () => keeper.minReservePol());
    const kpMaxPerTx = await safe("LKP.maxPerTx", () => keeper.maxPerTx());
    const kpMinDexRefillBiggi = await safe("LKP.minDexRefillBiggi", () => keeper.minDexRefillBiggi());
    await safe("LKP.lastPerformTs", () => keeper.lastPerformTs());
    await safe("LKP.paused", () => keeper.paused());

    if (isAddress(addresses.LIQUIDITY_ORCHESTRATOR)) {
      expectAddressMatch("LKP.orchestrator == LIQUIDITY_ORCHESTRATOR", kpOrch, addresses.LIQUIDITY_ORCHESTRATOR, issues);
    }
    expectAddressMatch("LKP.reserve == RESERVE", kpReserve, addresses.RESERVE, issues);

    const expKpMode = envIntOpt("LIQ_KEEPER_MODE");
    const expKpFixed = envTokenOpt("LIQ_KEEPER_FIXED_POL");
    const expKpPct = envIntOpt("LIQ_KEEPER_PERCENT_BPS");
    const expKpMinInterval = envIntOpt("LIQ_KEEPER_MIN_INTERVAL_SEC");
    const expKpMinReservePol = envTokenOpt("LIQ_KEEPER_MIN_RESERVE_POL");
    const expKpMaxPerTx = envTokenOpt("LIQ_KEEPER_MAX_PER_TX");
    const expKpMinDexRefillBiggi = envTokenOpt("LIQ_KEEPER_MIN_DEX_REFILL_BIGGI");

    if (expKpMode != null) expectNumberMatch("LKP.amountMode", kpAmountMode, expKpMode, issues);
    if (expKpFixed != null) expectBigNumberishMatch("LKP.fixedAmount", kpFixedAmount, expKpFixed, issues);
    if (expKpPct != null) expectNumberMatch("LKP.percentBps", kpPercentBps, expKpPct, issues);
    if (expKpMinInterval != null) expectNumberMatch("LKP.minIntervalSec", kpMinIntervalSec, expKpMinInterval, issues);
    if (expKpMinReservePol != null) expectBigNumberishMatch("LKP.minReservePol", kpMinReservePol, expKpMinReservePol, issues);
    if (expKpMaxPerTx != null) expectBigNumberishMatch("LKP.maxPerTx", kpMaxPerTx, expKpMaxPerTx, issues);
    if (expKpMinDexRefillBiggi != null) expectBigNumberishMatch("LKP.minDexRefillBiggi", kpMinDexRefillBiggi, expKpMinDexRefillBiggi, issues);
  });

  await section("LIQUIDITY_AUTOMATION", addresses.LIQUIDITY_AUTOMATION, requireCode, issues, async () => {
    const automation = viewContract(addresses.LIQUIDITY_AUTOMATION, [
      "function lm() view returns (address)",
      "function minPolWei() view returns (uint256)",
      "function maxPolWei() view returns (uint256)",
      "function minIntervalSec() view returns (uint256)",
      "function lastUpkeepTime() view returns (uint256)",
    ]);
    const autoLm = await safe("LAUTO.lm", () => automation.lm());
    const autoMinPolWei = await safe("LAUTO.minPolWei", () => automation.minPolWei());
    const autoMaxPolWei = await safe("LAUTO.maxPolWei", () => automation.maxPolWei());
    const autoMinIntervalSec = await safe("LAUTO.minIntervalSec", () => automation.minIntervalSec());
    await safe("LAUTO.lastUpkeepTime", () => automation.lastUpkeepTime());
    expectAddressMatch("LAUTO.lm == LIQUIDITY_MANAGER", autoLm, addresses.LIQUIDITY_MANAGER, issues);

    const expAutoMinPolWei = envTokenOpt("LIQ_AUTO_MIN_POL_WEI");
    const expAutoMaxPolWei = envTokenOpt("LIQ_AUTO_MAX_POL_WEI");
    const expAutoMinIntervalSec = envIntOpt("LIQ_AUTO_MIN_INTERVAL_SEC");
    if (expAutoMinPolWei != null) expectBigNumberishMatch("LAUTO.minPolWei", autoMinPolWei, expAutoMinPolWei, issues);
    if (expAutoMaxPolWei != null) expectBigNumberishMatch("LAUTO.maxPolWei", autoMaxPolWei, expAutoMaxPolWei, issues);
    if (expAutoMinIntervalSec != null) expectNumberMatch("LAUTO.minIntervalSec", autoMinIntervalSec, expAutoMinIntervalSec, issues);
  });

  if (expectedLiquidityPath && !["keeper_proxy", "automation", "none"].includes(expectedLiquidityPath)) {
    issues.push(`EXPECT_LIQUIDITY_PATH invalid: ${expectedLiquidityPath} (use keeper_proxy|automation|none)`);
  }

  const hasKeeperProxy = isAddress(addresses.LIQUIDITY_KEEPER_PROXY);
  const hasAutomation = isAddress(addresses.LIQUIDITY_AUTOMATION);
  const hasLmKeeper = isAddress(observedLiquidityKeeper);
  const hasOrchKeeper = isAddress(observedOrchestratorKeeper);
  const hasOrchestratorAddress = isAddress(addresses.LIQUIDITY_ORCHESTRATOR);

  if (expectedLiquidityPath === "keeper_proxy") {
    expectAddressSet("LIQ_PATH keeper_proxy address", addresses.LIQUIDITY_KEEPER_PROXY, issues);
    if (hasLmKeeper && hasOrchestratorAddress) {
      expectAddressMatch(
        "LIQ_PATH LM.keeper == LIQUIDITY_ORCHESTRATOR",
        observedLiquidityKeeper,
        addresses.LIQUIDITY_ORCHESTRATOR,
        issues
      );
    }
    if (hasOrchKeeper && hasKeeperProxy) {
      expectAddressMatch(
        "LIQ_PATH ORCH.keeper == LIQUIDITY_KEEPER_PROXY",
        observedOrchestratorKeeper,
        addresses.LIQUIDITY_KEEPER_PROXY,
        issues
      );
    }
  } else if (expectedLiquidityPath === "automation") {
    expectAddressSet("LIQ_PATH automation address", addresses.LIQUIDITY_AUTOMATION, issues);
    if (hasLmKeeper && hasAutomation) {
      expectAddressMatch(
        "LIQ_PATH LM.keeper == LIQUIDITY_AUTOMATION",
        observedLiquidityKeeper,
        addresses.LIQUIDITY_AUTOMATION,
        issues
      );
    }
  } else if (expectedLiquidityPath === "none") {
    if (hasLmKeeper) {
      issues.push(`LIQ_PATH expected none, but LM.keeper is set: ${observedLiquidityKeeper}`);
    }
  } else if (strict) {
    if (hasKeeperProxy && !hasAutomation) {
      if (hasLmKeeper && hasOrchestratorAddress) {
        expectAddressMatch(
          "LIQ_PATH(auto) LM.keeper == LIQUIDITY_ORCHESTRATOR",
          observedLiquidityKeeper,
          addresses.LIQUIDITY_ORCHESTRATOR,
          issues
        );
      }
      if (hasOrchKeeper) {
        expectAddressMatch(
          "LIQ_PATH(auto) ORCH.keeper == LIQUIDITY_KEEPER_PROXY",
          observedOrchestratorKeeper,
          addresses.LIQUIDITY_KEEPER_PROXY,
          issues
        );
      }
    }
    if (!hasKeeperProxy && hasAutomation && hasLmKeeper) {
      expectAddressMatch(
        "LIQ_PATH(auto) LM.keeper == LIQUIDITY_AUTOMATION",
        observedLiquidityKeeper,
        addresses.LIQUIDITY_AUTOMATION,
        issues
      );
    }
    if (hasKeeperProxy && hasAutomation) {
      console.log(
        "WARN LIQ_PATH: both LIQUIDITY_KEEPER_PROXY and LIQUIDITY_AUTOMATION are configured. " +
          "Set EXPECT_LIQUIDITY_PATH to enforce one active path."
      );
    }
  }

  await section("DRIP_KEEPER_PROXY", addresses.DRIP_KEEPER_PROXY, requireCode, issues, async () => {
    const dripKeeper = viewContract(addresses.DRIP_KEEPER_PROXY, [
      "function dripLM() view returns (address)",
      "function paused() view returns (bool)",
    ]);
    const dripLm = await safe("DKP.dripLM", () => dripKeeper.dripLM());
    await safe("DKP.paused", () => dripKeeper.paused());
    if (isAddress(addresses.DRIP_LM)) {
      expectAddressMatch("DKP.dripLM == DRIP_LM", dripLm, addresses.DRIP_LM, issues);
    }
  });

  await section("BUYBACK_UPKEEP_PROXY", addresses.BUYBACK_UPKEEP_PROXY, requireCode, issues, async () => {
    const buybackKeeper = viewContract(addresses.BUYBACK_UPKEEP_PROXY, [
      "function agent() view returns (address)",
      "function minNativeThresholdWei() view returns (uint256)",
      "function paused() view returns (bool)",
    ]);
    const agent = await safe("BKP.agent", () => buybackKeeper.agent());
    await safe("BKP.minNativeThresholdWei", () => buybackKeeper.minNativeThresholdWei());
    await safe("BKP.paused", () => buybackKeeper.paused());
    if (isAddress(addresses.BUYBACK_AGENT)) {
      expectAddressMatch("BKP.agent == BUYBACK_AGENT", agent, addresses.BUYBACK_AGENT, issues);
    }
  });

  await section("MULTICALL", addresses.MULTICALL, requireCode, issues, async () => {
    const multicall = viewContract(addresses.MULTICALL, [
      "function aggregate((address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)",
    ]);
    const tokenIface = new ethers.utils.Interface(["function totalSupply() view returns (uint256)"]);
    const reserveIface = new ethers.utils.Interface(["function biggiBalance() view returns (uint256)"]);
    const treasuryIface = new ethers.utils.Interface(["function biggiBalance() view returns (uint256)"]);

    const calls = [];
    const labels = [];

    if (isAddress(addresses.BIGGI_TOKEN)) {
      calls.push({
        target: addresses.BIGGI_TOKEN,
        callData: tokenIface.encodeFunctionData("totalSupply"),
      });
      labels.push("TOKEN.totalSupply");
    }
    if (isAddress(addresses.RESERVE)) {
      calls.push({
        target: addresses.RESERVE,
        callData: reserveIface.encodeFunctionData("biggiBalance"),
      });
      labels.push("RESERVE.biggiBalance");
    }
    if (isAddress(addresses.TREASURY)) {
      calls.push({
        target: addresses.TREASURY,
        callData: treasuryIface.encodeFunctionData("biggiBalance"),
      });
      labels.push("TREASURY.biggiBalance");
    }

    if (calls.length === 0) {
      console.log("MULTICALL: no callable targets configured.");
      return;
    }

    const aggregate = await safe("MULTICALL.aggregate", () => multicall.aggregate(calls));
    if (!aggregate) {
      if (strict) issues.push("MULTICALL.aggregate failed");
      return;
    }

    const returnData = aggregate.returnData || aggregate[1];
    for (let i = 0; i < returnData.length; i++) {
      try {
        let decoded;
        if (labels[i] === "TOKEN.totalSupply") {
          decoded = tokenIface.decodeFunctionResult("totalSupply", returnData[i])[0];
        } else if (labels[i] === "RESERVE.biggiBalance") {
          decoded = reserveIface.decodeFunctionResult("biggiBalance", returnData[i])[0];
        } else {
          decoded = treasuryIface.decodeFunctionResult("biggiBalance", returnData[i])[0];
        }
        console.log(`MULTICALL.decoded[${labels[i]}]:`, decoded);
      } catch (e) {
        const msg = `MULTICALL decode failed for ${labels[i]}: ${e.message}`;
        console.log(msg);
        if (strict) issues.push(msg);
      }
    }
  });

  const ownershipTargets = [
    ["MAIN", addresses.MAIN],
    ["MAIN2", addresses.MAIN2],
    ["TICKET_HUB", addresses.TICKET_HUB],
    ["VRF_ROUTER", addresses.VRF_ROUTER],
    ["REGISTRY", addresses.REGISTRY],
    ["CHAPTER_CONTROLLER", addresses.CHAPTER_CONTROLLER],
    ["DISTRIBUTOR", addresses.DISTRIBUTOR],
    ["COLLECTION_REWARDS", addresses.COLLECTION_REWARDS],
    ["COMMUNITY_CENTER", addresses.COMMUNITY_CENTER],
    ["MODERATOR_CENTER", addresses.MODERATOR_CENTER],
    ["BIGGI_TOKEN", addresses.BIGGI_TOKEN],
    ["RESERVE", addresses.RESERVE],
    ["TREASURY", addresses.TREASURY],
    ["DRIP_DISTRIBUTOR", addresses.DRIP_DISTRIBUTOR],
    ["TOKEN_REWARDS", addresses.TOKEN_REWARDS],
    ["NFT_REWARDS", addresses.NFT_REWARDS],
    ["BUYBACK_AGENT", addresses.BUYBACK_AGENT],
    ["POLICY", addresses.POLICY],
    ["SUPPLY_CONTROLLER", addresses.SUPPLY_CONTROLLER],
    ["SUPPLY_GUARDIAN", addresses.SUPPLY_GUARDIAN],
    ["DEX_RESERVE_GUARD", addresses.DEX_RESERVE_GUARD],
    ["LIQUIDITY_MANAGER", addresses.LIQUIDITY_MANAGER],
    ["LIQUIDITY_VAULT", addresses.LIQUIDITY_VAULT],
    ["LIQUIDITY_ORCHESTRATOR", addresses.LIQUIDITY_ORCHESTRATOR],
    ["LIQUIDITY_KEEPER_PROXY", addresses.LIQUIDITY_KEEPER_PROXY],
    ["LIQUIDITY_AUTOMATION", addresses.LIQUIDITY_AUTOMATION],
    ["DRIP_KEEPER_PROXY", addresses.DRIP_KEEPER_PROXY],
    ["BUYBACK_UPKEEP_PROXY", addresses.BUYBACK_UPKEEP_PROXY],
    ["MASTER_CONFIG", addresses.MASTER_CONFIG],
  ];

  for (const [name, addr] of ownershipTargets) {
    await section(`OWNER_${name}`, addr, requireCode, issues, async () => {
      const c = viewContract(addr, ["function owner() view returns (address)"]);
      const ownerAddr = await safe(`${name}.owner`, () => c.owner());
      if (!isAddress(ownerAddr)) {
        if (strict) issues.push(`${name}.owner invalid or not set`);
        return;
      }
      if (expectedOwner !== ZERO) {
        expectAddressMatch(`${name}.owner == EXPECT_OWNER`, ownerAddr, expectedOwner, issues);
      }
    });
  }

  if (issues.length === 0) {
    console.log("Consistency checks: OK (no mismatches detected).");
    return;
  }

  console.log(`Consistency checks: ${issues.length} issue(s).`);
  issues.forEach((issue, idx) => console.log(`${idx + 1}. ${issue}`));

  if (strict) {
    throw new Error(`Strict consistency check failed with ${issues.length} issue(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
