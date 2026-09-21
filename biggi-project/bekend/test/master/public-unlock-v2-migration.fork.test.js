const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const forkSuite = process.env.PUBLIC_UNLOCK_V2_FORK_URL ? describe : describe.skip;

function same(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

forkSuite("Public unlock V2 migration (Polygon fork)", function () {
  this.timeout(600000);

  async function impersonate(account, balance = "100000") {
    await network.provider.send("hardhat_impersonateAccount", [account]);
    await network.provider.send("hardhat_setBalance", [
      account,
      ethers.utils.hexValue(ethers.utils.parseEther(balance)),
    ]);
    return ethers.getSigner(account);
  }

  it("stages safely and unlocks Originals on the tenth paid ticket", async () => {
    expect(network.name).to.equal("hardhat");
    const metadata = await network.provider.send("hardhat_metadata");
    expect(metadata.forkedNetwork.chainId).to.equal(137);
    await network.provider.send("evm_mine");

    const root = path.resolve(__dirname, "../..");
    const book = JSON.parse(
      fs.readFileSync(path.join(root, "addresses.master.json"), "utf8"),
    );
    const chapter = book.chapters.find((entry) => Number(entry.chapterId) === 1);
    const owner = await impersonate(book.OWNER);
    const deployer = await impersonate(book.deployer || book.DEPLOYER, "1000");
    const buyer = await impersonate("0x1000000000000000000000000000000000000001");

    const registry = await ethers.getContractAt("BiggiSeriesRegistry", book.REGISTRY);
    const hub = (await ethers.getContractAt("BiggiTicketHub", book.TICKET_HUB)).connect(owner);
    const publicCollection = (
      await ethers.getContractAt("BiggiEyesMain2", chapter.MAIN2)
    ).connect(owner);

    expect(await hub.chapterSaleCap(1)).to.equal(0);
    expect(await hub.chapterMarketingCap(1)).to.equal(550);
    expect(await hub.chapterSaleMinted(1)).to.equal(0);
    expect(await hub.chapterMarketingMinted(1)).to.equal(50);
    expect(await publicCollection.paused()).to.equal(true);

    const Controller = await ethers.getContractFactory(
      "BiggiChapterControllerV2",
      deployer,
    );
    const controller = await Controller.deploy(book.OWNER, book.REGISTRY);
    await controller.deployed();

    const collections = await registry.getChapterCollections(1);
    const meta = await registry.getChapterMeta(1);
    await (
      await controller.connect(owner).stageChapterWithUnlockThreshold(
        1,
        meta.seriesId,
        collections.vrfCollection,
        collections.publicCollection,
        collections.ticketHub,
        500,
        50,
        550,
        10,
      )
    ).wait();
    await (
      await controller.connect(owner).lockPublicUnlockSaleThreshold(1)
    ).wait();

    const Reader = await ethers.getContractFactory("BiggiChapterSeriesReader", deployer);
    const reader = await Reader.deploy(controller.address, book.REGISTRY);
    await reader.deployed();

    await (
      await publicCollection.setChapterController(controller.address, 1)
    ).wait();

    expect(await publicCollection.chapterController()).to.equal(controller.address);
    expect(await controller.controllerVersion()).to.equal(2);
    expect(await controller.publicUnlockSaleThreshold(1)).to.equal(10);
    expect(await controller.publicUnlockThresholdLocked(1)).to.equal(true);
    expect(await controller.isChapterStackConsistent(1)).to.equal(true);
    expect(await controller.isChapterCapConsistent(1)).to.equal(false);
    expect(await controller.isPublicMintUnlocked(1)).to.equal(false);
    expect((await reader.globalSnapshot()).controller).to.equal(controller.address);

    await (await hub.setChapterTicketCaps(1, 500, 50)).wait();
    expect(await controller.isChapterCapConsistent(1)).to.equal(true);

    const connectedHub = hub.connect(buyer);
    for (let saleCount = 1; saleCount <= 10; saleCount += 1) {
      const price = await connectedHub.ticketPrice();
      await (await connectedHub.mintTicketForChapter(1, { value: price })).wait();
      expect(await hub.chapterSaleMinted(1)).to.equal(saleCount);
      expect(await controller.isPublicMintUnlocked(1)).to.equal(saleCount >= 10);
    }

    expect(await hub.chapterMarketingMinted(1)).to.equal(50);
    expect(await hub.chapterTotalMinted(1)).to.equal(60);
    expect(await controller.isPublicMintUnlocked(1)).to.equal(true);
    expect(same(await controller.registry(), book.REGISTRY)).to.equal(true);
  });
});
