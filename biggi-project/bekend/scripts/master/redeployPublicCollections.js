const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const PUBLIC_SUPPLY = 100;
const BATCH_SIZE = 50;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function envInt(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function same(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

function asNumber(value) {
  return ethers.BigNumber.isBigNumber(value) ? value.toNumber() : Number(value);
}

function address(value, label) {
  const raw = String(value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw) || same(raw, ZERO)) throw new Error(`${label} is not a valid non-zero address`);
  return ethers.utils.getAddress(raw.toLowerCase());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function updateAddressBooks(root, addressesFile, book, states, completedAt, blockNumber) {
  const byChapter = new Map(states.map((state) => [Number(state.chapterId), state.newPublic]));
  book.MAIN2 = byChapter.get(1);
  book.chapters = book.chapters.map((chapter) => ({
    ...chapter,
    MAIN2: byChapter.get(Number(chapter.chapterId)) || chapter.MAIN2,
    publicMetadataReady: states.find((state) => Number(state.chapterId) === Number(chapter.chapterId))?.targetUris.every(Boolean) === true,
  }));
  book.publicCollectionsRedeployedAt = completedAt;
  book.publicCollectionsRedeployBlock = blockNumber;
  book.supersededPublicCollections = states.map(({ chapterId, oldPublic }) => ({ chapterId, address: oldPublic }));
  writeJson(addressesFile, book);

  const legacyFile = path.join(root, "addresses.json");
  if (fs.existsSync(legacyFile)) {
    const legacy = readJson(legacyFile);
    legacy.MAIN2 = byChapter.get(1);
    legacy.COLLECTION_PUBLIC = byChapter.get(1);
    for (const [chapterId, publicAddress] of byChapter.entries()) {
      legacy[`CHAPTER_${chapterId}_MAIN2`] = publicAddress;
    }
    legacy.PUBLIC_COLLECTIONS_REDEPLOYED_AT = completedAt;
    legacy.PUBLIC_COLLECTIONS_REDEPLOY_BLOCK = blockNumber;
    writeJson(legacyFile, legacy);
  }
}

function layout() {
  return Array.from({ length: PUBLIC_SUPPLY }, (_, offset) => {
    const idx = offset + 1;
    return { idx, background: 1, blockIdx: Math.floor(offset / 10) + 1, mainId: idx };
  });
}

function chunk(values, size) {
  const groups = [];
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size));
  return groups;
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"), "gwei");
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priorityFee = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const calculatedMaxFee = baseFee.mul(2).add(priorityFee);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee) ? feeData.maxFeePerGas : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee };
}

async function requireCode(label, value) {
  const normalized = address(value, label);
  if ((await ethers.provider.getCode(normalized)) === "0x") throw new Error(`${label} has no Polygon bytecode: ${normalized}`);
  return normalized;
}

async function ownerOf(contractAddress) {
  return new ethers.Contract(contractAddress, ["function owner() view returns (address)"], ethers.provider).owner();
}

function publicUris(chapterId, oldUris) {
  return Array.from({ length: 10 }, (_, index) => {
    const block = index + 1;
    return env(
      `CHAPTER_${chapterId}_PUBLIC_BLOCK_URI_${block}`,
      chapterId === 1 ? env(`PUBLIC_BLOCK_URI_${block}`, oldUris[index]) : oldUris[index]
    );
  });
}

