// Deploy BiggiLpPriceFeed
// Env: BIGGI (req), WETH (req), OWNER (opt, default deployer), PAIR (opt, can be zero), DECIMALS (opt, default 18)
// Run: BIGGI=<addr> WETH=<addr> [PAIR=<addr>] [DECIMALS=8] npx hardhat run scripts/deployLpPriceFeed.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const biggi = process.env.BIGGI;
  const weth = process.env.WETH;
  if (!biggi || !weth) throw new Error("BIGGI and WETH env vars are required");

  const pair = process.env.PAIR || ethers.constants.AddressZero;
  const decimals = process.env.DECIMALS ? parseInt(process.env.DECIMALS, 10) : 18;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("BIGGI:", biggi);
  console.log("WETH :", weth);
  console.log("PAIR :", pair);
  console.log("DECIMALS:", decimals);

  const Factory = await ethers.getContractFactory("BiggiLpPriceFeed");
  const feed = await Factory.deploy(biggi, weth, pair, decimals, owner);
  await feed.deployed();
  console.log("BiggiLpPriceFeed:", feed.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
