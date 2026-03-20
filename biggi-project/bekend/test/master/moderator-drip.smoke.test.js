const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: moderator + drip consistency smoke", function () {
  it("routes drip native split to reserve and ModeratorCenter allocation", async () => {
    const [owner] = await ethers.getSigners();

    const token = await deploy("BiggiToken", owner.address);
    const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
    const dripDistributor = await deploy("BiggiDripDistributor", token.address, owner.address);
    const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
    const swapRouter = await deploy("MockSwapRouter", weth.address);
    const moderator = await deploy("ModeratorCenter", owner.address);
    const dripLM = await deploy("BiggiDripLMToModerator", token.address, swapRouter.address, owner.address);

    await owner.sendTransaction({ to: swapRouter.address, value: toWei("1000") });

    await (await token.setReserve(reserve.address)).wait();
    await (await token.setDripDistributor(dripDistributor.address)).wait();
    await (await token.setTokenRewards(owner.address)).wait();
    await (await token.setMarketingSupport(owner.address)).wait();
    await (await dripDistributor.setTreasury(owner.address)).wait();
    await (await token.initialDistribute()).wait();

    await (await dripDistributor.setDripLM(dripLM.address)).wait();
    await (await dripDistributor.setTokensPerMintOperator(dripLM.address)).wait();

    await (await dripLM.setDripDistributor(dripDistributor.address)).wait();
    await (await dripLM.setReserve(reserve.address)).wait();
    await (await dripLM.setBuybackAgent(owner.address)).wait();
    await (await dripLM.setModeratorCenter(moderator.address)).wait();
    await (await dripLM.setShares(4000, 6000)).wait();

    await (await moderator.setMultiCollection(dripLM.address)).wait();

    const weekBefore = Math.floor((await ethers.provider.getBlock("latest")).timestamp / (7 * 24 * 60 * 60));
    const beforeAllocated = await moderator.weekAllocated(weekBefore);
    const beforeReservePol = await reserve.polBalance();

    await (await dripLM.dripOnBuy(toWei("100"))).wait();

    const weekAfter = Math.floor((await ethers.provider.getBlock("latest")).timestamp / (7 * 24 * 60 * 60));
    const afterAllocated = await moderator.weekAllocated(weekAfter);
    const afterReservePol = await reserve.polBalance();

    expect(afterAllocated.sub(beforeAllocated)).to.equal(toWei("42"));
    expect(afterReservePol.sub(beforeReservePol)).to.equal(toWei("28"));
  });

  it("distributes weekly moderator allocation by slot weights", async () => {
    const [owner, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const moderator = await deploy("ModeratorCenter", owner.address);

    const refA = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("slot-A"));
    const refB = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("slot-B"));

    await (await moderator.configureSlot(0, true, true, alice.address)).wait(); // leader
    await (await moderator.configureSlot(1, true, false, bob.address)).wait(); // moderator
    await (await moderator.setReferralHash(0, refA)).wait();
    await (await moderator.setReferralHash(1, refB)).wait();
    await (await moderator.setReporter(owner.address, true)).wait();
    await (await moderator.setMultiCollection(owner.address)).wait();

    await (await moderator.notifyAllocation({ value: toWei("10") })).wait();

    await (await moderator.recordTicketSale(refA, carol.address)).wait();
    await (await moderator.recordTicketSale(refA, dave.address)).wait();
    await (await moderator.recordTicketSale(refB, erin.address)).wait();

    const beforeA = await ethers.provider.getBalance(alice.address);
    const beforeB = await ethers.provider.getBalance(bob.address);

    await (await moderator.distributeWeekRewards()).wait();

    const afterA = await ethers.provider.getBalance(alice.address);
    const afterB = await ethers.provider.getBalance(bob.address);

    const gainA = afterA.sub(beforeA);
    const gainB = afterB.sub(beforeB);

    expect(gainA).to.be.gt(0);
    expect(gainB).to.be.gt(0);
    expect(gainA).to.be.gt(gainB);
  });
});
