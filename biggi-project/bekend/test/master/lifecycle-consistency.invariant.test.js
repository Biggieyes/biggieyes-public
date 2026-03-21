const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployMainWithLinkedLibraries(initialOwner) {
  const namesLib = await deploy("BiggiNamesLib");
  const mainFactory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: {
      BiggiNamesLib: namesLib.address,
    },
  });
  const main = await mainFactory.deploy(initialOwner);
  await main.deployed();
  return main;
}

async function deployMain2WithLinkedLibraries(initialOwner) {
  const namesLib2 = await deploy("BiggiNamesLib2");
  const main2Factory = await ethers.getContractFactory("BiggiEyesMain2", {
    libraries: {
      BiggiNamesLib2: namesLib2.address,
    },
  });
  const main2 = await main2Factory.deploy(initialOwner);
  await main2.deployed();
  return main2;
}

describe("BIGGI_MASTER: lifecycle and consistency invariants", function () {
  let owner;
  let alice;
  let bob;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
  });

  it("keeps TicketHub/Main lifecycle consistent across repeated VRF requests", async () => {
    const main = await deployMainWithLinkedLibraries(owner.address);
    const ticketHub = await deploy("BiggiTicketHub", owner.address, main.address);
    const compute = await deploy("BiggiCompute");
    const mockVrfRouter = await deploy("MockVrfRouter");

    await (await main.setModules(compute.address, mockVrfRouter.address)).wait();
    await (await main.setTicketHub(ticketHub.address)).wait();

    await (
      await main.batchSetNFTBackgroundAndBlock([1, 2, 3], [1, 2, 3], [1, 1, 1], [1, 2, 3])
    ).wait();

    const mintedAtPrices = [];
    for (let i = 0; i < 3; i += 1) {
      const ticketPrice = await ticketHub.ticketPrice();
      mintedAtPrices.push(ticketPrice);
      await (await ticketHub.connect(alice).mintTicket({ value: ticketPrice })).wait();
    }

    expect(await ticketHub.ticketMinted()).to.equal(3);
    expect(await ticketHub.saleMinted()).to.equal(3);
    expect(await ticketHub.ticketCount(alice.address)).to.equal(3);

    for (let ticketId = 1; ticketId <= 3; ticketId += 1) {
      await (await ticketHub.connect(alice).redeemTicket(ticketId)).wait();

      const requestId = await main.pendingMintRequest(alice.address);
      expect(requestId).to.not.equal(0);
      expect(await main.pendingTicketId(requestId)).to.equal(ticketId);
      expect(await main.pendingTicketPrice(requestId)).to.equal(mintedAtPrices[ticketId - 1]);

      await (await mockVrfRouter.fulfill(requestId, 0)).wait();

      expect(await main.pendingMintRequest(alice.address)).to.equal(0);
      expect(await main.pendingMinters(requestId)).to.equal(ethers.constants.AddressZero);
      expect(await main.ownerOf(1000 + ticketId)).to.equal(alice.address);

      const mintData = await main.getMintData(ticketId);
      expect(mintData[0]).to.equal(mintedAtPrices[ticketId - 1]);
    }

    expect(await main.biggiMinted()).to.equal(3);
    expect(await ticketHub.ticketCount(alice.address)).to.equal(0);
    expect(await ticketHub.isTicket(1)).to.equal(false);
    expect(await ticketHub.isTicket(2)).to.equal(false);
    expect(await ticketHub.isTicket(3)).to.equal(false);
  });

  it("enforces sale/marketing cap segregation in TicketHub", async () => {
    const main = await deployMainWithLinkedLibraries(owner.address);
    const ticketHub = await deploy("BiggiTicketHub", owner.address, main.address);

    await (await ticketHub.setTicketCaps(1, 549)).wait();

    const price = await ticketHub.ticketPrice();
    await (await ticketHub.connect(alice).mintTicket({ value: price })).wait();

    await expect(ticketHub.connect(bob).mintTicket({ value: price })).to.be.reverted;

    await (await ticketHub.mintMarketingTicket(owner.address)).wait();

    expect(await ticketHub.saleMinted()).to.equal(1);
    expect(await ticketHub.marketingMinted()).to.equal(1);
    expect(await ticketHub.ticketMinted()).to.equal(2);
  });

  it("keeps chapter unlock strict and uses chapter VRF collection as public price provider", async () => {
    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const controller = await deploy("BiggiChapterController", owner.address, registry.address);
    const main = await deployMainWithLinkedLibraries(owner.address);
    const main2 = await deployMain2WithLinkedLibraries(owner.address);
    const ticketProgress = await deploy("MockTicketHubProgress");
    const distributor = await deploy("MockMintShareReceiver");

    await (await registry.createSeries("Series A")).wait();
    await (await registry.createChapter(1)).wait();
    await (
      await registry.setChapterCollections(1, main.address, main2.address, ticketProgress.address)
    ).wait();
    await (
      await controller.configureChapter(
        1,
        1,
        main.address,
        main2.address,
        ticketProgress.address,
        2,
        1,
        3
      )
    ).wait();

    await (await main2.setDistributor(distributor.address)).wait();
    await (await main2.setChapterController(controller.address, 1)).wait();
    await (await main2.setPriceProvider(owner.address)).wait();

    await (await main2.batchSetNFTBackgroundAndBlock([1, 2], [1, 2], [1, 1], [1, 2])).wait();

    await (await main.setBlockCurrentPrice(1, ethers.utils.parseEther("2"))).wait();
    await (await main2.setBlockCurrentPrice(1, ethers.utils.parseEther("9"))).wait();

    // Not unlocked: total minted mismatch (2 instead of configured 3)
    await (await ticketProgress.setProgress(2, 1, 2)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(false);
    await expect(main2.connect(alice).mintPublic(1, { value: ethers.utils.parseEther("2") })).to.be.reverted;

    // Exact cap equality unlocks public mint
    await (await ticketProgress.setProgress(2, 1, 3)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(true);

    // Main2 must resolve price from chapter VRF provider (main), not local block price
    const resolvedPrice = await main2.getCurrentBlockPrice(1);
    expect(resolvedPrice).to.equal(ethers.utils.parseEther("2"));

    await (await main2.connect(alice).mintPublic(1, { value: resolvedPrice })).wait();
    expect(await main2.ownerOf(1001)).to.equal(alice.address);

    // If chapter progress drops below configured caps, lock is active again
    await (await ticketProgress.setProgress(2, 0, 2)).wait();
    await expect(main2.connect(alice).mintPublic(2, { value: resolvedPrice })).to.be.reverted;
  });

  it("enforces MAX_BATCH and one-time metadata assignment in both Main contracts", async () => {
    const main = await deployMainWithLinkedLibraries(owner.address);
    const main2 = await deployMain2WithLinkedLibraries(owner.address);

    const tooLargeIndices = [];
    const tooLargeBg = [];
    const tooLargeBlocks = [];
    const tooLargeMainIds = [];

    for (let i = 1; i <= 56; i += 1) {
      tooLargeIndices.push(i);
      tooLargeBg.push(1);
      tooLargeBlocks.push(1);
      tooLargeMainIds.push(i);
    }

    await expect(
      main.batchSetNFTBackgroundAndBlock(tooLargeIndices, tooLargeBg, tooLargeBlocks, tooLargeMainIds)
    ).to.be.reverted;

    await expect(
      main2.batchSetNFTBackgroundAndBlock(tooLargeIndices, tooLargeBg, tooLargeBlocks, tooLargeMainIds)
    ).to.be.reverted;

    await expect(main.batchSetNFTBackgroundAndBlock([1, 2], [1], [1, 1], [1, 2])).to.be.reverted;
    await expect(main2.batchSetNFTBackgroundAndBlock([1, 2], [1], [1, 1], [1, 2])).to.be.reverted;

    await (await main.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();
    await (await main2.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();

    await expect(main.batchSetNFTBackgroundAndBlock([1], [2], [2], [2])).to.be.reverted;
    await expect(main2.batchSetNFTBackgroundAndBlock([1], [2], [2], [2])).to.be.reverted;
  });
});
