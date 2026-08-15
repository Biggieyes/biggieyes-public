const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

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

async function setupTreasuryStack(owner) {
  const nftMain = await deploy("MockBlockNft");
  const nftMain2 = await deploy("MockBlockNft");
  const token = await deploy("BiggiToken", owner.address);
  const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
  const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
  const rewards = await deploy("BiggiTokenRewards", nftMain.address, nftMain2.address, token.address, owner.address);
  const treasury = await deploy("BiggiTreasury", token.address, owner.address);

  await (await treasury.setTokenRewards(rewards.address)).wait();
  await (await treasury.setReserve(reserve.address)).wait();
  await (await treasury.setDripDistributor(drip.address)).wait();
  await (await reserve.setNotifyCaller(treasury.address, true)).wait();
  await (await drip.setTreasury(treasury.address)).wait();

  return { token, reserve, drip, rewards, treasury };
}

function split(amount) {
  const toRewards = amount.mul(3400).div(10000);
  const toReserve = amount.mul(3300).div(10000);
  const toDrip = amount.sub(toRewards).sub(toReserve);
  return { toRewards, toReserve, toDrip };
}

describe("BIGGI_MASTER: ecosystem BIGGI NFT payments", function () {
  it("routes TicketHub BIGGI payments through treasury 34/33/33 split", async () => {
    const [owner, alice] = await ethers.getSigners();
    const { token, reserve, drip, rewards, treasury } = await setupTreasuryStack(owner);
    const mainPlaceholder = await deploy("MockBlockNft");
    const ticketHub = await deploy("BiggiTicketHub", owner.address, mainPlaceholder.address);

    const price = toWei("10");
    const expected = split(price);

    await (await ticketHub.setBiggiToken(token.address)).wait();
    await (await ticketHub.setTicketPrice(price)).wait();
    await (await ticketHub.setTokenSink(treasury.address, 10_000)).wait();
    await (await ticketHub.setTokenSinkDepositMode(true)).wait();
    await (await treasury.setEcosystemBiggiCaller(ticketHub.address, true)).wait();

    await (await token.mint(alice.address, price)).wait();
    await (await token.connect(alice).approve(ticketHub.address, price)).wait();

    await expect(ticketHub.connect(alice).mintTicketWithBiggi())
      .to.emit(treasury, "EcosystemBiggiReceived")
      .withArgs(ticketHub.address, price, expected.toRewards, expected.toReserve, expected.toDrip);

    expect(await treasury.totalBiggiReceivedFromEcosystem()).to.equal(price);
    expect(await token.balanceOf(rewards.address)).to.equal(expected.toRewards);
    expect(await token.balanceOf(reserve.address)).to.equal(expected.toReserve);
    expect(await token.balanceOf(drip.address)).to.equal(expected.toDrip);
    expect(await drip.getTotalReceived()).to.equal(expected.toDrip);
    expect(await drip.getAvailable()).to.equal(expected.toDrip);
  });

  it("rejects unsafe zero BIGGI payment configuration on TicketHub", async () => {
    const [owner, alice] = await ethers.getSigners();
    const { token } = await setupTreasuryStack(owner);
    const mainPlaceholder = await deploy("MockBlockNft");
    const ticketHub = await deploy("BiggiTicketHub", owner.address, mainPlaceholder.address);

    await expect(ticketHub.setBiggiRate(0)).to.be.reverted;

    await (await ticketHub.setBiggiToken(token.address)).wait();
    await (await ticketHub.setTicketPrice(1)).wait();
    await (await ticketHub.setBiggiRate(1)).wait();
    await expect(ticketHub.connect(alice).mintTicketWithBiggi()).to.be.reverted;
  });

  it("routes Main2 public BIGGI payments through treasury 34/33/33 split", async () => {
    const [owner, alice] = await ethers.getSigners();
    const { token, reserve, drip, rewards, treasury } = await setupTreasuryStack(owner);
    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const controller = await deploy("BiggiChapterController", owner.address, registry.address);
    const main = await deployMainWithLinkedLibraries(owner.address);
    const main2 = await deployMain2WithLinkedLibraries(owner.address);
    const ticketProgress = await deploy("MockTicketHubProgress");

    const price = toWei("20");
    const expected = split(price);

    await (await ticketProgress.setMainCollection(main.address)).wait();
    await (await ticketProgress.setCaps(5, 5, 10)).wait();
    await (await ticketProgress.setProgress(5, 5, 10)).wait();
    await (await main.setTicketHub(ticketProgress.address)).wait();
    await (await main.setBlockCurrentPrice(1, price)).wait();

    await (await registry.createSeries("Series A")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.setChapterCollections(1, main.address, main2.address, ticketProgress.address)).wait();
    await (await controller.configureChapter(1, 1, main.address, main2.address, ticketProgress.address, 5, 5, 10)).wait();

    await (await main2.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();
    await (await main2.setChapterController(controller.address, 1)).wait();
    await (await main2.setBiggiToken(token.address)).wait();
    await (await main2.setTokenSink(treasury.address, 10_000)).wait();
    await (await main2.setTokenSinkDepositMode(true)).wait();
    await (await treasury.setEcosystemBiggiCaller(main2.address, true)).wait();

    await (await token.mint(alice.address, price)).wait();
    await (await token.connect(alice).approve(main2.address, price)).wait();

    await expect(main2.connect(alice).mintPublicWithBiggi(1))
      .to.emit(treasury, "EcosystemBiggiReceived")
      .withArgs(main2.address, price, expected.toRewards, expected.toReserve, expected.toDrip);

    expect(await treasury.totalBiggiReceivedFromEcosystem()).to.equal(price);
    expect(await token.balanceOf(rewards.address)).to.equal(expected.toRewards);
    expect(await token.balanceOf(reserve.address)).to.equal(expected.toReserve);
    expect(await token.balanceOf(drip.address)).to.equal(expected.toDrip);
    expect(await drip.getTotalReceived()).to.equal(expected.toDrip);
    expect(await drip.getAvailable()).to.equal(expected.toDrip);
    expect(await main2.ownerOf(1001)).to.equal(alice.address);
  });

  it("rejects unsafe zero BIGGI payment configuration on Main2", async () => {
    const [owner, alice] = await ethers.getSigners();
    const { token } = await setupTreasuryStack(owner);
    const registry = await deploy("BiggiSeriesRegistry", owner.address);
    const controller = await deploy("BiggiChapterController", owner.address, registry.address);
    const main = await deployMainWithLinkedLibraries(owner.address);
    const main2 = await deployMain2WithLinkedLibraries(owner.address);
    const ticketProgress = await deploy("MockTicketHubProgress");

    await expect(main2.setBiggiRate(0)).to.be.reverted;

    await (await ticketProgress.setMainCollection(main.address)).wait();
    await (await ticketProgress.setCaps(5, 5, 10)).wait();
    await (await ticketProgress.setProgress(5, 5, 10)).wait();
    await (await main.setTicketHub(ticketProgress.address)).wait();
    await (await main.setBlockCurrentPrice(1, 1)).wait();

    await (await registry.createSeries("Series A")).wait();
    await (await registry.createChapter(1)).wait();
    await (await registry.setChapterCollections(1, main.address, main2.address, ticketProgress.address)).wait();
    await (await controller.configureChapter(1, 1, main.address, main2.address, ticketProgress.address, 5, 5, 10)).wait();

    await (await main2.batchSetNFTBackgroundAndBlock([1], [1], [1], [1])).wait();
    await (await main2.setChapterController(controller.address, 1)).wait();
    await (await main2.setBiggiToken(token.address)).wait();
    await (await main2.setBiggiRate(1)).wait();

    await expect(main2.connect(alice).mintPublicWithBiggi(1)).to.be.reverted;
  });
});
