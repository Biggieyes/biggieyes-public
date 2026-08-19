// Deploy WETH9 + UniswapV2Factory + UniswapV2Router02
// Run: npx hardhat run scripts/deployDexCore.js --network <network>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) WETH9
  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.deployed();
  console.log("WETH9:", weth.address);

  // 2) Factory (feeToSetter = deployer, adjust if needed)
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.deployed();
  console.log("UniswapV2Factory:", factory.address);

  // 3) Router
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factory.address, weth.address);
  await router.deployed();
  console.log("UniswapV2Router02:", router.address);

  console.log("Done: core DEX deployed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

