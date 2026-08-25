const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const {
  buildProductionActivationPlan,
  loadProductionConfig,
} = require("./lib/productionActivationPlan");
const {
  compareProductionState,
  readProductionState,
  serializeProductionState,
} = require("./lib/productionState");

function loadJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadAddresses(root) {
  return {
    ...loadJson(path.resolve(root, "addresses.master.json")),
    ...loadJson(path.resolve(root, "addresses.visibility.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase1.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase2.polygon.json")),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function executePlan(signer, plan) {
  const executions = [];
  for (const phase of plan.phases) {
    const phaseResult = { id: phase.id, transactions: [] };
    for (const item of phase.transactions) {
      if (!item.required) {
        phaseResult.transactions.push({ id: item.id, status: "not-required" });
        continue;
      }
      assert(item.blockedBy.length === 0, `${phase.id}/${item.id} is blocked: ${item.blockedBy.join(", ")}`);
      const response = await signer.sendTransaction({ to: item.to, value: item.value, data: item.data });
      const receipt = await response.wait();
      assert(receipt.status === 1, `${phase.id}/${item.id} reverted`);
      phaseResult.transactions.push({
        id: item.id,
        status: "executed-on-fork",
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });
    }
    executions.push(phaseResult);
  }
  return executions;
}

async function main() {
  if (network.name !== "hardhat") throw new Error("Production activation rehearsal is fork-only");

  const root = path.resolve(__dirname, "../..");
  const addresses = loadAddresses(root);
  const { config } = loadProductionConfig(root);
  const owner = ethers.utils.getAddress(addresses.OWNER);
  const workflowId = ethers.utils.id("biggi-production-activation-fork-rehearsal");
  const workflowOwner = owner;
  let impersonating = false;

  try {
    await ethers.provider.send("hardhat_setBalance", [
      owner,
      ethers.utils.hexStripZeros(ethers.utils.parseEther("6000").toHexString()),
    ]);
    await ethers.provider.send("hardhat_impersonateAccount", [owner]);
    impersonating = true;
    await ethers.provider.send("evm_mine", []);
    const signer = await ethers.getSigner(owner);

    const stateBefore = await readProductionState(ethers.provider, addresses, config);
    assert(stateBefore.pair.empty, "Fork source pair is no longer empty");
    const block = await ethers.provider.getBlock("latest");
    const plan = buildProductionActivationPlan({
      addresses,
      config,
      state: stateBefore,
      blockTimestamp: block.timestamp,
      workflowId,
      workflowOwner,
    });
    assert(plan.phases.find((phase) => phase.id === "30-cre-wiring").ready, "CRE phase did not resolve test identity");

    const token = new ethers.Contract(addresses.BIGGI_TOKEN, [
      "function balanceOf(address) view returns(uint256)",
      "function allowance(address,address) view returns(uint256)",
    ], ethers.provider);
    const pair = new ethers.Contract(addresses.PAIR, [
      "function token0() view returns(address)",
      "function getReserves() view returns(uint112,uint112,uint32)",
    ], ethers.provider);
    const vault = new ethers.Contract(addresses.LIQUIDITY_VAULT, [
      "function lpSnapshot(address) view returns(bool,uint256,uint256)",
    ], ethers.provider);
    const receiver = new ethers.Contract(addresses.CRE_AUTOMATION_RECEIVER, [
      "function expectedWorkflowId() view returns(bytes32)",
      "function expectedWorkflowOwner() view returns(address)",
    ], ethers.provider);

    const ownerTokenBefore = await token.balanceOf(owner);
    const reserveTokenBefore = await token.balanceOf(addresses.RESERVE);
    const executions = await executePlan(signer, plan);
    const stateAfter = await readProductionState(ethers.provider, addresses, config);
    const canonicalChecks = compareProductionState(stateAfter, addresses, config);
    const failedChecks = canonicalChecks.filter((check) => !check.ok);

    const reserves = await pair.getReserves();
    const token0 = ethers.utils.getAddress(await pair.token0());
    const biggiReserve = token0 === ethers.utils.getAddress(addresses.BIGGI_TOKEN) ? reserves[0] : reserves[1];
    const polReserve = token0 === ethers.utils.getAddress(addresses.BIGGI_TOKEN) ? reserves[1] : reserves[0];
    const expectedBiggiReserve = ethers.BigNumber.from(config.initialLiquidity.tokenAmountWei)
      .add(config.initialLiquidity.postSeedSyncTokenWei);
    const expectedPolReserve = ethers.BigNumber.from(config.initialLiquidity.nativeAmountWei)
      .add(config.initialLiquidity.postSeedSyncNativeWei);
    const vaultSnapshot = await vault.lpSnapshot(addresses.PAIR);
    const ownerTokenAfter = await token.balanceOf(owner);
    const reserveTokenAfter = await token.balanceOf(addresses.RESERVE);
    const routerAllowance = await token.allowance(owner, addresses.ROUTER);

    assert(failedChecks.length === 0, `Canonical post-state failed: ${failedChecks.map((check) => check.name).join(", ")}`);
    assert(biggiReserve.eq(expectedBiggiReserve), "Final BIGGI pair reserve mismatch");
    assert(polReserve.eq(expectedPolReserve), "Final POL pair reserve mismatch");
    assert(vaultSnapshot[0], "Pair is not whitelisted in LiquidityVault");
    assert(vaultSnapshot[1].eq(vaultSnapshot[2]) && vaultSnapshot[2].gt(0), "Vault LP accounting mismatch");
    assert(ownerTokenAfter.eq(ownerTokenBefore), "Owner marketing BIGGI balance changed");
    assert(
      reserveTokenAfter.eq(
        reserveTokenBefore
          .sub(config.initialLiquidity.tokenAmountWei)
          .sub(config.initialLiquidity.postSeedSyncTokenWei)
      ),
      "Reserve BIGGI balance mismatch"
    );
    assert(routerAllowance.isZero(), "Router allowance was not cleared");
    assert(await receiver.expectedWorkflowId() === workflowId, "CRE workflow ID mismatch");
    assert(
      ethers.utils.getAddress(await receiver.expectedWorkflowOwner()) === workflowOwner,
      "CRE workflow owner mismatch"
    );
    for (const chapterId of config.launch.futureChapterIds) {
      assert(stateAfter.launch.chapterActive[String(chapterId)] === false, `Future chapter ${chapterId} became active`);
    }
    assert(stateAfter.dripKeeper.paused, "DripKeeper must remain paused");

    const gasUsed = executions
      .flatMap((phase) => phase.transactions)
      .filter((item) => item.gasUsed)
      .reduce((total, item) => total.add(item.gasUsed), ethers.BigNumber.from(0));
    const report = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      forkOnly: true,
      sendsMainnetTransactions: false,
      containsMainnetSignatures: false,
      sourceForkBlock: Number(process.env.FORK_BLOCK_NUMBER || 0) || null,
      workflowIdentity: { workflowId, workflowOwner, syntheticForFork: true },
      plan,
      executions,
      totalGasUsed: gasUsed.toString(),
      stateBefore: serializeProductionState(stateBefore),
      stateAfter: serializeProductionState(stateAfter),
      canonicalChecks,
      liquidity: {
        pair: addresses.PAIR,
        biggiReserveWei: biggiReserve.toString(),
        polReserveWei: polReserve.toString(),
        vaultAccountedLpWei: vaultSnapshot[1].toString(),
        vaultRealLpWei: vaultSnapshot[2].toString(),
        routerAllowanceWei: routerAllowance.toString(),
      },
      checks: {
        allCanonicalChecksPassed: true,
        exactInitialLiquidityAndSync: true,
        vaultAccountingSynchronized: true,
        ownerMarketingBalancePreserved: true,
        fiveCRECallsAndRolesReady: true,
        dripKeeperRemainsPaused: true,
        onlyOriginalsChapterActivated: true,
      },
    };
    const reportFile = path.resolve(root, "reports/production-activation-plan-fork.json");
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    const supportReportFile = path.resolve(
      root,
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/production-activation-plan-fork.json"
    );
    fs.mkdirSync(path.dirname(supportReportFile), { recursive: true });
    fs.writeFileSync(supportReportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      ok: true,
      report: reportFile,
      totalGasUsed: report.totalGasUsed,
      checks: report.checks,
    }, null, 2));
  } finally {
    if (impersonating) await ethers.provider.send("hardhat_stopImpersonatingAccount", [owner]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
