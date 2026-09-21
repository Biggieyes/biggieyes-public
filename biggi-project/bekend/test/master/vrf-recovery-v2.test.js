const { expect } = require("chai");
const { ethers, network, artifacts } = require("hardhat");

const ZERO = ethers.constants.AddressZero;
const KEY = ethers.utils.hexZeroPad("0x01", 32);
const PRICE = ethers.utils.parseEther("123");

async function deploy(name, ...args) {
  const contract = await (await ethers.getContractFactory(name)).deploy(...args);
  return contract.deployed();
}

async function seed(main) {
  const rows = [];
  for (let block = 1; block <= 10; block++) {
    for (let id = (block - 1) * 10 + 1; id <= block * 10; id++) {
      for (let bg = 1; bg <= 11 - block; bg++) rows.push([rows.length + 1, bg, block, id]);
    }
  }
  for (let start = 0; start < rows.length; start += 55) {
    const batch = rows.slice(start, start + 55);
    await main.batchSetNFTBackgroundAndBlock(...[0, 1, 2, 3].map((column) => batch.map((row) => row[column])));
  }
  return rows;
}

async function fixture({ version = 2, seeded = true, realHub = false } = {}) {
  const [owner, alice, bob, stranger] = await ethers.getSigners();
  const names = await deploy("BiggiNamesLib");
  const factory = await ethers.getContractFactory(version === 2 ? "MockVrfRecoveryMain" : "BiggiEyesMain", {
    libraries: { BiggiNamesLib: names.address },
  });
  const main = await (await factory.deploy(owner.address)).deployed();
  const compute = await deploy("BiggiCompute");
  const coordinator = await deploy("MockVrfCoordinatorV2Plus");
  const router = await deploy(version === 2 ? "BiggiVRFRouterV2" : "BiggiVRFRouter", coordinator.address, owner.address, KEY, 1);
  const hub = realHub
    ? await deploy("BiggiTicketHub", owner.address, main.address)
    : await deploy("MockVrfRecoveryHub", main.address);
  await main.setModules(compute.address, router.address);
  await main.setTicketHub(hub.address);
  await router.setMain(main.address);
  let rows;
  if (seeded) {
    rows = await seed(main);
    if (version === 2) await main.sealMetadata();
  }
  return { owner, alice, bob, stranger, main, compute, coordinator, router, hub, rows };
}

async function request(ctx, address = ctx.alice.address, ticket = 1) {
  await ctx.hub.redeem(address, ticket, PRICE);
  return ctx.main.pendingMintRequest(address);
}

async function deliver(ctx, id, word = 0) {
  const receipt = await (await ctx.coordinator.fulfillGasLimited(id, word, { gasLimit: 1_000_000 })).wait();
  const result = receipt.events.find((event) => event.event === "GasLimitedCallback").args;
  expect(result.success, `callback ${id} reverted`).to.equal(true);
  return result.gasUsed.toNumber();
}

