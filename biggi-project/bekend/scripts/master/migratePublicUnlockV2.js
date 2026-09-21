const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const EXECUTE = process.env.PUBLIC_UNLOCK_V2_EXECUTE === "1";
const RESUME = process.env.PUBLIC_UNLOCK_V2_RESUME === "1";
const CONFIRMATION = "STAGE_PUBLIC_UNLOCK_AFTER_10_PAID_TICKETS";
const CONFIRMATIONS = Number(process.env.TX_CONFIRMATIONS || 1);
const ORIGINALS_CHAPTER_ID = 1;
const ORIGINALS_UNLOCK_THRESHOLD = 10;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function same(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function requiredAddress(value, label) {
  if (!ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
    throw new Error(`${label} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

async function requireCode(label, address) {
  const code = await ethers.provider.getCode(address);
  if (!code || code === "0x") throw new Error(`${label} has no deployed code: ${address}`);
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(
    env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"),
    "gwei",
  );
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priority = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.constants.Zero;
  const calculatedMaxFee = baseFee.mul(2).add(priority);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priority, maxFeePerGas: maxFee };
}

async function recordTransaction(state, label, transactionPromise) {
  const transaction = await transactionPromise;
  const receipt = await transaction.wait(CONFIRMATIONS);
  state.transactions.push({
    label,
    hash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  });
  state.updatedAt = new Date().toISOString();
  writeJson(state.stateFile, state);
  console.log(`${label}: ${receipt.transactionHash}`);
  return receipt;
}

async function main() {
  const chain = await ethers.provider.getNetwork();
  if (Number(chain.chainId) !== 137) {
    throw new Error(`Polygon mainnet chainId 137 required, received ${chain.chainId}`);
  }

  const root = path.resolve(__dirname, "../..");
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const stateFile = path.join(root, "addresses.public-unlock-v2.resume.polygon.json");
  const reportFile = path.join(root, "reports/public-unlock-v2-migration-polygon.json");
  const book = readJson(addressFile);
  const ownerAddress = requiredAddress(book.OWNER || book.EXPECT_OWNER, "OWNER");
  const deployerAddress = requiredAddress(book.deployer || book.DEPLOYER, "DEPLOYER");
  const registryAddress = requiredAddress(book.REGISTRY, "REGISTRY");
  const ticketHubAddress = requiredAddress(book.TICKET_HUB, "TICKET_HUB");
  const oldControllerAddress = requiredAddress(book.CHAPTER_CONTROLLER, "CHAPTER_CONTROLLER");
  const chapterCount = Number(book.CHAPTER_COUNT || book.chapters?.length || 0);
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error("CHAPTER_COUNT must be positive");
  }

  for (const [label, address] of Object.entries({
    REGISTRY: registryAddress,
    TICKET_HUB: ticketHubAddress,
    OLD_CHAPTER_CONTROLLER: oldControllerAddress,
  })) {
    await requireCode(label, address);
  }

  const registry = new ethers.Contract(
    registryAddress,
    [
      "function getChapterMeta(uint256) view returns(uint256 seriesId,uint256 chapterNumber)",
      "function getChapterCollections(uint256) view returns(address vrfCollection,address publicCollection,address ticketHub)",
    ],
    ethers.provider,
  );
  const oldController = new ethers.Contract(
    oldControllerAddress,
    [
      "function chapterConfig(uint256) view returns(bool exists,uint16 saleCap,uint16 marketingCap,uint16 totalCap)",
      "function isChapterStackConsistent(uint256) view returns(bool)",
    ],
    ethers.provider,
  );
  const ticketHub = new ethers.Contract(
    ticketHubAddress,
    [
      "function chapterSaleCap(uint256) view returns(uint16)",
      "function chapterMarketingCap(uint256) view returns(uint16)",
      "function chapterTotalCap(uint256) view returns(uint16)",
      "function chapterSaleMinted(uint256) view returns(uint16)",
      "function chapterMarketingMinted(uint256) view returns(uint16)",
      "function chapterTotalMinted(uint256) view returns(uint256)",
    ],
    ethers.provider,
  );

  const chapters = [];
  for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
    const [meta, collections, config, stackConsistent, hubValues] = await Promise.all([
      registry.getChapterMeta(chapterId),
      registry.getChapterCollections(chapterId),
      oldController.chapterConfig(chapterId),
      oldController.isChapterStackConsistent(chapterId),
      Promise.all([
        ticketHub.chapterSaleCap(chapterId),
        ticketHub.chapterMarketingCap(chapterId),
        ticketHub.chapterTotalCap(chapterId),
        ticketHub.chapterSaleMinted(chapterId),
        ticketHub.chapterMarketingMinted(chapterId),
        ticketHub.chapterTotalMinted(chapterId),
      ]),
    ]);
    if (!config.exists) throw new Error(`Old controller chapter ${chapterId} is not configured`);
    if (!stackConsistent) throw new Error(`Chapter ${chapterId} stack is inconsistent`);
    if (!same(collections.ticketHub, ticketHubAddress)) {
      throw new Error(`Chapter ${chapterId} uses an unexpected TicketHub`);
    }

    chapters.push({
      chapterId,
      seriesId: Number(meta.seriesId),
      chapterNumber: Number(meta.chapterNumber),
      vrfCollection: collections.vrfCollection,
      publicCollection: collections.publicCollection,
      ticketHub: collections.ticketHub,
      saleCap: Number(config.saleCap),
      marketingCap: Number(config.marketingCap),
      totalCap: Number(config.totalCap),
      unlockThreshold:
        chapterId === ORIGINALS_CHAPTER_ID
          ? ORIGINALS_UNLOCK_THRESHOLD
          : Number(config.saleCap),
      hubSaleCap: Number(hubValues[0]),
      hubMarketingCap: Number(hubValues[1]),
      hubTotalCap: Number(hubValues[2]),
      saleMinted: Number(hubValues[3]),
      marketingMinted: Number(hubValues[4]),
      totalMinted: Number(hubValues[5]),
    });
  }

  const originals = chapters.find((chapter) => chapter.chapterId === ORIGINALS_CHAPTER_ID);
  const publicCollection = new ethers.Contract(
    originals.publicCollection,
    [
      "function owner() view returns(address)",
      "function paused() view returns(bool)",
      "function chapterId() view returns(uint256)",
      "function chapterController() view returns(address)",
      "function setChapterController(address,uint256)",
    ],
    ethers.provider,
  );
  const [publicOwner, publicPaused, publicChapterId, currentController] = await Promise.all([
    publicCollection.owner(),
    publicCollection.paused(),
    publicCollection.chapterId(),
    publicCollection.chapterController(),
  ]);
  if (!same(publicOwner, ownerAddress)) throw new Error("Public Originals owner mismatch");
  if (!publicPaused) throw new Error("Public Originals must remain paused during staging");
  if (!publicChapterId.eq(ORIGINALS_CHAPTER_ID)) throw new Error("Public Originals chapter mismatch");

  const preflight = {
    network: "polygon",
    chainId: 137,
    mode: EXECUTE ? "execute" : "dry-run",
    policy: "unlock Public Originals after 10 paid ticket sales; ignore marketing count",
    owner: ownerAddress,
    deployer: deployerAddress,
    registry: registryAddress,
    ticketHub: ticketHubAddress,
    oldController: oldControllerAddress,
    currentPublicController: currentController,
    publicPaused,
    chapters,
    preservesCurrentLaunchState: true,
    checkedAt: new Date().toISOString(),
  };
  writeJson(reportFile, preflight);
  console.log(JSON.stringify(preflight, null, 2));
  if (!EXECUTE) {
    console.log(`Dry-run passed. No transactions sent. Report: ${reportFile}`);
    return;
  }

  if (env("CONFIRM_PUBLIC_UNLOCK_V2") !== CONFIRMATION) {
    throw new Error(`Set CONFIRM_PUBLIC_UNLOCK_V2=${CONFIRMATION}`);
  }
  const ownerKey = env("OWNER_PRIVATE_KEY");
  const deployerKey = env("DEPLOYER_PRIVATE_KEY", env("PRIVATE_KEY"));
  if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) throw new Error("DEPLOYER_PRIVATE_KEY is missing or invalid");

  const ownerSigner = new ethers.Wallet(ownerKey, ethers.provider);
  const deployerSigner = new ethers.Wallet(deployerKey, ethers.provider);
  if (!same(ownerSigner.address, ownerAddress)) throw new Error("OWNER_PRIVATE_KEY signer mismatch");
  if (!same(deployerSigner.address, deployerAddress)) throw new Error("DEPLOYER_PRIVATE_KEY signer mismatch");

  let state = {
    stateFile,
    status: "starting",
    owner: ownerAddress,
    deployer: deployerAddress,
    registry: registryAddress,
    ticketHub: ticketHubAddress,
    publicCollection: originals.publicCollection,
    oldController: oldControllerAddress,
    controller: null,
    reader: null,
    configuredChapters: [],
    thresholdLocked: false,
    publicBound: false,
    transactions: [],
    startedAt: new Date().toISOString(),
  };
  if (RESUME) {
    if (!fs.existsSync(stateFile)) throw new Error(`Resume state not found: ${stateFile}`);
    state = readJson(stateFile);
    state.stateFile = stateFile;
  } else if (fs.existsSync(stateFile)) {
    throw new Error(`Resume state already exists. Use --resume after reviewing ${stateFile}`);
  }
  writeJson(stateFile, state);

  if (!state.controller) {
    const Controller = await ethers.getContractFactory(
      "BiggiChapterControllerV2",
      deployerSigner,
    );
    const controller = await Controller.deploy(
      ownerAddress,
      registryAddress,
      await feeOverrides(),
    );
    const receipt = await controller.deployTransaction.wait(CONFIRMATIONS);
    state.controller = controller.address;
    state.transactions.push({
      label: "deploy BiggiChapterControllerV2",
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
    state.status = "controller-deployed";
    writeJson(stateFile, state);
    console.log(`BiggiChapterControllerV2: ${controller.address}`);
  }
  await requireCode("NEW_CHAPTER_CONTROLLER", state.controller);

  const controller = (
    await ethers.getContractAt("BiggiChapterControllerV2", state.controller)
  ).connect(ownerSigner);
  for (const chapter of chapters) {
    if (state.configuredChapters.includes(chapter.chapterId)) continue;
    await recordTransaction(
      state,
      `stage chapter ${chapter.chapterId}`,
      controller.stageChapterWithUnlockThreshold(
        chapter.chapterId,
        chapter.seriesId,
        chapter.vrfCollection,
        chapter.publicCollection,
        chapter.ticketHub,
        chapter.saleCap,
        chapter.marketingCap,
        chapter.totalCap,
        chapter.unlockThreshold,
        await feeOverrides(),
      ),
    );
    state.configuredChapters.push(chapter.chapterId);
    writeJson(stateFile, state);
  }

  if (!state.thresholdLocked) {
    await recordTransaction(
      state,
      "lock Originals unlock threshold",
      controller.lockPublicUnlockSaleThreshold(
        ORIGINALS_CHAPTER_ID,
        await feeOverrides(),
      ),
    );
    state.thresholdLocked = true;
    writeJson(stateFile, state);
  }

  if (!state.reader) {
    const Reader = await ethers.getContractFactory("BiggiChapterSeriesReader", deployerSigner);
    const reader = await Reader.deploy(
      state.controller,
      registryAddress,
      await feeOverrides(),
    );
    const receipt = await reader.deployTransaction.wait(CONFIRMATIONS);
    state.reader = reader.address;
    state.transactions.push({
      label: "deploy BiggiChapterSeriesReader",
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
    state.status = "reader-deployed";
    writeJson(stateFile, state);
    console.log(`BiggiChapterSeriesReader: ${reader.address}`);
  }
  await requireCode("NEW_CHAPTER_SERIES_READER", state.reader);

  const currentBinding = await publicCollection.chapterController();
  if (!same(currentBinding, state.controller)) {
    await recordTransaction(
      state,
      "bind Public Originals to ChapterControllerV2",
      publicCollection
        .connect(ownerSigner)
        .setChapterController(state.controller, ORIGINALS_CHAPTER_ID, await feeOverrides()),
    );
  }
  state.publicBound = true;

  const reader = await ethers.getContractAt("BiggiChapterSeriesReader", state.reader);
  const [version, threshold, locked, capConsistent, stackConsistent, unlocked, finalBinding, finalPaused, global] =
    await Promise.all([
      controller.controllerVersion(),
      controller.publicUnlockSaleThreshold(ORIGINALS_CHAPTER_ID),
      controller.publicUnlockThresholdLocked(ORIGINALS_CHAPTER_ID),
      controller.isChapterCapConsistent(ORIGINALS_CHAPTER_ID),
      controller.isChapterStackConsistent(ORIGINALS_CHAPTER_ID),
      controller.isPublicMintUnlocked(ORIGINALS_CHAPTER_ID),
      publicCollection.chapterController(),
      publicCollection.paused(),
      reader.globalSnapshot(),
    ]);

  const checks = {
    controllerV2: version.eq(2),
    originalsThresholdTen: Number(threshold) === ORIGINALS_UNLOCK_THRESHOLD,
    originalsThresholdLocked: Boolean(locked),
    stackConsistent: Boolean(stackConsistent),
    capMismatchStillBlocksDuringTemporaryMode: !capConsistent,
    publicStillLocked: !unlocked,
    publicBoundToV2: same(finalBinding, state.controller),
    publicStillPaused: Boolean(finalPaused),
    readerUsesV2: same(global.controller, state.controller),
    readerUsesRegistry: same(global.registry, registryAddress),
  };
  const failures = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);
  if (failures.length) throw new Error(`Post-deploy verification failed: ${failures.join(", ")}`);

  state.status = "staged";
  state.checks = checks;
  state.completedAt = new Date().toISOString();
  writeJson(stateFile, state);
  writeJson(reportFile, {
    ...preflight,
    result: "staged",
    newController: state.controller,
    newChapterSeriesReader: state.reader,
    checks,
    transactions: state.transactions,
    completedAt: state.completedAt,
  });
  console.log(`Public unlock V2 staged. Report: ${reportFile}`);
  console.log("TicketHub caps and Public pause state were not changed.");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
