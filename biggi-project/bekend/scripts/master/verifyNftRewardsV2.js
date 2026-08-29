const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function loadReport() {
  const file = path.resolve(
    __dirname,
    "../../reports",
    process.env.NFT_REWARDS_V2_REPORT || "nft-rewards-v2-deployment-polygon.json",
  );
  if (!fs.existsSync(file)) throw new Error(`Deployment report not found: ${file}`);
  return { file, value: JSON.parse(fs.readFileSync(file, "utf8")) };
}

async function verify(label, address, constructorArguments, contract) {
  try {
    await hre.run("verify:verify", { address, constructorArguments, contract });
    console.log(`${label}: verified`);
  } catch (error) {
    const message = String(error?.message || error);
    if (/already verified|already been verified/i.test(message)) {
      console.log(`${label}: already verified`);
      return;
    }
    throw error;
  }
}

async function main() {
  const chain = await hre.ethers.provider.getNetwork();
  if (chain.chainId !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  const { file, value: report } = loadReport();
  if (!report.nftRewardsV2 || !report.nftRewardsReaderV2) {
    throw new Error(`Deployment addresses are missing in ${file}`);
  }

  await verify(
    "BiggiNFTRewardsV2",
    report.nftRewardsV2,
    [report.finalOwner, report.dependencies.vrfRouter],
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiNftRewardsV2.sol:BiggiNFTRewardsV2",
  );
  await verify(
    "BiggiNftRewardsReader",
    report.nftRewardsReaderV2,
    [report.nftRewardsV2],
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiNftRewardsReader.sol:BiggiNftRewardsReader",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
