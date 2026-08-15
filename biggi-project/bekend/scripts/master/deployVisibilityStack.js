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

function envAddr(name) {
  const raw = env(name);
  if (!raw) return ZERO;
  return ethers.utils.getAddress(raw);
}

function envBool(name, fallback = false) {
  const raw = env(name);
  if (!raw) return fallback;
  const lowered = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(lowered)) return true;
  if (["0", "false", "no", "off"].includes(lowered)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
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

function envWei(name, fallback = null) {
  const raw = env(name);
  if (!raw) return fallback;
  return ethers.utils.parseEther(raw);
}

function envHex32(name) {
  const raw = env(name);
  if (!raw) return "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`${name} must be bytes32`);
  }
  return raw;
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
  if (!file) return [];
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

async function deploy(name, args = [], options = undefined) {
  const factory = await ethers.getContractFactory(name, options);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  console.log(`${name}: ${contract.address}`);
  return contract;
}

async function ensureCode(label, addr) {
  if (addr === ZERO) return ZERO;
  const code = await ethers.provider.getCode(addr);
  if (code === "0x") {
    throw new Error(`${label} ${addr} has no code on ${network.name}`);
  }
  return addr;
}

async function maybeTx(txPromiseFactory) {
  const tx = await txPromiseFactory();
  await tx.wait();
}

async function attachExisting(contractName, envName) {
  const existing = envAddr(envName);
  if (existing === ZERO) return null;
  await ensureCode(envName, existing);
  console.log(`${contractName}: ${existing} (existing)`);
  return ethers.getContractAt(contractName, existing);
}

async function attachOrDeploy(contractName, envName, args = [], options = undefined) {
  const existing = await attachExisting(contractName, envName);
  if (existing) return existing;
  return deploy(contractName, args, options);
}

async function configureMainUris(main, prefix, blockCategory) {
  const rewardsBase = env(`${prefix}_REWARDS_BASE_URI`);
  const charactersBase = env(`${prefix}_CHARACTERS_BASE_URI`);

  if (rewardsBase) {
    await maybeTx(() => main.setURI(0, 0, rewardsBase));
  }
  if (charactersBase) {
    await maybeTx(() => main.setURI(1, 0, charactersBase));
  }

  for (let i = 1; i <= 10; i++) {
    const uri = env(`${prefix}_BLOCK_URI_${i}`);
    if (!uri) continue;
    await maybeTx(() => main.setURI(blockCategory, i, uri));
  }
}

async function seedMainMetadata(contract, items) {
  if (!items.length) return;
  const before = await contract.metadataConsistency();
  if (before[1] && before[2]) {
    console.log(`Metadata already fully configured for ${contract.address}; skipping seed.`);
    return;
  }
  for (const batch of chunk(items, MAIN_BATCH_LIMIT)) {
    await maybeTx(() =>
      contract.batchSetNFTBackgroundAndBlock(
        batch.map((item) => item.idx),
        batch.map((item) => item.background),
        batch.map((item) => item.blockIdx),
        batch.map((item) => item.mainId),
      )
    );
  }
  const metadataConsistency = await contract.metadataConsistency();
  if (!metadataConsistency[1] || !metadataConsistency[2]) {
    throw new Error(
      `Metadata consistency failed after seed: configured=${metadataConsistency[0].toString()} fullyConfigured=${metadataConsistency[1]} rewardMatrixConsistent=${metadataConsistency[2]}`
    );
  }
}

async function wireVrfRouter(vrfRouterAddress, mainAddress) {
  const vrfRouter = await ethers.getContractAt("BiggiVRFRouter", vrfRouterAddress);
  const currentMain = await vrfRouter.main();
  if (currentMain.toLowerCase() !== mainAddress.toLowerCase()) {
    await maybeTx(() => vrfRouter.setMain(mainAddress));
  } else {
    const approved = await vrfRouter.approvedMains(mainAddress);
    if (!approved) {
      await maybeTx(() => vrfRouter.setMainApproval(mainAddress, true));
    }
  }
}

function buildOutputFile() {
  const output = env("OUTPUT_FILE");
  if (output) return resolveFile(output);
  return path.resolve(process.cwd(), "addresses.visibility.json");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const saleCap = envInt("SALE_CAP", 500);
  const marketingCap = envInt("MARKETING_CAP", 50);
  if (saleCap + marketingCap !== TOTAL_TICKETS) {
    throw new Error(`SALE_CAP + MARKETING_CAP must equal ${TOTAL_TICKETS}`);
  }

  const configuredDevWallet = envAddr("DEV_WALLET");
  const devWallet = configuredDevWallet === ZERO ? deployer.address : configuredDevWallet;
  const deployPublicBranch = envBool("DEPLOY_PUBLIC_BRANCH", false);
  const seriesName = env("SERIES_NAME", "BIGGI Private Visibility Launch");
  const pendingRetryDelay = envInt("PENDING_RETRY_DELAY_SEC", 900);
  const ticketPrice = envWei("TICKET_PRICE", null);
  const ticketPriceIncreaseBps = envInt("PRICE_INCREASE_PER_MINT_BPS", 10033);
  const distributor = envAddr("DISTRIBUTOR");
  const biggiToken = envAddr("BIGGI_TOKEN");
  const reserveAddress = envAddr("RESERVE_ADDRESS");
  const tokenSink = envAddr("TOKEN_SINK");
  const tokenSinkBps = envInt("TOKEN_SINK_BPS", 10_000);
  const tokenSinkDepositMode = envBool("TOKEN_SINK_DEPOSIT_MODE", false);
  const biggiRate = env("BIGGI_RATE");
  let nftRewards = envAddr("NFT_REWARDS");
  const deployNftRewards = envBool("DEPLOY_NFT_REWARDS", true);
  const deployCollectionRewards = envBool("DEPLOY_COLLECTION_REWARDS", true);
  const deployCoreReaders = envBool("DEPLOY_CORE_READERS", true);
  const deployMainReader = envBool("DEPLOY_MAIN_READER", deployCoreReaders);
  const deployChapterSeriesReader = envBool(
    "DEPLOY_CHAPTER_SERIES_READER",
    deployCoreReaders && deployPublicBranch,
  );
  const deployMultiCollectionReader = envBool(
    "DEPLOY_MULTI_COLLECTION_READER",
    deployCoreReaders && distributor !== ZERO,
  );
  const deployNftRewardsReader = envBool(
    "DEPLOY_NFT_REWARDS_READER",
    deployCoreReaders && (deployNftRewards || nftRewards !== ZERO),
  );

  const namesLib = await attachOrDeploy("BiggiNamesLib", "BIGGI_NAMES_LIB");
  const compute = await attachOrDeploy("BiggiCompute", "COMPUTE");

  let mainCollection = await attachExisting("BiggiEyesMain", "MAIN");
  if (!mainCollection) {
    const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
      libraries: { BiggiNamesLib: namesLib.address },
    });
    mainCollection = await mainFactory.deploy(deployer.address);
    await mainCollection.deployed();
    console.log(`BiggiEyesMain: ${mainCollection.address}`);
  }

  const ticketHub = await attachOrDeploy("BiggiTicketHub", "TICKET_HUB", [
    deployer.address,
    mainCollection.address,
  ]);
  let collectionRewardsAddress = ZERO;
  let collectionRewards = null;
  if (deployCollectionRewards) {
    collectionRewards = await attachOrDeploy("BiggiCollectionRewards", "COLLECTION_REWARDS", [
      mainCollection.address,
      deployer.address,
    ]);
    collectionRewardsAddress = collectionRewards.address;
  }

  let vrfRouterAddress = envAddr("VRF_ROUTER");
  let vrfCoordinatorAddress = ZERO;
  let vrfKeyHash = "";
  let vrfSubId = "";
  if (vrfRouterAddress !== ZERO) {
    vrfRouterAddress = await ensureCode("VRF_ROUTER", vrfRouterAddress);
    vrfCoordinatorAddress = envAddr("VRF_COORDINATOR");
    vrfKeyHash = envHex32("VRF_KEY_HASH");
    vrfSubId = env("VRF_SUB_ID");
  } else {
    const vrfCoordinator = envAddr("VRF_COORDINATOR");
    const keyHash = envHex32("VRF_KEY_HASH");
    const subId = env("VRF_SUB_ID");
    if (vrfCoordinator === ZERO || !keyHash || !subId || !/^\d+$/.test(subId)) {
      throw new Error(
        "Visibility launch requires either existing VRF_ROUTER or full VRF_COORDINATOR + VRF_KEY_HASH + VRF_SUB_ID."
      );
    }
    const vrfRouter = await deploy("BiggiVRFRouter", [
      vrfCoordinator,
      deployer.address,
      keyHash,
      ethers.BigNumber.from(subId),
    ]);
    vrfRouterAddress = vrfRouter.address;
    vrfCoordinatorAddress = vrfCoordinator;
    vrfKeyHash = keyHash;
    vrfSubId = subId;
  }

  await wireVrfRouter(vrfRouterAddress, mainCollection.address);

  await maybeTx(() => mainCollection.setModules(compute.address, vrfRouterAddress));
  await maybeTx(() => mainCollection.setTicketHub(ticketHub.address));
  await maybeTx(() => mainCollection.setPendingRetryDelay(pendingRetryDelay));

  await maybeTx(() => ticketHub.setMainCollection(mainCollection.address));
  await maybeTx(() => ticketHub.setDevWallet(devWallet));
  await maybeTx(() => ticketHub.setTicketCaps(saleCap, marketingCap));
  await maybeTx(() => ticketHub.setPriceIncreasePerMint(ticketPriceIncreaseBps));
  if (ticketPrice != null) {
    await maybeTx(() => ticketHub.setTicketPrice(ticketPrice));
  }
  if (distributor !== ZERO) {
    await maybeTx(() => ticketHub.setDistributor(distributor));
  }
  if (biggiToken !== ZERO) {
    await maybeTx(() => ticketHub.setBiggiToken(biggiToken));
  }
  if (biggiRate) {
    await maybeTx(() => ticketHub.setBiggiRate(ethers.BigNumber.from(biggiRate)));
  }
  if (tokenSink !== ZERO || tokenSinkBps !== 10_000) {
    await maybeTx(() => ticketHub.setTokenSink(tokenSink, tokenSinkBps));
  }
  if (tokenSinkDepositMode) {
    await maybeTx(() => ticketHub.setTokenSinkDepositMode(true));
  }
  if (reserveAddress !== ZERO) {
    await maybeTx(() => ticketHub.setReserveAddress(reserveAddress));
  }
  const ticketBaseUri = env("TICKET_BASE_URI");
  if (ticketBaseUri) {
    await maybeTx(() => ticketHub.setTicketBaseURI(ticketBaseUri));
  } else {
    console.warn("WARN: TICKET_BASE_URI not set. Ticket metadata will be blank until configured.");
  }

  await configureMainUris(mainCollection, "MAIN", 3);
  const mainMetadata = loadMetadataFile("MAIN_METADATA_FILE");
  if (mainMetadata.length) {
    await seedMainMetadata(mainCollection, mainMetadata);
  } else {
    console.warn(
      "WARN: MAIN_METADATA_FILE not set. VRF redeem will revert on MetadataNotInitialized until metadata is seeded."
    );
  }

  let namesLib2Address = ZERO;
  let publicCollectionAddress = ZERO;
  let registryAddress = ZERO;
  let chapterControllerAddress = ZERO;

  if (deployPublicBranch) {
    const namesLib2 = await attachOrDeploy("BiggiNamesLib2", "BIGGI_NAMES_LIB2");
    namesLib2Address = namesLib2.address;
    const registry = await attachOrDeploy("BiggiSeriesRegistry", "REGISTRY", [deployer.address]);
    registryAddress = registry.address;
    const chapterController = await attachOrDeploy("BiggiChapterController", "CHAPTER_CONTROLLER", [
      deployer.address,
      registry.address,
    ]);
    chapterControllerAddress = chapterController.address;
    if (collectionRewards) {
      await maybeTx(() => collectionRewards.setRegistry(registry.address));
    }

    let main2 = await attachExisting("BiggiEyesMain2", "MAIN2");
    if (!main2) {
      const main2Factory = await ethers.getContractFactory("BiggiEyesMain2", {
        libraries: { BiggiNamesLib2: namesLib2.address },
      });
      main2 = await main2Factory.deploy(deployer.address);
      await main2.deployed();
      console.log(`BiggiEyesMain2: ${main2.address}`);
    }
    publicCollectionAddress = main2.address;

    await maybeTx(() => main2.setDevWallet(devWallet));
    await maybeTx(() => main2.setPriceProvider(mainCollection.address));
    if (distributor !== ZERO) {
      await maybeTx(() => main2.setDistributor(distributor));
    }
    if (biggiToken !== ZERO) {
      await maybeTx(() => main2.setBiggiToken(biggiToken));
    }
    if (biggiRate) {
      await maybeTx(() => main2.setBiggiRate(ethers.BigNumber.from(biggiRate)));
    }
    if (tokenSink !== ZERO || tokenSinkBps !== 10_000) {
      await maybeTx(() => main2.setTokenSink(tokenSink, tokenSinkBps));
    }
    if (tokenSinkDepositMode) {
      await maybeTx(() => main2.setTokenSinkDepositMode(true));
    }
    if (reserveAddress !== ZERO) {
      await maybeTx(() => main2.setReserveAddress(reserveAddress));
    }
    const seriesCount = await registry.seriesCount();
    if (seriesCount.isZero()) {
      await maybeTx(() => registry.createSeries(seriesName));
    }
    const chapterCount = await registry.chapterCount();
    if (chapterCount.isZero()) {
      await maybeTx(() => registry.createChapter(1));
    }
    await maybeTx(() =>
      registry.setChapterCollections(1, mainCollection.address, main2.address, ticketHub.address)
    );
    await maybeTx(() =>
      chapterController.configureChapter(
        1,
        1,
        mainCollection.address,
        main2.address,
        ticketHub.address,
        saleCap,
        marketingCap,
        TOTAL_TICKETS,
      )
    );
    await maybeTx(() => main2.setChapterController(chapterController.address, 1));

    await configureMainUris(main2, "PUBLIC", 2);
    const publicMetadata = loadMetadataFile("PUBLIC_METADATA_FILE");
    if (publicMetadata.length) {
      await seedMainMetadata(main2, publicMetadata);
    }
  }

  if (nftRewards !== ZERO) {
    nftRewards = await ensureCode("NFT_REWARDS", nftRewards);
  } else if (deployNftRewards) {
    const nftRewardsContract = await deploy("BiggiNFTRewards", [deployer.address]);
    nftRewards = nftRewardsContract.address;
  }

  if (nftRewards !== ZERO) {
    const nftRewardsContract = await ethers.getContractAt("BiggiNFTRewards", nftRewards);
    try {
      await maybeTx(() => nftRewardsContract.setMainContract(mainCollection.address));
    } catch (e) {
      console.warn(`WARN: NFT_REWARDS.setMainContract skipped: ${e.message}`);
    }
    if (vrfRouterAddress !== ZERO) {
      try {
        await maybeTx(() => nftRewardsContract.setVrfRouter(vrfRouterAddress));
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setVrfRouter skipped: ${e.message}`);
      }
      try {
        const vrfRouter = await ethers.getContractAt("BiggiVRFRouter", vrfRouterAddress);
        await maybeTx(() => vrfRouter.setRewardConsumerApproval(nftRewards, true));
      } catch (e) {
        console.warn(`WARN: VRF_ROUTER.setRewardConsumerApproval skipped: ${e.message}`);
      }
    }
    if (registryAddress !== ZERO) {
      try {
        await maybeTx(() => nftRewardsContract.setRegistry(registryAddress));
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setRegistry skipped: ${e.message}`);
      }
    }
    if (publicCollectionAddress !== ZERO) {
      try {
        await maybeTx(() => nftRewardsContract.setAllowedMainCollection(publicCollectionAddress, true));
      } catch (e) {
        console.warn(`WARN: NFT_REWARDS.setAllowedMainCollection skipped: ${e.message}`);
      }
    }
  }

  let mainReaderAddress = ZERO;
  let multiCollectionReaderAddress = ZERO;
  let chapterSeriesReaderAddress = ZERO;
  let nftRewardsReaderAddress = ZERO;

  if (deployMainReader) {
    const mainReader = await attachOrDeploy("BiggiMainReader", "MAIN_READER", [
      mainCollection.address,
      ticketHub.address,
      collectionRewardsAddress,
    ]);
    mainReaderAddress = mainReader.address;
  }

  if (deployMultiCollectionReader) {
    if (distributor === ZERO) {
      console.warn("WARN: DEPLOY_MULTI_COLLECTION_READER requested but DISTRIBUTOR is not set. Skipping.");
    } else {
      const multiCollectionReader = await attachOrDeploy(
        "BiggiMultiCollectionDistributorReaderV2",
        "MULTI_COLLECTION_READER",
        [distributor],
      );
      multiCollectionReaderAddress = multiCollectionReader.address;
    }
  }

  if (deployChapterSeriesReader) {
    if (chapterControllerAddress === ZERO || registryAddress === ZERO) {
      console.warn("WARN: DEPLOY_CHAPTER_SERIES_READER requested but public branch is not deployed. Skipping.");
    } else {
      const chapterSeriesReader = await attachOrDeploy("BiggiChapterSeriesReader", "CHAPTER_SERIES_READER", [
        chapterControllerAddress,
        registryAddress,
      ]);
      chapterSeriesReaderAddress = chapterSeriesReader.address;
    }
  }

  if (deployNftRewardsReader) {
    if (nftRewards === ZERO) {
      console.warn("WARN: DEPLOY_NFT_REWARDS_READER requested but NFT_REWARDS is not set. Skipping.");
    } else {
      const nftRewardsReader = await attachOrDeploy("BiggiNftRewardsReader", "NFT_REWARDS_READER", [nftRewards]);
      nftRewardsReaderAddress = nftRewardsReader.address;
    }
  }

  const output = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    DEV_WALLET: devWallet,
    DISTRIBUTOR: distributor,
    BIGGI_TOKEN: biggiToken,
    RESERVE_ADDRESS: reserveAddress,
    TOKEN_SINK: tokenSink,
    TOKEN_SINK_BPS: tokenSinkBps,
    TOKEN_SINK_DEPOSIT_MODE: tokenSinkDepositMode,
    BIGGI_RATE: biggiRate || null,
    SALE_CAP: saleCap,
    MARKETING_CAP: marketingCap,
    SERIES_NAME: seriesName,
    COMPUTE: compute.address,
    VRF_ROUTER: vrfRouterAddress,
    VRF_COORDINATOR: vrfCoordinatorAddress,
    VRF_KEY_HASH: vrfKeyHash || null,
    VRF_SUB_ID: vrfSubId || null,
    MAIN: mainCollection.address,
    TICKET_HUB: ticketHub.address,
    COLLECTION_REWARDS: collectionRewardsAddress,
    PENDING_RETRY_DELAY_SEC: pendingRetryDelay,
    TICKET_PRICE_WEI: ticketPrice ? ticketPrice.toString() : null,
    PRICE_INCREASE_PER_MINT_BPS: ticketPriceIncreaseBps,
    MAIN_METADATA_COUNT: mainMetadata.length,
    REGISTRY: registryAddress,
    CHAPTER_CONTROLLER: chapterControllerAddress,
    MAIN2: publicCollectionAddress,
    NFT_REWARDS: nftRewards,
    MAIN_READER: mainReaderAddress,
    MULTI_COLLECTION_READER: multiCollectionReaderAddress,
    CHAPTER_SERIES_READER: chapterSeriesReaderAddress,
    NFT_REWARDS_READER: nftRewardsReaderAddress,
    BIGGI_NAMES_LIB: namesLib.address,
    BIGGI_NAMES_LIB2: namesLib2Address,
    PUBLIC_BRANCH_ENABLED: deployPublicBranch,
    COLLECTION_REWARDS_ENABLED: deployCollectionRewards,
    CORE_READERS_ENABLED: deployCoreReaders,
    createdAt: new Date().toISOString(),
  };

  const outputFile = buildOutputFile();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  if (fs.existsSync(outputFile)) {
    const backupFile = `${outputFile}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(outputFile, backupFile);
    console.log(`Existing visibility addresses backed up to ${backupFile}`);
  }
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`Visibility launch addresses written to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
