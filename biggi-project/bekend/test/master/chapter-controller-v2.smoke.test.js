const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployMain(initialOwner) {
  const names = await deploy("BiggiNamesLib");
  const Factory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: names.address },
  });
  const contract = await Factory.deploy(initialOwner);
  await contract.deployed();
  return contract;
}

async function deployFixture() {
  const [owner, publicCollection, outsider] = await ethers.getSigners();
  const registry = await deploy("BiggiSeriesRegistry", owner.address);
  const controller = await deploy(
    "BiggiChapterControllerV2",
    owner.address,
    registry.address,
  );
  const main = await deployMain(owner.address);
  const hub = await deploy("MockTicketHubProgress");

  await (await hub.setMainCollection(main.address)).wait();
  await (await main.setTicketHub(hub.address)).wait();
  await (await registry.createSeries("Originals")).wait();
  await (await registry.createChapter(1)).wait();
  await (
    await registry.setChapterCollections(
      1,
      main.address,
      publicCollection.address,
      hub.address,
    )
  ).wait();

  return { owner, publicCollection, outsider, registry, controller, main, hub };
}

describe("BIGGI_MASTER: ChapterController V2 public unlock", function () {
  it("unlocks at ten paid sales and ignores marketing progress", async () => {
    const { controller, main, publicCollection, hub } = await deployFixture();

    await (await hub.setCaps(500, 50, 550)).wait();
    await (
      await controller.configureChapterWithUnlockThreshold(
        1,
        1,
        main.address,
        publicCollection.address,
        hub.address,
        500,
        50,
        550,
        10,
      )
    ).wait();

    await (await hub.setProgress(9, 50, 59)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(false);

    await (await hub.setProgress(10, 0, 10)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(true);

    await (await hub.setProgress(10, 50, 60)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(true);

    const progress = await controller.chapterMintProgress(1);
    expect(progress.saleMinted_).to.equal(10);
    expect(progress.marketingMinted_).to.equal(50);
    expect(progress.totalMinted_).to.equal(60);
    expect(progress.publicUnlocked).to.equal(true);
  });

  it("stages while sale is disabled and remains fail-closed until caps match", async () => {
    const { controller, main, publicCollection, hub } = await deployFixture();

    await (await hub.setCaps(0, 550, 550)).wait();
    await (await hub.setProgress(0, 50, 50)).wait();
    await (
      await controller.stageChapterWithUnlockThreshold(
        1,
        1,
        main.address,
        publicCollection.address,
        hub.address,
        500,
        50,
        550,
        10,
      )
    ).wait();
    await (await controller.lockPublicUnlockSaleThreshold(1)).wait();

    expect(await controller.isChapterCapConsistent(1)).to.equal(false);
    expect(await controller.isPublicMintUnlocked(1)).to.equal(false);
    expect(await controller.publicUnlockThresholdLocked(1)).to.equal(true);
    await expect(
      controller.setPublicUnlockSaleThreshold(1, 9),
    ).to.be.revertedWithCustomError(
      controller,
      "ChapterControllerV2UnlockThresholdLocked",
    );

    await (await hub.setCaps(500, 50, 550)).wait();
    await (await hub.setProgress(9, 50, 59)).wait();
    expect(await controller.isChapterCapConsistent(1)).to.equal(true);
    expect(await controller.isPublicMintUnlocked(1)).to.equal(false);

    await (await hub.setProgress(10, 50, 60)).wait();
    expect(await controller.isPublicMintUnlocked(1)).to.equal(true);
  });

  it("rejects invalid thresholds and non-owner configuration", async () => {
    const { controller, main, publicCollection, outsider, hub } = await deployFixture();
    await (await hub.setCaps(500, 50, 550)).wait();

    await expect(
      controller.configureChapterWithUnlockThreshold(
        1,
        1,
        main.address,
        publicCollection.address,
        hub.address,
        500,
        50,
        550,
        0,
      ),
    ).to.be.revertedWithCustomError(
      controller,
      "ChapterControllerV2InvalidUnlockThreshold",
    );

    await expect(
      controller.connect(outsider).configureChapterWithUnlockThreshold(
        1,
        1,
        main.address,
        publicCollection.address,
        hub.address,
        500,
        50,
        550,
        10,
      ),
    ).to.be.revertedWithCustomError(controller, "OwnableUnauthorizedAccount");
  });
});
