// Idempotently wire one chapter/collection stack into CORE + tokenomics.
//
// Required env:
//   REGISTRY, CHAPTER_CONTROLLER, SERIES_ID, CHAPTER_ID
//   MAIN, MAIN2, TICKET_HUB, DISTRIBUTOR
//   SALE_CAP, MARKETING_CAP
//
// Optional env:
//   BIGGI_TOKEN, RESERVE, TREASURY, COLLECTION_REWARDS, TOKEN_REWARDS,
//   NFT_REWARDS, DRIP_DISTRIBUTOR, DEV_WALLET, MARKETING_SUPPORT
//   TOKEN_REWARDS_VRF=true|false
//   TOKEN_REWARDS_PUBLIC=true|false
//   COLLECTION_REWARDS_VRF=true|false
//
// Default mode is dry-run. Use --execute after reviewing the planned changes.
//
// Example:
//   REGISTRY=0x... CHAPTER_CONTROLLER=0x... SERIES_ID=1 CHAPTER_ID=2 \
//   MAIN=0x... MAIN2=0x... TICKET_HUB=0x... DISTRIBUTOR=0x... \
//   SALE_CAP=275 MARKETING_CAP=275 TREASURY=0x... BIGGI_TOKEN=0x... \
//   npx hardhat run --config hardhat.biggi-master.cjs scripts/master/configureChapterTokenomics.js --network polygon --execute

const hre = require("hardhat");
const { ethers } = hre;

const ZERO = "0x0000000000000000000000000000000000000000";

const ABI = {
  registry: [
    "function getChapterCollections(uint256) view returns (address,address,address)",
    "function getChapterMeta(uint256) view returns (uint256,uint256)",
    "function chapterByCollection(address) view returns (uint256)",
    "function isTokenRewardsCollection(address) view returns (bool)",
    "function isCollectionRewardsCollection(address) view returns (bool)",
    "function setChapterCollections(uint256,address,address,address) external",
    "function setRewardsEligibility(uint256,bool,bool,bool) external",
  ],
  chapterController: [
    "function chapterConfig(uint256) view returns (bool,uint16,uint16,uint16)",
    "function configureChapter(uint256,uint256,address,address,address,uint16,uint16,uint16) external",
    "function isChapterStackConsistent(uint256) view returns (bool)",
    "function isChapterCapConsistent(uint256) view returns (bool)",
  ],
  main: [
    "function ticketHub() view returns (address)",
    "function setTicketHub(address) external",
  ],
  ticketHub: [
    "function mainCollection() view returns (address)",
    "function distributor() view returns (address)",
    "function BIGGI() view returns (address)",
    "function reserveAddress() view returns (address)",
    "function saleCap() view returns (uint16)",
    "function marketingCap() view returns (uint16)",
    "function totalCap() view returns (uint16)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function devWallet() view returns (address)",
    "function setMainCollection(address) external",
    "function setDistributor(address) external",
    "function setBiggiToken(address) external",
    "function setReserveAddress(address) external",
    "function setTicketCaps(uint16,uint16) external",
    "function setTokenSink(address,uint256) external",
    "function setTokenSinkDepositMode(bool) external",
    "function setDevWallet(address) external",
  ],
  main2: [
    "function distributor() view returns (address)",
    "function priceProvider() view returns (address)",
    "function BIGGI() view returns (address)",
    "function reserveAddress() view returns (address)",
    "function chapterController() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function devWallet() view returns (address)",
    "function setDistributor(address) external",
    "function setPriceProvider(address) external",
    "function setBiggiToken(address) external",
    "function setReserveAddress(address) external",
    "function setChapterController(address,uint256) external",
    "function setTokenSink(address,uint256) external",
    "function setTokenSinkDepositMode(bool) external",
    "function setDevWallet(address) external",
  ],
  biggiToken: [
    "function marketingSupportAddr() view returns (address)",
    "function setMarketingSupport(address) external",
  ],
  distributor: [
    "function collections(address) view returns (bool)",
    "function registry() view returns (address)",
    "function addCollection(address) external",
    "function setRegistry(address) external",
  ],
  treasury: [
    "function ecosystemBiggiCallers(address) view returns (bool)",
    "function setEcosystemBiggiCaller(address,bool) external",
  ],
  reserve: [
    "function notifyCallers(address) view returns (bool)",
    "function setNotifyCaller(address,bool) external",
  ],
  rewardsRegistry: [
    "function registry() view returns (address)",
    "function setRegistry(address) external",
  ],
  collectionRewards: [
    "function distributor() view returns (address)",
    "function registry() view returns (address)",
    "function setDistributor(address) external",
    "function setRegistry(address) external",
  ],
  tokenRewards: [
    "function treasure() view returns (address)",
    "function registry() view returns (address)",
    "function setTreasure(address) external",
    "function setRegistry(address) external",
  ],
  nftRewards: [
    "function registry() view returns (address)",
    "function allowedMainCollections(address) view returns (bool)",
    "function setRegistry(address) external",
    "function setAllowedMainCollection(address,bool) external",
  ],
  dripDistributor: [
    "function collections(address) view returns (bool)",
    "function setCollection(address,bool) external",
  ],
};

