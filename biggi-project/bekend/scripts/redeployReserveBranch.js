// scripts/redeployReserveBranch.js
// Redeploys ReserveV4 and rewires Reserve -> LM -> Orchestrator -> Keeper + related modules.
// Run:
//   npx hardhat run scripts/redeployReserveBranch.js --network amoy
//
// Reads env from scripts/.env first, then process env.

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const DEFAULTS = {
  BIGGI: "0xD4D0fa17f2955Eb3fF8D03ea0cD7A2f0a06E6d0E",
  MAIN: "0x3430f378032Cead7A82f38047e906C1E3cAFc703",
  MAIN2: "0xf511267b2A08Cd2f94ACc0eF74c4Eb1Ac799980B",
  TREASURY: "0xE2fa9DFFc69f53b42dC41681bfFd22dA74c64461",
  RESERVE_OLD: "0xC700EA8E43259C832C2438D01F60C88752894B8f",
  LIQUIDITY_MANAGER: "0x87f542886FC133C68F1b0ae7737Ecb4f8F647e6C",
  LIQUIDITY_ORCHESTRATOR: "0xAfbA1a91A0211a0a892dC34B529f904bF6E70c59",
  LIQUIDITY_KEEPER_PROXY: "0xb47CFDE62feA7a8A4B3a569d8A6Bf83c8a9D6f10",
  DISTRIBUTOR: "0xc8382527D0cb095fDa284547EA91eC352E7C75Cd",
  DRIP_LM: "0xD32fC50c153Ab47F68763c739A2deA8b5Da81373",
  MASTER_CONFIG: "0xd75402b5B72183813b61e641A27AA48C145d18fC",
};

const ABI_OWNABLE = ["function owner() view returns (address)"];
const ABI_TOKEN = [
  "function owner() view returns (address)",
  "function reserveAddr() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function transferFromReserveTo(address,uint256) external",
  "function setReserve(address) external",
];
const ABI_RESERVE = [
  "function owner() view returns (address)",
  "function setLiquidityManager(address) external",
  "function setDistributor(address) external",
  "function ownerTopUpDexRefill(uint256) external",
  "function waitingBiggi() view returns (uint256)",
  "function dexRefillBiggi() view returns (uint256)",
  "function totalPolReceived() view returns (uint256)",
  "function polBalance() view returns (uint256)",
  "function biggiBalance() view returns (uint256)",
  "function liquidityManager() view returns (address)",
  "function distributor() view returns (address)",
];
const ABI_MAIN = ["function setReserveAddress(address) external", "function reserveAddress() view returns (address)", "function owner() view returns (address)"];
const ABI_TREASURY = ["function setReserve(address) external", "function reserveAddr() view returns (address)", "function owner() view returns (address)"];
const ABI_DIST = ["function setReserve(address) external", "function reserve() view returns (address)", "function owner() view returns (address)"];
const ABI_LM = ["function setReserve(address) external", "function reserve() view returns (address)", "function owner() view returns (address)"];
const ABI_ORCH = ["function setReserve(address) external", "function reserve() view returns (address)", "function owner() view returns (address)"];
const ABI_KEEPER = ["function setReserve(address) external", "function reserve() view returns (address)", "function owner() view returns (address)"];
const ABI_DRIP_LM = ["function setReserve(address) external", "function reserve() view returns (address)", "function owner() view returns (address)"];
const ABI_MC = [
  "function owner() view returns (address)",
  "function coreBundle() view returns (address,address,address,address)",
  "function setCore(address,address,address,address) external",
];

function addr(name) {
  return process.env[name] || DEFAULTS[name];
}

function gasOverrides() {
  const prio = process.env.GAS_PRIORITY_GWEI || "30";
  const fee = process.env.GAS_FEE_GWEI || "60";
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(prio, "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(fee, "gwei"),
  };
}

async function tx(label, fn) {
  const sent = await fn();
  console.log(`${label} tx: ${sent.hash}`);
  const rc = await sent.wait();
  if (rc.status !== 1) throw new Error(`${label} failed`);
  return rc;
}

