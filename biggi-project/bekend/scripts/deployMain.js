// Deploy BiggiMain (VRF collection)
// Run: OWNER=<addr> npx hardhat run scripts/deployMain.js --network <net>
// If OWNER is not set, defaults to deployer.

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  // deploy required library
  const NamesLib = await ethers.getContractFactory("BiggiNamesLib");
  const namesLib = await NamesLib.deploy();
  await namesLib.deployed();
  console.log("BiggiNamesLib:", namesLib.address);

  const Main = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: {
      BiggiNamesLib: namesLib.address,
    },
  });
  const main = await Main.deploy(owner);
  await main.deployed();
  console.log("BiggiMain deployed at:", main.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
