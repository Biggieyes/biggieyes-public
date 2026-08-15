const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const POLYGON_FORWARDER = "0x76c9cf548b4179F8901cda1f8623568b58215E62";
const PERFORM_UPKEEP_SELECTOR = ethers.utils.id("performUpkeep(bytes)").slice(0, 10);
const ROLL_CURRENT_WEEK_SELECTOR = ethers.utils.id("rollCurrentWeek()").slice(0, 10);

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

function address(value) {
  return isAddress(value) ? ethers.utils.getAddress(value) : ZERO;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function formatPol(value) {
  return ethers.utils.formatEther(value);
}

async function estimate(label, fn, actions, blockers) {
  try {
    const gas = await fn();
    actions.push({ label, gas: gas.toString(), estimate: "rpc" });
    return gas;
  } catch (error) {
    blockers.push({ label, error: error.message });
    return ethers.BigNumber.from(0);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  const root = path.resolve(__dirname, "../..");
  const addressesFile = path.resolve(root, env("MASTER_ADDRESSES_FILE", "addresses.master.json"));
  const reportFile = path.resolve(root, "reports/cre-receiver-deployment-plan-polygon.json");
  const addresses = loadJson(addressesFile);
  const owner = address(env("CRE_RECEIVER_OWNER", env("EXPECT_OWNER", addresses.OWNER || deployer.address)));
  const forwarder = address(env("CRE_KEYSTONE_FORWARDER", addresses.CRE_KEYSTONE_FORWARDER || POLYGON_FORWARDER));
  const compromised = address(env("COMPROMISED_OWNER_ADDRESS"));
  const existingReceiver = address(env("CRE_AUTOMATION_RECEIVER", addresses.CRE_AUTOMATION_RECEIVER));
  const actions = [];
  const blockers = [];
  const warnings = [];

  if (network.name !== "polygon" || chain.chainId !== 137) blockers.push({ label: "network", error: "Expected Polygon mainnet" });
  if (owner === ZERO) blockers.push({ label: "owner", error: "CRE receiver owner is missing" });
  if (forwarder !== ethers.utils.getAddress(POLYGON_FORWARDER)) blockers.push({ label: "forwarder", error: "Not the official Polygon production forwarder" });
  if ((await ethers.provider.getCode(forwarder)) === "0x") blockers.push({ label: "forwarder", error: "Forwarder has no bytecode" });
  if (compromised !== ZERO && deployer.address === compromised) {
    blockers.push({ label: "deployer security", error: "Deployer equals COMPROMISED_OWNER_ADDRESS" });
  }
  if (compromised !== ZERO && owner === compromised) {
    blockers.push({ label: "owner security", error: "Receiver owner equals COMPROMISED_OWNER_ADDRESS" });
  }

  const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  const predictedReceiver = existingReceiver !== ZERO
    ? existingReceiver
    : ethers.utils.getContractAddress({ from: deployer.address, nonce: pendingNonce });
  let totalGas = ethers.BigNumber.from(0);

  if (existingReceiver === ZERO) {
    const Factory = await ethers.getContractFactory("BiggiCREAutomationReceiver");
    const deployTx = Factory.getDeployTransaction(owner, forwarder);
    totalGas = totalGas.add(await estimate(
      "Deploy BiggiCREAutomationReceiver (starts paused)",
      () => ethers.provider.estimateGas({ from: deployer.address, data: deployTx.data }),
      actions,
      blockers
    ));
    const conservativeAllowlistGas = ethers.BigNumber.from(300000);
    actions.push({
      label: "Receiver.setCallsAllowed (5 target/selector pairs)",
      gas: conservativeAllowlistGas.toString(),
      estimate: "conservative until receiver exists",
      targets: [
        [addresses.SUPPLY_CONTROLLER, PERFORM_UPKEEP_SELECTOR],
        [addresses.BUYBACK_UPKEEP_PROXY, PERFORM_UPKEEP_SELECTOR],
        [addresses.LIQUIDITY_KEEPER_PROXY, PERFORM_UPKEEP_SELECTOR],
        [addresses.DEX_RESERVE_GUARD, PERFORM_UPKEEP_SELECTOR],
        [addresses.TOKEN_REWARDS_EMISSION_CONTROLLER, ROLL_CURRENT_WEEK_SELECTOR],
      ],
    });
    totalGas = totalGas.add(conservativeAllowlistGas);
  } else if ((await ethers.provider.getCode(existingReceiver)) === "0x") {
    blockers.push({ label: "receiver", error: "Configured CRE receiver has no bytecode" });
  } else {
    warnings.push({ label: "receiver", value: "Receiver already exists; deployment estimate omitted" });
  }

  const targetSetters = [
    {
      label: "SupplyController.setAllowedCaller(receiver,true)",
      target: address(addresses.SUPPLY_CONTROLLER),
      abi: ["function setAllowedCaller(address,bool)"],
      method: "setAllowedCaller",
      args: [predictedReceiver, true],
    },
    {
      label: "DexReserveGuard.setKeeper(receiver,true)",
      target: address(addresses.DEX_RESERVE_GUARD),
      abi: ["function setKeeper(address,bool)"],
      method: "setKeeper",
      args: [predictedReceiver, true],
    },
    {
      label: "TokenRewardsEmissionController.setKeeper(receiver,true)",
      target: address(addresses.TOKEN_REWARDS_EMISSION_CONTROLLER),
      abi: ["function setKeeper(address,bool)"],
      method: "setKeeper",
      args: [predictedReceiver, true],
    },
    {
      label: "LiquidityKeeperProxy.setAllowedCaller(receiver)",
      target: address(addresses.LIQUIDITY_KEEPER_PROXY),
      abi: ["function setAllowedCaller(address)"],
      method: "setAllowedCaller",
      args: [predictedReceiver],
    },
  ];

  for (const item of targetSetters) {
    if (item.target === ZERO || (await ethers.provider.getCode(item.target)) === "0x") {
      blockers.push({ label: item.label, error: "Target missing or has no bytecode" });
      continue;
    }
    const contract = new ethers.Contract(item.target, item.abi, deployer);
    const gas = await estimate(item.label, () => contract.estimateGas[item.method](...item.args), actions, blockers);
    totalGas = totalGas.add(gas);
  }

  actions.push({
    label: "After CRE deploy: receiver.setExpectedWorkflowIdentity(workflowId,workflowOwner)",
    gas: "estimated after workflow ID is known",
  });
  actions.push({
    label: "Launch last: receiver.unpause()",
    gas: "estimated immediately before activation",
  });

  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const balance = await deployer.getBalance();
  const estimatedCost = totalGas.mul(gasPrice);
  const report = {
    createdAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    dryRun: true,
    sendsTransactions: false,
    deployer: deployer.address,
    owner,
    forwarder,
    existingReceiver,
    predictedReceiver,
    pendingNonce,
    balanceWei: balance.toString(),
    balancePol: formatPol(balance),
    gasPriceWei: gasPrice.toString(),
    estimatedPreApprovalGas: totalGas.toString(),
    estimatedPreApprovalCostWei: estimatedCost.toString(),
    estimatedPreApprovalCostPol: formatPol(estimatedCost),
    actions,
    warnings,
    blockers,
    readyToExecute: blockers.length === 0,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    readyToExecute: report.readyToExecute,
    predictedReceiver,
    actions: actions.length,
    estimatedPreApprovalGas: report.estimatedPreApprovalGas,
    estimatedPreApprovalCostPol: report.estimatedPreApprovalCostPol,
    blockers: blockers.length,
    report: reportFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
