const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const forkSuite = process.env.VRF_RECOVERY_FORK_URL ? describe : describe.skip;

function same(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

forkSuite("CORE V2 Originals-only cutover (local Polygon fork)", function () {
  this.timeout(600000);

  async function impersonate(account) {
    await network.provider.send("hardhat_impersonateAccount", [account]);
    await network.provider.send("hardhat_setBalance", [account, ethers.utils.hexValue(ethers.utils.parseEther("1000"))]);
    return ethers.getSigner(account);
  }

  it("cuts over only chapter 1 and leaves chapters 2-5 inactive and unchanged", async function () {
    expect(network.name).to.equal("hardhat");
    const metadata = await network.provider.send("hardhat_metadata");
    expect(metadata.forkedNetwork.chainId).to.equal(137);
    await network.provider.send("evm_mine");

    const root = path.resolve(__dirname, "../..");
    const state = JSON.parse(fs.readFileSync(path.join(root, "addresses.core-v2-migration.resume.polygon.json"), "utf8"));
    const book = JSON.parse(fs.readFileSync(path.join(root, "addresses.master.json"), "utf8"));
    expect(state.status).to.equal("staged-chapters-1-2-configured");
    expect(state.pending).to.equal(undefined);

    const owner = await impersonate(state.owner);
    const deployer = await impersonate(state.deployer);
    const hub = (await ethers.getContractAt("BiggiTicketHub", book.TICKET_HUB)).connect(owner);
    const registry = (await ethers.getContractAt("BiggiSeriesRegistry", book.REGISTRY)).connect(owner);
    const controller = await ethers.getContractAt("BiggiChapterController", book.CHAPTER_CONTROLLER);
    const rewards = (await ethers.getContractAt("BiggiCollectionRewards", book.COLLECTION_REWARDS)).connect(owner);
    const router = (await ethers.getContractAt("BiggiVRFRouterV2", state.router)).connect(owner);
    const chapterOneState = state.chapters.find((chapter) => Number(chapter.id) === 1);
    const chapterOne = (await ethers.getContractAt("BiggiEyesMainV2", chapterOneState.newMain)).connect(owner);
    const publicOne = (await ethers.getContractAt("BiggiEyesMain2", chapterOneState.publicCollection)).connect(owner);

    expect(await chapterOne.metadataSealed()).to.equal(true);
    console.log("    Originals metadata is sealed; capturing deferred chapter state");

    const deferredBefore = new Map();
    for (const chapter of state.chapters.filter((entry) => Number(entry.id) > 1)) {
      const id = Number(chapter.id);
      const collections = await registry.getChapterCollections(id);
      const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection);
      deferredBefore.set(id, {
        active: await hub.chapterActive(id),
        hubMain: await hub.chapterMainCollection(id),
        registryMain: collections.vrfCollection,
        registryPublic: collections.publicCollection,
        registryHub: collections.ticketHub,
        priceProvider: await publicCollection.priceProvider(),
        routerApproved: await router.approvedMains(chapter.newMain),
      });
    }

    let ownerGas = ethers.constants.Zero;
    let deployerGas = ethers.constants.Zero;
    async function record(transactionPromise, role) {
      const receipt = await (await transactionPromise).wait();
      if (role === "owner") ownerGas = ownerGas.add(receipt.gasUsed);
      else deployerGas = deployerGas.add(receipt.gasUsed);
      return receipt;
    }

    const readerFactory = await ethers.getContractFactory("BiggiMainReader", deployer);
    const reader = await readerFactory.deploy(chapterOne.address, hub.address, rewards.address);
    const readerReceipt = await reader.deployTransaction.wait();
    deployerGas = deployerGas.add(readerReceipt.gasUsed);
    console.log("    Reader deployed; applying Originals-only wiring on the fork");

    if (!(await router.approvedMains(chapterOne.address))) {
      await record(router.setMain(chapterOne.address), "owner");
    }
    if (!same(await router.main(), chapterOne.address)) {
      await record(router.setMain(chapterOne.address), "owner");
    }

    const oldRouter = await ethers.getContractAt("BiggiVRFRouter", book.VRF_ROUTER);
    const coordinatorAddress = await oldRouter.coordinator();
    const subId = await oldRouter.subId();
    const coordinator = new ethers.Contract(coordinatorAddress, [
      "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address subOwner,address[] consumers)",
      "function addConsumer(uint256 subId,address consumer)",
    ], owner);
    let subscription = await coordinator.getSubscription(subId);
    if (!subscription.consumers.some((consumer) => same(consumer, router.address))) {
      await record(coordinator.addConsumer(subId, router.address), "owner");
    }

    if (!same(await hub.chapterMainCollection(1), chapterOne.address)) {
      await record(hub.setChapterMainCollection(1, chapterOne.address), "owner");
    }
    if (!same(await chapterOne.ticketHub(), hub.address)) {
      await record(chapterOne.setTicketHub(hub.address), "owner");
    }
    let current = await registry.getChapterCollections(1);
    if (!same(current.vrfCollection, chapterOne.address)) {
      await record(registry.setChapterCollections(1, chapterOne.address, chapterOneState.publicCollection, hub.address), "owner");
    }
    const budget = await rewards.collectionBudgetSnapshot(chapterOne.address);
    if (!budget.configured) await record(rewards.configureCollectionBudget(chapterOne.address), "owner");
    if (same(await publicOne.priceProvider(), chapterOneState.oldMain)) {
      await record(publicOne.setPriceProvider(chapterOne.address), "owner");
    }
    if (!same(await rewards.defaultMain(), chapterOne.address)) {
      await record(rewards.setMain(chapterOne.address), "owner");
    }
    if (!same(await rewards.fundingCollection(), chapterOne.address)) {
      await record(rewards.setFundingCollection(chapterOne.address), "owner");
    }

    expect(await hub.chapterActive(1)).to.equal(false);
    expect(await hub.chapterMainCollection(1)).to.equal(chapterOne.address);
    expect(await chapterOne.ticketHub()).to.equal(hub.address);
    current = await registry.getChapterCollections(1);
    expect(current.vrfCollection).to.equal(chapterOne.address);
    expect(await router.approvedMains(chapterOne.address)).to.equal(true);
    expect(await controller.isChapterStackConsistent(1)).to.equal(true);
    expect(await controller.isChapterCapConsistent(1)).to.equal(true);
    expect((await rewards.collectionBudgetSnapshot(chapterOne.address)).configured).to.equal(true);
    expect(await rewards.defaultMain()).to.equal(chapterOne.address);
    expect(await rewards.fundingCollection()).to.equal(chapterOne.address);
    expect(await reader.main()).to.equal(chapterOne.address);

    subscription = await coordinator.getSubscription(subId);
    expect(subscription.consumers.some((consumer) => same(consumer, router.address))).to.equal(true);
    expect(subscription.consumers.some((consumer) => same(consumer, book.VRF_ROUTER))).to.equal(true);

    for (const chapter of state.chapters.filter((entry) => Number(entry.id) > 1)) {
      const id = Number(chapter.id);
      const before = deferredBefore.get(id);
      const collections = await registry.getChapterCollections(id);
      const publicCollection = await ethers.getContractAt("BiggiEyesMain2", chapter.publicCollection);
      expect(await hub.chapterActive(id), `chapter ${id} active`).to.equal(false);
      expect(await hub.chapterMainCollection(id), `chapter ${id} TicketHub`).to.equal(before.hubMain);
      expect(collections.vrfCollection, `chapter ${id} registry main`).to.equal(before.registryMain);
      expect(collections.publicCollection, `chapter ${id} registry public`).to.equal(before.registryPublic);
      expect(collections.ticketHub, `chapter ${id} registry hub`).to.equal(before.registryHub);
      expect(await publicCollection.priceProvider(), `chapter ${id} price provider`).to.equal(before.priceProvider);
      expect(await router.approvedMains(chapter.newMain), `chapter ${id} router approval`).to.equal(before.routerApproved);
      expect(before.routerApproved, `chapter ${id} was unexpectedly approved before test`).to.equal(false);
    }

    console.log(`    ORIGINALS_SELECTIVE_OWNER_GAS=${ownerGas.toString()}`);
    console.log(`    ORIGINALS_SELECTIVE_DEPLOYER_GAS=${deployerGas.toString()}`);
  });
});
