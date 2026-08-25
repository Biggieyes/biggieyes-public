const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const productionWorkflowConfig = require("../../cre-workflows/biggi-cre/my-workflow/config.production.json");
const testWorkflowConfig = require("../../cre-workflows/biggi-cre/my-workflow/config.test.json");

const toWei = (value) => ethers.utils.parseEther(value);
const CRE_EVM_TRANSACTION_GAS_QUOTA = 5_000_000;
const CRE_EVM_READ_CALL_QUOTA = 15;
const WORKFLOW_WORST_CASE_READ_CALLS = 6;
const WORKFLOW_ID = ethers.utils.id("biggi-tokenomics-production");
const WORKFLOW_NAME = "biggi-tokenomics-production";
const WORKFLOW_NODE_NAME = "0x0102030405060708090a";
const GAS_LIMITS = Object.fromEntries(
  productionWorkflowConfig.targets.map((target) => [target.name, Number(target.writeGasLimit)])
);

const gasRows = [];
const adversarialChecks = [];
let startBlock;
let endBlock;
let chainId;

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployTokenStack(owner) {
  const token = await deploy("BiggiToken", owner.address);
  const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
  const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
  const nftMain = await deploy("MockBlockNft");
  const nftMain2 = await deploy("MockBlockNft");
  const rewards = await deploy(
    "BiggiTokenRewards",
    nftMain.address,
    nftMain2.address,
    token.address,
    owner.address
  );
  const quoteToken = await deploy("MockERC20", "Quote", "QTE", 18);
  const pair = await deploy("MockPairLite", token.address, quoteToken.address);
  await (await pair.setReserves(toWei("1000000"), toWei("1000000"))).wait();

  const controller = await deploy(
    "BiggiSupplyController",
    owner.address,
    token.address,
    drip.address,
    rewards.address,
    pair.address
  );
  const guardian = await deploy("BiggiSupplyGuardian", owner.address, controller.address);
  const guard = await deploy(
    "BiggiDexReserveGuard",
    owner.address,
    pair.address,
    token.address,
    quoteToken.address,
    controller.address
  );

  await (await token.setReserve(reserve.address)).wait();
  await (await token.setDripDistributor(drip.address)).wait();
  await (await token.setTokenRewards(rewards.address)).wait();
  await (await token.setMarketingSupport(owner.address)).wait();
  await (await token.setSupplyController(controller.address)).wait();
  await (await token.setSupplyGuardian(guardian.address)).wait();
  await (await drip.setTreasury(owner.address)).wait();
  await (await token.initialDistribute()).wait();

  return { token, reserve, drip, rewards, pair, controller, guard };
}

async function deployLiquidityStack(owner) {
  const token = await deploy("BiggiToken", owner.address);
  const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
  const vault = await deploy("LiquidityVault", owner.address);
  const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
  const nftMain = await deploy("MockBlockNft");
  const nftMain2 = await deploy("MockBlockNft");
  const rewards = await deploy(
    "BiggiTokenRewards",
    nftMain.address,
    nftMain2.address,
    token.address,
    owner.address
  );
  const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
  const lpToken = await deploy("MockLpToken");
  const router = await deploy("MockLiquidityRouter", weth.address, lpToken.address);
  const factory = await deploy("MockLiquidityFactory");
  await (await factory.setPair(lpToken.address)).wait();
  await (await lpToken.setPairTokens(token.address, weth.address)).wait();
  await (await lpToken.setReserves(toWei("1000"), toWei("1000"))).wait();

  const manager = await deploy(
    "BiggiLiquidityManager",
    token.address,
    router.address,
    vault.address,
    owner.address,
    reserve.address
  );
  const orchestrator = await deploy(
    "BiggiLiquidityOrchestrator",
    reserve.address,
    manager.address,
    owner.address
  );
  const keeperProxy = await deploy(
    "BiggiLiquidityKeeperProxy",
    orchestrator.address,
    reserve.address,
    owner.address
  );

  await (await token.setReserve(reserve.address)).wait();
  await (await token.setDripDistributor(drip.address)).wait();
  await (await token.setTokenRewards(rewards.address)).wait();
  await (await token.setMarketingSupport(owner.address)).wait();
  await (await drip.setTreasury(owner.address)).wait();
  await (await token.initialDistribute()).wait();

  await (await reserve.setLiquidityManager(manager.address)).wait();
  await (await reserve.ownerTopUpDexRefill(toWei("100"))).wait();
  await owner.sendTransaction({ to: reserve.address, value: toWei("10") });

  await (await vault.setLiquidityManager(manager.address)).wait();
  await (await vault.addWhitelistedPair(lpToken.address)).wait();
  await (await manager.setFactory(factory.address)).wait();
  await (await manager.setTokenPct(100)).wait();
  await (await manager.setSlippageBps(0)).wait();
  await (await manager.setTxDeadlineSec(3600)).wait();
  await (await manager.setKeeper(orchestrator.address)).wait();
  await (await orchestrator.setLimits(toWei("0.1"), toWei("5"), toWei("1"), 0, 0)).wait();

  return { reserve, vault, lpToken, orchestrator, keeperProxy };
}

