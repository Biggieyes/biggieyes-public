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
  await (await drip.setTreasury(treasury.address)).wait();

  await (await buyback.setRouter(router.address)).wait();
  await (await buyback.setTreasury(treasury.address)).wait();
  await (await buyback.setPolicy(policy.address)).wait();
  await (await buyback.setDripLM(dripLm.address)).wait();

  await (await token.mint(router.address, toWei("100000"))).wait();

  return { token, reserve, drip, rewards, treasury, policy, dripLm, router, buyback };
}

describe("BIGGI_MASTER: buyback/treasury/drip + multicall smoke", function () {
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

    // Fallback receive() accepts forwarded native, but accounting counter is only for distributor entrypoints.
    expect(await treasury.totalPolReceivedFromDistributor()).to.equal(0);

    const nativeOut = toWei("3");
    await (await treasury.rescueETH(owner.address, nativeOut)).wait();
    const treasuryAfterRescue = await ethers.provider.getBalance(treasury.address);
    expect(treasuryAfterRescue).to.equal(treasuryAfterForward.sub(nativeOut));
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