describe("VRF recovery V2 (local EVM only)", function () {
  before(function () {
    if (network.name !== "hardhat") throw new Error("Refusing VRF tests outside the local Hardhat network");
  });

  it("fits deployed bytecode limits without changing V1 artifacts", async function () {
    for (const name of ["BiggiEyesMainV2", "BiggiVRFRouterV2"]) {
      const artifact = await artifacts.readArtifact(name);
      expect((artifact.deployedBytecode.length - 2) / 2).to.be.lessThan(24576);
    }
  });

  it("reproduces the old 300k callback failure after nine collisions", async function () {
    const ctx = await fixture({ version: 1 });
    for (let index = 1; index <= 9; index++) {
      const id = await request(ctx, ctx.alice.address, index);
      await ctx.coordinator.fulfill(ctx.router.address, id, 0);
    }
    const id = await request(ctx, ctx.alice.address, 10);
    await ctx.coordinator.fulfillGasLimited(id, 0, { gasLimit: 1_000_000 });
    expect(await ctx.main.pendingMintRequest(ctx.alice.address)).to.equal(id);
    expect(await ctx.main.biggiMinted()).to.equal(9);
  });

  for (const scenario of ["maximal collisions", "mixed boundary and wraparound draws"]) {
    it(`finishes all 550 NFTs with bounded callback gas: ${scenario}`, async function () {
      const ctx = await fixture();
      const available = new Set(Array.from({ length: 550 }, (_, index) => index + 1));
      let maxGas = 0;
      let random = 42;
      for (let minted = 0; minted < 550; minted++) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        const boundaries = [549, 255, 256, 511, 512, 0];
        const word = scenario === "maximal collisions" ? 0 : (minted < boundaries.length ? boundaries[minted] : random);
        let expectedIndex = word % 550 + 1;
        while (!available.has(expectedIndex)) expectedIndex = expectedIndex % 550 + 1;
        expect(await ctx.main.selectForTest(word % 550 + 1)).to.equal(expectedIndex);
        const id = await request(ctx, ctx.alice.address, minted + 1);
        maxGas = Math.max(maxGas, await deliver(ctx, id, word));
        expect(await ctx.main.assignedIndex(id)).to.equal(expectedIndex);
        expect(await ctx.main.pendingMintRequest(ctx.alice.address)).to.equal(0);
        expect(await ctx.main.ownerOf(1000 + expectedIndex)).to.equal(ctx.alice.address);
        expect((await ctx.main.getMintData(expectedIndex))[0]).to.equal(PRICE);
        available.delete(expectedIndex);
      }
      expect(await ctx.main.biggiMinted()).to.equal(550);
      expect(await ctx.main.pendingMintCount()).to.equal(0);
      expect(await ctx.main.balanceOf(ctx.alice.address)).to.equal(560);
      for (let block = 1; block <= 10; block++) {
        expect(await ctx.main.getBlockMintCount(block)).to.equal(110 - 10 * block);
        expect(await ctx.main.ownerOf(2000 + block)).to.equal(ctx.alice.address);
      }
      await expect(request(ctx)).to.be.revertedWithCustomError(ctx.main, "AllNFTsMintedErr");
      await expect(ctx.main.selectForTest(1)).to.be.revertedWithCustomError(ctx.main, "NoConfiguredMintableIndex");
      expect(maxGas).to.be.lessThan(750000);
      console.log(`    ${scenario}: 550/550 mints, peak callback gas ${maxGas}`);
    });
  }

  it("preserves V1 color price growth, snapshots, rarity, token URIs and eligibility", async function () {
    const old = await fixture({ version: 1 });
    const ctx = await fixture();
    for (const main of [old.main, ctx.main]) {
      for (let block = 1; block <= 10; block++) await main.setURI(3, block, `ipfs://same-block-${block}/`);
    }
    const words = [0, 0, 99, 100, 190, 255, 256, 511, 512, 549, 549, 199, 300];
    const used = new Set();
    for (let i = 0; i < words.length; i++) {
      const oldId = await request(old, old.alice.address, i + 1);
      const id = await request(ctx, ctx.alice.address, i + 1);
      await old.coordinator.fulfill(old.router.address, oldId, words[i]);
      await deliver(ctx, id, words[i]);
      const idx = (await ctx.main.assignedIndex(id)).toNumber();
      expect(used.has(idx)).to.equal(false);
      used.add(idx);
      expect(await ctx.main.getMintData(idx)).to.deep.equal(await old.main.getMintData(idx));
      expect(await ctx.main.nftInfo(idx)).to.deep.equal(await old.main.nftInfo(idx));
      expect(await ctx.main.tokenURI(1000 + idx)).to.equal(await old.main.tokenURI(1000 + idx));
      for (let block = 1; block <= 10; block++) {
        expect(await ctx.main.blockInfos(block - 1)).to.deep.equal(await old.main.blockInfos(block - 1));
        expect(await ctx.main.backgroundMintCounts(block - 1)).to.equal(await old.main.backgroundMintCounts(block - 1));
      }
    }
    expect(await ctx.main.hasAllTenMainIdsInBlock(ctx.alice.address, 1)).to.equal(await old.main.hasAllTenMainIdsInBlock(old.alice.address, 1));
    expect(await ctx.main.hasAllBackgroundsForMainIdInBlock(ctx.alice.address, 1, 1)).to.equal(await old.main.hasAllBackgroundsForMainIdInBlock(old.alice.address, 1, 1));
  });

  for (const mode of [1, 2, 3]) {
    it(`retains the original word and reserved NFT after receiver failure mode ${mode}`, async function () {
      const ctx = await fixture();
      const receiver = await deploy("MockVrfRecoveryReceiver");
      await receiver.configure(mode, ZERO, "0x");
      const id = await request(ctx, receiver.address);
      await deliver(ctx, id, 0);
      const result = await ctx.router.getRequestResult(id);
      expect(result.consumer).to.equal(ctx.main.address);
      expect(result.ready).to.equal(true);
      expect(result.word).to.equal(0);
      expect(await ctx.main.assignedIndex(id)).to.equal(1);
      expect(await ctx.main.pendingMintRequest(receiver.address)).to.equal(id);
      expect(await ctx.main.biggiMinted()).to.equal(0);
      expect(await ctx.main.getCurrentBlockPrice(1)).to.equal(ethers.utils.parseEther("100"));
      // A later draw cannot take the reserved NFT, even while its receiver is failing.
      const second = await request(ctx);
      await deliver(ctx, second, 0);
      expect(await ctx.main.assignedIndex(second)).to.equal(2);
      await receiver.configure(0, ZERO, "0x");
      await ctx.main.pause();
      const recovery = await (await ctx.router.connect(ctx.stranger).deliverRandomness(id)).wait();
      const recoveryEvents = recovery.logs.filter((log) => log.address === ctx.main.address)
        .map((log) => ctx.main.interface.parseLog(log).name);
      expect(recoveryEvents).to.include("VRFFulfillStarted");
      expect(recoveryEvents).to.include("NFTMinted");
      expect(await ctx.main.ownerOf(1001)).to.equal(receiver.address);
      expect(await ctx.main.pendingMintCount()).to.equal(0);
      expect(await ctx.coordinator.nextRequestId()).to.equal(3);
      const price = await ctx.main.getCurrentBlockPrice(1);
      await ctx.router.deliverRandomness(id);
      await ctx.main.completePendingMint(id);
      await ctx.coordinator.fulfill(ctx.router.address, id, 549);
      expect((await ctx.router.getRequestResult(id)).word).to.equal(0);
      expect(await ctx.main.getCurrentBlockPrice(1)).to.equal(price);
      expect(await ctx.main.biggiMinted()).to.equal(2);
    });
  }

  it("blocks reentry during mint and never reassigns the same request", async function () {
    const ctx = await fixture();
    const receiver = await deploy("MockVrfRecoveryReceiver");
    const id = await request(ctx, receiver.address);
    await receiver.configure(4, ctx.main.address, ctx.main.interface.encodeFunctionData("completePendingMint", [id]));
    await deliver(ctx, id);
    expect(await receiver.reentrySucceeded()).to.equal(false);
    expect(await ctx.main.biggiMinted()).to.equal(1);
  });

  it("only completes verified draws; owner cannot select an NFT or reroll", async function () {
    const ctx = await fixture();
    const id = await request(ctx);
    for (const action of [
      () => ctx.main.connect(ctx.alice).retryPendingMint(),
      () => ctx.main.ownerRetryPendingMint(ctx.alice.address),
      () => ctx.main.emergencyResolvePendingMint(ctx.alice.address, 0),
    ]) await expect(action()).to.be.revertedWithCustomError(ctx.main, "RandomnessNotReady");
    await expect(ctx.main.emergencyResolvePendingMint(ctx.alice.address, 550)).to.be.revertedWithCustomError(ctx.main, "PreferredIndexDisabled");
    await expect(ctx.main.fulfillRandomFromRouter(id, 0)).to.be.revertedWithCustomError(ctx.main, "OnlyVrfRouter");
    await expect(ctx.router.rawFulfillRandomWords(id, [0])).to.be.reverted;
    expect(await ctx.coordinator.nextRequestId()).to.equal(2);
    expect(await ctx.main.pendingMintRequest(ctx.alice.address)).to.equal(id);
  });

  it("can resume via the legacy retry selector without spending another ticket or requesting VRF", async function () {
    const ctx = await fixture();
    const receiver = await deploy("MockVrfRecoveryReceiver");
    await receiver.configure(1, ZERO, "0x");
    const id = await request(ctx, receiver.address);
    await deliver(ctx, id, 549);
    await receiver.configure(0, ZERO, "0x");
    await receiver.execute(ctx.main.address, ctx.main.interface.encodeFunctionData("retryPendingMint"));
    expect(await ctx.main.ownerOf(1550)).to.equal(receiver.address);
    expect(await ctx.coordinator.nextRequestId()).to.equal(2);
    expect(await ctx.main.pendingRetryDelay()).to.equal(0);
    await ctx.router.deliverRandomness(id);
    expect(await ctx.main.biggiMinted()).to.equal(1);
  });

  it("keeps results durable even when the consumer burns assignment gas or returns huge revert data", async function () {
    const ctx = await fixture();
    const consumer = await deploy("MockVrfRecoveryConsumer");
    await ctx.router.setMainApproval(consumer.address, true);
    for (const mode of [1, 2]) {
      await consumer.setMode(mode);
      const id = await ctx.coordinator.nextRequestId();
      await consumer.request(ctx.router.address, ctx.alice.address, mode);
      await deliver(ctx, id, 123);
      expect((await ctx.router.getRequestResult(id)).ready).to.equal(true);
      expect(await consumer.deliveries()).to.equal(mode - 1);
      await consumer.setMode(0);
      await ctx.router.deliverRandomness(id);
      expect(await consumer.deliveries()).to.equal(mode);
    }
  });

  it("retains randomness at the minimum allowed callback budget and ignores unknown callbacks", async function () {
    const ctx = await fixture();
    await ctx.router.setVrfParams(KEY, 1, 300000, 3, 1);
    const id = await request(ctx);
    await deliver(ctx, id, 0);
    expect((await ctx.router.getRequestResult(id)).ready).to.equal(true);
    await ctx.router.deliverRandomness(id);
    expect(await ctx.main.ownerOf(1001)).to.equal(ctx.alice.address);
    await ctx.coordinator.fulfill(ctx.router.address, 999999, 42);
    expect((await ctx.router.getRequestResult(999999)).ready).to.equal(false);
    for (const gas of [299999, 2500001]) {
      await expect(ctx.router.setVrfParams(KEY, 1, gas, 3, 1)).to.be.revertedWith("INVALID_CALLBACK_GAS");
    }
    await expect(ctx.router.setVrfParams(KEY, 1, 750000, 2, 1)).to.be.revertedWith("INVALID_CONFIRMATIONS");
    await expect(ctx.router.setVrfParams(KEY, 1, 750000, 3, 2)).to.be.revertedWith("ONE_WORD_REQUIRED");
  });

  it("pins pending requests to the right wallet and consumer across out-of-order fulfillment and revocation", async function () {
    const ctx = await fixture();
    const aliceId = await request(ctx);
    const bobId = await request(ctx, ctx.bob.address, 2);
    await expect(request(ctx)).to.be.revertedWithCustomError(ctx.main, "AlreadyPending");
    const anotherConsumer = await deploy("MockVrfRecoveryConsumer");
    await ctx.router.setMain(anotherConsumer.address);
    await ctx.router.setMainApproval(ctx.main.address, false);
    await expect(request(ctx, ctx.stranger.address, 3)).to.be.revertedWith("ONLY_MAIN");
    await expect(ctx.main.setModules(ctx.compute.address, ZERO)).to.be.revertedWithCustomError(ctx.main, "PendingMintsExist");
    await expect(ctx.main.setBlockCurrentPrice(1, 1)).to.be.revertedWithCustomError(ctx.main, "PendingMintsExist");
    await expect(ctx.main.setChapterId(2)).to.be.revertedWithCustomError(ctx.main, "RoutingLocked");
    await deliver(ctx, bobId, 0);
    await deliver(ctx, aliceId, 0);
    expect(await ctx.main.ownerOf(1001)).to.equal(ctx.bob.address);
    expect(await ctx.main.ownerOf(1002)).to.equal(ctx.alice.address);
    const anotherRouter = await deploy("BiggiVRFRouterV2", ctx.coordinator.address, ctx.owner.address, KEY, 1);
    await expect(ctx.main.setModules(ZERO, anotherRouter.address)).to.be.revertedWithCustomError(ctx.main, "RoutingLocked");
  });

  it("rejects unsealed metadata before TicketHub burns a ticket", async function () {
    const ctx = await fixture({ seeded: false, realHub: true });
    const distributor = await deploy("MockMintShareReceiver");
    await ctx.hub.setDistributor(distributor.address);
    await ctx.hub.setChapterActive(1, true);
    await ctx.hub.connect(ctx.alice).mintTicket({ value: await ctx.hub.ticketPrice() });
    await expect(ctx.hub.connect(ctx.alice).redeemTicket(1)).to.be.revertedWithCustomError(ctx.main, "MetadataNotSealed");
    expect(await ctx.hub.ownerOf(1)).to.equal(ctx.alice.address);
    expect(await ctx.hub.isTicket(1)).to.equal(true);
    expect(await ctx.coordinator.nextRequestId()).to.equal(1);
    await expect(ctx.main.sealMetadata()).to.be.revertedWithCustomError(ctx.main, "MetadataConfigurationIncomplete");
    await seed(ctx.main);
    await ctx.main.sealMetadata();
    await expect(ctx.main.batchSetNFTBackgroundAndBlock([], [], [], [])).to.be.revertedWith("METADATA_SEALED");
    await ctx.hub.connect(ctx.alice).redeemTicket(1);
    const id = await ctx.main.pendingMintRequest(ctx.alice.address);
    expect(await ctx.hub.isTicket(1)).to.equal(false);
    await deliver(ctx, id, 0);
    expect(await ctx.main.ownerOf(1001)).to.equal(ctx.alice.address);
  });

  it("does not seal a full but duplicate reward matrix", async function () {
    const ctx = await fixture({ seeded: false });
    for (let start = 1; start <= 550; start += 55) {
      const indices = Array.from({ length: 55 }, (_, offset) => start + offset);
      const repeated = Array(55).fill(1);
      await ctx.main.batchSetNFTBackgroundAndBlock(indices, repeated, repeated, repeated);
    }
    expect((await ctx.main.metadataConsistency()).fullyConfigured).to.equal(true);
    await expect(ctx.main.sealMetadata()).to.be.revertedWithCustomError(ctx.main, "RewardMatrixInconsistent");
    expect(await ctx.main.metadataSealed()).to.equal(false);
  });

  it("recovers an actually burned TicketHub ticket without another burn or another draw", async function () {
    const ctx = await fixture({ realHub: true });
    const distributor = await deploy("MockMintShareReceiver");
    const receiver = await deploy("MockVrfRecoveryReceiver");
    await ctx.hub.setDistributor(distributor.address);
    await ctx.hub.setChapterActive(1, true);
    const ticketPrice = await ctx.hub.ticketPrice();
    await ctx.hub.connect(ctx.alice).mintTicket({ value: ticketPrice });
    await ctx.hub.connect(ctx.alice)["safeTransferFrom(address,address,uint256)"](ctx.alice.address, receiver.address, 1);
    await receiver.execute(ctx.hub.address, ctx.hub.interface.encodeFunctionData("redeemTicket", [1]));
    const id = await ctx.main.pendingMintRequest(receiver.address);
    await receiver.configure(1, ZERO, "0x");
    await deliver(ctx, id, 255);
    expect(await ctx.hub.isTicket(1)).to.equal(false);
    expect(await ctx.main.pendingMintRequest(receiver.address)).to.equal(id);
    expect(await ctx.main.assignedIndex(id)).to.equal(256);
    await receiver.configure(0, ZERO, "0x");
    await ctx.main.connect(ctx.stranger).completePendingMint(id);
    expect(await ctx.main.ownerOf(1256)).to.equal(receiver.address);
    expect((await ctx.main.getMintData(256))[0]).to.equal(ticketPrice);
    expect(await ctx.hub.ticketMinted()).to.equal(1);
    expect(await ctx.hub.ticketCount(receiver.address)).to.equal(0);
    expect(await ctx.coordinator.nextRequestId()).to.equal(2);
  });

  it("counts outstanding requests against supply before burning more tickets", async function () {
    const ctx = await fixture();
    for (let i = 1; i <= 550; i++) {
      const address = ethers.utils.getAddress(ethers.utils.hexZeroPad(ethers.utils.hexlify(i + 10000), 20));
      await request(ctx, address, i);
    }
    expect(await ctx.main.pendingMintCount()).to.equal(550);
    await expect(request(ctx)).to.be.revertedWithCustomError(ctx.main, "AllNFTsMintedErr");
    expect(await ctx.coordinator.nextRequestId()).to.equal(551);
  });
});
