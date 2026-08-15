// Deploy a new Treasury, migrate balances/accounting, rewire the branch,
// and optionally redeploy immutable readers that depend on Treasury.
//
// Run:
//   npx hardhat run scripts/migrateTreasuryAndReaders.js --network polygon
//
// Reads from scripts/.env and addresses.json.

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const addressesPath = path.join(__dirname, "..", "addresses.json");

const ABI_OLD_TREASURY = [
  "function distributor() view returns (address)",
  "function buybackAgent() view returns (address)",
  "function tokenRewards() view returns (address)",
  "function reserveAddr() view returns (address)",
  "function dripDistributor() view returns (address)",
  "function polBalance() view returns (uint256)",
  "function biggiBalance() view returns (uint256)",
  "function totalBiggiReceivedFromBuyback() view returns (uint256)",
  "function totalPolReceivedFromDistributor() view returns (uint256)",
  "function rescueETH(address payable to, uint256 amount) external",
  "function rescueERC20(address token, address to, uint256 amount) external",
];

const ABI_BUYBACK = [
  "function setTreasury(address treasury_) external",
  "function treasury() view returns (address)",
];

const ABI_DRIP = [
  "function setTreasury(address t) external",
  "function treasury() view returns (address)",
];

const ABI_DIST = [
  "function setTreasury(address addr) external",
  "function treasury() view returns (address)",
  "function totalReceived() view returns (uint256)",
];