function usage() {
  console.log("Usage: npx hardhat run --config hardhat.biggi-master.cjs scripts/master/configureChapterTokenomics.js --network <net> [--execute]");
}

function parseArgs(argv) {
  const envExecute = ["1", "true", "yes", "on"].includes(
    String(process.env.CONFIGURE_CHAPTER_EXECUTE || "").toLowerCase()
  );
  const opts = { execute: envExecute };
  for (const arg of argv) {
    if (arg === "--execute") opts.execute = true;
    else if (arg === "--dry-run") opts.execute = false;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return opts;
}

function env(name, required = false) {
  const value = process.env[name];
  if (required && !value) throw new Error(`Missing env var ${name}`);
  return value || "";
}

function envAddress(name, required = false) {
  const value = env(name, required);
  if (!value) return ZERO;
  if (!ethers.utils.isAddress(value)) throw new Error(`${name} is not an address: ${value}`);
  return ethers.utils.getAddress(value);
}

function envUint(name, required = false) {
  const value = env(name, required);
  if (!value) return null;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer: ${value}`);
  return Number(value);
}

function envBool(name, fallback) {
  const value = env(name, false);
  if (!value) return fallback;
  if (["1", "true", "yes", "y"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "n"].includes(value.toLowerCase())) return false;
  throw new Error(`${name} must be boolean-like: ${value}`);
}

function same(a, b) {
  return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function isSet(addr) {
  return ethers.utils.isAddress(addr) && !same(addr, ZERO);
}

function bnToNumber(value) {
  return ethers.BigNumber.from(value).toNumber();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }
  const [signer] = await ethers.getSigners();
  const compromisedOwner = envAddress("COMPROMISED_OWNER_ADDRESS");
  if (opts.execute && isSet(compromisedOwner) && same(signer.address, compromisedOwner)) {
    throw new Error("Refusing chapter configuration transaction from COMPROMISED_OWNER_ADDRESS");
  }
  const A = {
    REGISTRY: envAddress("REGISTRY", true),
    CHAPTER_CONTROLLER: envAddress("CHAPTER_CONTROLLER", true),
    SERIES_ID: envUint("SERIES_ID", true),
    CHAPTER_ID: envUint("CHAPTER_ID", true),
    MAIN: envAddress("MAIN", true),
    MAIN2: envAddress("MAIN2", true),
    TICKET_HUB: envAddress("TICKET_HUB", true),
    DISTRIBUTOR: envAddress("DISTRIBUTOR", true),
    BIGGI_TOKEN: envAddress("BIGGI_TOKEN"),
    RESERVE: envAddress("RESERVE"),
    TREASURY: envAddress("TREASURY"),
    COLLECTION_REWARDS: envAddress("COLLECTION_REWARDS"),
    TOKEN_REWARDS: envAddress("TOKEN_REWARDS"),
    NFT_REWARDS: envAddress("NFT_REWARDS"),
    DRIP_DISTRIBUTOR: envAddress("DRIP_DISTRIBUTOR"),
    DEV_WALLET: envAddress("DEV_WALLET"),
    MARKETING_SUPPORT: envAddress("MARKETING_SUPPORT"),
  };
  const saleCap = envUint("SALE_CAP", true);
  const marketingCap = envUint("MARKETING_CAP", true);
  const totalCap = envUint("TOTAL_CAP") ?? saleCap + marketingCap;
  const eligibility = {
    tokenVrf: envBool("TOKEN_REWARDS_VRF", true),
    tokenPublic: envBool("TOKEN_REWARDS_PUBLIC", true),
    collectionVrf: envBool("COLLECTION_REWARDS_VRF", true),
  };

  if (saleCap + marketingCap !== totalCap) throw new Error("SALE_CAP + MARKETING_CAP must equal TOTAL_CAP");
  for (const [name, value] of Object.entries({ SALE_CAP: saleCap, MARKETING_CAP: marketingCap, TOTAL_CAP: totalCap })) {
    if (value < 0 || value > 65535) throw new Error(`${name} must fit uint16`);
  }

  console.log("Network:", hre.network.name);
  console.log("Signer:", signer.address);
  console.log("Mode:", opts.execute ? "EXECUTE" : "DRY-RUN");
  console.log("Chapter:", A.CHAPTER_ID, "Series:", A.SERIES_ID);

  const registry = new ethers.Contract(A.REGISTRY, ABI.registry, signer);
  const chapter = new ethers.Contract(A.CHAPTER_CONTROLLER, ABI.chapterController, signer);
  const mainCollection = new ethers.Contract(A.MAIN, ABI.main, signer);
  const publicCollection = new ethers.Contract(A.MAIN2, ABI.main2, signer);
  const ticketHub = new ethers.Contract(A.TICKET_HUB, ABI.ticketHub, signer);
  const distributor = new ethers.Contract(A.DISTRIBUTOR, ABI.distributor, signer);
  let plannedChanges = false;

  async function tx(label, factory) {
    if (!opts.execute) {
      plannedChanges = true;
      console.log(`[DRY] ${label}`);
      return;
    }
    console.log(`[TX] ${label}`);
    const sent = await factory();
    console.log(`  hash: ${sent.hash}`);
    await sent.wait();
  }

  async function read(label, fn) {
    try {
      return await fn();
    } catch (e) {
      throw new Error(`${label} read failed: ${e.message}`);
    }
  }

  async function ensureAddress(label, getter, expected, setter) {
    if (!isSet(expected)) return;
    const current = await read(label, getter);
    if (same(current, expected)) {
      console.log(`[OK] ${label}`);
    } else {
      await tx(`${label}: ${current} -> ${expected}`, setter);
    }
  }

  async function ensureBool(label, getter, expected, setter) {
    const current = await read(label, getter);
    if (current === expected) {
      console.log(`[OK] ${label}`);
    } else {
      await tx(`${label}: ${current} -> ${expected}`, setter);
    }
  }

  async function ensureCollection(name, collection) {
    const whitelisted = await read(`${name}.collections`, () => distributor.collections(collection));
    if (whitelisted) {
      console.log(`[OK] ${name}.collections(${collection})`);
    } else {
      await tx(`${name}.addCollection(${collection})`, () => distributor.addCollection(collection));
    }
  }

  async function ensureRegistryMapping() {
    const meta = await read("REGISTRY.getChapterMeta", () => registry.getChapterMeta(A.CHAPTER_ID));
    if (bnToNumber(meta[0]) !== A.SERIES_ID) {
      throw new Error(`REGISTRY chapter ${A.CHAPTER_ID} belongs to series ${meta[0]}, expected ${A.SERIES_ID}`);
    }

    const collections = await read("REGISTRY.getChapterCollections", () => registry.getChapterCollections(A.CHAPTER_ID));
    const empty =
      same(collections[0], ZERO) &&
      same(collections[1], ZERO) &&
      same(collections[2], ZERO);
    const correct =
      same(collections[0], A.MAIN) &&
      same(collections[1], A.MAIN2) &&
      same(collections[2], A.TICKET_HUB);

    if (correct) {
      console.log("[OK] REGISTRY.getChapterCollections");
    } else if (empty) {
      await tx("REGISTRY.setChapterCollections", () =>
        registry.setChapterCollections(A.CHAPTER_ID, A.MAIN, A.MAIN2, A.TICKET_HUB)
      );
      if (!opts.execute) return;
    } else {
      throw new Error(
        `REGISTRY chapter ${A.CHAPTER_ID} already has different collections: ${collections[0]}, ${collections[1]}, ${collections[2]}`
      );
    }

    for (const [label, address] of [
      ["MAIN", A.MAIN],
      ["MAIN2", A.MAIN2],
      ["TICKET_HUB", A.TICKET_HUB],
    ]) {
      const mapped = await read(`REGISTRY.chapterByCollection(${label})`, () => registry.chapterByCollection(address));
      if (bnToNumber(mapped) !== A.CHAPTER_ID) {
        throw new Error(`REGISTRY.chapterByCollection(${label}) is ${mapped}, expected ${A.CHAPTER_ID}`);
      }
    }
  }

  await ensureAddress("MAIN.ticketHub", () => mainCollection.ticketHub(), A.TICKET_HUB, () => mainCollection.setTicketHub(A.TICKET_HUB));
  await ensureAddress("TICKET_HUB.mainCollection", () => ticketHub.mainCollection(), A.MAIN, () => ticketHub.setMainCollection(A.MAIN));
  await ensureAddress("TICKET_HUB.distributor", () => ticketHub.distributor(), A.DISTRIBUTOR, () => ticketHub.setDistributor(A.DISTRIBUTOR));
  await ensureAddress("MAIN2.distributor", () => publicCollection.distributor(), A.DISTRIBUTOR, () => publicCollection.setDistributor(A.DISTRIBUTOR));
  await ensureAddress("MAIN2.priceProvider", () => publicCollection.priceProvider(), A.MAIN, () => publicCollection.setPriceProvider(A.MAIN));

  if (isSet(A.DEV_WALLET)) {
    await ensureAddress("TICKET_HUB.devWallet", () => ticketHub.devWallet(), A.DEV_WALLET, () => ticketHub.setDevWallet(A.DEV_WALLET));
    await ensureAddress("MAIN2.devWallet", () => publicCollection.devWallet(), A.DEV_WALLET, () => publicCollection.setDevWallet(A.DEV_WALLET));
  }

  if (isSet(A.BIGGI_TOKEN)) {
    await ensureAddress("TICKET_HUB.BIGGI", () => ticketHub.BIGGI(), A.BIGGI_TOKEN, () => ticketHub.setBiggiToken(A.BIGGI_TOKEN));
    await ensureAddress("MAIN2.BIGGI", () => publicCollection.BIGGI(), A.BIGGI_TOKEN, () => publicCollection.setBiggiToken(A.BIGGI_TOKEN));
    if (isSet(A.MARKETING_SUPPORT)) {
      const biggiToken = new ethers.Contract(A.BIGGI_TOKEN, ABI.biggiToken, signer);
      await ensureAddress(
        "BIGGI_TOKEN.marketingSupportAddr",
        () => biggiToken.marketingSupportAddr(),
        A.MARKETING_SUPPORT,
        () => biggiToken.setMarketingSupport(A.MARKETING_SUPPORT)
      );
    }
  }
  if (isSet(A.RESERVE)) {
    await ensureAddress("TICKET_HUB.reserveAddress", () => ticketHub.reserveAddress(), A.RESERVE, () => ticketHub.setReserveAddress(A.RESERVE));
    await ensureAddress("MAIN2.reserveAddress", () => publicCollection.reserveAddress(), A.RESERVE, () => publicCollection.setReserveAddress(A.RESERVE));
  }

  const hubSaleCap = bnToNumber(await read("TICKET_HUB.saleCap", () => ticketHub.saleCap()));
  const hubMarketingCap = bnToNumber(await read("TICKET_HUB.marketingCap", () => ticketHub.marketingCap()));
  const hubTotalCap = bnToNumber(await read("TICKET_HUB.totalCap", () => ticketHub.totalCap()));
  if (hubTotalCap !== totalCap) {
    throw new Error(`TICKET_HUB.totalCap is ${hubTotalCap}; expected ${totalCap}. Deploy a hub with the intended total cap.`);
  }
  if (hubSaleCap === saleCap && hubMarketingCap === marketingCap) {
    console.log("[OK] TICKET_HUB caps");
  } else {
    await tx(`TICKET_HUB.setTicketCaps(${saleCap}, ${marketingCap})`, () => ticketHub.setTicketCaps(saleCap, marketingCap));
  }

  await ensureRegistryMapping();

  await ensureBool("REGISTRY.tokenRewards MAIN", () => registry.isTokenRewardsCollection(A.MAIN), eligibility.tokenVrf, () =>
    registry.setRewardsEligibility(A.CHAPTER_ID, eligibility.tokenVrf, eligibility.tokenPublic, eligibility.collectionVrf)
  );
  await ensureBool("REGISTRY.tokenRewards MAIN2", () => registry.isTokenRewardsCollection(A.MAIN2), eligibility.tokenPublic, () =>
    registry.setRewardsEligibility(A.CHAPTER_ID, eligibility.tokenVrf, eligibility.tokenPublic, eligibility.collectionVrf)
  );
  await ensureBool("REGISTRY.collectionRewards MAIN", () => registry.isCollectionRewardsCollection(A.MAIN), eligibility.collectionVrf, () =>
    registry.setRewardsEligibility(A.CHAPTER_ID, eligibility.tokenVrf, eligibility.tokenPublic, eligibility.collectionVrf)
  );

  const cfg = await read("CHAPTER_CONTROLLER.chapterConfig", () => chapter.chapterConfig(A.CHAPTER_ID));
  const cfgOk =
    cfg[0] === true &&
    bnToNumber(cfg[1]) === saleCap &&
    bnToNumber(cfg[2]) === marketingCap &&
    bnToNumber(cfg[3]) === totalCap;
  if (cfgOk) {
    console.log("[OK] CHAPTER_CONTROLLER.chapterConfig");
  } else {
    await tx("CHAPTER_CONTROLLER.configureChapter", () =>
      chapter.configureChapter(A.CHAPTER_ID, A.SERIES_ID, A.MAIN, A.MAIN2, A.TICKET_HUB, saleCap, marketingCap, totalCap)
    );
  }

  await ensureAddress("MAIN2.chapterController", () => publicCollection.chapterController(), A.CHAPTER_CONTROLLER, () =>
    publicCollection.setChapterController(A.CHAPTER_CONTROLLER, A.CHAPTER_ID)
  );
  const configuredChapterId = await read("MAIN2.chapterId", () => publicCollection.chapterId());
  if (bnToNumber(configuredChapterId) === A.CHAPTER_ID) {
    console.log("[OK] MAIN2.chapterId");
  } else {
    await tx("MAIN2.setChapterController(chapterId)", () => publicCollection.setChapterController(A.CHAPTER_CONTROLLER, A.CHAPTER_ID));
  }

  await ensureCollection("DISTRIBUTOR", A.TICKET_HUB);
  await ensureCollection("DISTRIBUTOR", A.MAIN2);
  await ensureCollection("DISTRIBUTOR", A.MAIN);
  await ensureAddress("DISTRIBUTOR.registry", () => distributor.registry(), A.REGISTRY, () => distributor.setRegistry(A.REGISTRY));

  if (isSet(A.TREASURY)) {
    const treasury = new ethers.Contract(A.TREASURY, ABI.treasury, signer);
    await ensureAddress("TICKET_HUB.tokenSink", () => ticketHub.tokenSink(), A.TREASURY, () => ticketHub.setTokenSink(A.TREASURY, 10_000));
    const hubSinkBps = await read("TICKET_HUB.tokenSinkBps", () => ticketHub.tokenSinkBps());
    if (ethers.BigNumber.from(hubSinkBps).eq(10_000)) console.log("[OK] TICKET_HUB.tokenSinkBps");
    else await tx("TICKET_HUB.setTokenSink bps", () => ticketHub.setTokenSink(A.TREASURY, 10_000));
    await ensureBool("TICKET_HUB.tokenSinkDepositMode", () => ticketHub.tokenSinkDepositMode(), true, () => ticketHub.setTokenSinkDepositMode(true));

    await ensureAddress("MAIN2.tokenSink", () => publicCollection.tokenSink(), A.TREASURY, () => publicCollection.setTokenSink(A.TREASURY, 10_000));
    const publicSinkBps = await read("MAIN2.tokenSinkBps", () => publicCollection.tokenSinkBps());
    if (ethers.BigNumber.from(publicSinkBps).eq(10_000)) console.log("[OK] MAIN2.tokenSinkBps");
    else await tx("MAIN2.setTokenSink bps", () => publicCollection.setTokenSink(A.TREASURY, 10_000));
    await ensureBool("MAIN2.tokenSinkDepositMode", () => publicCollection.tokenSinkDepositMode(), true, () => publicCollection.setTokenSinkDepositMode(true));

    await ensureBool("TREASURY.ecosystemBiggiCallers(TICKET_HUB)", () => treasury.ecosystemBiggiCallers(A.TICKET_HUB), true, () =>
      treasury.setEcosystemBiggiCaller(A.TICKET_HUB, true)
    );
    await ensureBool("TREASURY.ecosystemBiggiCallers(MAIN2)", () => treasury.ecosystemBiggiCallers(A.MAIN2), true, () =>
      treasury.setEcosystemBiggiCaller(A.MAIN2, true)
    );
  }

  if (isSet(A.RESERVE)) {
    const reserve = new ethers.Contract(A.RESERVE, ABI.reserve, signer);
    await ensureBool("RESERVE.notifyCallers(TICKET_HUB)", () => reserve.notifyCallers(A.TICKET_HUB), true, () => reserve.setNotifyCaller(A.TICKET_HUB, true));
    await ensureBool("RESERVE.notifyCallers(MAIN2)", () => reserve.notifyCallers(A.MAIN2), true, () => reserve.setNotifyCaller(A.MAIN2, true));
    if (isSet(A.TREASURY)) {
      await ensureBool("RESERVE.notifyCallers(TREASURY)", () => reserve.notifyCallers(A.TREASURY), true, () => reserve.setNotifyCaller(A.TREASURY, true));
    }
  }

  if (isSet(A.COLLECTION_REWARDS)) {
    const collectionRewards = new ethers.Contract(A.COLLECTION_REWARDS, ABI.collectionRewards, signer);
    await ensureAddress("COLLECTION_REWARDS.registry", () => collectionRewards.registry(), A.REGISTRY, () => collectionRewards.setRegistry(A.REGISTRY));
    await ensureAddress("COLLECTION_REWARDS.distributor", () => collectionRewards.distributor(), A.DISTRIBUTOR, () => collectionRewards.setDistributor(A.DISTRIBUTOR));
  }

  if (isSet(A.TOKEN_REWARDS)) {
    const tokenRewards = new ethers.Contract(A.TOKEN_REWARDS, ABI.tokenRewards, signer);
    await ensureAddress("TOKEN_REWARDS.registry", () => tokenRewards.registry(), A.REGISTRY, () => tokenRewards.setRegistry(A.REGISTRY));
    if (isSet(A.TREASURY)) {
      await ensureAddress("TOKEN_REWARDS.treasure", () => tokenRewards.treasure(), A.TREASURY, () => tokenRewards.setTreasure(A.TREASURY));
    }
  }

  if (isSet(A.NFT_REWARDS)) {
    const nftRewards = new ethers.Contract(A.NFT_REWARDS, ABI.nftRewards, signer);
    await ensureAddress("NFT_REWARDS.registry", () => nftRewards.registry(), A.REGISTRY, () => nftRewards.setRegistry(A.REGISTRY));
    await ensureBool("NFT_REWARDS.allowedMainCollections(MAIN2)", () => nftRewards.allowedMainCollections(A.MAIN2), true, () =>
      nftRewards.setAllowedMainCollection(A.MAIN2, true)
    );
  }

  if (isSet(A.DRIP_DISTRIBUTOR)) {
    const drip = new ethers.Contract(A.DRIP_DISTRIBUTOR, ABI.dripDistributor, signer);
    await ensureBool("DRIP_DISTRIBUTOR.collections(MAIN)", () => drip.collections(A.MAIN), true, () => drip.setCollection(A.MAIN, true));
    await ensureBool("DRIP_DISTRIBUTOR.collections(MAIN2)", () => drip.collections(A.MAIN2), true, () => drip.setCollection(A.MAIN2, true));
  }

  if (!opts.execute && plannedChanges) {
    console.log("Dry-run planned changes. Re-run with --execute to submit transactions, then re-run dry-run/checks.");
    return;
  }

  const stackConsistent = await read("CHAPTER_CONTROLLER.isChapterStackConsistent", () => chapter.isChapterStackConsistent(A.CHAPTER_ID));
  const capConsistent = await read("CHAPTER_CONTROLLER.isChapterCapConsistent", () => chapter.isChapterCapConsistent(A.CHAPTER_ID));
  console.log("Final stack consistent:", stackConsistent);
  console.log("Final cap consistent:", capConsistent);
  if (!opts.execute) {
    console.log("Dry-run found no required changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
