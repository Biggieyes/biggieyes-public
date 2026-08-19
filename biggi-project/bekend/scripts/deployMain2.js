// Deploy BiggiMain2 (public collection using Main price provider)
// Run: OWNER=<addr> npx hardhat run scripts/deployMain2.js --network <net>
// If OWNER is not set, defaults to deployer.

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);

  // deploy required library
  const NamesLib2 = await ethers.getContractFactory("BiggiNamesLib2");
  const namesLib2 = await NamesLib2.deploy();
  await namesLib2.deployed();
  console.log("BiggiNamesLib2:", namesLib2.address);

  const Main2 = await ethers.getContractFactory("BiggiEyesMain2", {
    libraries: {
      BiggiNamesLib2: namesLib2.address,
    },
  });
  const main2 = await Main2.deploy(owner);
  await main2.deployed();
  console.log("BiggiMain2 deployed at:", main2.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