const ABI_MC = [
  "function coreBundle() view returns (address,address,address,address)",
  "function setCore(address biggi, address reserve, address treasury, address distributor) external",
];

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
  console.log(`${label}:`, sent.hash);
  await sent.wait();
  return sent;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const gas = gasOverrides();
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  const cfg = {
    BIGGI: process.env.BIGGI || addresses.BIGGI,
    TREASURY_OLD: process.env.TREASURY || addresses.TREASURY,
    RESERVE: process.env.RESERVE || addresses.RESERVE,
    DRIP_DISTRIBUTOR: process.env.DRIP_DISTRIBUTOR || addresses.DRIP_DISTRIBUTOR,
    TOKEN_REWARDS: process.env.TOKEN_REWARDS || addresses.TOKEN_REWARDS,
    DISTRIBUTOR: process.env.DISTRIBUTOR || addresses.MULTI_COLLECTION_DISTRIBUTOR || addresses.DISTRIBUTOR,
    BUYBACK_AGENT: process.env.BUYBACK_AGENT || addresses.BUYBACK_AGENT,
    MASTER_CONFIG: process.env.MASTER_CONFIG || addresses.MASTER_CONFIG,
    POLICY: process.env.POLICY || addresses.POLICY,
    BUYBACK_READER_OLD: addresses.BUYBACK_READER,
    RESERVE_TREASURY_READER_OLD: addresses.RESERVE_TREASURY_READER || addresses.TREASURY_READER,
    UPKEEP_PROXY: process.env.UPKEEP_PROXY || addresses.UPKEEP_PROXY,
  };

  console.log("Signer:", deployer.address);
  console.log("Config:", cfg);

  const oldTreasury = new ethers.Contract(cfg.TREASURY_OLD, ABI_OLD_TREASURY, deployer);
  const buyback = new ethers.Contract(cfg.BUYBACK_AGENT, ABI_BUYBACK, deployer);
  const drip = new ethers.Contract(cfg.DRIP_DISTRIBUTOR, ABI_DRIP, deployer);
  const dist = new ethers.Contract(cfg.DISTRIBUTOR, ABI_DIST, deployer);
  const mc = new ethers.Contract(cfg.MASTER_CONFIG, ABI_MC, deployer);

  const [
    oldDistributor,
    oldBuyback,
    oldTokenRewards,
    oldReserve,
    oldDrip,
    oldPolBalance,
    oldBiggiBalance,
    oldBiggiReceived,
    oldPolReceived,
    distributorTotalReceived,
    core,
  ] = await Promise.all([
    oldTreasury.distributor(),
    oldTreasury.buybackAgent(),
    oldTreasury.tokenRewards(),
    oldTreasury.reserveAddr(),
    oldTreasury.dripDistributor(),
    oldTreasury.polBalance(),
    oldTreasury.biggiBalance(),
    oldTreasury.totalBiggiReceivedFromBuyback(),
    oldTreasury.totalPolReceivedFromDistributor(),
    dist.totalReceived(),
    mc.coreBundle(),
  ]);

  const treasuryShareFromDistributor = distributorTotalReceived.mul(1000).div(10000);
  const historicalPolReceived = oldPolReceived.gt(0) ? oldPolReceived : treasuryShareFromDistributor;

  console.log("Old treasury snapshot:");
  console.log("  distributor      ", oldDistributor);
  console.log("  buybackAgent     ", oldBuyback);
  console.log("  tokenRewards     ", oldTokenRewards);
  console.log("  reserveAddr      ", oldReserve);
  console.log("  dripDistributor  ", oldDrip);
  console.log("  polBalance       ", ethers.utils.formatEther(oldPolBalance));
  console.log("  biggiBalance     ", ethers.utils.formatEther(oldBiggiBalance));
  console.log("  totalBiggiIn     ", ethers.utils.formatEther(oldBiggiReceived));
  console.log("  totalPolIn       ", ethers.utils.formatEther(oldPolReceived));
  console.log("  seededPolIn      ", ethers.utils.formatEther(historicalPolReceived));

  const Treasury = await ethers.getContractFactory("BiggiTreasury");
  const treasuryNew = await Treasury.deploy(cfg.BIGGI, deployer.address, gas);
  await treasuryNew.deployed();
  console.log("New BiggiTreasury:", treasuryNew.address);

  await tx("treasuryNew.setReserve", () => treasuryNew.setReserve(cfg.RESERVE, gas));
  await tx("treasuryNew.setDripDistributor", () => treasuryNew.setDripDistributor(cfg.DRIP_DISTRIBUTOR, gas));
  await tx("treasuryNew.setTokenRewards", () => treasuryNew.setTokenRewards(cfg.TOKEN_REWARDS, gas));
  await tx("treasuryNew.setDistributor", () => treasuryNew.setDistributor(cfg.DISTRIBUTOR, gas));
  await tx("treasuryNew.setBuybackAgent", () => treasuryNew.setBuybackAgent(cfg.BUYBACK_AGENT, gas));
  await tx("treasuryNew.seedHistoricalTotals", () => treasuryNew.seedHistoricalTotals(oldBiggiReceived, historicalPolReceived, gas));

  if (oldBiggiBalance.gt(0)) {
    await tx("oldTreasury.rescueERC20(BIGGI)", () => oldTreasury.rescueERC20(cfg.BIGGI, treasuryNew.address, oldBiggiBalance, gas));
  }
  if (oldPolBalance.gt(0)) {
    await tx("oldTreasury.rescueETH", () => oldTreasury.rescueETH(treasuryNew.address, oldPolBalance, gas));
  }

  await tx("buyback.setTreasury", () => buyback.setTreasury(treasuryNew.address, gas));
  await tx("drip.setTreasury", () => drip.setTreasury(treasuryNew.address, gas));
  await tx("distributor.setTreasury", () => dist.setTreasury(treasuryNew.address, gas));
  await tx("masterConfig.setCore", () => mc.setCore(core[0], core[1], treasuryNew.address, core[3], gas));

  const BuybackReader = await ethers.getContractFactory("BiggiBuybackReader");
  const buybackReader = await BuybackReader.deploy(
    cfg.BUYBACK_AGENT,
    treasuryNew.address,
    cfg.POLICY,
    cfg.UPKEEP_PROXY || ethers.constants.AddressZero,
    gas,
  );
  await buybackReader.deployed();
  console.log("New BiggiBuybackReader:", buybackReader.address);

  const ReserveTreasuryReader = await ethers.getContractFactory("BiggiReserveTreasuryReader");
  const reserveTreasuryReader = await ReserveTreasuryReader.deploy(cfg.RESERVE, treasuryNew.address, gas);
  await reserveTreasuryReader.deployed();
  console.log("New BiggiReserveTreasuryReader:", reserveTreasuryReader.address);

  addresses.TREASURY = treasuryNew.address;
  addresses.BUYBACK_READER = buybackReader.address;
  addresses.TREASURY_READER = reserveTreasuryReader.address;
  addresses.RESERVE_TREASURY_READER = reserveTreasuryReader.address;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2) + "\n");
  console.log("addresses.json updated");

  console.log(
    JSON.stringify(
      {
        oldTreasury: cfg.TREASURY_OLD,
        newTreasury: treasuryNew.address,
        buybackReader: buybackReader.address,
        reserveTreasuryReader: reserveTreasuryReader.address,
        sweptPol: oldPolBalance.toString(),
        sweptBiggi: oldBiggiBalance.toString(),
        seededBiggiReceived: oldBiggiReceived.toString(),
        seededPolReceived: historicalPolReceived.toString(),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
