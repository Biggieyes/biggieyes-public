const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers } = hre;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sameAddress(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(
    env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"),
    "gwei",
  );
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priority = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.constants.Zero;
  const calculatedMaxFee = baseFee.mul(2).add(priority);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priority, maxFeePerGas: maxFee };
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 137) throw new Error("Polygon mainnet chainId 137 is required");
  const root = path.resolve(__dirname, "../..");
  const book = readJson(path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json"))));
  const chapterId = Number(env("WIRE_PUBLIC_CHAPTER_ID", "1"));
  const execute = env("WIRE_PUBLIC_DISTRIBUTOR_EXECUTE") === "1";
  const chapter = (book.chapters || []).find((entry) => Number(entry.chapterId) === chapterId);
  if (!chapter) throw new Error(`Chapter ${chapterId} is missing from the canonical address book`);

  const owner = ethers.utils.getAddress(book.OWNER || book.EXPECT_OWNER);
  const publicAddress = ethers.utils.getAddress(chapter.MAIN2);
  const distributorAddress = ethers.utils.getAddress(book.DISTRIBUTOR);
  const hubAddress = ethers.utils.getAddress(book.TICKET_HUB);
  const publicCollection = new ethers.Contract(publicAddress, [
    "function owner() view returns (address)",
    "function distributor() view returns (address)",
    "function setDistributor(address)",
  ], ethers.provider);
  const hub = new ethers.Contract(hubAddress, [
    "function chapterActive(uint256) view returns (bool)",
  ], ethers.provider);
  const distributor = new ethers.Contract(distributorAddress, [
    "function distributorVersion() view returns (uint256)",
    "function collections(address) view returns (bool)",
  ], ethers.provider);
  const [contractOwner, currentDistributor, active, version, whitelisted] = await Promise.all([
    publicCollection.owner(),
    publicCollection.distributor(),
    hub.chapterActive(chapterId),
    distributor.distributorVersion(),
    distributor.collections(publicAddress),
  ]);
  const checks = {
    chapterInactive: !active,
    ownerMatches: sameAddress(contractOwner, owner),
    distributorV2: version.eq(2),
    publicCollectionWhitelisted: Boolean(whitelisted),
    currentDistributorExpected:
      sameAddress(currentDistributor, distributorAddress) ||
      sameAddress(currentDistributor, book.OLD_DISTRIBUTOR_V1),
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([label]) => label);
  const reportFile = path.join(root, `reports/chapter-${chapterId}-public-distributor-polygon.json`);
  const report = {
    network: "polygon",
    chainId: 137,
    chapterId,
    mode: execute ? "execute" : "dry-run",
    publicCollection: publicAddress,
    previousDistributor: currentDistributor,
    targetDistributor: distributorAddress,
    checks,
    result: failures.length
      ? "blocked"
      : sameAddress(currentDistributor, distributorAddress)
        ? "already-wired"
        : "ready-no-transactions",
    failures,
    checkedAt: new Date().toISOString(),
  };
  writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`Public distributor wiring blocked: ${failures.join(", ")}`);
  if (sameAddress(currentDistributor, distributorAddress)) return;
  if (!execute) {
    console.log(`Preflight passed. No transaction sent. Report: ${reportFile}`);
    return;
  }

  const confirmation = `WIRE_CHAPTER_${chapterId}_PUBLIC_TO_DISTRIBUTOR_V2`;
  if (env("CONFIRM_PUBLIC_DISTRIBUTOR_WIRING") !== confirmation) {
    throw new Error(`Set CONFIRM_PUBLIC_DISTRIBUTOR_WIRING=${confirmation}`);
  }
  const ownerKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(ownerKey)) throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  const signer = new ethers.Wallet(ownerKey, ethers.provider);
  if (!sameAddress(signer.address, owner)) throw new Error("OWNER_PRIVATE_KEY does not match the contract owner");

  const fees = await feeOverrides();
  const estimatedGas = await publicCollection.connect(signer).estimateGas.setDistributor(distributorAddress);
  const gasLimit = estimatedGas.mul(120).div(100);
  const requiredBalance = gasLimit.mul(fees.maxFeePerGas);
  const ownerBalance = await ethers.provider.getBalance(signer.address);
  if (ownerBalance.lt(requiredBalance)) {
    throw new Error(
      `Owner balance is insufficient; requires up to ${ethers.utils.formatEther(requiredBalance)} POL`,
    );
  }
  const transaction = await publicCollection.connect(signer).setDistributor(distributorAddress, {
    ...fees,
    gasLimit,
  });
  const receipt = await transaction.wait();
  if (receipt.status !== 1 || !sameAddress(await publicCollection.distributor(), distributorAddress)) {
    throw new Error("Public distributor wiring transaction did not produce the expected state");
  }
  writeJson(reportFile, {
    ...report,
    result: "wired",
    transaction: {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    },
    completedAt: new Date().toISOString(),
  });
  console.log(`Chapter ${chapterId} Public distributor wired: ${receipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error.message || "Public distributor wiring failed");
  process.exitCode = 1;
});
