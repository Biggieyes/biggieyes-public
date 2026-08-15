const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const TOTAL_TICKETS = 550;
const MAIN_BATCH_LIMIT = 55;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envInt(name, fallback) {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return value;
}

function resolveFile(inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function normalizeMetadataItem(raw, index) {
  const idx = Number(raw?.idx ?? raw?.index ?? raw?.nftIndex ?? raw?.id ?? raw?.tokenIndex);
  const background = Number(
    raw?.background ?? raw?.bg ?? raw?.backgroundCode ?? raw?.bgCode ?? raw?.bgIdx
  );
  const blockIdx = Number(raw?.blockIdx ?? raw?.block ?? raw?.blockIndex);
  const mainId = Number(raw?.mainId ?? raw?.mainID ?? raw?.main ?? raw?.main_id);
  const bgCountForBlock = Number.isInteger(blockIdx) && blockIdx >= 1 && blockIdx <= 10 ? (11 - blockIdx) : 0;
  const minMainIdForBlock = Number.isInteger(blockIdx) && blockIdx >= 1 && blockIdx <= 10 ? (((blockIdx - 1) * 10) + 1) : 0;
  const maxMainIdForBlock = Number.isInteger(blockIdx) && blockIdx >= 1 && blockIdx <= 10 ? (blockIdx * 10) : 0;

  if (!Number.isInteger(idx) || idx < 1 || idx > TOTAL_TICKETS) {
    throw new Error(`Metadata item ${index} has invalid idx`);
  }
  if (!Number.isInteger(background) || background < 1 || background > bgCountForBlock) {
    throw new Error(`Metadata item ${index} has invalid background`);
  }
  if (!Number.isInteger(blockIdx) || blockIdx < 1 || blockIdx > 10) {
    throw new Error(`Metadata item ${index} has invalid blockIdx`);
  }
  if (!Number.isInteger(mainId) || mainId < minMainIdForBlock || mainId > maxMainIdForBlock) {
    throw new Error(`Metadata item ${index} has invalid mainId`);
  }

  return { idx, background, blockIdx, mainId };
}

function loadMetadataFile(envName) {
  const file = env(envName);
  if (!file) throw new Error(`${envName} is required`);
  const resolved = resolveFile(file);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${envName} not found: ${resolved}`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
  if (!Array.isArray(list)) {
    throw new Error(`${envName} must be a JSON array or { items: [] }`);
  }

  return list.map((item, index) => normalizeMetadataItem(item, index));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function maybeTx(label, txFactory) {
  const tx = await txFactory();
  const receipt = await tx.wait();
  console.log(`${label}: ${tx.hash}`);
  return receipt;
}

async function configureMainUris(main, prefix, blockCategory) {
  const rewardsBase = env(`${prefix}_REWARDS_BASE_URI`);
  const charactersBase = env(`${prefix}_CHARACTERS_BASE_URI`);
  const overrides = { gasLimit: 500000 };

  if (rewardsBase) {
    await maybeTx("main.setURI(rewards)", () => main.setURI(0, 0, rewardsBase, overrides));
  }
  if (charactersBase) {
    await maybeTx("main.setURI(characters)", () => main.setURI(1, 0, charactersBase, overrides));
  }

  for (let i = 1; i <= 10; i++) {
    const uri = env(`${prefix}_BLOCK_URI_${i}`);
    if (!uri) continue;
    await maybeTx(`main.setURI(block ${i})`, () => main.setURI(blockCategory, i, uri, overrides));
  }
}

async function seedMainMetadata(main, items) {
  for (const [batchIndex, batch] of chunk(items, MAIN_BATCH_LIMIT).entries()) {
    await maybeTx(
      `main.batchSetNFTBackgroundAndBlock batch ${batchIndex + 1}`,
      () =>
        main.batchSetNFTBackgroundAndBlock(
          batch.map((item) => item.idx),
          batch.map((item) => item.background),
          batch.map((item) => item.blockIdx),
          batch.map((item) => item.mainId),
          { gasLimit: 3000000 }
        )
    );
  }
  const metadataConsistency = await main.metadataConsistency();
  console.log(
    "metadataConsistency:",
    metadataConsistency[0].toString(),
    metadataConsistency[1],
    metadataConsistency[2]
  );
  await main.callStatic.assertMetadataConsistency();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const addressesFile = resolveFile(env("OUTPUT_FILE", "./addresses.visibility.polygon.json"));
  const current = readJson(addressesFile, {});

  const namesLib = ethers.utils.getAddress(current.BIGGI_NAMES_LIB || env("BIGGI_NAMES_LIB"));
  const computeAddress = ethers.utils.getAddress(current.COMPUTE || env("COMPUTE"));
  const ticketHubAddress = ethers.utils.getAddress(current.TICKET_HUB || env("TICKET_HUB"));
  const vrfRouterAddress = ethers.utils.getAddress(current.VRF_ROUTER || env("VRF_ROUTER"));
  const pendingRetryDelay = envInt("PENDING_RETRY_DELAY_SEC", 900);
  const metadataItems = loadMetadataFile("MAIN_METADATA_FILE");

  if (!namesLib || namesLib === ZERO) throw new Error("BIGGI_NAMES_LIB missing");
  if (!computeAddress || computeAddress === ZERO) throw new Error("COMPUTE missing");
  if (!ticketHubAddress || ticketHubAddress === ZERO) throw new Error("TICKET_HUB missing");
  if (!vrfRouterAddress || vrfRouterAddress === ZERO) throw new Error("VRF_ROUTER missing");

  const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: namesLib },
  });
  const newMain = await mainFactory.deploy(deployer.address);
  await newMain.deployed();
  console.log(`BiggiEyesMain redeployed: ${newMain.address}`);

  await maybeTx("main.setModules", () => newMain.setModules(computeAddress, vrfRouterAddress, { gasLimit: 500000 }));
  await maybeTx("main.setPendingRetryDelay", () => newMain.setPendingRetryDelay(pendingRetryDelay, { gasLimit: 200000 }));
  await configureMainUris(newMain, "MAIN", 3);
  await seedMainMetadata(newMain, metadataItems);

  const ticketHub = await ethers.getContractAt("BiggiTicketHub", ticketHubAddress);
  const vrfRouter = await ethers.getContractAt("BiggiVRFRouter", vrfRouterAddress);

  await maybeTx("ticketHub.setMainCollection", () => ticketHub.setMainCollection(newMain.address, { gasLimit: 300000 }));
  await maybeTx("main.setTicketHub", () => newMain.setTicketHub(ticketHubAddress, { gasLimit: 300000 }));
  await maybeTx("vrfRouter.setMain", () => vrfRouter.setMain(newMain.address, { gasLimit: 300000 }));

  const unset = await newMain.findUnsetIndices();
  const metadataConsistency = await newMain.metadataConsistency();
  const currentMainFromHub = await ticketHub.mainCollection();
  const currentMainFromVrf = await vrfRouter.main();

  const next = {
    ...current,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    MAIN_PREVIOUS: current.MAIN || ZERO,
    MAIN: newMain.address,
    PENDING_RETRY_DELAY_SEC: pendingRetryDelay,
    MAIN_METADATA_COUNT: metadataItems.length,
    metadataCheck: {
      unsetCount: unset.length,
      configuredCount: metadataConsistency[0].toString(),
      fullyConfigured: metadataConsistency[1],
      rewardMatrixConsistent: metadataConsistency[2],
      rewardsBaseURI: await newMain.rewardsBaseURI(),
      charactersBaseURI: await newMain.charactersBaseURI(),
      block1BaseURI: await newMain.blockBaseURIs(1),
      block10BaseURI: await newMain.blockBaseURIs(10),
    },
    wiringCheck: {
      hubMain: currentMainFromHub,
      vrfMain: currentMainFromVrf,
      compute: await newMain.compute(),
      vrfRouter: await newMain.vrfRouter(),
      ticketHub: await newMain.ticketHub(),
    },
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(addressesFile, JSON.stringify(next, null, 2));
  console.log(`Updated address book: ${addressesFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
