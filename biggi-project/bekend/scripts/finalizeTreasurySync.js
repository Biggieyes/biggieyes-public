// Final treasury sync:
// - deploys a treasury seeded from the correct historical sources
// - sweeps balances from interim treasuries
// - rewires live contracts and redeploys treasury-dependent readers
// - redeploys tokenomics reader with the active LM address
//
// Run:
//   npx hardhat run scripts/finalizeTreasurySync.js --network amoy

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const addressesPath = path.join(__dirname, "..", "addresses.json");

const INTERIM_TREASURY = "0x09553c9BD245f1c1C06AE8B156d6F366b88Bde1c";
const ACTIVE_TREASURY_WITH_BIGGI_TOTAL = "0x77c2A3fe8cdc26F24698999e4898fc37ef2BfF67";

function gasOverrides() {
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(process.env.GAS_PRIORITY_GWEI || "30", "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(process.env.GAS_FEE_GWEI || "60", "gwei"),
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
    BIGGI: addresses.BIGGI,
    RESERVE: addresses.RESERVE,
    TOKEN_REWARDS: addresses.TOKEN_REWARDS,
    DISTRIBUTOR: addresses.MULTI_COLLECTION_DISTRIBUTOR || addresses.DISTRIBUTOR,
    BUYBACK_AGENT: addresses.BUYBACK_AGENT,
    POLICY: addresses.POLICY,
    DRIP_LM: addresses.DRIP_LM,
    DRIP_DISTRIBUTOR: addresses.DRIP_DISTRIBUTOR,
    UPKEEP_PROXY: addresses.UPKEEP_PROXY,
    ROUTER: addresses.ROUTER,
    PAIR: addresses.PAIR,
    LIQUIDITY_MANAGER: addresses.LM || addresses.LIQUIDITY_MANAGER,
    LIQUIDITY_VAULT: addresses.LIQUIDITY_VAULT,
    MASTER_CONFIG: addresses.MASTER_CONFIG,
  };

  console.log("Signer:", deployer.address);
  console.log("Config:", cfg);

  const treasurySourcePol = new ethers.Contract(
    INTERIM_TREASURY,
    [
      "function polBalance() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function totalPolReceivedFromDistributor() view returns (uint256)",
      "function rescueETH(address payable to, uint256 amount) external",
      "function rescueERC20(address token, address to, uint256 amount) external",
    ],
    deployer,
  );
  const treasurySourceBiggi = new ethers.Contract(
    ACTIVE_TREASURY_WITH_BIGGI_TOTAL,
    [
      "function polBalance() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function totalBiggiReceivedFromBuyback() view returns (uint256)",
      "function rescueETH(address payable to, uint256 amount) external",
      "function rescueERC20(address token, address to, uint256 amount) external",
    ],
    deployer,
  );
  const buyback = new ethers.Contract(cfg.BUYBACK_AGENT, ["function setTreasury(address) external"], deployer);
  const drip = new ethers.Contract(cfg.DRIP_DISTRIBUTOR, ["function setTreasury(address) external"], deployer);
  const distributor = new ethers.Contract(cfg.DISTRIBUTOR, ["function setTreasury(address) external"], deployer);
  const masterConfig = new ethers.Contract(
    cfg.MASTER_CONFIG,
    [
      "function coreBundle() view returns (address,address,address,address)",
      "function setCore(address biggi, address reserve, address treasury, address distributor) external",
    ],
    deployer,
  );

  const [sourcePolBalance, sourcePolBiggi, sourcePolTotal, sourceBiggiBalance, sourceBiggiPol, sourceBiggiTotal, core] =
    await Promise.all([
      treasurySourcePol.polBalance(),
      treasurySourcePol.biggiBalance(),
      treasurySourcePol.totalPolReceivedFromDistributor(),
      treasurySourceBiggi.biggiBalance(),
      treasurySourceBiggi.polBalance(),
      treasurySourceBiggi.totalBiggiReceivedFromBuyback(),
      masterConfig.coreBundle(),
    ]);

  console.log("Interim treasury POL / totalPol:", ethers.utils.formatEther(sourcePolBalance), ethers.utils.formatEther(sourcePolTotal));
  console.log("Active treasury totalBiggi:", ethers.utils.formatEther(sourceBiggiTotal));

  const Treasury = await ethers.getContractFactory("BiggiTreasury");
  const treasury = await Treasury.deploy(cfg.BIGGI, deployer.address, gas);
  await treasury.deployed();
  console.log("Active BiggiTreasury:", treasury.address);

  await tx("treasury.setReserve", () => treasury.setReserve(cfg.RESERVE, gas));
  await tx("treasury.setDripDistributor", () => treasury.setDripDistributor(cfg.DRIP_DISTRIBUTOR, gas));
  await tx("treasury.setTokenRewards", () => treasury.setTokenRewards(cfg.TOKEN_REWARDS, gas));
  await tx("treasury.setDistributor", () => treasury.setDistributor(cfg.DISTRIBUTOR, gas));
  await tx("treasury.setBuybackAgent", () => treasury.setBuybackAgent(cfg.BUYBACK_AGENT, gas));
  await tx("treasury.seedHistoricalTotals", () => treasury.seedHistoricalTotals(sourceBiggiTotal, sourcePolTotal, gas));

  if (sourcePolBiggi.gt(0)) {
    await tx("interimTreasury.rescueERC20", () => treasurySourcePol.rescueERC20(cfg.BIGGI, treasury.address, sourcePolBiggi, gas));
  }
  if (sourcePolBalance.gt(0)) {
    await tx("interimTreasury.rescueETH", () => treasurySourcePol.rescueETH(treasury.address, sourcePolBalance, gas));
  }
  if (sourceBiggiBalance.gt(0)) {
    await tx("activeTreasury.rescueERC20", () => treasurySourceBiggi.rescueERC20(cfg.BIGGI, treasury.address, sourceBiggiBalance, gas));
  }
  if (sourceBiggiPol.gt(0)) {
    await tx("activeTreasury.rescueETH", () => treasurySourceBiggi.rescueETH(treasury.address, sourceBiggiPol, gas));
  }

  await tx("buyback.setTreasury", () => buyback.setTreasury(treasury.address, gas));
  await tx("drip.setTreasury", () => drip.setTreasury(treasury.address, gas));
  await tx("distributor.setTreasury", () => distributor.setTreasury(treasury.address, gas));
  await tx("masterConfig.setCore", () => masterConfig.setCore(core[0], core[1], treasury.address, core[3], gas));

  const BuybackReader = await ethers.getContractFactory("BiggiBuybackReader");
  const buybackReader = await BuybackReader.deploy(
    cfg.BUYBACK_AGENT,
    treasury.address,
    cfg.POLICY,
    cfg.UPKEEP_PROXY || ethers.constants.AddressZero,
    gas,
  );
  await buybackReader.deployed();
  console.log("Active BiggiBuybackReader:", buybackReader.address);

  const ReserveTreasuryReader = await ethers.getContractFactory("BiggiReserveTreasuryReader");
  const reserveTreasuryReader = await ReserveTreasuryReader.deploy(cfg.RESERVE, treasury.address, gas);
  await reserveTreasuryReader.deployed();
  console.log("Active BiggiReserveTreasuryReader:", reserveTreasuryReader.address);

  const TokenomikReader = await ethers.getContractFactory("BiggiTokenomikReader");
  const tokenomikReader = await TokenomikReader.deploy(
    cfg.BIGGI,
    cfg.ROUTER,
    cfg.PAIR,
    cfg.DISTRIBUTOR,
    cfg.BUYBACK_AGENT,
    cfg.RESERVE,
    cfg.LIQUIDITY_MANAGER,
    cfg.LIQUIDITY_VAULT,
    cfg.DRIP_DISTRIBUTOR,
    cfg.TOKEN_REWARDS,
    gas,
  );
  await tokenomikReader.deployed();
  console.log("Active BiggiTokenomikReader:", tokenomikReader.address);

  addresses.TREASURY = treasury.address;
  addresses.BUYBACK_READER = buybackReader.address;
  addresses.TREASURY_READER = reserveTreasuryReader.address;
  addresses.RESERVE_TREASURY_READER = reserveTreasuryReader.address;
  addresses.TOKENOMIK_READER = tokenomikReader.address;
  addresses.BIGGI_TOKENOMICS_READER = tokenomikReader.address;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2) + "\n");
  console.log("addresses.json updated");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
