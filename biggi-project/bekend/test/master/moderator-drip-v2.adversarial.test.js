const { expect } = require("chai");
const { ethers } = require("hardhat");

const WEEK = 7 * 24 * 60 * 60;
const DAY = 24 * 60 * 60;
const toWei = (value) => ethers.utils.parseEther(value);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function closeWeek(week) {
  const target = (Number(week) + 1) * WEEK + DAY + 1;
  const latest = await ethers.provider.getBlock("latest");
  if (latest.timestamp < target) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [target]);
    await ethers.provider.send("evm_mine", []);
  }
}

async function deployModeratorFixture({ milestone100 = 0 } = {}) {
  const [owner, leader, moderator, buyerA, buyerB, buyerC, relayer] =
    await ethers.getSigners();
  const hub = await deploy("MockModeratorTicketHub");
  await (
    await hub.configureChapter(1, 550, 50, 50, 500, 0, 50)
  ).wait();

  const center = await deploy(
    "ModeratorCenterV2",
    owner.address,
    hub.address,
  );
  await (await center.registerChapter(1)).wait();

  const refLeader = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("leader-referral"),
  );
  const refModerator = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("moderator-referral"),
  );

  await (await center.setReferralHash(0, refLeader)).wait();
  await (
    await center.configureSlot(0, true, true, leader.address)
  ).wait();
  await (await center.setReferralHash(1, refModerator)).wait();
  await (
    await center.configureSlot(1, true, false, moderator.address)
  ).wait();
  await (await center.setMultiCollection(owner.address)).wait();
  await (await center.setMilestones(milestone100, 0, 0)).wait();
  await (await center.lockMilestoneConfig()).wait();
  await (await center.unpause()).wait();

  return {
    owner,
    leader,
    moderator,
    buyerA,
    buyerB,
    buyerC,
    relayer,
    hub,
    center,
    refLeader,
    refModerator,
  };
}

