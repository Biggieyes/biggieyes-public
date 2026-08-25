const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const {
  HASH_ZERO,
  ZERO,
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

function workflowIdentityFromEnvironment() {
  const workflowId = String(process.env.CRE_EXPECTED_WORKFLOW_ID || "").trim();
  const workflowOwner = String(process.env.CRE_EXPECTED_WORKFLOW_OWNER || "").trim();
  if (!ethers.utils.isHexString(workflowId, 32) || workflowId.toLowerCase() === HASH_ZERO.toLowerCase()) {
    return { workflowId: HASH_ZERO, workflowOwner: ZERO, resolved: false };
  }
  try {
    const owner = ethers.utils.getAddress(workflowOwner);
    if (owner === ZERO) return { workflowId: HASH_ZERO, workflowOwner: ZERO, resolved: false };
    return { workflowId, workflowOwner: owner, resolved: true };
  } catch {
    return { workflowId: HASH_ZERO, workflowOwner: ZERO, resolved: false };
  }
}

function summarizeChecks(checks) {
  const categories = {};
  for (const check of checks) {
    const category = categories[check.category] || { total: 0, passed: 0, failed: 0 };
    category.total += 1;
    if (check.ok) category.passed += 1;
    else category.failed += 1;
    categories[check.category] = category;
  }
  return categories;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const addresses = loadAddresses(root);
  const { file: configFile, config } = loadProductionConfig(root);
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== config.network.chainId || network.name !== config.network.name) {
    throw new Error(`Read-only plan must run on ${config.network.name} chainId ${config.network.chainId}`);
  }

  const latestBlock = await ethers.provider.getBlock("latest");
  const state = await readProductionState(ethers.provider, addresses, config);
  const checks = compareProductionState(state, addresses, config);
  const workflow = workflowIdentityFromEnvironment();
  const plan = buildProductionActivationPlan({
    addresses,
    config,
    state,
    blockTimestamp: latestBlock.timestamp,
    workflowId: workflow.workflowId,
    workflowOwner: workflow.workflowOwner,
  });

  const token = new ethers.Contract(addresses.BIGGI_TOKEN, [
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
  ], ethers.provider);
  const requiredNative = ethers.BigNumber.from(config.initialLiquidity.nativeAmountWei)
    .add(config.initialLiquidity.postSeedSyncNativeWei);
  const requiredReserveToken = ethers.BigNumber.from(config.initialLiquidity.tokenAmountWei)
    .add(config.initialLiquidity.postSeedSyncTokenWei);
  const [ownerNative, reserveToken, routerAllowance] = await Promise.all([
    ethers.provider.getBalance(addresses.OWNER),
    token.balanceOf(addresses.RESERVE),
    token.allowance(addresses.OWNER, addresses.ROUTER),
  ]);

  const remediatedParameterNames = new Set([
    "BuybackUpkeep threshold",
    "LiquidityManager auto top-up enabled",
    "LiquidityManager auto trigger",
    "LiquidityManager auto request",
  ]);
  const blockers = [];
  const warnings = [];
  const failedOwnership = checks.filter((check) => check.category === "ownership" && !check.ok);
  const failedParameters = checks.filter(
    (check) => check.category === "parameter" && !check.ok && !remediatedParameterNames.has(check.name)
  );
  const remediableParameters = checks.filter(
    (check) => check.category === "parameter" && !check.ok && remediatedParameterNames.has(check.name)
  );
  const failedIsolation = checks.filter((check) => check.category === "chapterIsolation" && !check.ok);

  if (failedOwnership.length) blockers.push({ name: "Production owner mismatch", checks: failedOwnership });
  if (failedParameters.length) blockers.push({ name: "Canonical parameter mismatch outside remediation phase", checks: failedParameters });
  if (failedIsolation.length) blockers.push({ name: "A future chapter is already active", checks: failedIsolation });
  if (!state.pair.empty) blockers.push({ name: "Initial BIGGI/WPOL pair is not empty", pair: serializeProductionState(state.pair) });
  if (ownerNative.lte(requiredNative)) {
    blockers.push({
      name: "Owner lacks execution value plus a positive gas reserve",
      actualWei: ownerNative.toString(),
      executionValueWei: requiredNative.toString(),
    });
  }
  if (reserveToken.lt(requiredReserveToken)) {
    blockers.push({
      name: "Reserve lacks BIGGI required by seed and accounting sync",
      actualWei: reserveToken.toString(),
      requiredWei: requiredReserveToken.toString(),
    });
  }
  if (!routerAllowance.isZero()) {
    blockers.push({ name: "Existing owner-to-router BIGGI allowance must be cleared first", allowanceWei: routerAllowance.toString() });
  }
  if (!workflow.resolved) {
    blockers.push({ name: "CRE production workflow identity is unresolved", required: ["CRE_EXPECTED_WORKFLOW_ID", "CRE_EXPECTED_WORKFLOW_OWNER"] });
  }
  if (remediableParameters.length) {
    warnings.push({ name: "Phase 00 contains required canonical remediation", checks: remediableParameters });
  }
  warnings.push({
    name: "Liquidity transaction deadline is ephemeral",
    value: `Regenerate this plan after Phase 00 and immediately before Phase 10; current deadline is ${plan.dynamicValues.liquidityDeadlineUnix}.`,
  });

  const remediationPhase = plan.phases.find((phase) => phase.id === "00-pre-liquidity-remediation");
  remediationPhase.blockers = [];
  if (failedOwnership.length) remediationPhase.blockers.push("Production owner mismatch");
  if (failedParameters.length) remediationPhase.blockers.push("Canonical parameter mismatch outside Phase 00");
  remediationPhase.ready = remediationPhase.blockers.length === 0;

  const liquidityPhase = plan.phases.find((phase) => phase.id === "10-initial-liquidity");
  if (remediationPhase.transactions.some((item) => item.required)) {
    liquidityPhase.blockers.push("Phase 00 remediation must be executed and the plan regenerated");
  }
  if (ownerNative.lte(requiredNative)) liquidityPhase.blockers.push("Owner lacks 5001 POL execution value plus gas");
  if (reserveToken.lt(requiredReserveToken)) liquidityPhase.blockers.push("Reserve lacks required BIGGI");
  if (!routerAllowance.isZero()) liquidityPhase.blockers.push("Existing router allowance is non-zero");
  liquidityPhase.ready = liquidityPhase.blockers.length === 0;

  const reportDirectory = path.resolve(root, "reports/production-activation");
  const reportFile = path.resolve(root, "reports/production-activation-plan-polygon.json");
  const report = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    sourceBlock: { number: latestBlock.number, timestamp: latestBlock.timestamp },
    network: { hardhatName: network.name, chainId: chain.chainId },
    mode: "read-only-unsigned-plan",
    sendsTransactions: false,
    containsSignatures: false,
    configFile: path.relative(root, configFile).replace(/\\/g, "/"),
    readyForExecution: blockers.length === 0,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers,
    warnings,
    funding: {
      ownerNativeWei: ownerNative.toString(),
      requiredExecutionValueWei: requiredNative.toString(),
      surplusForGasWei: ownerNative.gt(requiredNative) ? ownerNative.sub(requiredNative).toString() : "0",
      reserveBiggiWei: reserveToken.toString(),
      requiredReserveBiggiWei: requiredReserveToken.toString(),
      existingRouterAllowanceWei: routerAllowance.toString(),
    },
    canonicalAudit: {
      summary: summarizeChecks(checks),
      checks,
    },
    currentState: serializeProductionState(state),
    plan,
  };

  writeJson(reportFile, report);
  writeJson(
    path.resolve(
      root,
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/production-activation-plan-polygon.json"
    ),
    report
  );
  for (const phase of plan.phases) {
    writeJson(path.resolve(reportDirectory, `${phase.id}.unsigned.json`), {
      schemaVersion: 1,
      createdAt: report.createdAt,
      network: config.network,
      sourceBlock: report.sourceBlock,
      sendsTransactions: false,
      containsSignatures: false,
      expectedSigner: plan.expectedSigner,
      configDigest: plan.configDigest,
      phase,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    readyForExecution: report.readyForExecution,
    blockers: report.blockerCount,
    warnings: report.warningCount,
    phases: plan.phases.map((phase) => phase.id),
    report: reportFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
