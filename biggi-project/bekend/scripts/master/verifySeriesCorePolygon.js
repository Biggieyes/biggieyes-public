const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

const root = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(root, ".env.core.polygon"), override: true });

const ZERO = ethers.constants.AddressZero;
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const report = { network: "polygon", chainId: null, checks: [], issues: [], checkedAt: null };

function sameAddress(a, b) {
  return ethers.utils.isAddress(a || "") && ethers.utils.isAddress(b || "") &&
    ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function record(label, ok, actual, expected) {
  const check = { label, ok, actual: String(actual), expected: String(expected) };
  report.checks.push(check);
  if (!ok) report.issues.push(check);
}

async function read(label, fn) {
  try {
    return await fn();
  } catch (error) {
    record(label, false, error.reason || error.message, "successful read");
    return null;
  }
}

async function optionalRead(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function expectAddress(label, actual, expected) {
  record(label, sameAddress(actual, expected), actual, expected);
}

function expectBool(label, actual, expected) {
  record(label, actual === expected, actual, expected);
}

function expectNumber(label, actual, expected) {
  const value = actual == null ? null : ethers.BigNumber.from(actual).toString();
  record(label, value === String(expected), value, expected);
}

function contract(address, abi) {
  return new ethers.Contract(address, abi, provider);
}

async function main() {
  const addressFile = path.resolve(root, process.env.SERIES_CORE_OUTPUT_FILE || "addresses.core.polygon.json");
  const addresses = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  const network = await provider.getNetwork();
  report.chainId = network.chainId;
  record("Polygon chainId", network.chainId === 137, network.chainId, 137);

  const registry = contract(addresses.REGISTRY, [
    "function seriesCount() view returns (uint256)",
    "function chapterCount() view returns (uint256)",
    "function getChapterMeta(uint256) view returns (uint256,uint256)",
    "function getChapterCollections(uint256) view returns (address,address,address)",
    "function isTokenRewardsCollection(address) view returns (bool)",
    "function isCollectionRewardsCollection(address) view returns (bool)",
  ]);
  const controller = contract(addresses.CHAPTER_CONTROLLER, [
    "function getChapterPriceProvider(uint256) view returns (address)",
    "function isChapterStackConsistent(uint256) view returns (bool)",
    "function isChapterCapConsistent(uint256) view returns (bool)",
  ]);
  const hub = contract(addresses.TICKET_HUB, [
    "function owner() view returns (address)",
    "function ownerOf(uint256) view returns (address)",
    "function balanceOf(address) view returns (uint256)",
    "function chapterMainCollection(uint256) view returns (address)",
    "function chapterTicketBaseURI(uint256) view returns (string)",
    "function chapterActive(uint256) view returns (bool)",
    "function chapterMarketingMinted(uint256) view returns (uint16)",
    "function chapterSaleMinted(uint256) view returns (uint16)",
    "function chapterTicketMinted(uint256) view returns (uint16)",
    "function chapterTicketCount(uint256,address) view returns (uint256)",
    "function ticketRedeemable(uint256) view returns (bool)",
    "function tokenURI(uint256) view returns (string)",
  ]);
  const marketingRecipient = process.env.MARKETING_TICKET_RECIPIENT || addresses.OWNER;
  expectAddress("TicketHub owner", await read("TicketHub.owner", () => hub.owner()), addresses.OWNER);

  expectNumber("Registry series count", await read("Registry.seriesCount", () => registry.seriesCount()), addresses.CHAPTER_COUNT);
  expectNumber("Registry chapter count", await read("Registry.chapterCount", () => registry.chapterCount()), addresses.CHAPTER_COUNT);

  for (const chapter of addresses.chapters) {
    const id = Number(chapter.chapterId);
    const meta = await read(`Chapter ${id} registry meta`, () => registry.getChapterMeta(id));
    const collections = await read(`Chapter ${id} registry collections`, () => registry.getChapterCollections(id));
    if (meta) {
      expectNumber(`Chapter ${id} series id`, meta[0], id);
      expectNumber(`Chapter ${id} number`, meta[1], 1);
    }
    if (collections) {
      expectAddress(`Chapter ${id} registry VRF`, collections[0], chapter.MAIN);
      expectAddress(`Chapter ${id} registry Public`, collections[1], chapter.MAIN2);
      expectAddress(`Chapter ${id} registry TicketHub`, collections[2], addresses.TICKET_HUB);
    }

    expectBool(`Chapter ${id} VRF TokenRewards eligibility`, await read("registry token VRF", () => registry.isTokenRewardsCollection(chapter.MAIN)), true);
    expectBool(`Chapter ${id} Public TokenRewards eligibility`, await read("registry token Public", () => registry.isTokenRewardsCollection(chapter.MAIN2)), true);
    expectBool(`Chapter ${id} VRF CollectionRewards eligibility`, await read("registry collection VRF", () => registry.isCollectionRewardsCollection(chapter.MAIN)), true);
    expectBool(`Chapter ${id} Public CollectionRewards exclusion`, await read("registry collection Public", () => registry.isCollectionRewardsCollection(chapter.MAIN2)), false);

    expectAddress(`Chapter ${id} controller price provider`, await read("controller price provider", () => controller.getChapterPriceProvider(id)), chapter.MAIN);
    expectBool(`Chapter ${id} controller stack consistency`, await read("controller stack", () => controller.isChapterStackConsistent(id)), true);
    expectBool(`Chapter ${id} controller cap consistency`, await read("controller cap", () => controller.isChapterCapConsistent(id)), true);

    expectAddress(`Chapter ${id} hub MAIN`, await read("hub main", () => hub.chapterMainCollection(id)), chapter.MAIN);
    const ticketBaseURI = await read("hub URI", () => hub.chapterTicketBaseURI(id));
    record(`Chapter ${id} ticket metadata URI`, ticketBaseURI === chapter.ticketBaseURI, ticketBaseURI, chapter.ticketBaseURI);
    expectBool(`Chapter ${id} remains inactive`, await read("hub active", () => hub.chapterActive(id)), false);
    expectNumber(`Chapter ${id} marketing minted`, await read("hub marketing", () => hub.chapterMarketingMinted(id)), 50);
    expectNumber(`Chapter ${id} sale minted`, await read("hub sale", () => hub.chapterSaleMinted(id)), 0);
    expectNumber(`Chapter ${id} total tickets minted`, await read("hub total", () => hub.chapterTicketMinted(id)), 50);
    const firstTicketId = ((id - 1) * 550) + 1;
    const lastMarketingTicketId = firstTicketId + 49;
    expectNumber(`Chapter ${id} recipient ticket count`, await read("hub recipient count", () => hub.chapterTicketCount(id, marketingRecipient)), 50);
    expectAddress(`Chapter ${id} first ticket owner`, await read("hub first owner", () => hub.ownerOf(firstTicketId)), marketingRecipient);
    expectAddress(`Chapter ${id} last marketing ticket owner`, await read("hub last owner", () => hub.ownerOf(lastMarketingTicketId)), marketingRecipient);
    expectBool(`Chapter ${id} first ticket redeem locked`, await read("hub redeemable", () => hub.ticketRedeemable(firstTicketId)), false);
    const firstTicketURI = await read("hub tokenURI", () => hub.tokenURI(firstTicketId));
    record(
      `Chapter ${id} first ticket URI`,
      firstTicketURI === `${chapter.ticketBaseURI}Biggi_RANDOM_MINT_TICKET.json`,
      firstTicketURI,
      `${chapter.ticketBaseURI}Biggi_RANDOM_MINT_TICKET.json`
    );

    const mainCollection = contract(chapter.MAIN, [
      "function owner() view returns (address)",
      "function ticketHub() view returns (address)",
      "function chapterId() view returns (uint256)",
      "function getCurrentBlockPrice(uint16) view returns (uint256)",
      "function metadataConsistency() view returns (uint256,bool,bool)",
    ]);
    const publicCollection = contract(chapter.MAIN2, [
      "function owner() view returns (address)",
      "function priceProvider() view returns (address)",
      "function chapterController() view returns (address)",
      "function chapterId() view returns (uint256)",
      "function MAX_SUPPLY() view returns (uint256)",
      "function biggiMinted() view returns (uint16)",
      "function getEffectiveBlockPrice(uint256) view returns (uint256)",
      "function metadataConsistency() view returns (uint256,bool,bool)",
    ]);
    expectAddress(`Chapter ${id} VRF owner`, await read("VRF owner", () => mainCollection.owner()), addresses.OWNER);
    expectAddress(`Chapter ${id} Public owner`, await read("Public owner", () => publicCollection.owner()), addresses.OWNER);
    expectAddress(`Chapter ${id} VRF TicketHub`, await read("VRF hub", () => mainCollection.ticketHub()), addresses.TICKET_HUB);
    const vrfChapterId = id === 1
      ? await optionalRead(() => mainCollection.chapterId())
      : await read("VRF chapter", () => mainCollection.chapterId());
    if (id === 1 && vrfChapterId == null) {
      record("Chapter 1 legacy VRF chapter binding", true, "derived from Registry + TicketHub", "legacy-compatible binding");
    } else {
      expectNumber(`Chapter ${id} VRF chapter id`, vrfChapterId, id);
    }
    expectAddress(`Chapter ${id} Public direct price provider`, await read("Public provider", () => publicCollection.priceProvider()), chapter.MAIN);
    expectAddress(`Chapter ${id} Public controller`, await read("Public controller", () => publicCollection.chapterController()), addresses.CHAPTER_CONTROLLER);
    expectNumber(`Chapter ${id} Public chapter id`, await read("Public chapter", () => publicCollection.chapterId()), id);
    expectNumber(`Chapter ${id} Public max supply`, await read("Public max supply", () => publicCollection.MAX_SUPPLY()), 100);
    expectNumber(`Chapter ${id} Public minted`, await read("Public minted", () => publicCollection.biggiMinted()), 0);
    const vrfPrice = await read("VRF block price", () => mainCollection.getCurrentBlockPrice(1));
    const publicPrice = await read("Public effective block price", () => publicCollection.getEffectiveBlockPrice(1));
    expectNumber(`Chapter ${id} Public price follows VRF`, publicPrice, vrfPrice == null ? "missing" : vrfPrice.toString());

    const vrfMetadata = await read("VRF metadata consistency", () => mainCollection.metadataConsistency());
    const publicMetadata = await read("Public metadata consistency", () => publicCollection.metadataConsistency());
    if (vrfMetadata) {
      expectNumber(`Chapter ${id} VRF metadata count`, vrfMetadata[0], id === 1 ? 550 : 0);
      expectBool(`Chapter ${id} VRF metadata configured`, vrfMetadata[1], id === 1);
    }
    if (publicMetadata) {
      expectNumber(`Chapter ${id} Public metadata count`, publicMetadata[0], 100);
      expectBool(`Chapter ${id} Public metadata configured`, publicMetadata[1], chapter.publicMetadataReady === true);
      expectBool(`Chapter ${id} Public metadata matrix`, publicMetadata[2], true);
    }
  }

  expectNumber("Marketing recipient total TicketHub balance", await read("hub marketing balance", () => hub.balanceOf(marketingRecipient)), addresses.CHAPTER_COUNT * 50);

  const sharedContracts = [
    ["CollectionRewards", process.env.COLLECTION_REWARDS],
    ["TokenRewards", process.env.TOKEN_REWARDS],
    ["NFTRewards", process.env.NFT_REWARDS],
    ["Distributor", process.env.DISTRIBUTOR],
  ];
  for (const [label, address] of sharedContracts) {
    if (!address || !ethers.utils.isAddress(address) || sameAddress(address, ZERO)) continue;
    const shared = contract(address, ["function registry() view returns (address)"]);
    expectAddress(`${label} uses central Registry`, await read(`${label}.registry`, () => shared.registry()), addresses.REGISTRY);
  }

  if (ethers.utils.isAddress(process.env.TOKEN_REWARDS || "")) {
    const tokenRewards = contract(process.env.TOKEN_REWARDS, ["function isAllowedCollection(address) view returns (bool)"]);
    for (const chapter of addresses.chapters) {
      expectBool(`TokenRewards accepts chapter ${chapter.chapterId} VRF`, await read("TokenRewards VRF", () => tokenRewards.isAllowedCollection(chapter.MAIN)), true);
      expectBool(`TokenRewards accepts chapter ${chapter.chapterId} Public`, await read("TokenRewards Public", () => tokenRewards.isAllowedCollection(chapter.MAIN2)), true);
    }
  }
  if (ethers.utils.isAddress(process.env.COLLECTION_REWARDS || "")) {
    const collectionRewards = contract(process.env.COLLECTION_REWARDS, ["function isEligibleCollection(address) view returns (bool)"]);
    for (const chapter of addresses.chapters) {
      expectBool(`CollectionRewards accepts chapter ${chapter.chapterId} VRF`, await read("CollectionRewards VRF", () => collectionRewards.isEligibleCollection(chapter.MAIN)), true);
      expectBool(`CollectionRewards excludes chapter ${chapter.chapterId} Public`, await read("CollectionRewards Public", () => collectionRewards.isEligibleCollection(chapter.MAIN2)), false);
    }
  }

  report.checkedAt = new Date().toISOString();
  const reportFile = path.join(root, "reports", "core-series-verification-polygon.json");
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`CORE series verification: ${report.checks.length - report.issues.length}/${report.checks.length} checks passed`);
  console.log(`Report: ${reportFile}`);
  if (report.issues.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
