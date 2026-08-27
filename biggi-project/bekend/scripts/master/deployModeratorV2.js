const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ZERO = ethers.constants.AddressZero;
const EXECUTE = process.env.MODERATOR_V2_DEPLOY_EXECUTE === "1";
const FORK_REHEARSAL = process.env.MODERATOR_V2_FORK_REHEARSAL === "1";
const CONFIRMATION = "DEPLOY_PAUSED_MODERATOR_V2";
const CONFIRMATIONS = Number(process.env.TX_CONFIRMATIONS || 1);

function requireAddress(name, value) {
  if (!value || !ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${name} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

function loadAddresses() {
  const configured = process.env.MASTER_ADDRESSES_FILE || "addresses.master.json";
  const file = path.resolve(__dirname, "../..", configured);
  if (!fs.existsSync(file)) throw new Error(`Address file not found: ${file}`);
  return { file, values: JSON.parse(fs.readFileSync(file, "utf8")) };
}

async function requireCode(name, address) {
  const code = await ethers.provider.getCode(address);
  if (!code || code === "0x") throw new Error(`${name} has no deployed code: ${address}`);
}

async function waitFor(tx, label, report) {
  const receipt = await tx.wait(CONFIRMATIONS);
  report.transactions.push({
    label,
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  });
  console.log(`${label}: ${tx.hash}`);
  return receipt;
}

async function readChapterState(ticketHub, chapterId) {
  const [
    exists,
    totalCap,
    totalMinted,
    marketingCap,
    marketingMinted,
    saleCap,
    saleMinted,
  ] = await Promise.all([
    ticketHub.chapterExists(chapterId),
    ticketHub.chapterTotalCap(chapterId),
    ticketHub.chapterTotalMinted(chapterId),
    ticketHub.chapterMarketingCap(chapterId),
    ticketHub.chapterMarketingMinted(chapterId),
    ticketHub.chapterSaleCap(chapterId),
    ticketHub.chapterSaleMinted(chapterId),
  ]);
  const totalCapBn = ethers.BigNumber.from(totalCap);
  const totalMintedBn = ethers.BigNumber.from(totalMinted);
  const marketingCapBn = ethers.BigNumber.from(marketingCap);
  const marketingMintedBn = ethers.BigNumber.from(marketingMinted);
  const saleCapBn = ethers.BigNumber.from(saleCap);
  const saleMintedBn = ethers.BigNumber.from(saleMinted);
  const ready =
    exists &&
    totalCapBn.eq(marketingCapBn.add(saleCapBn)) &&
    marketingMintedBn.eq(marketingCapBn) &&
    saleMintedBn.eq(0) &&
    totalMintedBn.eq(marketingMintedBn);
  return {
    chapterId,
    exists,
    totalCap: totalCapBn.toString(),
    totalMinted: totalMintedBn.toString(),
    marketingCap: marketingCapBn.toString(),
    marketingMinted: marketingMintedBn.toString(),
    saleCap: saleCapBn.toString(),
    saleMinted: saleMintedBn.toString(),
    ready,
  };
}

async function main() {
  const { file: addressesFile, values: addresses } = loadAddresses();
  const chain = await ethers.provider.getNetwork();
  if (FORK_REHEARSAL && process.env.MODERATOR_V2_DEBUG_FORK === "1") {
    const chains = network.config?.chains;
    console.log(
      "Resolved fork chains:",
      JSON.stringify(
        chains instanceof Map
          ? [...chains.entries()].map(([id, value]) => [
              id,
              [...(value?.hardforkHistory?.entries?.() || [])],
            ])
          : chains,
      ),
    );
  }
  if (chain.chainId !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  if (FORK_REHEARSAL) {
    // EDR evaluates calls at the fork boundary as historical Polygon calls.
    // Mine one local block so subsequent `latest` calls use the configured hardfork.
    await ethers.provider.send("evm_mine", []);
  }

  const [deployer] = await ethers.getSigners();
  const expectedDeployer = FORK_REHEARSAL
    ? deployer.address
    : requireAddress("DEPLOYER", process.env.DEPLOYER || addresses.deployer);
  if (deployer.address.toLowerCase() !== expectedDeployer.toLowerCase()) {
    throw new Error(`Signer ${deployer.address} is not expected deployer ${expectedDeployer}`);
  }

  const finalOwner = requireAddress(
    "OWNER/EXPECT_OWNER",
    process.env.EXPECT_OWNER || process.env.OWNER || addresses.EXPECT_OWNER || addresses.OWNER,
  );
  const ticketHubAddress = requireAddress("TICKET_HUB", addresses.TICKET_HUB);
  const tokenAddress = requireAddress("BIGGI_TOKEN", addresses.BIGGI_TOKEN);
  const routerAddress = requireAddress(
    "BUYBACK_ROUTER",
    addresses.BUYBACK_ROUTER || addresses.ROUTER,
  );
  const reserveAddress = requireAddress("RESERVE", addresses.RESERVE);
  const distributorAddress = requireAddress("DRIP_DISTRIBUTOR", addresses.DRIP_DISTRIBUTOR);
  const buybackAddress = requireAddress("BUYBACK_AGENT", addresses.BUYBACK_AGENT);
  const oldDripAddress = requireAddress("DRIP_LM", addresses.DRIP_LM);
  const oldModeratorAddress = requireAddress(
    "MODERATOR_CENTER",
    addresses.MODERATOR_CENTER || addresses.BIGGI_MODERATOR_CENTER,
  );
  const chapterCount = Number(addresses.CHAPTER_COUNT || addresses.chapters?.length || 0);
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error("CHAPTER_COUNT must be positive");
  }

  for (const [name, address] of Object.entries({
    TICKET_HUB: ticketHubAddress,
    BIGGI_TOKEN: tokenAddress,
    BUYBACK_ROUTER: routerAddress,
    RESERVE: reserveAddress,
    DRIP_DISTRIBUTOR: distributorAddress,
    BUYBACK_AGENT: buybackAddress,
    OLD_DRIP_LM: oldDripAddress,
    OLD_MODERATOR_CENTER: oldModeratorAddress,
  })) {
    await requireCode(name, address);
  }

  const ticketHub = new ethers.Contract(
    ticketHubAddress,
    [
      "function chapterExists(uint256) view returns (bool)",
      "function chapterTotalCap(uint256) view returns (uint16)",
      "function chapterTotalMinted(uint256) view returns (uint256)",
      "function chapterMarketingCap(uint256) view returns (uint16)",
      "function chapterMarketingMinted(uint256) view returns (uint16)",
      "function chapterSaleCap(uint256) view returns (uint16)",
      "function chapterSaleMinted(uint256) view returns (uint16)",
    ],
    ethers.provider,
  );
  const chapterStates = [];
  for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
    const state = await readChapterState(ticketHub, chapterId);
    chapterStates.push(state);
    if (!state.ready) {
      throw new Error(`Chapter ${chapterId} is not ready for paid-range registration`);
    }
  }

  const token = new ethers.Contract(
    tokenAddress,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider,
  );
  const [oldDripTokenBalance, oldDripNativeBalance] = await Promise.all([
    token.balanceOf(oldDripAddress),
    ethers.provider.getBalance(oldDripAddress),
  ]);
  if (!oldDripTokenBalance.eq(0) || !oldDripNativeBalance.eq(0)) {
    throw new Error(
      `Old DRIP_LM is not empty (BIGGI=${oldDripTokenBalance}, POL=${oldDripNativeBalance})`,
    );
  }

  const oldModerator = new ethers.Contract(
    oldModeratorAddress,
    [
      "function leaderCoefBps() view returns (uint256)",
      "function moderatorCoefBps() view returns (uint256)",
      "function saleBoostBpsPerTicket() view returns (uint256)",
      "function globalUniquePerWeek() view returns (bool)",
      "function milestone100() view returns (uint256)",
      "function milestone500() view returns (uint256)",
      "function milestone1000() view returns (uint256)",
      "function totalAllocatedOutstanding() view returns (uint256)",
      "function slots(uint256) view returns (bool enabled,bool isLeader,address payout,bytes32 passwordHash,bytes32 referralHash,uint256 cumulativeTicketSales)",
    ],
    ethers.provider,
  );
  const [
    leaderCoefBps,
    moderatorCoefBps,
    saleBoostBpsPerTicket,
    globalUniquePerWeek,
    milestone100,
    milestone500,
    milestone1000,
    oldModeratorOutstanding,
    oldModeratorNativeBalance,
  ] = await Promise.all([
    oldModerator.leaderCoefBps(),
    oldModerator.moderatorCoefBps(),
    oldModerator.saleBoostBpsPerTicket(),
    oldModerator.globalUniquePerWeek(),
    oldModerator.milestone100(),
    oldModerator.milestone500(),
    oldModerator.milestone1000(),
    oldModerator.totalAllocatedOutstanding(),
    ethers.provider.getBalance(oldModeratorAddress),
  ]);
  if (!oldModeratorOutstanding.eq(0) || !oldModeratorNativeBalance.eq(0)) {
    throw new Error(
      `Old ModeratorCenter is not empty (outstanding=${oldModeratorOutstanding}, POL=${oldModeratorNativeBalance})`,
    );
  }
  const oldModeratorSlots = [];
  for (let slotId = 0; slotId < 10; slotId += 1) {
    const slot = await oldModerator.slots(slotId);
    const state = {
      slotId,
      enabled: Boolean(slot.enabled),
      isLeader: Boolean(slot.isLeader),
      payout: slot.payout,
      referralHash: slot.referralHash,
      cumulativeTicketSales: slot.cumulativeTicketSales.toString(),
    };
    oldModeratorSlots.push(state);
    if (state.enabled || !slot.cumulativeTicketSales.eq(0)) {
      throw new Error(`Old ModeratorCenter slot ${slotId} has live state and needs migration`);
    }
  }

  const oldDrip = new ethers.Contract(
    oldDripAddress,
    [
      "function sellPct() view returns (uint8)",
      "function reserveShareBps() view returns (uint16)",
      "function moderatorShareBps() view returns (uint16)",
      "function slippageBps() view returns (uint256)",
      "function txDeadlineSec() view returns (uint256)",
    ],
    ethers.provider,
  );
  const [sellPct, reserveShareBps, moderatorShareBps, slippageBps, txDeadlineSec] =
    await Promise.all([
      oldDrip.sellPct(),
      oldDrip.reserveShareBps(),
      oldDrip.moderatorShareBps(),
      oldDrip.slippageBps(),
      oldDrip.txDeadlineSec(),
    ]);

  const Moderator = await ethers.getContractFactory("ModeratorCenterV2", deployer);
  const Drip = await ethers.getContractFactory("BiggiDripLMToModeratorV2", deployer);
  const resumeModeratorAddress = String(process.env.MODERATOR_V2_RESUME_ADDRESS || "").trim()
    ? requireAddress("MODERATOR_V2_RESUME_ADDRESS", process.env.MODERATOR_V2_RESUME_ADDRESS)
    : null;
  let resumedModerator = null;
  if (resumeModeratorAddress) {
    await requireCode("MODERATOR_V2_RESUME_ADDRESS", resumeModeratorAddress);
    resumedModerator = Moderator.attach(resumeModeratorAddress);
    const [
      resumeOwner,
      resumePaused,
      resumeTicketHub,
      resumeAllocator,
      resumeRegisteredChapterCount,
      resumeMilestoneLocked,
      resumeOutstanding,
      resumeClaimable,
      resumeMilestoneBudget,
    ] = await Promise.all([
      resumedModerator.owner(),
      resumedModerator.paused(),
      resumedModerator.ticketHub(),
      resumedModerator.multiCollection(),
      resumedModerator.registeredChapterCount(),
      resumedModerator.milestoneConfigLocked(),
      resumedModerator.totalAllocatedOutstanding(),
      resumedModerator.totalClaimable(),
      resumedModerator.milestoneBudget(),
    ]);
    if (
      resumeOwner.toLowerCase() !== deployer.address.toLowerCase() ||
      !resumePaused ||
      resumeTicketHub.toLowerCase() !== ticketHubAddress.toLowerCase() ||
      resumeAllocator !== ZERO ||
      !resumeRegisteredChapterCount.eq(0) ||
      resumeMilestoneLocked ||
      !resumeOutstanding.eq(0) ||
      !resumeClaimable.eq(0) ||
      !resumeMilestoneBudget.eq(0)
    ) {
      throw new Error("Existing ModeratorCenterV2 is not in the expected pristine paused state");
    }
  }
  const moderatorDeployTx = resumeModeratorAddress
    ? null
    : Moderator.getDeployTransaction(deployer.address, ticketHubAddress);
  const dripDeployTx = Drip.getDeployTransaction(tokenAddress, routerAddress, deployer.address);
  const [moderatorGas, dripGas, deployerBalance] = await Promise.all([
    moderatorDeployTx
      ? ethers.provider.estimateGas({ ...moderatorDeployTx, from: deployer.address })
      : Promise.resolve(ethers.constants.Zero),
    ethers.provider.estimateGas({ ...dripDeployTx, from: deployer.address }),
    ethers.provider.getBalance(deployer.address),
  ]);

  const preflight = {
    mode: FORK_REHEARSAL ? "fork-rehearsal" : EXECUTE ? "execute" : "dry-run",
    network: network.name,
    chainId: chain.chainId,
    addressesFile,
    deployer: deployer.address,
    finalOwner,
    dependencies: {
      ticketHub: ticketHubAddress,
      token: tokenAddress,
      router: routerAddress,
      reserve: reserveAddress,
      dripDistributor: distributorAddress,
      buybackAgent: buybackAddress,
      oldDripLM: oldDripAddress,
      oldModeratorCenter: oldModeratorAddress,
    },
    preservedParameters: {
      sellPct: Number(sellPct),
      reserveShareBps: Number(reserveShareBps),
      moderatorShareBps: Number(moderatorShareBps),
      slippageBps: slippageBps.toString(),
      txDeadlineSec: txDeadlineSec.toString(),
      leaderCoefBps: leaderCoefBps.toString(),
      moderatorCoefBps: moderatorCoefBps.toString(),
      saleBoostBpsPerTicket: saleBoostBpsPerTicket.toString(),
      globalUniquePerWeek,
      milestone100: milestone100.toString(),
      milestone500: milestone500.toString(),
      milestone1000: milestone1000.toString(),
    },
    oldModeratorState: {
      nativeBalance: oldModeratorNativeBalance.toString(),
      allocatedOutstanding: oldModeratorOutstanding.toString(),
      slots: oldModeratorSlots,
    },
    chapters: chapterStates,
    gasEstimate: {
      moderator: moderatorGas.toString(),
      drip: dripGas.toString(),
      totalDeployOnly: moderatorGas.add(dripGas).toString(),
    },
    resumeModeratorAddress,
    deployerBalanceWei: deployerBalance.toString(),
  };
  console.log(JSON.stringify(preflight, null, 2));

  if (!EXECUTE) {
    console.log("Dry-run only. No transaction was sent.");
    return;
  }
  if (process.env.MODERATOR_V2_DEPLOY_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set MODERATOR_V2_DEPLOY_CONFIRM=${CONFIRMATION} to execute`);
  }

  const report = {
    ...preflight,
    createdAt: new Date().toISOString(),
    transactions: [],
    activated: false,
  };

  const moderator = resumedModerator || (await Moderator.deploy(deployer.address, ticketHubAddress));
  if (resumedModerator) {
    report.transactions.push({
      label: "resume existing ModeratorCenterV2",
      address: moderator.address,
      hash: process.env.MODERATOR_V2_RESUME_TX_HASH || null,
    });
    console.log(`resume existing ModeratorCenterV2: ${moderator.address}`);
  } else {
    await waitFor(moderator.deployTransaction, "deploy ModeratorCenterV2", report);
  }
  const drip = await Drip.deploy(tokenAddress, routerAddress, deployer.address);
  await waitFor(drip.deployTransaction, "deploy BiggiDripLMToModeratorV2", report);
  report.moderatorCenterV2 = moderator.address;
  report.dripLMV2 = drip.address;

  for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
    await waitFor(
      await moderator.registerChapter(chapterId),
      `ModeratorCenterV2.registerChapter(${chapterId})`,
      report,
    );
  }
  await waitFor(
    await moderator.setMultiCollection(drip.address),
    "ModeratorCenterV2.setMultiCollection",
    report,
  );
  await waitFor(
    await moderator.setCoefs(leaderCoefBps, moderatorCoefBps, saleBoostBpsPerTicket),
    "ModeratorCenterV2.setCoefs(preserved)",
    report,
  );
  await waitFor(
    await moderator.setGlobalUniquePerWeek(globalUniquePerWeek),
    "ModeratorCenterV2.setGlobalUniquePerWeek(preserved)",
    report,
  );
  await waitFor(
    await moderator.setMilestones(milestone100, milestone500, milestone1000),
    "ModeratorCenterV2.setMilestones(preserved)",
    report,
  );
  await waitFor(
    await moderator.lockMilestoneConfig(),
    "ModeratorCenterV2.lockMilestoneConfig",
    report,
  );

  await waitFor(
    await drip.setDripDistributor(distributorAddress),
    "DripV2.setDripDistributor",
    report,
  );
  await waitFor(await drip.setReserve(reserveAddress), "DripV2.setReserve", report);
  await waitFor(
    await drip.setBuybackAgent(buybackAddress),
    "DripV2.setBuybackAgent",
    report,
  );
  await waitFor(
    await drip.setModeratorCenter(moderator.address),
    "DripV2.setModeratorCenter",
    report,
  );
  await waitFor(await drip.setSellPct(sellPct), "DripV2.setSellPct", report);
  await waitFor(
    await drip.setShares(reserveShareBps, moderatorShareBps),
    "DripV2.setShares",
    report,
  );
  await waitFor(
    await drip.setSlippageBps(slippageBps),
    "DripV2.setSlippageBps",
    report,
  );
  await waitFor(
    await drip.setTxDeadlineSec(txDeadlineSec),
    "DripV2.setTxDeadlineSec",
    report,
  );

  await waitFor(
    await moderator.transferOwnership(finalOwner),
    "ModeratorCenterV2.transferOwnership",
    report,
  );
  await waitFor(
    await drip.transferOwnership(finalOwner),
    "DripV2.transferOwnership",
    report,
  );

  const [
    moderatorOwner,
    dripOwner,
    moderatorPaused,
    dripPaused,
    wiringReady,
    milestoneLocked,
    finalLeaderCoef,
    finalModeratorCoef,
    finalSaleBoost,
    finalGlobalUnique,
  ] =
    await Promise.all([
      moderator.owner(),
      drip.owner(),
      moderator.paused(),
      drip.paused(),
      drip.wiringReady(),
      moderator.milestoneConfigLocked(),
      moderator.leaderCoefBps(),
      moderator.moderatorCoefBps(),
      moderator.saleBoostBpsPerTicket(),
      moderator.globalUniquePerWeek(),
    ]);
  if (
    moderatorOwner.toLowerCase() !== finalOwner.toLowerCase() ||
    dripOwner.toLowerCase() !== finalOwner.toLowerCase() ||
    !moderatorPaused ||
    !dripPaused ||
    !wiringReady ||
    !milestoneLocked ||
    !finalLeaderCoef.eq(leaderCoefBps) ||
    !finalModeratorCoef.eq(moderatorCoefBps) ||
    !finalSaleBoost.eq(saleBoostBpsPerTicket) ||
    finalGlobalUnique !== globalUniquePerWeek
  ) {
    throw new Error("Post-deploy verification failed");
  }

  report.postDeploy = {
    moderatorOwner,
    dripOwner,
    moderatorPaused,
    dripPaused,
    wiringReady,
    milestoneLocked,
    moderatorParametersPreserved: true,
    liveContractsRewired: false,
  };
  const reportFile = path.resolve(
    __dirname,
    FORK_REHEARSAL
      ? "../../reports/moderator-v2-deployment-fork.json"
      : "../../reports/moderator-v2-deployment-polygon.json",
  );
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Deployment report: ${reportFile}`);
  console.log("V2 contracts remain paused. No live contract was rewired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
