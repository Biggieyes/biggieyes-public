const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ZERO = ethers.constants.AddressZero;
const EXECUTE = process.env.MODERATOR_V2_ACTIVATE_EXECUTE === "1";
const CONFIRMATION = "ACTIVATE_MODERATOR_V2_AFTER_LIQUIDITY";
const CONFIRMATIONS = Number(process.env.TX_CONFIRMATIONS || 1);

function requireAddress(name, value) {
  if (!value || !ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${name} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function requireCode(name, address) {
  const code = await ethers.provider.getCode(address);
  if (!code || code === "0x") throw new Error(`${name} has no code: ${address}`);
}

async function waitFor(tx, label, report) {
  const receipt = await tx.wait(CONFIRMATIONS);
  report.transactions.push({ label, hash: tx.hash, blockNumber: receipt.blockNumber });
  console.log(`${label}: ${tx.hash}`);
}

async function sendIfDifferent(label, current, expected, send, report) {
  if (String(current).toLowerCase() === String(expected).toLowerCase()) return;
  await waitFor(await send(), label, report);
}

async function main() {
  const backendRoot = path.resolve(__dirname, "../..");
  const addressesFile = path.resolve(
    backendRoot,
    process.env.MASTER_ADDRESSES_FILE || "addresses.master.json",
  );
  const deploymentFile = path.resolve(
    backendRoot,
    process.env.MODERATOR_V2_DEPLOYMENT_REPORT ||
      "reports/moderator-v2-deployment-polygon.json",
  );
  const addresses = readJson(addressesFile);
  const deployment = readJson(deploymentFile);
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);

  const ownerAddress = requireAddress(
    "OWNER",
    process.env.EXPECT_OWNER || process.env.OWNER || addresses.EXPECT_OWNER || addresses.OWNER,
  );
  const moderatorAddress = requireAddress(
    "MODERATOR_CENTER_V2",
    process.env.MODERATOR_CENTER_V2 || deployment.moderatorCenterV2,
  );
  const dripAddress = requireAddress(
    "DRIP_LM_V2",
    process.env.DRIP_LM_V2 || deployment.dripLMV2,
  );
  const distributorAddress = requireAddress("DRIP_DISTRIBUTOR", addresses.DRIP_DISTRIBUTOR);
  const buybackAddress = requireAddress("BUYBACK_AGENT", addresses.BUYBACK_AGENT);
  const tokenAddress = requireAddress("BIGGI_TOKEN", addresses.BIGGI_TOKEN);
  const reserveAddress = requireAddress("RESERVE", addresses.RESERVE);
  const routerAddress = requireAddress(
    "BUYBACK_ROUTER",
    addresses.BUYBACK_ROUTER || addresses.ROUTER,
  );
  const pairAddress = requireAddress("PAIR", addresses.PAIR);
  const quoteAddress = requireAddress("QUOTE_TOKEN/WPOL", addresses.QUOTE_TOKEN || addresses.WPOL);
  const oldDripAddress = requireAddress("OLD_DRIP_LM", addresses.DRIP_LM);
  const chapterCount = Number(addresses.CHAPTER_COUNT || addresses.chapters?.length || 0);

  for (const [name, address] of Object.entries({
    MODERATOR_CENTER_V2: moderatorAddress,
    DRIP_LM_V2: dripAddress,
    DRIP_DISTRIBUTOR: distributorAddress,
    BUYBACK_AGENT: buybackAddress,
    BIGGI_TOKEN: tokenAddress,
    RESERVE: reserveAddress,
    BUYBACK_ROUTER: routerAddress,
    PAIR: pairAddress,
    QUOTE_TOKEN: quoteAddress,
  })) {
    await requireCode(name, address);
  }

  const moderator = await ethers.getContractAt("ModeratorCenterV2", moderatorAddress);
  const drip = await ethers.getContractAt("BiggiDripLMToModeratorV2", dripAddress);
  const distributor = new ethers.Contract(
    distributorAddress,
    [
      "function owner() view returns (address)",
      "function dripLM() view returns (address)",
      "function tokensPerMintOperator() view returns (address)",
      "function setDripLM(address)",
      "function setTokensPerMintOperator(address)",
    ],
    ethers.provider,
  );
  const buyback = new ethers.Contract(
    buybackAddress,
    [
      "function owner() view returns (address)",
      "function dripLM() view returns (address)",
      "function setDripLM(address)",
    ],
    ethers.provider,
  );
  const pair = new ethers.Contract(
    pairAddress,
    [
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)",
    ],
    ethers.provider,
  );
  const router = new ethers.Contract(
    routerAddress,
    ["function WETH() view returns (address)", "function factory() view returns (address)"],
    ethers.provider,
  );

  const [
    moderatorOwner,
    dripOwner,
    moderatorPaused,
    dripPaused,
    allocator,
    configuredDistributor,
    configuredReserve,
    configuredBuyback,
    configuredModerator,
    configuredRouter,
    pendingReserve,
    pendingModerator,
    milestoneLocked,
    operationallyReady,
    registeredChapterCount,
    leaderCoefBps,
    moderatorCoefBps,
    saleBoostBpsPerTicket,
    globalUniquePerWeek,
    milestone100,
    milestone500,
    milestone1000,
    distributorOwner,
    buybackOwner,
    currentDistributorDrip,
    currentOperator,
    currentBuybackDrip,
    token0,
    token1,
    reserves,
    routerQuote,
    routerFactory,
  ] = await Promise.all([
    moderator.owner(),
    drip.owner(),
    moderator.paused(),
    drip.paused(),
    moderator.multiCollection(),
    drip.dripDistributor(),
    drip.reserve(),
    drip.buybackAgent(),
    drip.moderatorCenter(),
    drip.router(),
    drip.pendingReserveNative(),
    drip.pendingModeratorNative(),
    moderator.milestoneConfigLocked(),
    moderator.operationallyReady(),
    moderator.registeredChapterCount(),
    moderator.leaderCoefBps(),
    moderator.moderatorCoefBps(),
    moderator.saleBoostBpsPerTicket(),
    moderator.globalUniquePerWeek(),
    moderator.milestone100(),
    moderator.milestone500(),
    moderator.milestone1000(),
    distributor.owner(),
    buyback.owner(),
    distributor.dripLM(),
    distributor.tokensPerMintOperator(),
    buyback.dripLM(),
    pair.token0(),
    pair.token1(),
    pair.getReserves(),
    router.WETH(),
    router.factory(),
  ]);

  for (const [name, actual] of Object.entries({
    moderatorOwner,
    dripOwner,
    distributorOwner,
    buybackOwner,
  })) {
    if (actual.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error(`${name} ${actual} does not match expected owner ${ownerAddress}`);
    }
  }
  if (allocator.toLowerCase() !== dripAddress.toLowerCase()) {
    throw new Error("ModeratorCenterV2 allocator mismatch");
  }
  for (const [name, actual, expected] of [
    ["dripDistributor", configuredDistributor, distributorAddress],
    ["reserve", configuredReserve, reserveAddress],
    ["buybackAgent", configuredBuyback, buybackAddress],
    ["moderatorCenter", configuredModerator, moderatorAddress],
    ["router", configuredRouter, routerAddress],
  ]) {
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`DripV2 ${name} mismatch: ${actual} != ${expected}`);
    }
  }
  if (!pendingReserve.eq(0) || !pendingModerator.eq(0)) {
    throw new Error("DripV2 has pending native balances");
  }
  if (!milestoneLocked) {
    throw new Error("Milestone configuration is not locked");
  }
  if (!operationallyReady) {
    throw new Error("ModeratorCenterV2 is not operationally ready");
  }

  const preserved = deployment.preservedParameters || {};
  for (const [name, actual, expected] of [
    ["leaderCoefBps", leaderCoefBps, preserved.leaderCoefBps],
    ["moderatorCoefBps", moderatorCoefBps, preserved.moderatorCoefBps],
    ["saleBoostBpsPerTicket", saleBoostBpsPerTicket, preserved.saleBoostBpsPerTicket],
    ["milestone100", milestone100, preserved.milestone100],
    ["milestone500", milestone500, preserved.milestone500],
    ["milestone1000", milestone1000, preserved.milestone1000],
  ]) {
    if (expected !== undefined && !actual.eq(ethers.BigNumber.from(expected))) {
      throw new Error(`${name} ${actual.toString()} does not match preserved value ${expected}`);
    }
  }
  if (
    preserved.globalUniquePerWeek !== undefined &&
    globalUniquePerWeek !== preserved.globalUniquePerWeek
  ) {
    throw new Error("globalUniquePerWeek does not match the preserved value");
  }

  let enabledSlots = 0;
  let leaders = 0;
  const slots = [];
  for (let slotId = 0; slotId < 10; slotId += 1) {
    const slot = await moderator.slots(slotId);
    const enabled = Boolean(slot.enabled ?? slot[0]);
    const isLeader = Boolean(slot.isLeader ?? slot[1]);
    const payout = slot.payout ?? slot[2];
    const referralHash = slot.referralHash ?? slot[4];
    if (enabled) {
      enabledSlots += 1;
      if (isLeader) leaders += 1;
      if (payout === ZERO || referralHash === ethers.constants.HashZero) {
        throw new Error(`Enabled slot ${slotId} is incomplete`);
      }
    }
    slots.push({ slotId, enabled, isLeader, payout, referralHash });
  }
  if (enabledSlots < 1 || leaders !== 1) {
    throw new Error(`Expected at least one enabled slot and exactly one leader; got ${enabledSlots}/${leaders}`);
  }

  for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
    const chapter = await moderator.registeredChapters(chapterId);
    if (!(chapter.registered ?? chapter[0])) {
      throw new Error(`Chapter ${chapterId} is not registered in ModeratorCenterV2`);
    }
  }
  if (!registeredChapterCount.eq(chapterCount)) {
    throw new Error(
      `Expected ${chapterCount} registered chapters, got ${registeredChapterCount.toString()}`,
    );
  }

  if (routerQuote.toLowerCase() !== quoteAddress.toLowerCase()) {
    throw new Error(`Router WETH ${routerQuote} does not match quote token ${quoteAddress}`);
  }
  await requireCode("BUYBACK_FACTORY", routerFactory);
  const factory = new ethers.Contract(
    routerFactory,
    ["function getPair(address,address) view returns (address)"],
    ethers.provider,
  );
  const factoryPair = await factory.getPair(tokenAddress, quoteAddress);
  if (factoryPair.toLowerCase() !== pairAddress.toLowerCase()) {
    throw new Error(`Factory pair ${factoryPair} does not match configured PAIR ${pairAddress}`);
  }

  const normalizedToken0 = token0.toLowerCase();
  const normalizedToken1 = token1.toLowerCase();
  if (
    ![normalizedToken0, normalizedToken1].includes(tokenAddress.toLowerCase()) ||
    ![normalizedToken0, normalizedToken1].includes(quoteAddress.toLowerCase())
  ) {
    throw new Error("PAIR is not the expected BIGGI/quote pair");
  }
  const biggiReserve =
    normalizedToken0 === tokenAddress.toLowerCase() ? reserves.reserve0 : reserves.reserve1;
  const quoteReserve =
    normalizedToken0 === quoteAddress.toLowerCase() ? reserves.reserve0 : reserves.reserve1;
  if (biggiReserve.eq(0) || quoteReserve.eq(0)) {
    throw new Error("DEX liquidity is empty; Moderator V2 activation is blocked");
  }

  const allowedPreActivationDrips = new Set([
    oldDripAddress.toLowerCase(),
    dripAddress.toLowerCase(),
  ]);
  for (const [name, value] of [
    ["DripDistributor.dripLM", currentDistributorDrip],
    ["DripDistributor.tokensPerMintOperator", currentOperator],
    ["BuybackAgent.dripLM", currentBuybackDrip],
  ]) {
    if (!allowedPreActivationDrips.has(value.toLowerCase())) {
      throw new Error(`${name} points to unexpected address ${value}`);
    }
  }

  const preflight = {
    mode: EXECUTE ? "execute" : "dry-run",
    network: network.name,
    chainId: chain.chainId,
    owner: ownerAddress,
    moderatorCenterV2: moderatorAddress,
    dripLMV2: dripAddress,
    paused: { moderator: moderatorPaused, drip: dripPaused },
    slots: { enabled: enabledSlots, leaders, values: slots },
    milestoneLocked,
    operationallyReady,
    registeredChapterCount: registeredChapterCount.toString(),
    preservedModeratorParameters: {
      leaderCoefBps: leaderCoefBps.toString(),
      moderatorCoefBps: moderatorCoefBps.toString(),
      saleBoostBpsPerTicket: saleBoostBpsPerTicket.toString(),
      globalUniquePerWeek,
      milestone100: milestone100.toString(),
      milestone500: milestone500.toString(),
      milestone1000: milestone1000.toString(),
    },
    liquidity: {
      pair: pairAddress,
      factory: routerFactory,
      biggiReserve: biggiReserve.toString(),
      quoteReserve: quoteReserve.toString(),
    },
    currentLiveWiring: {
      distributorDripLM: currentDistributorDrip,
      tokensPerMintOperator: currentOperator,
      buybackDripLM: currentBuybackDrip,
    },
  };
  console.log(JSON.stringify(preflight, null, 2));
  if (!EXECUTE) {
    console.log("Dry-run only. No transaction was sent.");
    return;
  }
  if (process.env.MODERATOR_V2_ACTIVATE_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set MODERATOR_V2_ACTIVATE_CONFIRM=${CONFIRMATION} to execute`);
  }

  const ownerKey = String(process.env.OWNER_PRIVATE_KEY || "").trim();
  if (!ownerKey) throw new Error("OWNER_PRIVATE_KEY is required for activation");
  const ownerSigner = new ethers.Wallet(ownerKey, ethers.provider);
  if (ownerSigner.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`OWNER_PRIVATE_KEY resolves to ${ownerSigner.address}, expected ${ownerAddress}`);
  }

  const report = {
    ...preflight,
    activatedAt: new Date().toISOString(),
    transactions: [],
  };
  const distributorWrite = distributor.connect(ownerSigner);
  const buybackWrite = buyback.connect(ownerSigner);
  const moderatorWrite = moderator.connect(ownerSigner);
  const dripWrite = drip.connect(ownerSigner);

  if (await moderatorWrite.paused()) {
    await waitFor(await moderatorWrite.unpause(), "ModeratorCenterV2.unpause", report);
  }
  if (await dripWrite.paused()) {
    await waitFor(await dripWrite.unpause(), "DripV2.unpause", report);
  }

  await sendIfDifferent(
    "DripDistributor.setDripLM(V2)",
    currentDistributorDrip,
    dripAddress,
    () => distributorWrite.setDripLM(dripAddress),
    report,
  );
  await sendIfDifferent(
    "DripDistributor.setTokensPerMintOperator(V2)",
    currentOperator,
    dripAddress,
    () => distributorWrite.setTokensPerMintOperator(dripAddress),
    report,
  );
  await sendIfDifferent(
    "BuybackAgent.setDripLM(V2)",
    currentBuybackDrip,
    dripAddress,
    () => buybackWrite.setDripLM(dripAddress),
    report,
  );

  const [finalDistributorDrip, finalOperator, finalBuybackDrip, finalModeratorPaused, finalDripPaused] =
    await Promise.all([
      distributor.dripLM(),
      distributor.tokensPerMintOperator(),
      buyback.dripLM(),
      moderator.paused(),
      drip.paused(),
    ]);
  if (
    finalDistributorDrip.toLowerCase() !== dripAddress.toLowerCase() ||
    finalOperator.toLowerCase() !== dripAddress.toLowerCase() ||
    finalBuybackDrip.toLowerCase() !== dripAddress.toLowerCase() ||
    finalModeratorPaused ||
    finalDripPaused
  ) {
    throw new Error("Post-activation verification failed");
  }

  report.postActivation = {
    distributorDripLM: finalDistributorDrip,
    tokensPerMintOperator: finalOperator,
    buybackDripLM: finalBuybackDrip,
    moderatorPaused: finalModeratorPaused,
    dripPaused: finalDripPaused,
  };
  const reportFile = path.resolve(backendRoot, "reports/moderator-v2-activation-polygon.json");
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Activation report: ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
