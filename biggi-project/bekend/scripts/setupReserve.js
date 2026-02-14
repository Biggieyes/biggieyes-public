// Wire Reserve (LM + distributor)
// Env: RESERVE (req), LIQUIDITY_MANAGER (req), DISTRIBUTOR (req)
// Run: RESERVE=<addr> LIQUIDITY_MANAGER=<addr> DISTRIBUTOR=<addr> npx hardhat run scripts/setupReserve.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const reserveAddr = requireEnv("RESERVE");
  const lmAddr = requireEnv("LIQUIDITY_MANAGER");
  const distributor = requireEnv("DISTRIBUTOR");

  const reserve = await ethers.getContractAt("BiggiReserveV4", reserveAddr, signer);
  await (await reserve.setLiquidityManager(lmAddr)).wait();
  await (await reserve.setDistributor(distributor)).wait();
  console.log("Reserve wired to LM and distributor.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
