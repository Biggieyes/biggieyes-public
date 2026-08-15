// Deploy helper readers for frontend (Polygon mainnet)
const hre = require("hardhat");
const addresses = require("../addresses.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const txOpts = {};

  // 1) Main reader (tickets + mint data)
  const MainReader = await hre.ethers.getContractFactory("BiggiMainReader");
  const mainReader = await MainReader.deploy(addresses.COLLECTION, txOpts);
  await mainReader.deployed();
  console.log("BiggiMainReader:", mainReader.address);

  // 2) Liquidity helper
  const LqReader = await hre.ethers.getContractFactory("BiggiLiquidityHelperReader");
  const lqReader = await LqReader.deploy(
    addresses.RESERVE,
    addresses.LM,
    addresses.LIQUIDITY_VAULT,
    addresses.ROUTER,
    txOpts
  );
  await lqReader.deployed();
  console.log("BiggiLiquidityHelperReader:", lqReader.address);

  // 3) Reserve + Treasury snapshot
  const RTReader = await hre.ethers.getContractFactory("BiggiReserveTreasuryReader");
  const rtReader = await RTReader.deploy(addresses.RESERVE, addresses.TREASURY, txOpts);
  await rtReader.deployed();
  console.log("BiggiReserveTreasuryReader:", rtReader.address);

  // 4) MCD reader v2
  const MCDReader = await hre.ethers.getContractFactory("BiggiMultiCollectionDistributorReaderV2");
  const mcdReader = await MCDReader.deploy(addresses.DISTRIBUTOR, txOpts);
  await mcdReader.deployed();
  console.log("BiggiMultiCollectionDistributorReaderV2:", mcdReader.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