async function main() {
  const execute = env("REDEPLOY_PUBLIC_COLLECTIONS_EXECUTE") === "1";
  const forkRehearsal = network.name === "hardhat" && env("PUBLIC_REDEPLOY_FORK_REHEARSAL") === "1";
  if (forkRehearsal) {
    // Hardhat EDR can reject calls at the exact fork block on custom chains.
    // Mine one local block so all rehearsal calls execute after the fork point.
    await network.provider.send("hardhat_mine", ["0x1"]);
  }
  const confirmations = envInt("TX_CONFIRMATIONS", 2);
  const root = path.resolve(__dirname, "../..");
  const reportFile = path.join(root, "reports", forkRehearsal ? "public-collections-redeploy-fork.json" : "public-collections-redeploy-polygon.json");
  const resumeFile = path.join(root, forkRehearsal ? "addresses.public-redeploy.resume.fork.json" : "addresses.public-redeploy.resume.polygon.json");
  const resumeRequested = env("REDEPLOY_PUBLIC_COLLECTIONS_RESUME") === "1";
  const resumeState = resumeRequested && fs.existsSync(resumeFile)
    ? readJson(resumeFile)
    : { network: forkRehearsal ? "hardhat-fork" : "polygon", chainId: 137, chapters: [] };
  const addressesFile = path.resolve(root, env("MASTER_ADDRESSES_FILE", "addresses.master.json"));
  const book = readJson(addressesFile);
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (chapters.length !== 5) throw new Error(`Expected five chapters, got ${chapters.length}`);

  const chain = await ethers.provider.getNetwork();
  if ((!forkRehearsal && network.name !== "polygon") || chain.chainId !== 137) {
    throw new Error(`Expected Polygon mainnet, got ${network.name} (${chain.chainId})`);
  }

  const required = {
    OWNER: address(book.OWNER, "OWNER"),
    DEPLOYER: address(book.DEPLOYER || book.deployer, "DEPLOYER"),
    REGISTRY: await requireCode("REGISTRY", book.REGISTRY),
    CHAPTER_CONTROLLER: await requireCode("CHAPTER_CONTROLLER", book.CHAPTER_CONTROLLER),
    TICKET_HUB: await requireCode("TICKET_HUB", book.TICKET_HUB),
    BIGGI_NAMES_LIB2: await requireCode("BIGGI_NAMES_LIB2", book.BIGGI_NAMES_LIB2),
    DISTRIBUTOR: await requireCode("DISTRIBUTOR", book.DISTRIBUTOR),
    TREASURY: await requireCode("TREASURY", book.TREASURY),
    RESERVE: await requireCode("RESERVE", book.RESERVE),
    NFT_REWARDS: await requireCode("NFT_REWARDS", book.NFT_REWARDS),
    DRIP_DISTRIBUTOR: await requireCode("DRIP_DISTRIBUTOR", book.DRIP_DISTRIBUTOR),
    TOKEN_REWARDS: await requireCode("TOKEN_REWARDS", book.TOKEN_REWARDS),
    COLLECTION_REWARDS: await requireCode("COLLECTION_REWARDS", book.COLLECTION_REWARDS),
    MASTER_CONFIG: await requireCode("MASTER_CONFIG", book.MASTER_CONFIG),
  };

  const deployerKey = env("DEPLOYER_PRIVATE_KEY");
  const ownerKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) throw new Error("DEPLOYER_PRIVATE_KEY is missing or invalid");
  if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  const deployer = new ethers.Wallet(deployerKey, ethers.provider);
  const owner = new ethers.Wallet(ownerKey, ethers.provider);
  if (!same(deployer.address, required.DEPLOYER)) throw new Error(`Deployer signer mismatch: ${deployer.address}`);
  if (!same(owner.address, required.OWNER)) throw new Error(`Owner signer mismatch: ${owner.address}`);

  const oldAbi = [
    "function owner() view returns (address)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function biggiMinted() view returns (uint16)",
    "function paused() view returns (bool)",
    "function pause()",
    "function distributor() view returns (address)",
    "function priceProvider() view returns (address)",
    "function chapterController() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function devWallet() view returns (address)",
    "function BIGGI() view returns (address)",
    "function biggiPerEth() view returns (uint256)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
    "function reserveAddress() view returns (address)",
    "function rewardsBaseURI() view returns (string)",
    "function charactersBaseURI() view returns (string)",
    "function contractURI() view returns (string)",
    "function blockBaseURIs(uint16) view returns (string)",
  ];
  const registry = new ethers.Contract(required.REGISTRY, [
    "function owner() view returns (address)",
    "function getChapterCollections(uint256) view returns (address,address,address)",
    "function getChapterMeta(uint256) view returns (uint256,uint256)",
    "function setChapterCollections(uint256,address,address,address)",
    "function isTokenRewardsCollection(address) view returns (bool)",
    "function isCollectionRewardsCollection(address) view returns (bool)",
  ], owner);
  const controller = new ethers.Contract(required.CHAPTER_CONTROLLER, [
    "function owner() view returns (address)",
    "function chapterConfig(uint256) view returns (bool,uint16,uint16,uint16)",
    "function configureChapter(uint256,uint256,address,address,address,uint16,uint16,uint16)",
    "function getChapterPriceProvider(uint256) view returns (address)",
  ], owner);
  const hub = new ethers.Contract(required.TICKET_HUB, [
    "function owner() view returns (address)",
    "function chapterActive(uint256) view returns (bool)",
  ], owner);
  const distributor = new ethers.Contract(required.DISTRIBUTOR, [
    "function owner() view returns (address)",
    "function collections(address) view returns (bool)",
    "function pending(address) view returns (uint256)",
    "function addCollection(address)",
    "function removeCollection(address)",
  ], owner);
  const treasury = new ethers.Contract(required.TREASURY, [
    "function owner() view returns (address)",
    "function ecosystemBiggiCallers(address) view returns (bool)",
    "function setEcosystemBiggiCaller(address,bool)",
  ], owner);
  const reserve = new ethers.Contract(required.RESERVE, [
    "function owner() view returns (address)",
    "function notifyCallers(address) view returns (bool)",
    "function setNotifyCaller(address,bool)",
  ], owner);
  const nftRewards = new ethers.Contract(required.NFT_REWARDS, [
    "function owner() view returns (address)",
    "function allowedMainCollections(address) view returns (bool)",
    "function setAllowedMainCollection(address,bool)",
  ], owner);
  const drip = new ethers.Contract(required.DRIP_DISTRIBUTOR, [
    "function owner() view returns (address)",
    "function collections(address) view returns (bool)",
    "function setCollection(address,bool)",
  ], owner);
  const tokenRewards = new ethers.Contract(required.TOKEN_REWARDS, [
    "function isAllowedCollection(address) view returns (bool)",
  ], ethers.provider);
  const collectionRewards = new ethers.Contract(required.COLLECTION_REWARDS, [
    "function isEligibleCollection(address) view returns (bool)",
  ], ethers.provider);
  const masterConfig = new ethers.Contract(required.MASTER_CONFIG, [
    "function owner() view returns (address)",
    "function collections() view returns (address,address,address,address)",
    "function setCollections(address,address,address,address)",
  ], owner);

  const ownerContracts = {
    REGISTRY: registry,
    CHAPTER_CONTROLLER: controller,
    TICKET_HUB: hub,
    DISTRIBUTOR: distributor,
    TREASURY: treasury,
    RESERVE: reserve,
    NFT_REWARDS: nftRewards,
    DRIP_DISTRIBUTOR: drip,
    MASTER_CONFIG: masterConfig,
  };
  const blockers = [];
  for (const [label, contract] of Object.entries(ownerContracts)) {
    const actual = await contract.owner();
    if (!same(actual, required.OWNER)) blockers.push(`${label} owner is ${actual}, expected ${required.OWNER}`);
  }

  const states = [];
  for (const chapter of chapters) {
    const chapterId = Number(chapter.chapterId);
    const vrf = await requireCode(`Chapter ${chapterId} MAIN`, chapter.MAIN);
    const oldPublicAddress = await requireCode(`Chapter ${chapterId} MAIN2`, chapter.MAIN2);
    const oldPublic = new ethers.Contract(oldPublicAddress, oldAbi, owner);
    const [
      registryCollections,
      meta,
      config,
      active,
      oldOwner,
      maxSupply,
      minted,
      paused,
      pending,
      oldUris,
    ] = await Promise.all([
      registry.getChapterCollections(chapterId),
      registry.getChapterMeta(chapterId),
      controller.chapterConfig(chapterId),
      hub.chapterActive(chapterId),
      oldPublic.owner(),
      oldPublic.MAX_SUPPLY(),
      oldPublic.biggiMinted(),
      oldPublic.paused(),
      distributor.pending(oldPublicAddress),
      Promise.all(Array.from({ length: 10 }, (_, index) => oldPublic.blockBaseURIs(index + 1))),
    ]);
    if (active) blockers.push(`Chapter ${chapterId} is active`);
    if (!same(oldOwner, required.OWNER)) blockers.push(`Chapter ${chapterId} Public owner mismatch: ${oldOwner}`);
    if (!ethers.BigNumber.from(minted).isZero()) blockers.push(`Chapter ${chapterId} Public already minted ${minted.toString()} NFTs`);
    if (!ethers.BigNumber.from(pending).isZero()) blockers.push(`Chapter ${chapterId} Public has distributor pending ${pending.toString()}`);
    const resumedChapter = resumeState.chapters.find((item) => Number(item.chapterId) === chapterId);
    const registryPublicMatches = same(registryCollections[1], oldPublicAddress) || (
      resumedChapter?.newPublic && same(registryCollections[1], resumedChapter.newPublic)
    );
    if (!same(registryCollections[0], vrf) || !registryPublicMatches || !same(registryCollections[2], required.TICKET_HUB)) {
      blockers.push(`Chapter ${chapterId} Registry tuple differs from address book`);
    }
    const wiring = await Promise.all([
      oldPublic.distributor(),
      oldPublic.priceProvider(),
      oldPublic.chapterController(),
      oldPublic.chapterId(),
      oldPublic.devWallet(),
      oldPublic.BIGGI(),
      oldPublic.biggiPerEth(),
      oldPublic.tokenSink(),
      oldPublic.tokenSinkBps(),
      oldPublic.tokenSinkDepositMode(),
      oldPublic.reserveAddress(),
      oldPublic.rewardsBaseURI(),
      oldPublic.charactersBaseURI(),
      oldPublic.contractURI(),
    ]);
    if (!same(wiring[1], vrf)) blockers.push(`Chapter ${chapterId} Public priceProvider is ${wiring[1]}, expected ${vrf}`);
    if (!same(wiring[2], required.CHAPTER_CONTROLLER) || asNumber(wiring[3]) !== chapterId) blockers.push(`Chapter ${chapterId} Public controller binding mismatch`);
    states.push({
      chapterId,
      seriesId: asNumber(meta[0]),
      vrf,
      oldPublic: oldPublicAddress,
      maxSupply: maxSupply.toString(),
      minted: minted.toString(),
      distributorPending: pending.toString(),
      paused,
      resume: resumedChapter || null,
      saleCap: asNumber(config[1]),
      marketingCap: asNumber(config[2]),
      totalCap: asNumber(config[3]),
      targetUris: publicUris(chapterId, oldUris),
      wiring: {
        distributor: wiring[0],
        priceProvider: wiring[1],
        devWallet: wiring[4],
        biggi: wiring[5],
        biggiPerEth: wiring[6].toString(),
        tokenSink: wiring[7],
        tokenSinkBps: wiring[8].toString(),
        tokenSinkDepositMode: wiring[9],
        reserve: wiring[10],
        rewardsBaseURI: wiring[11],
        charactersBaseURI: wiring[12],
        contractURI: wiring[13],
      },
      oldAllowlist: {
        distributor: await distributor.collections(oldPublicAddress),
        treasury: await treasury.ecosystemBiggiCallers(oldPublicAddress),
        reserve: await reserve.notifyCallers(oldPublicAddress),
        nftRewards: await nftRewards.allowedMainCollections(oldPublicAddress),
        drip: await drip.collections(oldPublicAddress),
      },
    });
  }

  const main2Factory = (await ethers.getContractFactory("BiggiEyesMain2", {
    libraries: { BiggiNamesLib2: required.BIGGI_NAMES_LIB2 },
  })).connect(deployer);
  const fees = await feeOverrides();
  const deployRequest = main2Factory.getDeployTransaction(required.OWNER);
  const deploymentGasPerContract = await ethers.provider.estimateGas({ ...deployRequest, from: deployer.address });
  const report = {
    checkedAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    mode: execute ? "execute" : "dry-run",
    sourceModel: { publicSupply: PUBLIC_SUPPLY, perBlock: 10, backgroundVariants: false },
    owner: required.OWNER,
    deployer: required.DEPLOYER,
    ownerBalancePol: ethers.utils.formatEther(await owner.getBalance()),
    deployerBalancePol: ethers.utils.formatEther(await deployer.getBalance()),
    maxFeePerGasGwei: ethers.utils.formatUnits(fees.maxFeePerGas, "gwei"),
    deploymentGasPerContract: deploymentGasPerContract.toString(),
    deploymentGasFiveContracts: deploymentGasPerContract.mul(chapters.length).toString(),
    deploymentMaximumCostPol: ethers.utils.formatEther(deploymentGasPerContract.mul(chapters.length).mul(fees.maxFeePerGas)),
    chapters: states,
    blockers,
    transactions: [],
  };
  writeJson(reportFile, report);
  if (blockers.length) throw new Error(`Redeploy preflight blocked: ${blockers.join("; ")}`);
  if (!execute) {
    report.result = "ready-for-explicit-execute";
    writeJson(reportFile, report);
    console.log(JSON.stringify({ result: report.result, chapters: states.length, deploymentMaximumCostPol: report.deploymentMaximumCostPol, report: reportFile }, null, 2));
    return;
  }

  async function send(label, transactionFactory) {
    const tx = await transactionFactory();
    const receipt = await tx.wait(confirmations);
    if (receipt.status !== 1) throw new Error(`${label} failed: ${tx.hash}`);
    report.transactions.push({ label, hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() });
    writeJson(reportFile, report);
    return receipt;
  }

  async function ensureBool(label, read, expected, write) {
    if (Boolean(await read()) !== expected) await send(label, write);
  }

  const deployed = [];
  for (const state of states) {
    let resumeChapter = resumeState.chapters.find((item) => Number(item.chapterId) === state.chapterId);
    if (!resumeChapter) {
      resumeChapter = { chapterId: state.chapterId, oldPublic: state.oldPublic };
      resumeState.chapters.push(resumeChapter);
    }
    let fresh;
    if (resumeRequested && resumeChapter.newPublic && (await ethers.provider.getCode(resumeChapter.newPublic)) !== "0x") {
      fresh = main2Factory.attach(resumeChapter.newPublic).connect(owner);
      console.log(`Chapter ${state.chapterId} Public resumed: ${fresh.address}`);
    } else {
      const deployment = await main2Factory.deploy(required.OWNER, fees);
      console.log(`Chapter ${state.chapterId} Public deploy submitted: ${deployment.deployTransaction.hash}`);
      const deployReceipt = await deployment.deployTransaction.wait(confirmations);
      if (deployReceipt.status !== 1) throw new Error(`Chapter ${state.chapterId} deployment failed`);
      report.transactions.push({ label: `Chapter ${state.chapterId} deploy`, hash: deployment.deployTransaction.hash, blockNumber: deployReceipt.blockNumber, gasUsed: deployReceipt.gasUsed.toString() });
      fresh = deployment.connect(owner);
      resumeChapter.newPublic = fresh.address;
      resumeChapter.deployedAt = new Date().toISOString();
      writeJson(resumeFile, resumeState);
    }
    state.newPublic = fresh.address;
    writeJson(reportFile, report);

    if (!resumeChapter.prepared) {
      if (!(await fresh.paused())) await send(`Chapter ${state.chapterId} new Public pause`, () => fresh.pause(fees));
      await send(`Chapter ${state.chapterId} setDevWallet`, () => fresh.setDevWallet(state.wiring.devWallet, fees));
      await send(`Chapter ${state.chapterId} setPriceProvider`, () => fresh.setPriceProvider(state.vrf, fees));
      if (!same(state.wiring.distributor, ZERO)) await send(`Chapter ${state.chapterId} setDistributor`, () => fresh.setDistributor(state.wiring.distributor, fees));
      if (!same(state.wiring.biggi, ZERO)) await send(`Chapter ${state.chapterId} setBiggiToken`, () => fresh.setBiggiToken(state.wiring.biggi, fees));
      await send(`Chapter ${state.chapterId} setBiggiRate`, () => fresh.setBiggiRate(state.wiring.biggiPerEth, fees));
      if (!same(state.wiring.tokenSink, ZERO)) {
        await send(`Chapter ${state.chapterId} setTokenSink`, () => fresh.setTokenSink(state.wiring.tokenSink, state.wiring.tokenSinkBps, fees));
        if (state.wiring.tokenSinkDepositMode) await send(`Chapter ${state.chapterId} setTokenSinkDepositMode`, () => fresh.setTokenSinkDepositMode(true, fees));
      }
      if (!same(state.wiring.reserve, ZERO)) await send(`Chapter ${state.chapterId} setReserveAddress`, () => fresh.setReserveAddress(state.wiring.reserve, fees));
      if (state.wiring.rewardsBaseURI) await send(`Chapter ${state.chapterId} rewards URI`, () => fresh.setURI(0, 0, state.wiring.rewardsBaseURI, fees));
      if (state.wiring.charactersBaseURI) await send(`Chapter ${state.chapterId} characters URI`, () => fresh.setURI(1, 0, state.wiring.charactersBaseURI, fees));
      for (let index = 0; index < state.targetUris.length; index += 1) {
        if (state.targetUris[index] && (await fresh.blockBaseURIs(index + 1)) !== state.targetUris[index]) {
          await send(`Chapter ${state.chapterId} block ${index + 1} URI`, () => fresh.setURI(2, index + 1, state.targetUris[index], fees));
        }
      }
      if (state.wiring.contractURI) await send(`Chapter ${state.chapterId} contract URI`, () => fresh.setContractURI(state.wiring.contractURI, fees));
      const unset = (await fresh.findUnsetIndices()).map(asNumber);
      const unsetItems = layout().filter((item) => unset.includes(item.idx));
      for (const group of chunk(unsetItems, BATCH_SIZE)) {
        await send(`Chapter ${state.chapterId} seed ${group[0].idx}-${group[group.length - 1].idx}`, () => fresh.batchSetNFTBackgroundAndBlock(
          group.map((item) => item.idx),
          group.map((item) => item.background),
          group.map((item) => item.blockIdx),
          group.map((item) => item.mainId),
          fees
        ));
      }
      resumeChapter.prepared = true;
      resumeChapter.preparedAt = new Date().toISOString();
      writeJson(resumeFile, resumeState);
    }
    deployed.push({ state, contract: fresh, resumeChapter });
  }

  for (const { state, contract: fresh, resumeChapter } of deployed) {
    if (resumeChapter.migrated) continue;
    const oldPublic = new ethers.Contract(state.oldPublic, oldAbi, owner);
    if (!(await oldPublic.paused())) await send(`Chapter ${state.chapterId} old Public pause`, () => oldPublic.pause(fees));
    const currentCollections = await registry.getChapterCollections(state.chapterId);
    if (!same(currentCollections[1], fresh.address)) {
      await send(`Chapter ${state.chapterId} Registry replace Public`, () => registry.setChapterCollections(state.chapterId, state.vrf, fresh.address, required.TICKET_HUB, fees));
    }
    const currentConfig = await controller.chapterConfig(state.chapterId);
    if (
      !currentConfig[0] ||
      asNumber(currentConfig[1]) !== state.saleCap ||
      asNumber(currentConfig[2]) !== state.marketingCap ||
      asNumber(currentConfig[3]) !== state.totalCap
    ) {
      await send(`Chapter ${state.chapterId} Controller reconfigure`, () => controller.configureChapter(
        state.chapterId,
        state.seriesId,
        state.vrf,
        fresh.address,
        required.TICKET_HUB,
        state.saleCap,
        state.marketingCap,
        state.totalCap,
        fees
      ));
    }
    const boundChapter = await fresh.chapterId();
    if (!same(await fresh.chapterController(), required.CHAPTER_CONTROLLER) || !boundChapter.eq(state.chapterId)) {
      await send(`Chapter ${state.chapterId} bind new Public controller`, () => fresh.setChapterController(required.CHAPTER_CONTROLLER, state.chapterId, fees));
    }
    await ensureBool(`Chapter ${state.chapterId} Distributor add new`, () => distributor.collections(fresh.address), true, () => distributor.addCollection(fresh.address, fees));
    await ensureBool(`Chapter ${state.chapterId} Treasury allow new`, () => treasury.ecosystemBiggiCallers(fresh.address), true, () => treasury.setEcosystemBiggiCaller(fresh.address, true, fees));
    await ensureBool(`Chapter ${state.chapterId} Reserve allow new`, () => reserve.notifyCallers(fresh.address), true, () => reserve.setNotifyCaller(fresh.address, true, fees));
    await ensureBool(`Chapter ${state.chapterId} NFTRewards allow new`, () => nftRewards.allowedMainCollections(fresh.address), true, () => nftRewards.setAllowedMainCollection(fresh.address, true, fees));
    await ensureBool(`Chapter ${state.chapterId} Drip allow new`, () => drip.collections(fresh.address), true, () => drip.setCollection(fresh.address, true, fees));
    await ensureBool(`Chapter ${state.chapterId} Distributor remove old`, () => distributor.collections(state.oldPublic), false, () => distributor.removeCollection(state.oldPublic, fees));
    await ensureBool(`Chapter ${state.chapterId} Treasury remove old`, () => treasury.ecosystemBiggiCallers(state.oldPublic), false, () => treasury.setEcosystemBiggiCaller(state.oldPublic, false, fees));
    await ensureBool(`Chapter ${state.chapterId} Reserve remove old`, () => reserve.notifyCallers(state.oldPublic), false, () => reserve.setNotifyCaller(state.oldPublic, false, fees));
    await ensureBool(`Chapter ${state.chapterId} NFTRewards remove old`, () => nftRewards.allowedMainCollections(state.oldPublic), false, () => nftRewards.setAllowedMainCollection(state.oldPublic, false, fees));
    await ensureBool(`Chapter ${state.chapterId} Drip remove old`, () => drip.collections(state.oldPublic), false, () => drip.setCollection(state.oldPublic, false, fees));
    resumeChapter.migrated = true;
    resumeChapter.migratedAt = new Date().toISOString();
    writeJson(resumeFile, resumeState);
  }

  const configCollections = await masterConfig.collections();
  if (!same(configCollections[1], deployed[0].contract.address)) {
    await send("MasterConfig replace chapter-1 Public", () => masterConfig.setCollections(
      configCollections[0],
      deployed[0].contract.address,
      configCollections[2],
      configCollections[3],
      fees
    ));
  }

  for (const { state, contract: fresh } of deployed) {
    const pairedVrf = new ethers.Contract(
      state.vrf,
      ["function getCurrentBlockPrice(uint16) view returns (uint256)"],
      ethers.provider
    );
    const [maxSupply, minted, paused, metadata, registryCollections, provider, boundController, boundChapter, publicPrice, vrfPrice, localBlockInfo] = await Promise.all([
      fresh.MAX_SUPPLY(),
      fresh.biggiMinted(),
      fresh.paused(),
      fresh.metadataConsistency(),
      registry.getChapterCollections(state.chapterId),
      fresh.priceProvider(),
      fresh.chapterController(),
      fresh.chapterId(),
      fresh.getCurrentBlockPrice(1),
      pairedVrf.getCurrentBlockPrice(1),
      fresh.blockInfos(0),
    ]);
    const expectedFullyConfigured = state.targetUris.every(Boolean);
    const valid = maxSupply.eq(PUBLIC_SUPPLY) && asNumber(minted) === 0 && paused && metadata[0].eq(PUBLIC_SUPPLY) && metadata[1] === expectedFullyConfigured && metadata[2] && same(registryCollections[1], fresh.address) && same(provider, state.vrf) && same(boundController, required.CHAPTER_CONTROLLER) && boundChapter.eq(state.chapterId) && publicPrice.gt(0) && publicPrice.eq(vrfPrice) && localBlockInfo.basePrice.eq(0) && localBlockInfo.priceIncrease.eq(0) && localBlockInfo.currentPrice.eq(0) && await distributor.collections(fresh.address) && !(await distributor.collections(state.oldPublic)) && await treasury.ecosystemBiggiCallers(fresh.address) && !(await treasury.ecosystemBiggiCallers(state.oldPublic)) && await reserve.notifyCallers(fresh.address) && !(await reserve.notifyCallers(state.oldPublic)) && await nftRewards.allowedMainCollections(fresh.address) && !(await nftRewards.allowedMainCollections(state.oldPublic)) && await drip.collections(fresh.address) && !(await drip.collections(state.oldPublic)) && await tokenRewards.isAllowedCollection(fresh.address) && !(await collectionRewards.isEligibleCollection(fresh.address));
    if (!valid) throw new Error(`Chapter ${state.chapterId} post-migration verification failed`);
  }

  const totalGasUsed = report.transactions.reduce(
    (sum, transaction) => sum.add(transaction.gasUsed),
    ethers.BigNumber.from(0)
  );
  const deployerGasUsed = report.transactions
    .filter((transaction) => / deploy$/.test(transaction.label))
    .reduce((sum, transaction) => sum.add(transaction.gasUsed), ethers.BigNumber.from(0));
  const ownerGasUsed = totalGasUsed.sub(deployerGasUsed);
  report.gasUsed = {
    total: totalGasUsed.toString(),
    deployer: deployerGasUsed.toString(),
    owner: ownerGasUsed.toString(),
    maximumTotalCostPolAtQuotedMaxFee: ethers.utils.formatEther(totalGasUsed.mul(fees.maxFeePerGas)),
    maximumDeployerCostPolAtQuotedMaxFee: ethers.utils.formatEther(deployerGasUsed.mul(fees.maxFeePerGas)),
    maximumOwnerCostPolAtQuotedMaxFee: ethers.utils.formatEther(ownerGasUsed.mul(fees.maxFeePerGas)),
  };
  report.result = "deployed-wired-paused";
  report.completedAt = new Date().toISOString();
  const lastBlockNumber = report.transactions.reduce(
    (highest, transaction) => Math.max(highest, Number(transaction.blockNumber || 0)),
    0
  );
  if (!forkRehearsal) {
    updateAddressBooks(root, addressesFile, book, states, report.completedAt, lastBlockNumber);
    report.addressBooksUpdated = [addressesFile, path.join(root, "addresses.json")];
  }
  writeJson(reportFile, report);
  console.log(JSON.stringify({ result: report.result, chapters: states.map(({ chapterId, oldPublic, newPublic }) => ({ chapterId, oldPublic, newPublic })), transactions: report.transactions.length, report: reportFile }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
