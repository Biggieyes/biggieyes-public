// Deploy a new DripDistributor and final Treasury, migrate historical state,
// recover stranded buyback BIGGI, redeploy immutable readers, and update addresses.json.
//
// Run:
//   npx hardhat run scripts/repairPumpBranchFinal.js --network polygon

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const hre = require("hardhat");
const { ethers } = hre;

const addressesPath = path.join(__dirname, "..", "addresses.json");

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
    RESERVE: process.env.RESERVE || addresses.RESERVE,
    TOKEN_REWARDS: process.env.TOKEN_REWARDS || addresses.TOKEN_REWARDS,
    DISTRIBUTOR: process.env.DISTRIBUTOR || addresses.MULTI_COLLECTION_DISTRIBUTOR || addresses.DISTRIBUTOR,
    BUYBACK_AGENT: process.env.BUYBACK_AGENT || addresses.BUYBACK_AGENT,
    POLICY: process.env.POLICY || addresses.POLICY,
    DRIP_LM: process.env.DRIP_LM || addresses.DRIP_LM,
    TREASURY_CURRENT: process.env.TREASURY || addresses.TREASURY,
    DRIP_DISTRIBUTOR_CURRENT: process.env.DRIP_DISTRIBUTOR || addresses.DRIP_DISTRIBUTOR,
    UPKEEP_PROXY: process.env.UPKEEP_PROXY || addresses.UPKEEP_PROXY,
    TOKEN: process.env.BIGGI || addresses.BIGGI,
    BIGGI_TOKEN: process.env.BIGGI || addresses.BIGGI,
    ROUTER: process.env.ROUTER || addresses.ROUTER,
    PAIR: process.env.PAIR || addresses.PAIR,
    LIQUIDITY_MANAGER: process.env.LIQUIDITY_MANAGER || addresses.LIQUIDITY_MANAGER || addresses.LM,
    LIQUIDITY_VAULT: process.env.LIQUIDITY_VAULT || addresses.LIQUIDITY_VAULT,
    MASTER_CONFIG: process.env.MASTER_CONFIG || addresses.MASTER_CONFIG,
    COLLECTION: process.env.COLLECTION || addresses.COLLECTION || addresses.COLLECTION_VRF,
    COLLECTION2: process.env.COLLECTION2 || addresses.COLLECTION2 || addresses.COLLECTION_PUBLIC,
  };

  console.log("Signer:", deployer.address);
  console.log("Config:", cfg);

  const currentTreasury = new ethers.Contract(
    cfg.TREASURY_CURRENT,
    [
      "function polBalance() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function totalBiggiReceivedFromBuyback() view returns (uint256)",
      "function totalPolReceivedFromDistributor() view returns (uint256)",
      "function rescueETH(address payable to, uint256 amount) external",
      "function rescueERC20(address token, address to, uint256 amount) external",
    ],
    deployer,
  );
  const currentDrip = new ethers.Contract(
    cfg.DRIP_DISTRIBUTOR_CURRENT,
    [
      "function treasury() view returns (address)",
      "function dripLM() view returns (address)",
      "function tokensPerMintOperator() view returns (address)",
      "function tokensPerMint() view returns (uint256)",
      "function availableTokens() view returns (uint256)",
      "function totalReceived() view returns (uint256)",
      "function totalClaimed() view returns (uint256)",
      "function totalNotified() view returns (uint256)",
      "function biggiBalance() view returns (uint256)",
      "function collections(address) view returns (bool)",
      "function rescueERC20(address token, address to, uint256 amount) external",
    ],
    deployer,
  );
  const buyback = new ethers.Contract(
    cfg.BUYBACK_AGENT,
    [
      "function setTreasury(address treasury_) external",
      "function treasury() view returns (address)",
      "function biggiBalance() view returns (uint256)",
      "function rescueERC20(address token, address to, uint256 amount) external",
    ],
    deployer,
  );
  const dripLM = new ethers.Contract(
    cfg.DRIP_LM,
    [
      "function setDripDistributor(address d) external",
      "function dripDistributor() view returns (address)",
    ],
    deployer,
  );
  const distributor = new ethers.Contract(
    cfg.DISTRIBUTOR,
    [
      "function setTreasury(address addr) external",
      "function treasury() view returns (address)",
    ],
    deployer,
  );
  const masterConfig = new ethers.Contract(
    cfg.MASTER_CONFIG,
    [
      "function coreBundle() view returns (address,address,address,address)",
      "function pumpBundle() view returns (address,address,address,address)",
      "function setCore(address biggi, address reserve, address treasury, address distributor) external",
      "function setPumpBranch(address buybackAgent, address dripLM, address dripDistributor, address policy) external",
    ],
    deployer,
  );
  const token = new ethers.Contract(
    cfg.BIGGI_TOKEN,
    [
      "function setDripDistributor(address _drip) external",
      "function dripDistributorAddr() view returns (address)",
    ],
    deployer,
  );

  const [
    currentTreasuryPol,
    currentTreasuryBiggi,
    currentTreasuryBiggiReceived,
    currentTreasuryPolReceived,
    currentDripTreasury,
    currentDripLm,
    currentDripOperator,
    currentDripTokensPerMint,
    currentDripAvailable,
    currentDripTotalReceived,
    currentDripTotalClaimed,
    currentDripTotalNotified,
    currentDripBalance,
    collection1Allowed,
    collection2Allowed,
    buybackStrandedBiggi,
    core,
    pump,
  ] = await Promise.all([
    currentTreasury.polBalance(),
    currentTreasury.biggiBalance(),
    currentTreasury.totalBiggiReceivedFromBuyback(),
    currentTreasury.totalPolReceivedFromDistributor(),
    currentDrip.treasury(),
    currentDrip.dripLM(),
    currentDrip.tokensPerMintOperator(),
    currentDrip.tokensPerMint(),
    currentDrip.availableTokens(),
    currentDrip.totalReceived(),
    currentDrip.totalClaimed(),
    currentDrip.totalNotified(),
    currentDrip.biggiBalance(),
    currentDrip.collections(cfg.COLLECTION),
    currentDrip.collections(cfg.COLLECTION2),
    buyback.biggiBalance(),
    masterConfig.coreBundle(),
    masterConfig.pumpBundle(),
  ]);

  console.log("Current treasury POL:", ethers.utils.formatEther(currentTreasuryPol));
  console.log("Current treasury BIGGI received:", ethers.utils.formatEther(currentTreasuryBiggiReceived));
  console.log("Current drip balance/available:", ethers.utils.formatEther(currentDripBalance), ethers.utils.formatEther(currentDripAvailable));
  console.log("Stranded buyback BIGGI:", ethers.utils.formatEther(buybackStrandedBiggi));

  const DripDistributor = await ethers.getContractFactory("BiggiDripDistributor");
  const dripNew = await DripDistributor.deploy(cfg.BIGGI, deployer.address, gas);
  await dripNew.deployed();
  console.log("New BiggiDripDistributor:", dripNew.address);

  const Treasury = await ethers.getContractFactory("BiggiTreasury");
  const treasuryFinal = await Treasury.deploy(cfg.BIGGI, deployer.address, gas);
  await treasuryFinal.deployed();
  console.log("Final BiggiTreasury:", treasuryFinal.address);

  await tx("treasuryFinal.setReserve", () => treasuryFinal.setReserve(cfg.RESERVE, gas));
  await tx("treasuryFinal.setDripDistributor", () => treasuryFinal.setDripDistributor(dripNew.address, gas));
  await tx("treasuryFinal.setTokenRewards", () => treasuryFinal.setTokenRewards(cfg.TOKEN_REWARDS, gas));
  await tx("treasuryFinal.setDistributor", () => treasuryFinal.setDistributor(cfg.DISTRIBUTOR, gas));
  await tx("treasuryFinal.setBuybackAgent", () => treasuryFinal.setBuybackAgent(cfg.BUYBACK_AGENT, gas));
  await tx("treasuryFinal.seedHistoricalTotals", () =>
    treasuryFinal.seedHistoricalTotals(currentTreasuryBiggiReceived, currentTreasuryPolReceived, gas),
  );

  await tx("dripNew.setDripLM", () => dripNew.setDripLM(cfg.DRIP_LM, gas));
  await tx("dripNew.setTreasury", () => dripNew.setTreasury(treasuryFinal.address, gas));
  await tx("dripNew.setTokensPerMint", () => dripNew.setTokensPerMint(currentDripTokensPerMint, gas));
  await tx("dripNew.setTokensPerMintOperator", () => dripNew.setTokensPerMintOperator(currentDripOperator, gas));
  if (collection1Allowed) await tx("dripNew.setCollection(COLLECTION)", () => dripNew.setCollection(cfg.COLLECTION, true, gas));
  if (collection2Allowed) await tx("dripNew.setCollection(COLLECTION2)", () => dripNew.setCollection(cfg.COLLECTION2, true, gas));

  if (currentDripBalance.gt(0)) {
    await tx("oldDrip.rescueERC20(BIGGI)", () => currentDrip.rescueERC20(cfg.BIGGI, dripNew.address, currentDripBalance, gas));
  }
  await tx("dripNew.seedHistoricalState", () =>
    dripNew.seedHistoricalState(
      currentDripTotalReceived,
      currentDripTotalClaimed,
      currentDripTotalNotified,
      currentDripAvailable,
      gas,
    ),
  );

  if (currentTreasuryBiggi.gt(0)) {
    await tx("currentTreasury.rescueERC20(BIGGI)", () =>
      currentTreasury.rescueERC20(cfg.BIGGI, treasuryFinal.address, currentTreasuryBiggi, gas),
    );
  }
  if (currentTreasuryPol.gt(0)) {
    await tx("currentTreasury.rescueETH", () =>
      currentTreasury.rescueETH(treasuryFinal.address, currentTreasuryPol, gas),
    );
  }

  await tx("buyback.setTreasury", () => buyback.setTreasury(treasuryFinal.address, gas));
  await tx("distributor.setTreasury", () => distributor.setTreasury(treasuryFinal.address, gas));
  await tx("dripLM.setDripDistributor", () => dripLM.setDripDistributor(dripNew.address, gas));
  await tx("token.setDripDistributor", () => token.setDripDistributor(dripNew.address, gas));
  await tx("masterConfig.setCore", () => masterConfig.setCore(core[0], core[1], treasuryFinal.address, core[3], gas));
  await tx("masterConfig.setPumpBranch", () =>
    masterConfig.setPumpBranch(cfg.BUYBACK_AGENT, cfg.DRIP_LM, dripNew.address, cfg.POLICY, gas),
  );

  if (buybackStrandedBiggi.gt(0)) {
    await tx("buyback.rescueERC20(BIGGI->owner)", () =>
      buyback.rescueERC20(cfg.BIGGI, deployer.address, buybackStrandedBiggi, gas),
    );
    const biggi = new ethers.Contract(
      cfg.BIGGI,
      ["function approve(address spender, uint256 amount) external returns (bool)"],
      deployer,
    );
    await tx("owner approve treasuryFinal", () => biggi.approve(treasuryFinal.address, buybackStrandedBiggi, gas));
    await tx("treasuryFinal.ownerDepositAndSplit", () => treasuryFinal.ownerDepositAndSplit(buybackStrandedBiggi, gas));
  }

  const BuybackReader = await ethers.getContractFactory("BiggiBuybackReader");
  const buybackReaderFinal = await BuybackReader.deploy(
    cfg.BUYBACK_AGENT,
    treasuryFinal.address,
    cfg.POLICY,
    cfg.UPKEEP_PROXY || ethers.constants.AddressZero,
    gas,
  );
  await buybackReaderFinal.deployed();
  console.log("Final BiggiBuybackReader:", buybackReaderFinal.address);

  const ReserveTreasuryReader = await ethers.getContractFactory("BiggiReserveTreasuryReader");
  const reserveTreasuryReaderFinal = await ReserveTreasuryReader.deploy(cfg.RESERVE, treasuryFinal.address, gas);
  await reserveTreasuryReaderFinal.deployed();
  console.log("Final BiggiReserveTreasuryReader:", reserveTreasuryReaderFinal.address);

  const TokenomikReader = await ethers.getContractFactory("BiggiTokenomikReader");
  const tokenomikReaderFinal = await TokenomikReader.deploy(
    cfg.BIGGI,
    cfg.ROUTER,
    cfg.PAIR,
    cfg.DISTRIBUTOR,
    cfg.BUYBACK_AGENT,
    cfg.RESERVE,
    cfg.LIQUIDITY_MANAGER,
    cfg.LIQUIDITY_VAULT,
    dripNew.address,
    cfg.TOKEN_REWARDS,
    gas,
  );
  await tokenomikReaderFinal.deployed();
  console.log("Final BiggiTokenomikReader:", tokenomikReaderFinal.address);

  const previous = {
    treasury: addresses.TREASURY,
    dripDistributor: addresses.DRIP_DISTRIBUTOR,
    buybackReader: addresses.BUYBACK_READER,
    reserveTreasuryReader: addresses.RESERVE_TREASURY_READER || addresses.TREASURY_READER,
    tokenomikReader: addresses.TOKENOMIK_READER,
  };

  addresses.TREASURY = treasuryFinal.address;
  addresses.DRIP_DISTRIBUTOR = dripNew.address;
  addresses.BUYBACK_READER = buybackReaderFinal.address;
  addresses.TREASURY_READER = reserveTreasuryReaderFinal.address;
  addresses.RESERVE_TREASURY_READER = reserveTreasuryReaderFinal.address;
  addresses.TOKENOMIK_READER = tokenomikReaderFinal.address;
  addresses.BIGGI_TOKENOMICS_READER = tokenomikReaderFinal.address;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2) + "\n");
  console.log("addresses.json updated");

  console.log(
    JSON.stringify(
      {
        previous,
        active: {
          treasury: treasuryFinal.address,
          dripDistributor: dripNew.address,
          buybackReader: buybackReaderFinal.address,
          reserveTreasuryReader: reserveTreasuryReaderFinal.address,
          tokenomikReader: tokenomikReaderFinal.address,
        },
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
