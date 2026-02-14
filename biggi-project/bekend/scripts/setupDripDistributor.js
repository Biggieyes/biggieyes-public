// Wire BiggiDripDistributor
// Env (req): DRIP_DISTRIBUTOR, DRIP_LM, TREASURY
// Env (opt): TOKENS_PER_MINT, COLLECTIONS=addr1,addr2,... to allow
// Run: DRIP_DISTRIBUTOR=<addr> DRIP_LM=<addr> TREASURY=<addr> npx hardhat run scripts/setupDripDistributor.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const dripAddr = requireEnv("DRIP_DISTRIBUTOR");
  const dripLm = requireEnv("DRIP_LM");
  const treasury = requireEnv("TREASURY");
  const tokensPerMint = process.env.TOKENS_PER_MINT;
  const collectionsRaw = process.env.COLLECTIONS;
  const collections = collectionsRaw ? collectionsRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];

  const drip = await ethers.getContractAt("BiggiDripDistributor", dripAddr, signer);
  await (await drip.setDripLM(dripLm)).wait();
  await (await drip.setTreasury(treasury)).wait();
  // allow DripLM to update tokensPerMint dynamically
  await (await drip.setTokensPerMintOperator(dripLm)).wait();
  if (tokensPerMint) {
    await (await drip.setTokensPerMint(tokensPerMint)).wait();
  }
  for (const coll of collections) {
    await (await drip.setCollection(coll, true)).wait();
    console.log("Collection allowed:", coll);
  }

  console.log("DripDistributor wired.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
