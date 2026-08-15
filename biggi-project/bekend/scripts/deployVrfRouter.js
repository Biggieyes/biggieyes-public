// Deploy BiggiVrfRouter (VRF V2 Plus router)
// Env: VRF_COORDINATOR (req), KEY_HASH (req), SUB_ID (req), OWNER (opt, default deployer)
// Run: VRF_COORDINATOR=<addr> KEY_HASH=<0x...> SUB_ID=<id> npx hardhat run scripts/deployVrfRouter.js --network <net>

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.OWNER || deployer.address;
  const coord = process.env.VRF_COORDINATOR;
  const keyHash = process.env.KEY_HASH;
  const subId = process.env.SUB_ID;
  if (!coord || !keyHash || !subId) throw new Error("VRF_COORDINATOR, KEY_HASH, SUB_ID are required");

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("VRF_COORDINATOR:", coord);
  console.log("KEY_HASH:", keyHash);
  console.log("SUB_ID:", subId);

  const Factory = await ethers.getContractFactory("BiggiVRFRouter");
  const router = await Factory.deploy(coord, owner, keyHash, subId);
  await router.deployed();
  console.log("BiggiVrfRouter:", router.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
