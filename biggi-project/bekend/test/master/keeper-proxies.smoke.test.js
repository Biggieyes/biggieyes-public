const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: keeper proxies smoke", function () {
  it("drip keeper proxy forwards dripOnBuy for whitelisted keeper", async () => {
    const [owner, keeper, outsider] = await ethers.getSigners();

    const dripLM = await deploy("MockDripLM");
    const proxy = await deploy("DripKeeperProxy", owner.address);

    await (await proxy.setDripLM(dripLM.address)).wait();
    await (await proxy.setKeeper(keeper.address, true)).wait();

    const performData = ethers.utils.defaultAbiCoder.encode(["uint256"], [toWei("42")]);
    const [upkeepNeeded] = await proxy.checkUpkeep(performData);
    expect(upkeepNeeded).to.equal(true);

    await (await proxy.connect(keeper).performUpkeep(performData)).wait();
    expect(await dripLM.calls()).to.equal(1);
    expect(await dripLM.totalBought()).to.equal(toWei("42"));

    await expect(proxy.connect(outsider).performDrip(toWei("1"))).to.be.revertedWith(
      "proxy: only keeper/owner"
    );
  });

  it("buyback upkeep proxy executes buyback when threshold/policy conditions are met", async () => {
    const [owner] = await ethers.getSigners();

    const policy = await deploy("MockBuybackPolicy");
    const agent = await deploy("MockBuybackAgent", policy.address);
    const proxy = await deploy("BiggiBuybackUpkeepProxy", owner.address);

    await (await proxy.setAgent(agent.address)).wait();
    await (await proxy.setThreshold(toWei("1"))).wait();
    await (await agent.setNativeBalance(toWei("2"))).wait();

    const [neededBefore] = await proxy.checkUpkeep("0x");
    expect(neededBefore).to.equal(true);

    await (await proxy.performUpkeep("0x")).wait();
    expect(await agent.buybackCalls()).to.equal(1);

    await (await agent.setNativeBalance(toWei("0.2"))).wait();
    const [neededLow] = await proxy.checkUpkeep("0x");
    expect(neededLow).to.equal(false);

    await (await agent.setNativeBalance(toWei("2"))).wait();
    await (await policy.setBuybacksPaused(true)).wait();
    const [neededPaused] = await proxy.checkUpkeep("0x");
    expect(neededPaused).to.equal(false);
  });
});
