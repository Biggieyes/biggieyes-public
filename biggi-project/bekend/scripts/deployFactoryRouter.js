// Deploy only Factory + Router (reuse existing WETH)
// Run: npx hardhat run scripts/deployFactoryRouter.js --network polygon
// Env: WETH (required), BIGGI (optional for createPair), MAX_FEE_GWEI/MAX_PRIORITY_FEE_GWEI (optional)

require("dotenv").config();
const hre = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function gasOverrides(ethers) {
  const feeGwei = process.env.MAX_FEE_GWEI || "40";
  const prioGwei = process.env.MAX_PRIORITY_FEE_GWEI || "30";
  return {
    maxFeePerGas: ethers.utils.parseUnits(feeGwei, "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits(prioGwei, "gwei"),
  };
}

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const weth = requireEnv("WETH");
  const biggi = process.env.BIGGI;

  console.log("Deployer:", deployer.address);
  console.log("WETH:", weth);

  const overrides = gasOverrides(ethers);

  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployer.address, overrides);
  await factory.deployed();
  console.log("Factory:", factory.address);

  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factory.address, weth, overrides);
  await router.deployed();
  console.log("Router:", router.address);

  let pair = ethers.constants.AddressZero;
  if (biggi) {
    console.log("Creating BIGGI/WETH pair...");
    const tx = await factory.createPair(biggi, weth, overrides);
    console.log("createPair tx:", tx.hash);
    await tx.wait();
    pair = await factory.getPair(biggi, weth);
    console.log("Pair:", pair);
  } else {
    console.log("BIGGI env missing, skip createPair (set manually later).");
  }

  console.log("\nSummary:", { factory: factory.address, router: router.address, weth, pair });
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