function workflowMetadata(ownerAddress, workflowId = WORKFLOW_ID) {
  return ethers.utils.solidityPack(
    ["bytes32", "bytes10", "address"],
    [workflowId, WORKFLOW_NODE_NAME, ownerAddress]
  );
}

function receiverReport(targetAddress, callData) {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "bytes"],
    [targetAddress, callData]
  );
}

async function automationCall(target) {
  const [needed, performData] = await target.checkUpkeep("0x");
  expect(needed).to.equal(true);
  return target.interface.encodeFunctionData("performUpkeep", [performData]);
}

async function executeBranch(receiver, forwarder, metadata, name, target, callData) {
  const report = receiverReport(target.address, callData);
  const tx = await receiver.connect(forwarder).onReport(metadata, report);
  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed.toNumber();
  const configuredWriteGasLimit = GAS_LIMITS[name];

  expect(gasUsed).to.be.lessThan(configuredWriteGasLimit);
  expect(gasUsed).to.be.lessThan(CRE_EVM_TRANSACTION_GAS_QUOTA);

  gasRows.push({
    name,
    targetContract: target.address,
    selector: callData.slice(0, 10),
    receiverOnReportGasUsed: gasUsed,
    configuredWriteGasLimit,
    configuredHeadroomGas: configuredWriteGasLimit - gasUsed,
    configuredHeadroomPct: Number(
      (((configuredWriteGasLimit - gasUsed) * 100) / configuredWriteGasLimit).toFixed(2)
    ),
    withinConfiguredLimit: true,
    withinCRETransactionQuota: true,
  });
}

