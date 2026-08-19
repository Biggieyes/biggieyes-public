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
  it("CRE automation receiver forwards only allowed reports from KeystoneForwarder", async () => {
    const [owner, forwarder, outsider] = await ethers.getSigners();

    const target = await deploy("MockCREAutomationTarget");
    const receiver = await deploy("BiggiCREAutomationReceiver", owner.address, forwarder.address);
    expect(await receiver.paused()).to.equal(true);

    const innerPerformData = ethers.utils.defaultAbiCoder.encode(["uint256"], [toWei("7")]);
    const callData = target.interface.encodeFunctionData("performUpkeep", [innerPerformData]);
    const report = ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [target.address, callData]);

    expect(await receiver.supportsInterface("0x01ffc9a7")).to.equal(true);
    expect(await receiver.supportsInterface(ethers.utils.id("onReport(bytes,bytes)").slice(0, 10))).to.equal(true);

    await expect(receiver.connect(outsider).onReport("0x1234", report)).to.be.reverted;
    await expect(receiver.connect(forwarder).onReport("0x1234", report)).to.be.reverted;

    const selector = target.interface.getSighash("performUpkeep");
    await (await receiver.setCallAllowed(target.address, selector, true)).wait();
    await (await receiver.unpause()).wait();

    await (await receiver.connect(forwarder).onReport("0x1234", report)).wait();
    expect(await target.calls()).to.equal(1);
    expect(await target.lastCaller()).to.equal(receiver.address);
    expect(await target.lastPerformData()).to.equal(innerPerformData);

    const workflowId = ethers.utils.id("biggi-tokenomics-production");
    const metadata = ethers.utils.solidityPack(
      ["bytes32", "bytes10", "address"],
      [workflowId, "0x0102030405060708090a", owner.address]
    );
    await (await receiver.setExpectedWorkflowIdentity(workflowId, owner.address)).wait();
    await expect(receiver.connect(forwarder).onReport("0x1234", report)).to.be.reverted;
    await (await receiver.connect(forwarder).onReport(metadata, report)).wait();
    expect(await target.calls()).to.equal(2);

    const forbiddenData = target.interface.encodeFunctionData("forbidden", [innerPerformData]);
    const forbiddenReport = ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [target.address, forbiddenData]);
    await expect(receiver.connect(forwarder).onReport(metadata, forbiddenReport)).to.be.reverted;
  });

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
    expect(await agent.lastMinOut()).to.equal(1);

    await (await agent.setNativeBalance(toWei("0.2"))).wait();
    const [neededLow] = await proxy.checkUpkeep("0x");
    expect(neededLow).to.equal(false);

    await (await agent.setNativeBalance(toWei("2"))).wait();
    await (await policy.setBuybacksPaused(true)).wait();
    const [neededPaused] = await proxy.checkUpkeep("0x");
    expect(neededPaused).to.equal(false);
  });

  it("buyback upkeep proxy refuses to execute when protected minOut preview is zero", async () => {
    const [owner] = await ethers.getSigners();

    const policy = await deploy("MockBuybackPolicy");
    const agent = await deploy("MockBuybackAgent", policy.address);
    const proxy = await deploy("BiggiBuybackUpkeepProxy", owner.address);

    await (await proxy.setAgent(agent.address)).wait();
    await (await proxy.setThreshold(toWei("1"))).wait();
    await (await agent.setNativeBalance(toWei("2"))).wait();
    await (await agent.setPreviewMinOut(0)).wait();

    const [needed] = await proxy.checkUpkeep("0x");
    expect(needed).to.equal(false);

    await expect(proxy.performUpkeep("0x")).to.emit(proxy, "PerformFailed").withArgs("MIN_OUT_ZERO");
    expect(await agent.buybackCalls()).to.equal(0);
  });
});
