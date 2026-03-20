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

describe("BIGGI_MASTER: scaling collections smoke", function () {
  let owner;
  let alice;

  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it("keeps public mint locked until chapter exhaust and then mints with VRF-side price", async () => {
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
        5,
        5,
        10
      )
    ).wait();

    await (await main.setBlockCurrentPrice(1, ethers.utils.parseEther("2"))).wait();
    await (await main2.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();
    await (await main2.setDistributor(distributor.address)).wait();
    await (await main2.setChapterController(controller.address, 1)).wait();

    await (await ticketProgress.setProgress(0, 0, 0)).wait();
    await expect(
      main2.connect(alice).mintPublic(1, { value: ethers.utils.parseEther("2") })
    ).to.be.reverted;

    await (await ticketProgress.setProgress(5, 5, 10)).wait();

    const expectedPrice = await main.getCurrentBlockPrice(1);
    await expect(main2.connect(alice).mintPublic(1, { value: expectedPrice }))
      .to.emit(main2, "PublicMint");

    expect(await main2.ownerOf(1001)).to.equal(alice.address);
    expect(await distributor.totalReceived()).to.equal(expectedPrice.mul(6000).div(10000));
  });

  it("redeems ticket through hub and finalizes mint with VRF callback", async () => {
    const main = await deployMainWithLinkedLibraries(owner.address);
    const main2 = await deployMain2WithLinkedLibraries(owner.address);
    const ticketHub = await deploy("BiggiTicketHub", owner.address, main.address);
    const compute = await deploy("BiggiCompute");
    const mockVrfRouter = await deploy("MockVrfRouter");
    const distributor = await deploy("MockMintShareReceiver");

    await (await main.setModules(compute.address, mockVrfRouter.address)).wait();
    await (await main.setTicketHub(ticketHub.address)).wait();
    await (await ticketHub.setMainCollection(main.address)).wait();
    await (await ticketHub.setDistributor(distributor.address)).wait();
    await (await main.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();
    await (await main2.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();

    const mintPrice = await ticketHub.ticketPrice();
    await (await ticketHub.connect(alice).mintTicket({ value: mintPrice })).wait();
    expect(await ticketHub.ownerOf(1)).to.equal(alice.address);

    await (await ticketHub.connect(alice).redeemTicket(1)).wait();
    const requestId = await main.pendingMintRequest(alice.address);
    expect(requestId).to.not.equal(0);

    await (await mockVrfRouter.fulfill(requestId, 0)).wait();

    expect(await main.pendingMintRequest(alice.address)).to.equal(0);
    expect(await main.biggiMinted()).to.equal(1);
    expect(await main.ownerOf(1001)).to.equal(alice.address);

    const mintData = await main.getMintData(1);
    expect(mintData[0]).to.equal(mintPrice);
  });
});