function writeEvidenceReport() {
  const reportPath = process.env.CRE_AUTOMATION_REPORT_PATH;
  if (!reportPath) return;

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workflow: WORKFLOW_NAME,
    execution: {
      mode: process.env.FORK_URL ? "polygon-mainnet-fork" : "hardhat-local",
      chainId,
      startBlock,
      endBlock,
      mainnetTransactionsSent: 0,
      locallyDeployedProductionImplementations: true,
    },
    creQuotas: {
      evmTransactionGas: CRE_EVM_TRANSACTION_GAS_QUOTA,
      evmReadCallsPerRun: CRE_EVM_READ_CALL_QUOTA,
      source: "https://docs.chain.link/cre/service-quotas",
    },
    workflowReadBudget: {
      worstCaseCalls: WORKFLOW_WORST_CASE_READ_CALLS,
      withinQuota: WORKFLOW_WORST_CASE_READ_CALLS <= CRE_EVM_READ_CALL_QUOTA,
      calculation: "4 automation checkUpkeep reads + currentWeek + weekState",
    },
    gasAccounting: {
      scope: "Direct BiggiCREAutomationReceiver.onReport transaction including the target branch",
      excludes: "KeystoneForwarder and CRE DON overhead",
      result: gasRows.every(
        (row) => row.withinConfiguredLimit && row.withinCRETransactionQuota
      )
        ? "PASS"
        : "FAIL",
      branches: gasRows,
    },
    adversarialChecks,
    operationalNotes: [
      "BuybackUpkeepProxy intentionally catches BuybackAgent reverts and emits PerformFailed.",
      "A caught buyback failure leaves the upkeep eligible for the next workflow tick; monitor PerformFailed events because the receiver transaction itself succeeds.",
    ],
    overallResult:
      gasRows.length === 5 && adversarialChecks.every((check) => check.passed)
        ? "PASS"
        : "FAIL",
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

describe("BIGGI_MASTER: CRE automation adversarial and gas rehearsal", function () {
  it("executes all five production branches through the receiver within configured gas limits", async () => {
    const [owner, forwarder] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;
    startBlock = await ethers.provider.getBlockNumber();

    const productionTargets = productionWorkflowConfig.targets.map((target) => ({
      name: target.name,
      kind: target.kind,
      enabled: target.enabled,
      writeGasLimit: target.writeGasLimit,
    }));
    const testTargets = testWorkflowConfig.targets.map((target) => ({
      name: target.name,
      kind: target.kind,
      enabled: target.enabled,
      writeGasLimit: target.writeGasLimit,
    }));
    expect(testTargets).to.deep.equal(productionTargets);
    expect(productionTargets).to.have.length(5);
    for (const target of productionTargets) {
      expect(Number(target.writeGasLimit)).to.be.at.most(CRE_EVM_TRANSACTION_GAS_QUOTA);
    }

    const receiver = await deploy(
      "BiggiCREAutomationReceiver",
      owner.address,
      forwarder.address
    );
    const metadata = workflowMetadata(owner.address);

    const supply = await deployTokenStack(owner);
    await (
      await supply.controller.setDexConfig(9000, toWei("100"), 0, 0, false)
    ).wait();
    await (
      await supply.controller.setRewardsConfig(toWei("300000000"), toWei("50"), 0)
    ).wait();
    await (await supply.controller.snapshotBaseline()).wait();
    await (await supply.controller.setAllowedCaller(receiver.address, true)).wait();
    await (await supply.pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    const policy = await deploy("MockBuybackPolicy");
    const buybackAgent = await deploy("MockBuybackAgent", policy.address);
    const buybackProxy = await deploy("BiggiBuybackUpkeepProxy", owner.address);
    await (await buybackProxy.setAgent(buybackAgent.address)).wait();
    await (await buybackProxy.setThreshold(toWei("1"))).wait();
    await (await buybackAgent.setNativeBalance(toWei("2"))).wait();

    const liquidity = await deployLiquidityStack(owner);
    await (await liquidity.orchestrator.setKeeper(liquidity.keeperProxy.address)).wait();
    await (await liquidity.keeperProxy.setAllowedCaller(receiver.address)).wait();
    await (await liquidity.keeperProxy.setStrategy(0, toWei("0.5"), 500)).wait();
    await (
      await liquidity.keeperProxy.setLimits(0, toWei("0.1"), toWei("2"), toWei("1"))
    ).wait();

    const guardStack = await deployTokenStack(owner);
    await (
      await guardStack.controller.setDexConfig(9000, toWei("20000000"), 0, 0, false)
    ).wait();
    await (await guardStack.controller.snapshotBaseline()).wait();
    await (await guardStack.controller.setAllowedCaller(guardStack.guard.address, true)).wait();
    await (await guardStack.guard.setKeeper(receiver.address, true)).wait();
    await (await guardStack.guard.setCooldown(0)).wait();
    await (await guardStack.guard.setReserveRatioBps(9000)).wait();
    await (await guardStack.guard.setRefillAmount(toWei("20000000"))).wait();
    await (await guardStack.guard.snapshotBaseline()).wait();
    await (await guardStack.pair.setReserves(toWei("1000"), toWei("1000000"))).wait();

    const emission = await deploy(
      "BiggiTokenRewardsEmissionController",
      supply.rewards.address,
      ethers.constants.AddressZero,
      supply.token.address,
      owner.address
    );
    await (await emission.setKeeper(receiver.address, true)).wait();

    const performSelector = await receiver.PERFORM_UPKEEP_SELECTOR();
    const rollSelector = emission.interface.getSighash("rollCurrentWeek");
    await (
      await receiver.setCallsAllowed(
        [
          supply.controller.address,
          buybackProxy.address,
          liquidity.keeperProxy.address,
          guardStack.guard.address,
          emission.address,
        ],
        [performSelector, performSelector, performSelector, performSelector, rollSelector],
        true
      )
    ).wait();
    await (await receiver.setExpectedWorkflowIdentity(WORKFLOW_ID, owner.address)).wait();
    await (await receiver.unpause()).wait();

    const supplyData = await automationCall(supply.controller);
    await executeBranch(
      receiver,
      forwarder,
      metadata,
      "supply-controller",
      supply.controller,
      supplyData
    );
    expect(await supply.token.guardianDexMinted()).to.equal(toWei("100"));
    expect(await supply.token.guardianRewardsMinted()).to.equal(toWei("50"));

    const buybackData = await automationCall(buybackProxy);
    await executeBranch(
      receiver,
      forwarder,
      metadata,
      "buyback",
      buybackProxy,
      buybackData
    );
    expect(await buybackAgent.buybackCalls()).to.equal(1);

    const reservePolBefore = await liquidity.reserve.polBalance();
    const liquidityData = await automationCall(liquidity.keeperProxy);
    await executeBranch(
      receiver,
      forwarder,
      metadata,
      "liquidity",
      liquidity.keeperProxy,
      liquidityData
    );
    expect(await liquidity.reserve.polBalance()).to.be.lt(reservePolBefore);
    expect(await liquidity.vault.lpBalanceOf(liquidity.lpToken.address)).to.be.gt(0);

    const guardData = await automationCall(guardStack.guard);
    await executeBranch(
      receiver,
      forwarder,
      metadata,
      "dex-reserve-guard",
      guardStack.guard,
      guardData
    );
    expect(await guardStack.token.guardianDexMinted()).to.equal(toWei("20000000"));

    const weekId = await emission.currentWeek();
    expect((await emission.weekState(weekId)).initialized).to.equal(false);
    const weekData = emission.interface.encodeFunctionData("rollCurrentWeek");
    await executeBranch(
      receiver,
      forwarder,
      metadata,
      "rewards-week-roll",
      emission,
      weekData
    );
    expect((await emission.weekState(weekId)).initialized).to.equal(true);

    expect(gasRows).to.have.length(5);
    expect(WORKFLOW_WORST_CASE_READ_CALLS).to.be.at.most(CRE_EVM_READ_CALL_QUOTA);
  });

  it("rejects hostile reports and remains usable after an isolated target revert", async () => {
    const [owner, forwarder, outsider] = await ethers.getSigners();
    const target = await deploy("MockCREAutomationTarget");
    const receiver = await deploy(
      "BiggiCREAutomationReceiver",
      owner.address,
      forwarder.address
    );
    const performSelector = target.interface.getSighash("performUpkeep");
    const revertingSelector = target.interface.getSighash("revertingUpkeep");
    await (
      await receiver.setCallsAllowed(
        [target.address, target.address],
        [performSelector, revertingSelector],
        true
      )
    ).wait();
    await (await receiver.setExpectedWorkflowIdentity(WORKFLOW_ID, owner.address)).wait();
    await (await receiver.unpause()).wait();

    const metadata = workflowMetadata(owner.address);
    const performData = ethers.utils.defaultAbiCoder.encode(["uint256"], [7]);
    const goodCall = target.interface.encodeFunctionData("performUpkeep", [performData]);
    const goodReport = receiverReport(target.address, goodCall);

    await expect(receiver.connect(outsider).onReport(metadata, goodReport)).to.be.reverted;
    adversarialChecks.push({ name: "unauthorized-forwarder", passed: true });

    const wrongMetadata = workflowMetadata(owner.address, ethers.utils.id("hostile-workflow"));
    await expect(receiver.connect(forwarder).onReport(wrongMetadata, goodReport)).to.be.reverted;
    adversarialChecks.push({ name: "wrong-workflow-identity", passed: true });

    const revertingCall = target.interface.encodeFunctionData("revertingUpkeep", [performData]);
    const revertingReport = receiverReport(target.address, revertingCall);
    await expect(receiver.connect(forwarder).onReport(metadata, revertingReport)).to.be.reverted;
    adversarialChecks.push({ name: "target-revert-contained", passed: true });

    await (await receiver.connect(forwarder).onReport(metadata, goodReport)).wait();
    expect(await target.calls()).to.equal(1);
    adversarialChecks.push({ name: "receiver-recovers-for-next-report", passed: true });

    const policy = await deploy("MockBuybackPolicy");
    const buybackAgent = await deploy("MockBuybackAgent", policy.address);
    const buybackProxy = await deploy("BiggiBuybackUpkeepProxy", owner.address);
    await (await buybackProxy.setAgent(buybackAgent.address)).wait();
    await (await buybackProxy.setThreshold(toWei("1"))).wait();
    await (await buybackAgent.setNativeBalance(toWei("2"))).wait();
    await (await buybackAgent.setShouldRevert(true)).wait();
    await (
      await receiver.setCallAllowed(buybackProxy.address, performSelector, true)
    ).wait();

    const failedBuybackCall = await automationCall(buybackProxy);
    const failedBuybackReport = receiverReport(buybackProxy.address, failedBuybackCall);
    await (await receiver.connect(forwarder).onReport(metadata, failedBuybackReport)).wait();
    expect(await buybackAgent.buybackCalls()).to.equal(0);
    const [retryNeeded] = await buybackProxy.checkUpkeep("0x");
    expect(retryNeeded).to.equal(true);
    adversarialChecks.push({ name: "buyback-failure-remains-retryable", passed: true });

    await (await buybackAgent.setShouldRevert(false)).wait();
    await (await receiver.connect(forwarder).onReport(metadata, failedBuybackReport)).wait();
    expect(await buybackAgent.buybackCalls()).to.equal(1);
    adversarialChecks.push({ name: "buyback-recovers-on-next-report", passed: true });

    endBlock = await ethers.provider.getBlockNumber();
    writeEvidenceReport();
  });
});
