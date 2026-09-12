const { expect } = require("chai");
const { ethers, network } = require("hardhat");

if (network.name !== "hardhat") {
  throw new Error(
    "Ticket presale tests must run on the local hardhat network.",
  );
}

const snapshotPrice = ethers.utils.parseEther("1");
const paidPrice = ethers.utils.parseEther("500");

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployMain(owner) {
  const namesLib = await deploy("BiggiNamesLib");
  const Factory = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: namesLib.address },
  });
  const main = await Factory.deploy(owner);
  await main.deployed();
  return main;
}

describe("BIGGI_MASTER: ticket presale transfers and redemption", function () {
  let owner, seller, buyer, operator;
  let main, hub, compute, router, distributor;

  beforeEach(async () => {
    [owner, seller, buyer, operator] = await ethers.getSigners();
    main = await deployMain(owner.address);
    hub = await deploy("BiggiTicketHub", owner.address, main.address);
    compute = await deploy("BiggiCompute");
    router = await deploy("MockVrfRouter");
    distributor = await deploy("MockMintShareReceiver");
    await main.setTicketHub(hub.address);
    await main.setModules(compute.address, router.address);
    await main.batchSetNFTBackgroundAndBlock([1], [1], [1], [1]);
    await hub.setDistributor(distributor.address);
    await hub.setTicketCaps(500, 50);
    // Mirror the deployed launch sequence, not the constructor's default price.
    await hub.setTicketPrice(snapshotPrice);
    await hub.mintMarketingTicketsForChapter(1, seller.address, 1);
    await hub.setTicketPrice(paidPrice);
  });

  it("approves without moving a ticket; only the approved operator can transfer", async () => {
    await expect(
      hub.connect(operator).transferFrom(seller.address, buyer.address, 1),
    ).to.be.revertedWithCustomError(hub, "ERC721InsufficientApproval");
    await hub.connect(seller).setApprovalForAll(operator.address, true);
    expect(await hub.ownerOf(1)).to.equal(seller.address);
    expect(await hub.ticketCount(seller.address)).to.equal(1);

    await hub.connect(operator).transferFrom(seller.address, buyer.address, 1);
    expect(await hub.ownerOf(1)).to.equal(buyer.address);
    expect(await hub.ticketCount(seller.address)).to.equal(0);
    expect(await hub.chapterTicketCount(1, seller.address)).to.equal(0);
    expect(await hub.ticketCount(buyer.address)).to.equal(1);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(1);
    expect(await hub.ticketChapterId(1)).to.equal(1);
    expect(await hub.mintedTicketPrice(1)).to.equal(snapshotPrice);
    expect(await hub.ticketPrice()).to.equal(paidPrice);
    expect(await hub.globalTicketMinted()).to.equal(1);
    expect(await hub.saleMinted()).to.equal(0);
    expect(await distributor.totalReceived()).to.equal(0);

    // The seller's approval never authorizes transfers from the buyer.
    await expect(
      hub.connect(operator).transferFrom(buyer.address, seller.address, 1),
    ).to.be.revertedWithCustomError(hub, "ERC721InsufficientApproval");
  });

  it("revoking an operator approval prevents a subsequent transfer", async () => {
    await hub.connect(seller).setApprovalForAll(operator.address, true);
    await hub.connect(seller).setApprovalForAll(operator.address, false);
    await expect(
      hub.connect(operator).transferFrom(seller.address, buyer.address, 1),
    ).to.be.revertedWithCustomError(hub, "ERC721InsufficientApproval");
    expect(await hub.ownerOf(1)).to.equal(seller.address);
  });

  it("clears token-specific approval on transfer and keeps self-transfer counts stable", async () => {
    await hub.connect(seller).approve(operator.address, 1);
    await hub.connect(operator).transferFrom(seller.address, buyer.address, 1);
    expect(await hub.getApproved(1)).to.equal(ethers.constants.AddressZero);
    await hub.connect(buyer).transferFrom(buyer.address, buyer.address, 1);
    expect(await hub.balanceOf(buyer.address)).to.equal(1);
    expect(await hub.ticketCount(buyer.address)).to.equal(1);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(1);
  });

  it("permits transfers before activation and while paused, but gates mint and redeem", async () => {
    expect(await hub.chapterActive(1)).to.equal(false);
    await expect(
      hub.connect(seller).redeemTicket(1),
    ).to.be.revertedWithCustomError(hub, "ChapterInactive");
    await expect(
      hub.connect(buyer).mintTicket({ value: paidPrice }),
    ).to.be.revertedWithCustomError(hub, "ChapterInactive");
    await hub.pause();
    await hub.connect(seller).setApprovalForAll(operator.address, true);
    await hub.connect(operator).transferFrom(seller.address, buyer.address, 1);
    await expect(
      hub.connect(buyer).redeemTicket(1),
    ).to.be.revertedWithCustomError(hub, "EnforcedPause");
    expect(await hub.ownerOf(1)).to.equal(buyer.address);
    expect(await hub.mintedTicketPrice(1)).to.equal(snapshotPrice);
  });

  it("allows transfers above 10, but checks current holdings before each paid mint", async () => {
    await hub.mintMarketingTicketsForChapter(1, buyer.address, 10);
    await hub.connect(seller).transferFrom(seller.address, buyer.address, 1);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(11);
    await hub.setChapterActive(1, true);
    await expect(
      hub.connect(buyer).mintTicket({ value: paidPrice }),
    ).to.be.revertedWithCustomError(hub, "MaxPerWallet");
    await hub.connect(buyer).transferFrom(buyer.address, seller.address, 1);
    await expect(
      hub.connect(buyer).mintTicket({ value: paidPrice }),
    ).to.be.revertedWithCustomError(hub, "MaxPerWallet");
    await hub.connect(buyer).transferFrom(buyer.address, seller.address, 2);
    await hub.connect(buyer).mintTicket({ value: paidPrice });
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(10);
    expect(await hub.saleMinted()).to.equal(1);
    expect(await hub.ticketPrice()).to.equal(paidPrice.mul(10033).div(10000));
    expect(await distributor.totalReceived()).to.equal(
      paidPrice.mul(6000).div(10000),
    );
  });

  it("applies the paid-mint wallet limit per chapter, not across all chapters", async () => {
    const secondMain = await deployMain(owner.address);
    await hub.configureChapter(2, secondMain.address, 500, 50, "");
    await secondMain.setChapterId(2);
    await secondMain.setTicketHub(hub.address);
    await hub.mintMarketingTicketsForChapter(1, buyer.address, 11);
    await hub.setChapterActive(2, true);
    await hub.connect(buyer).mintTicketForChapter(2, { value: paidPrice });
    expect(await hub.ticketCount(buyer.address)).to.equal(12);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(11);
    expect(await hub.chapterTicketCount(2, buyer.address)).to.equal(1);
    expect(await hub.ownerOf(551)).to.equal(buyer.address);
    expect(await hub.ticketChapterId(551)).to.equal(2);
  });

  it("only lets the new owner redeem, preserving the snapshot through VRF fulfillment", async () => {
    await hub.connect(seller).transferFrom(seller.address, buyer.address, 1);
    await hub.connect(buyer).setApprovalForAll(operator.address, true);
    await hub.setChapterActive(1, true);
    for (const nonOwner of [seller, operator]) {
      await expect(
        hub.connect(nonOwner).redeemTicket(1),
      ).to.be.revertedWithCustomError(hub, "NotTicketOwner");
    }
    await expect(hub.connect(buyer).redeemTicket(1))
      .to.emit(hub, "TicketRedeemed")
      .withArgs(buyer.address, 1, snapshotPrice);
    const requestId = await main.pendingMintRequest(buyer.address);
    expect(requestId).to.not.equal(0);
    expect(await main.pendingTicketPrice(requestId)).to.equal(snapshotPrice);
    expect(await main.pendingMinters(requestId)).to.equal(buyer.address);
    expect(await hub.isTicket(1)).to.equal(false);
    expect(await hub.ticketCount(buyer.address)).to.equal(0);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(0);
    expect(await hub.mintedTicketPrice(1)).to.equal(0);
    expect(await hub.ticketChapterId(1)).to.equal(0);
    expect(await hub.globalTicketMinted()).to.equal(1);
    expect(await hub.marketingMinted()).to.equal(1);
    await router.fulfill(requestId, 0);
    expect(await main.ownerOf(1001)).to.equal(buyer.address);
    expect((await main.getMintData(1))[0]).to.equal(snapshotPrice);
    expect(await hub.ticketPrice()).to.equal(paidPrice);
    expect(await distributor.totalReceived()).to.equal(0);
    await expect(
      hub.connect(buyer).redeemTicket(1),
    ).to.be.revertedWithCustomError(hub, "NotTicket");
  });

  it("rolls back the burn and all counters if the linked main rejects redemption", async () => {
    await hub.connect(seller).transferFrom(seller.address, buyer.address, 1);
    await hub.setChapterActive(1, true);
    await main.pause();
    // This helper checks chapter activation only, not the entire redeem path.
    expect(await hub.ticketRedeemable(1)).to.equal(true);
    await expect(
      hub.connect(buyer).redeemTicket(1),
    ).to.be.revertedWithCustomError(main, "EnforcedPause");
    expect(await hub.ownerOf(1)).to.equal(buyer.address);
    expect(await hub.isTicket(1)).to.equal(true);
    expect(await hub.ticketChapterId(1)).to.equal(1);
    expect(await hub.mintedTicketPrice(1)).to.equal(snapshotPrice);
    expect(await hub.ticketCount(buyer.address)).to.equal(1);
    expect(await hub.chapterTicketCount(1, buyer.address)).to.equal(1);
    expect(await main.pendingMintRequest(buyer.address)).to.equal(0);
    await main.unpause();
    await hub.connect(buyer).redeemTicket(1);
    expect(await hub.isTicket(1)).to.equal(false);
  });

  it("routes a transferred chapter 2 ticket to its own collection and VRF request", async () => {
    const secondMain = await deployMain(owner.address);
    await hub.configureChapter(2, secondMain.address, 500, 50, "");
    await secondMain.setChapterId(2);
    await secondMain.setTicketHub(hub.address);
    await secondMain.setModules(compute.address, router.address);
    await secondMain.batchSetNFTBackgroundAndBlock([1], [1], [1], [1]);
    await hub.setTicketPrice(snapshotPrice);
    await hub.mintMarketingTicketsForChapter(2, seller.address, 1);
    await hub.setTicketPrice(paidPrice);
    await hub.connect(seller).transferFrom(seller.address, buyer.address, 551);
    await hub.setChapterActive(2, true);
    expect(await hub.chapterActive(1)).to.equal(false);
    await hub.connect(buyer).redeemTicket(551);
    const requestId = await secondMain.pendingMintRequest(buyer.address);
    expect(await secondMain.pendingTicketId(requestId)).to.equal(551);
    expect(await main.pendingMintRequest(buyer.address)).to.equal(0);
    await router.fulfill(requestId, 0);
    expect(await secondMain.ownerOf(1001)).to.equal(buyer.address);
    expect((await secondMain.getMintData(1))[0]).to.equal(snapshotPrice);
    expect(await main.biggiMinted()).to.equal(0);
    expect(await hub.chapterTicketCount(2, buyer.address)).to.equal(0);
  });
});