describe("BIGGI_MASTER: ModeratorCenterV2 adversarial consistency", function () {
  it("registers only chapters whose marketing range is complete before paid sales", async () => {
    const [owner] = await ethers.getSigners();
    const hub = await deploy("MockModeratorTicketHub");
    const center = await deploy(
      "ModeratorCenterV2",
      owner.address,
      hub.address,
    );

    await (
      await hub.configureChapter(1, 550, 50, 49, 500, 0, 49)
    ).wait();
    await expect(center.registerChapter(1)).to.be.revertedWithCustomError(
      center,
      "ModeratorChapterNotReady",
    );

    await (
      await hub.configureChapter(1, 550, 50, 50, 500, 0, 50)
    ).wait();
    await expect(center.registerChapter(1))
      .to.emit(center, "ChapterRegistered")
      .withArgs(1, 51, 550, 500, 50);

    const chapter = await center.registeredChapters(1);
    expect(chapter.firstPaidTicketId).to.equal(51);
    expect(chapter.lastPaidTicketId).to.equal(550);
  });

  it("accepts each paid TicketHub token once and rejects marketing or forged ownership", async () => {
    const { buyerA, buyerB, hub, center, refLeader } =
      await deployModeratorFixture();

    await (await hub.mintTicket(1, 1, buyerA.address)).wait();
    await (await hub.mintTicket(51, 1, buyerA.address)).wait();
    await (await hub.mintTicket(52, 1, buyerA.address)).wait();

    await expect(
      center.connect(buyerA).attributeTicket(1, refLeader),
    ).to.be.revertedWithCustomError(center, "ModeratorTicketNotPaid");
    await expect(
      center.connect(buyerB).attributeTicket(51, refLeader),
    ).to.be.revertedWithCustomError(center, "ModeratorTicketOwnerMismatch");

    await expect(center.connect(buyerA).attributeTicket(51, refLeader))
      .to.emit(center, "TicketRecorded")
      .withArgs(0, buyerA.address, 51, 1, await center.currentWeek());

    await expect(
      center.connect(buyerA).attributeTicket(51, refLeader),
    ).to.be.revertedWithCustomError(
      center,
      "ModeratorTicketAlreadyAttributed",
    );

    await (await center.connect(buyerA).attributeTicket(52, refLeader)).wait();
    const week = await center.currentWeek();
    expect(await center.weekTicketCount(week, 0)).to.equal(2);
    expect(await center.weekUniqueCount(week, 0)).to.equal(1);
  });

  it("supports gasless EIP-712 attribution while binding ticket, buyer, week and referral", async () => {
    const { buyerA, relayer, hub, center, refLeader, refModerator } =
      await deployModeratorFixture();
    await (await hub.mintTicket(51, 1, buyerA.address)).wait();

    const network = await ethers.provider.getNetwork();
    const block = await ethers.provider.getBlock("latest");
    const week = await center.currentWeek();
    const deadline = block.timestamp + 3600;
    const domain = {
      name: "Biggi Moderator Center",
      version: "2",
      chainId: network.chainId,
      verifyingContract: center.address,
    };
    const types = {
      TicketReferral: [
        { name: "ticketId", type: "uint256" },
        { name: "buyer", type: "address" },
        { name: "referralHash", type: "bytes32" },
        { name: "week", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const value = {
      ticketId: 51,
      buyer: buyerA.address,
      referralHash: refLeader,
      week,
      deadline,
    };
    const signature = await buyerA._signTypedData(domain, types, value);

    await expect(
      center
        .connect(relayer)
        .attributeTicketBySig(
          51,
          buyerA.address,
          refLeader,
          week,
          deadline,
          signature,
        ),
    ).to.emit(center, "TicketRecorded");

    await (await hub.mintTicket(52, 1, buyerA.address)).wait();
    await expect(
      center
        .connect(relayer)
        .attributeTicketBySig(
          52,
          buyerA.address,
          refModerator,
          week,
          deadline,
          signature,
        ),
    ).to.be.revertedWithCustomError(center, "ModeratorSignatureInvalid");
  });

  it("settles a closed week once using its immutable original weight configuration", async () => {
    const {
      owner,
      leader,
      moderator,
      buyerA,
      buyerB,
      buyerC,
      hub,
      center,
      refLeader,
      refModerator,
    } = await deployModeratorFixture();

    await (await hub.mintTicket(51, 1, buyerA.address)).wait();
    await (await hub.mintTicket(52, 1, buyerB.address)).wait();
    await (await hub.mintTicket(53, 1, buyerC.address)).wait();
    await (await center.connect(buyerA).attributeTicket(51, refLeader)).wait();
    await (await center.connect(buyerB).attributeTicket(52, refLeader)).wait();
    await (
      await center.connect(buyerC).attributeTicket(53, refModerator)
    ).wait();
    await (await center.notifyAllocation({ value: toWei("10") })).wait();

    const week = await center.currentWeek();
    const snapshottedVersion = await center.weekConfigVersion(week);
    await (await center.setCoefs(1, 10_000, 0)).wait();
    expect(await center.currentConfigVersion()).to.not.equal(snapshottedVersion);

    await expect(
      center.settleWeek(week),
    ).to.be.revertedWithCustomError(center, "ModeratorWeekNotClosed");
    await closeWeek(week);
    await (await center.settleWeek(week)).wait();

    const pool = toWei("10");
    const moderatorShare = pool.mul(40).div(280);
    const leaderShare = pool.sub(moderatorShare);
    expect(await center.claimable(leader.address)).to.equal(leaderShare);
    expect(await center.claimable(moderator.address)).to.equal(
      moderatorShare,
    );
    expect(await center.weekDistributed(week)).to.equal(pool);
    expect(await center.totalAllocatedOutstanding()).to.equal(0);
    expect(await center.totalClaimable()).to.equal(pool);

    await expect(
      center.settleWeek(week),
    ).to.be.revertedWithCustomError(center, "ModeratorWeekAlreadySettled");

    await (await center.connect(leader).claim()).wait();
    expect(await center.claimable(leader.address)).to.equal(0);
    expect(await center.totalClaimable()).to.equal(moderatorShare);
    expect(await ethers.provider.getBalance(center.address)).to.equal(
      moderatorShare,
    );
  });

  it("rolls a no-activity pool into the next opened week instead of locking it", async () => {
    const { owner, buyerA, leader, hub, center, refLeader } =
      await deployModeratorFixture();

    await (await center.notifyAllocation({ value: toWei("3") })).wait();
    const emptyWeek = await center.currentWeek();
    await closeWeek(emptyWeek);
    await (await center.settleWeek(emptyWeek)).wait();

    expect(await center.pendingRollover()).to.equal(toWei("3"));
    expect(await center.totalAllocatedOutstanding()).to.equal(toWei("3"));

    const activeWeek = await center.currentWeek();
    await (await hub.mintTicket(51, 1, buyerA.address)).wait();
    await (await center.connect(buyerA).attributeTicket(51, refLeader)).wait();
    expect(await center.weekAllocated(activeWeek)).to.equal(toWei("3"));
    expect(await center.pendingRollover()).to.equal(0);
    await (await center.notifyAllocation({ value: toWei("2") })).wait();

    await closeWeek(activeWeek);
    await (await center.connect(owner).settleWeek(activeWeek)).wait();
    expect(await center.claimable(leader.address)).to.equal(toWei("5"));
    expect(await center.totalAllocatedOutstanding()).to.equal(0);
  });

  it("credits rewards without calling payout contracts and isolates a rejecting claimant", async () => {
    const { owner, leader, buyerA, hub, center, refLeader } =
      await deployModeratorFixture();
    const rejectReceiver = await deploy("MockRejectReceiver");

    await (await center.pause()).wait();
    await (await center.configureSlot(0, false, true, leader.address)).wait();
    await (
      await center.replaceSlot(0, true, true, rejectReceiver.address, refLeader)
    ).wait();
    await (await center.unpause()).wait();
    await (await hub.mintTicket(51, 1, buyerA.address)).wait();
    await (await center.connect(buyerA).attributeTicket(51, refLeader)).wait();
    await (await center.connect(owner).notifyAllocation({ value: toWei("1") })).wait();
    const week = await center.currentWeek();
    await closeWeek(week);

    await expect(center.settleWeek(week)).to.not.be.reverted;
    expect(await center.claimable(rejectReceiver.address)).to.equal(toWei("1"));
    await expect(center.claimFor(rejectReceiver.address)).to.be.reverted;
    expect(await center.claimable(rejectReceiver.address)).to.equal(toWei("1"));

    await (await rejectReceiver.setReject(false)).wait();
    await (await center.claimFor(rejectReceiver.address)).wait();
    expect(await rejectReceiver.totalReceived()).to.equal(toWei("1"));
  });

  it("does not mark an underfunded milestone paid and credits it after explicit funding", async function () {
    this.timeout(300000);
    const { owner, buyerA, leader, hub, center, refLeader } =
      await deployModeratorFixture({ milestone100: toWei("1") });

    for (let tokenId = 51; tokenId <= 150; tokenId += 1) {
      await (await hub.mintTicket(tokenId, 1, buyerA.address)).wait();
      await (
        await center.connect(buyerA).attributeTicket(tokenId, refLeader)
      ).wait();
    }

    const generation = await center.getSlotGeneration(0);
    const awardBefore = await center.milestoneAwards(0, generation, 100);
    expect(awardBefore.achieved).to.equal(true);
    expect(awardBefore.funded).to.equal(false);
    expect(await center.milestonePaid(0, 100)).to.equal(false);
    expect(await center.claimable(leader.address)).to.equal(0);

    await (await center.connect(owner).fundMilestones({ value: toWei("1") })).wait();
    await (await center.settleMilestone(0, generation, 100)).wait();

    const awardAfter = await center.milestoneAwards(0, generation, 100);
    expect(awardAfter.funded).to.equal(true);
    expect(await center.milestonePaid(0, 100)).to.equal(true);
    expect(await center.claimable(leader.address)).to.equal(toWei("1"));
    expect(await center.milestoneBudget()).to.equal(0);
  });

  it("rejects duplicate referral hashes and more than one enabled leader", async () => {
    const { center, refLeader } = await deployModeratorFixture();
    const [, , , , , , , anotherPayout] = await ethers.getSigners();

    await expect(
      center.setReferralHash(2, refLeader),
    ).to.be.revertedWithCustomError(center, "ModeratorDuplicateReferral");

    const refThird = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("third-referral"),
    );
    await (await center.setReferralHash(2, refThird)).wait();
    await expect(
      center.configureSlot(2, true, true, anotherPayout.address),
    ).to.be.revertedWithCustomError(
      center,
      "ModeratorLeaderAlreadyConfigured",
    );
  });

  it("requires a complete operational configuration and versions slot replacements", async () => {
    const [owner, firstPayout, secondPayout, buyer] = await ethers.getSigners();
    const hub = await deploy("MockModeratorTicketHub");
    await (await hub.configureChapter(1, 550, 50, 50, 500, 0, 50)).wait();
    const center = await deploy("ModeratorCenterV2", owner.address, hub.address);
    const firstReferral = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("first"));
    const secondReferral = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("second"));

    await expect(center.unpause()).to.be.revertedWithCustomError(
      center,
      "ModeratorOperationalConfigInvalid",
    );
    await (await center.registerChapter(1)).wait();
    await (await center.setMultiCollection(owner.address)).wait();
    await (await center.setReferralHash(0, firstReferral)).wait();
    await (await center.configureSlot(0, true, true, firstPayout.address)).wait();
    await (await center.lockMilestoneConfig()).wait();
    await (await center.unpause()).wait();

    await expect(
      center.setPayoutAddress(0, secondPayout.address),
    ).to.be.revertedWithCustomError(center, "ModeratorSlotReplacementRequired");

    await (await hub.mintTicket(51, 1, buyer.address)).wait();
    await (await center.connect(buyer).attributeTicket(51, firstReferral)).wait();
    const firstGeneration = await center.getSlotGeneration(0);
    expect(await center.generationTicketSales(0, firstGeneration)).to.equal(1);

    await (await center.pause()).wait();
    await (await center.configureSlot(0, false, true, firstPayout.address)).wait();
    await (
      await center.replaceSlot(0, true, true, secondPayout.address, secondReferral)
    ).wait();
    const secondGeneration = await center.getSlotGeneration(0);
    expect(secondGeneration).to.equal(firstGeneration.add(1));
    expect(await center.generationTicketSales(0, secondGeneration)).to.equal(0);
    await (await center.unpause()).wait();
    expect(await center.operationallyReady()).to.equal(true);
  });
});