async function assertOwner(contract, expected, label) {
  const onchain = (await contract.owner()).toLowerCase();
  if (onchain !== expected.toLowerCase()) {
    throw new Error(`${label}: signer is not owner (${onchain})`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const me = deployer.address;
  const gas = gasOverrides();

  const A = {
    BIGGI: addr("BIGGI"),
    MAIN: addr("MAIN"),
    MAIN2: addr("MAIN2"),
    TREASURY: addr("TREASURY"),
    RESERVE_OLD: addr("RESERVE_OLD") || addr("RESERVE"),
    LIQUIDITY_MANAGER: addr("LIQUIDITY_MANAGER"),
    LIQUIDITY_ORCHESTRATOR: addr("LIQUIDITY_ORCHESTRATOR"),
    LIQUIDITY_KEEPER_PROXY: addr("LIQUIDITY_KEEPER_PROXY"),
    DISTRIBUTOR: addr("DISTRIBUTOR"),
    DRIP_LM: addr("DRIP_LM"),
    MASTER_CONFIG: addr("MASTER_CONFIG"),
  };

  console.log("Signer:", me);
  console.log("Network:", await deployer.getChainId());
  console.log("Config:", A);

  const token = new ethers.Contract(A.BIGGI, ABI_TOKEN, deployer);
  const main1 = new ethers.Contract(A.MAIN, ABI_MAIN, deployer);
  const main2 = new ethers.Contract(A.MAIN2, ABI_MAIN, deployer);
  const treasury = new ethers.Contract(A.TREASURY, ABI_TREASURY, deployer);
  const reserveOld = new ethers.Contract(A.RESERVE_OLD, ABI_RESERVE, deployer);
  const dist = new ethers.Contract(A.DISTRIBUTOR, ABI_DIST, deployer);
  const lm = new ethers.Contract(A.LIQUIDITY_MANAGER, ABI_LM, deployer);
  const orch = new ethers.Contract(A.LIQUIDITY_ORCHESTRATOR, ABI_ORCH, deployer);
  const keeper = new ethers.Contract(A.LIQUIDITY_KEEPER_PROXY, ABI_KEEPER, deployer);
  const dripLm = new ethers.Contract(A.DRIP_LM, ABI_DRIP_LM, deployer);
  const mc = new ethers.Contract(A.MASTER_CONFIG, ABI_MC, deployer);

  await assertOwner(token, me, "BIGGI");
  await assertOwner(main1, me, "MAIN");
  await assertOwner(main2, me, "MAIN2");
  await assertOwner(treasury, me, "TREASURY");
  await assertOwner(reserveOld, me, "RESERVE_OLD");
  await assertOwner(dist, me, "DISTRIBUTOR");
  await assertOwner(lm, me, "LIQUIDITY_MANAGER");
  await assertOwner(orch, me, "LIQUIDITY_ORCHESTRATOR");
  await assertOwner(keeper, me, "LIQUIDITY_KEEPER_PROXY");
  await assertOwner(dripLm, me, "DRIP_LM");
  await assertOwner(mc, me, "MASTER_CONFIG");

  const tokenReserveBefore = await token.reserveAddr();
  if (tokenReserveBefore.toLowerCase() !== A.RESERVE_OLD.toLowerCase()) {
    throw new Error(`Token reserveAddr is not old reserve: ${tokenReserveBefore}`);
  }

  const oldBiggi = await token.balanceOf(A.RESERVE_OLD);
  const oldWaiting = await reserveOld.waitingBiggi();
  const oldDexRefill = await reserveOld.dexRefillBiggi();
  const oldPol = await reserveOld.polBalance();

  console.log("Old reserve balances:");
  console.log("  BIGGI:", oldBiggi.toString());
  console.log("  POL  :", oldPol.toString());
  console.log("  waitingBiggi:", oldWaiting.toString());
  console.log("  dexRefillBiggi:", oldDexRefill.toString());

  if (!oldWaiting.eq(0)) {
    throw new Error(`Old reserve waitingBiggi is non-zero (${oldWaiting.toString()}); stop for manual handling`);
  }

  // 1) Deploy new reserve with patched bytecode
  const Reserve = await ethers.getContractFactory("BiggiReserveV4", deployer);
  const reserveNew = await Reserve.deploy(A.BIGGI, me, gas);
  await reserveNew.deployed();
  console.log("New ReserveV4:", reserveNew.address);

  const reserveNewCtr = new ethers.Contract(reserveNew.address, ABI_RESERVE, deployer);

  // 2) Wire new reserve core pointers
  await tx("newReserve.setLiquidityManager", () => reserveNewCtr.setLiquidityManager(A.LIQUIDITY_MANAGER, gas));
  await tx("newReserve.setDistributor", () => reserveNewCtr.setDistributor(A.DISTRIBUTOR, gas));

  // 3) Move BIGGI from old reserve -> new reserve (must happen before token.setReserve)
  if (oldBiggi.gt(0)) {
    await tx("token.transferFromReserveTo(newReserve, oldBiggi)", () => token.transferFromReserveTo(reserveNew.address, oldBiggi, gas));
  } else {
    console.log("Old reserve BIGGI balance is zero, skip transfer.");
  }

  // 4) Recreate dexRefill bucket accounting on new reserve
  const topUp = oldDexRefill.gt(oldBiggi) ? oldBiggi : oldDexRefill;
  if (topUp.gt(0)) {
    await tx("newReserve.ownerTopUpDexRefill(oldDexRefill)", () => reserveNewCtr.ownerTopUpDexRefill(topUp, gas));
  } else {
    console.log("dexRefill top-up is zero, skip.");
  }

  // 5) Rewire all modules that reference reserve
  await tx("token.setReserve", () => token.setReserve(reserveNew.address, gas));
  await tx("treasury.setReserve", () => treasury.setReserve(reserveNew.address, gas));
  await tx("main.setReserveAddress", () => main1.setReserveAddress(reserveNew.address, gas));
  await tx("main2.setReserveAddress", () => main2.setReserveAddress(reserveNew.address, gas));
  await tx("distributor.setReserve", () => dist.setReserve(reserveNew.address, gas));
  await tx("lm.setReserve", () => lm.setReserve(reserveNew.address, gas));
  await tx("orchestrator.setReserve", () => orch.setReserve(reserveNew.address, gas));
  await tx("keeper.setReserve", () => keeper.setReserve(reserveNew.address, gas));
  await tx("dripLM.setReserve", () => dripLm.setReserve(reserveNew.address, gas));

  // 6) Update MasterConfig core bundle (BIGGI, RESERVE, TREASURY, DISTRIBUTOR)
  const core = await mc.coreBundle();
  const coreNext = [core[0], reserveNew.address, core[2], core[3]];
  await tx("masterConfig.setCore", () => mc.setCore(coreNext[0], coreNext[1], coreNext[2], coreNext[3], gas));

  // 7) Post-check summary
  const post = {
    tokenReserve: await token.reserveAddr(),
    treasuryReserve: await treasury.reserveAddr(),
    mainReserve: await main1.reserveAddress(),
    main2Reserve: await main2.reserveAddress(),
    distributorReserve: await dist.reserve(),
    lmReserve: await lm.reserve(),
    orchestratorReserve: await orch.reserve(),
    keeperReserve: await keeper.reserve(),
    dripLmReserve: await dripLm.reserve(),
    newReserveLm: await reserveNewCtr.liquidityManager(),
    newReserveDistributor: await reserveNewCtr.distributor(),
    newReserveBiggi: await reserveNewCtr.biggiBalance(),
    newReserveDexRefill: await reserveNewCtr.dexRefillBiggi(),
    oldReserveBiggiAfter: await token.balanceOf(A.RESERVE_OLD),
  };

  console.log("\nMigration complete.");
  console.log("NEW_RESERVE=", reserveNew.address);
  console.log("Post state:");
  console.log(JSON.stringify(
    {
      ...post,
      newReserveBiggi: post.newReserveBiggi.toString(),
      newReserveDexRefill: post.newReserveDexRefill.toString(),
      oldReserveBiggiAfter: post.oldReserveBiggiAfter.toString(),
    },
    null,
    2
  ));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});

