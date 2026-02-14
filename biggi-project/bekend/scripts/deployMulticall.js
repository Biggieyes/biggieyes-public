// Run: npx hardhat run scripts/deployMulticall.js --network amoy
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Multicall2 = await hre.ethers.getContractFactory("Multicall2");
  const multicall = await Multicall2.deploy();
  await multicall.deployed();

  console.log("Multicall2 deployed:", multicall.address);

  try {
    const addrPath = path.join(__dirname, "..", "addresses.json");
    const raw = fs.readFileSync(addrPath, "utf8");
    const json = JSON.parse(raw);
    json.MULTICALL = multicall.address;
    fs.writeFileSync(addrPath, JSON.stringify(json, null, 2));
    console.log("addresses.json updated with MULTICALL.");
  } catch (err) {
    console.warn("Could not update addresses.json:", err.message || err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
