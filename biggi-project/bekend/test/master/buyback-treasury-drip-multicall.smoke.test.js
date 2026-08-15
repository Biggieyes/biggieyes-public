const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function setupBuybackStack(owner) {
  const nftMain = await deploy("MockBlockNft");
  const nftMain2 = await deploy("MockBlockNft");
  const token = await deploy("BiggiToken", owner.address);
  const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
  const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
  const rewards = await deploy("BiggiTokenRewards", nftMain.address, nftMain2.address, token.address, owner.address);
  const treasury = await deploy("BiggiTreasury", token.address, owner.address);
  const policy = await deploy("BiggiPolicy", owner.address);
  const dripLm = await deploy("MockDripLM");
  const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
  const router = await deploy("MockBuybackRouter", weth.address);
  const buyback = await deploy("BiggiBuybackAgent", token.address, owner.address);

  await (await token.setReserve(reserve.address)).wait();
  await (await token.setDripDistributor(drip.address)).wait();
  await (await token.setTokenRewards(rewards.address)).wait();
  await (await token.setMarketingSupport(owner.address)).wait();
  await (await token.initialDistribute()).wait();

  await (await treasury.setBuybackAgent(buyback.address)).wait();
  await (await treasury.setTokenRewards(rewards.address)).wait();
  await (await treasury.setReserve(reserve.address)).wait();
  await (await treasury.setDripDistributor(drip.address)).wait();
  await (await reserve.setNotifyCaller(treasury.address, true)).wait();
  await (await drip.setTreasury(treasury.address)).wait();

  await (await buyback.setRouter(router.address)).wait();
  await (await buyback.setTreasury(treasury.address)).wait();
  await (await buyback.setPolicy(policy.address)).wait();
  await (await buyback.setDistributor(owner.address)).wait();
  await (await policy.setBuybackAgent(buyback.address)).wait();
  await (await buyback.setDripLM(dripLm.address)).wait();

  await (await token.mint(router.address, toWei("100000"))).wait();

  return { token, reserve, drip, rewards, treasury, policy, dripLm, router, buyback };
}