describe("BIGGI_MASTER: BiggiDripLMToModeratorV2 adversarial consistency", function () {
  async function deployDripFixture({ rejectingReserve = false } = {}) {
    const [owner] = await ethers.getSigners();
    const token = await deploy("MockERC20", "BIGGI", "BIGGI", 18);
    const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
    const router = await deploy("MockSwapRouter", weth.address);
    const hub = await deploy("MockModeratorTicketHub");
    const center = await deploy(
      "ModeratorCenterV2",
      owner.address,
      hub.address,
    );
    const distributor = await deploy(
      "BiggiDripDistributor",
      token.address,
      owner.address,
    );
    const drip = await deploy(
      "BiggiDripLMToModeratorV2",
      token.address,
      router.address,
      owner.address,
    );
    const reserve = rejectingReserve
      ? await deploy("MockRejectReceiver")
      : owner;

    await (await hub.configureChapter(1, 550, 50, 50, 500, 0, 50)).wait();
    await (await center.registerChapter(1)).wait();
    const referral = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("drip-leader"));
    await (await center.setReferralHash(0, referral)).wait();
    await (await center.configureSlot(0, true, true, owner.address)).wait();
    await (await center.lockMilestoneConfig()).wait();

    await owner.sendTransaction({ to: router.address, value: toWei("1000") });
    await (await token.mint(distributor.address, toWei("1000"))).wait();
    await (await distributor.syncAvailableToBalance()).wait();
    await (await distributor.setDripLM(drip.address)).wait();
    await (await distributor.setTokensPerMintOperator(drip.address)).wait();

    await (await drip.setDripDistributor(distributor.address)).wait();
    await (await drip.setReserve(reserve.address)).wait();
    await (await drip.setBuybackAgent(owner.address)).wait();
    await (await drip.setModeratorCenter(center.address)).wait();
    await (await center.setMultiCollection(drip.address)).wait();
    await (await center.unpause()).wait();
    await (await drip.unpause()).wait();

    return { owner, token, router, center, distributor, drip, reserve };
  }

  it("splits only the current swap delta and preserves unrelated native surplus", async () => {
    const { owner, center, distributor, drip } = await deployDripFixture();
    const surplus = toWei("7");
    await ethers.provider.send("hardhat_setBalance", [
      drip.address,
      ethers.utils.hexStripZeros(surplus.toHexString()),
    ]);

    const week = await center.currentWeek();
    const ownerBefore = await ethers.provider.getBalance(owner.address);
    const tx = await drip.dripOnBuy(toWei("100"));
    const receipt = await tx.wait();
    const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const ownerAfter = await ethers.provider.getBalance(owner.address);

    expect(await distributor.tokensPerMint()).to.equal(toWei("70"));
    expect(await distributor.totalClaimed()).to.equal(toWei("70"));
    expect(await center.weekAllocated(week)).to.equal(toWei("35"));
    expect(ownerAfter.add(gas).sub(ownerBefore)).to.equal(toWei("35"));
    expect(await ethers.provider.getBalance(drip.address)).to.equal(surplus);
    expect(await drip.pendingReserveNative()).to.equal(0);
    expect(await drip.pendingModeratorNative()).to.equal(0);
  });

  it("keeps failed reserve and moderator deliveries pending until an explicit retry", async () => {
    const { center, drip, reserve } = await deployDripFixture({
      rejectingReserve: true,
    });
    await (await center.pause()).wait();

    await (await drip.dripOnBuy(toWei("100"))).wait();
    expect(await drip.pendingReserveNative()).to.equal(toWei("35"));
    expect(await drip.pendingModeratorNative()).to.equal(toWei("35"));
    expect(await ethers.provider.getBalance(drip.address)).to.equal(toWei("70"));
    await expect(
      drip.rescueNative((await ethers.getSigners())[0].address, 1),
    ).to.be.revertedWithCustomError(drip, "ExpectedPause");
    await (await drip.pause()).wait();
    await expect(
      drip.rescueNative((await ethers.getSigners())[0].address, 1),
    ).to.be.revertedWithCustomError(drip, "DripInsufficientSurplus");
    await expect(
      drip.setReserve((await ethers.getSigners())[0].address),
    ).to.be.revertedWithCustomError(drip, "DripPendingReserve");

    await (await reserve.setReject(false)).wait();
    await (await center.unpause()).wait();
    const week = await center.currentWeek();
    await (await drip.retryPending()).wait();

    expect(await reserve.totalReceived()).to.equal(toWei("35"));
    expect(await center.weekAllocated(week)).to.equal(toWei("35"));
    expect(await drip.pendingReserveNative()).to.equal(0);
    expect(await drip.pendingModeratorNative()).to.equal(0);
    expect(await ethers.provider.getBalance(drip.address)).to.equal(0);
  });
});