describe("BIGGI_MASTER: buyback/treasury/drip + multicall smoke", function () {
  it("rejects unsafe zero treasury routes and buyback rescue recipients", async () => {
    const [owner] = await ethers.getSigners();
    const token = await deploy("BiggiToken", owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);
    const buyback = await deploy("BiggiBuybackAgent", token.address, owner.address);

    await expect(treasury.setDistributor(ethers.constants.AddressZero)).to.be.reverted;
    await expect(treasury.setBuybackAgent(ethers.constants.AddressZero)).to.be.reverted;
    await expect(treasury.setTokenRewards(ethers.constants.AddressZero)).to.be.reverted;
    await expect(treasury.setReserve(ethers.constants.AddressZero)).to.be.reverted;
    await expect(treasury.setDripDistributor(ethers.constants.AddressZero)).to.be.reverted;

    await expect(buyback.rescueERC20(token.address, ethers.constants.AddressZero, 0)).to.be.reverted;
    await expect(buyback.rescueNative(ethers.constants.AddressZero, 0)).to.be.reverted;
  });

  it("fails closed when BIGGI split targets are incomplete", async () => {
    const [owner] = await ethers.getSigners();
    const token = await deploy("BiggiToken", owner.address);
    const treasury = await deploy("BiggiTreasury", token.address, owner.address);

    const amount = toWei("1");
    await (await treasury.setEcosystemBiggiCaller(owner.address, true)).wait();
    await (await token.mint(owner.address, amount)).wait();
    await (await token.approve(treasury.address, amount)).wait();

    await expect(treasury.receiveEcosystemBiggi(amount)).to.be.reverted;
    expect(await token.balanceOf(treasury.address)).to.equal(0);
    expect(await treasury.totalBiggiReceivedFromEcosystem()).to.equal(0);
  });

  it("executes auto buyback and routes BIGGI through treasury split into rewards/reserve/drip", async () => {
    const [owner] = await ethers.getSigners();
    const { token, reserve, drip, rewards, treasury, dripLm, buyback } = await setupBuybackStack(owner);

    const initialRewards = await token.balanceOf(rewards.address);
    const initialReserve = await token.balanceOf(reserve.address);
    const initialDrip = await token.balanceOf(drip.address);

    const nativeIn = toWei("10");
    await (await buyback.receiveMintShare({ value: nativeIn })).wait();

    const acquired = nativeIn; // mock router default quote is 1:1
    const partRewards = acquired.mul(3400).div(10000);
    const partReserve = acquired.mul(3300).div(10000);
    const partDrip = acquired.sub(partRewards).sub(partReserve);

    expect(await treasury.totalBiggiReceivedFromBuyback()).to.equal(acquired);
    expect(await token.balanceOf(rewards.address)).to.equal(initialRewards.add(partRewards));
    expect(await token.balanceOf(reserve.address)).to.equal(initialReserve.add(partReserve));
    expect(await token.balanceOf(drip.address)).to.equal(initialDrip.add(partDrip));
    expect(await drip.getTotalReceived()).to.equal(initialDrip.add(partDrip));
    expect(await drip.getAvailable()).to.equal(initialDrip.add(partDrip));

    expect(await buyback.totalNativeSpent()).to.equal(nativeIn);
    expect(await buyback.totalBiggiAcquired()).to.equal(acquired);
    expect(await dripLm.calls()).to.equal(1);
    expect(await dripLm.totalBought()).to.equal(acquired);
  });

  it("executes full buyback -> treasury -> real dripLM sell -> reserve/moderator flow", async () => {
    const [owner] = await ethers.getSigners();
    const { token, reserve, drip, rewards, treasury, buyback } = await setupBuybackStack(owner);

    const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
    const swapRouter = await deploy("MockSwapRouter", weth.address);
    const moderator = await deploy("ModeratorCenter", owner.address);
    const dripLm = await deploy("BiggiDripLMToModerator", token.address, swapRouter.address, owner.address);

    await owner.sendTransaction({ to: swapRouter.address, value: toWei("1000") });
    await (await drip.setDripLM(dripLm.address)).wait();
    await (await drip.setTokensPerMintOperator(dripLm.address)).wait();
    await (await dripLm.setDripDistributor(drip.address)).wait();
    await (await dripLm.setReserve(reserve.address)).wait();
    await (await dripLm.setBuybackAgent(buyback.address)).wait();
    await (await dripLm.setModeratorCenter(moderator.address)).wait();
    await (await dripLm.setShares(4000, 6000)).wait();
    await (await moderator.setMultiCollection(dripLm.address)).wait();
    await (await buyback.setDripLM(dripLm.address)).wait();

    const initialRewards = await token.balanceOf(rewards.address);
    const initialReserveBiggi = await token.balanceOf(reserve.address);
    const initialDrip = await token.balanceOf(drip.address);
    const initialDripAvailable = await drip.getAvailable();
    const initialReservePol = await reserve.polBalance();
    const weekBefore = Math.floor((await ethers.provider.getBlock("latest")).timestamp / (7 * 24 * 60 * 60));
    const initialModeratorAllocation = await moderator.weekAllocated(weekBefore);

    const nativeIn = toWei("10");
    await (await buyback.receiveMintShare({ value: nativeIn })).wait();

    const acquired = nativeIn;
    const partRewards = acquired.mul(3400).div(10000);
    const partReserve = acquired.mul(3300).div(10000);
    const partDrip = acquired.sub(partRewards).sub(partReserve);
    const dripSold = acquired.mul(70).div(100);
    const reserveNative = dripSold.mul(4000).div(10000);
    const moderatorNative = dripSold.sub(reserveNative);
    const weekAfter = Math.floor((await ethers.provider.getBlock("latest")).timestamp / (7 * 24 * 60 * 60));

    expect(await treasury.totalBiggiReceivedFromBuyback()).to.equal(acquired);
    expect(await token.balanceOf(rewards.address)).to.equal(initialRewards.add(partRewards));
    expect(await token.balanceOf(reserve.address)).to.equal(initialReserveBiggi.add(partReserve));
    expect(await token.balanceOf(drip.address)).to.equal(initialDrip.add(partDrip).sub(dripSold));
    expect(await drip.getAvailable()).to.equal(initialDripAvailable.add(partDrip).sub(dripSold));
    expect(await drip.getTotalClaimed()).to.equal(dripSold);
    expect(await token.balanceOf(swapRouter.address)).to.equal(dripSold);
    expect(await reserve.polBalance()).to.equal(initialReservePol.add(reserveNative));
    expect(await moderator.weekAllocated(weekAfter)).to.equal(initialModeratorAllocation.add(moderatorNative));
    expect(await buyback.totalNativeSpent()).to.equal(nativeIn);
    expect(await buyback.totalBiggiAcquired()).to.equal(acquired);
  });

  it("forwards native to treasury on swap failure, treasury keeps it, and owner can transfer it out", async () => {
    const [owner] = await ethers.getSigners();
    const { treasury, buyback, router } = await setupBuybackStack(owner);

    const initialTreasuryNative = await ethers.provider.getBalance(treasury.address);
    expect(initialTreasuryNative).to.equal(0);

    // Force router output above its token balance so swap reverts and fallback forwards native to treasury.
    await (await router.setQuoteBps(200_000_000)).wait();

    const nativeIn = toWei("10");
    await (await buyback.receiveMintShare({ value: nativeIn })).wait();

    const treasuryAfterForward = await ethers.provider.getBalance(treasury.address);
    expect(treasuryAfterForward).to.equal(initialTreasuryNative.add(nativeIn));
    expect(await buyback.totalNativeReceived()).to.equal(nativeIn);
    expect(await buyback.totalNativeSpent()).to.equal(0);
    expect(await buyback.totalBiggiAcquired()).to.equal(0);

    // Buyback fallback path must be explicitly accounted in treasury.
    expect(await treasury.totalPolReceivedFromDistributor()).to.equal(0);
    expect(await treasury.totalPolReceivedFromBuyback()).to.equal(nativeIn);

    const nativeOut = toWei("3");
    await (await treasury.rescueETH(owner.address, nativeOut)).wait();
    const treasuryAfterRescue = await ethers.provider.getBalance(treasury.address);
    expect(treasuryAfterRescue).to.equal(treasuryAfterForward.sub(nativeOut));
  });

  it("rejects direct mint-share calls from non-distributor addresses", async () => {
    const [owner, attacker] = await ethers.getSigners();
    const { buyback } = await setupBuybackStack(owner);

    await expect(
      buyback.connect(attacker).receiveMintShare({ value: toWei("1") })
    ).to.be.reverted;
  });

  it("does not consume daily quota or strand BIGGI when treasury split fails", async () => {
    const [owner] = await ethers.getSigners();
    const { token, treasury, policy, drip, buyback } = await setupBuybackStack(owner);

    await (await drip.pause()).wait();

    const nativeIn = toWei("2");
    await (await buyback.receiveMintShare({ value: nativeIn })).wait();

    expect(await policy.usedToday()).to.equal(0);
    expect(await buyback.totalNativeSpent()).to.equal(0);
    expect(await buyback.totalBiggiAcquired()).to.equal(0);
    expect(await token.balanceOf(buyback.address)).to.equal(0);
    expect(await treasury.totalBiggiReceivedFromBuyback()).to.equal(0);
    expect(await treasury.totalPolReceivedFromBuyback()).to.equal(nativeIn);
  });

  it("aggregates buyback branch snapshots through Multicall2", async () => {
    const [owner] = await ethers.getSigners();
    const { drip, treasury, buyback } = await setupBuybackStack(owner);

    await (await buyback.receiveMintShare({ value: toWei("5") })).wait();

    const multicall = await deploy("Multicall2");
    const calls = [
      {
        target: buyback.address,
        callData: buyback.interface.encodeFunctionData("totalNativeSpent"),
      },
      {
        target: treasury.address,
        callData: treasury.interface.encodeFunctionData("totalBiggiReceivedFromBuyback"),
      },
      {
        target: drip.address,
        callData: drip.interface.encodeFunctionData("getTotalReceived"),
      },
    ];

    const [, returnData] = await multicall.aggregate(calls);
    const spent = buyback.interface.decodeFunctionResult("totalNativeSpent", returnData[0])[0];
    const fromBuyback = treasury.interface.decodeFunctionResult(
      "totalBiggiReceivedFromBuyback",
      returnData[1]
    )[0];
    const dripReceived = drip.interface.decodeFunctionResult("getTotalReceived", returnData[2])[0];

    expect(spent).to.equal(await buyback.totalNativeSpent());
    expect(fromBuyback).to.equal(await treasury.totalBiggiReceivedFromBuyback());
    expect(dripReceived).to.equal(await drip.getTotalReceived());
  });
});
