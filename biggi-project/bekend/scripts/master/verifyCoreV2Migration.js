const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Required migration report not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonIfExists(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function requiredAddress(value, label) {
  if (!hre.ethers.utils.isAddress(value) || value === hre.ethers.constants.AddressZero) {
    throw new Error(`${label} is missing or invalid`);
  }
  return hre.ethers.utils.getAddress(value);
}

async function verify(label, address, constructorArguments, contract, libraries = {}) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments,
      contract,
      libraries,
    });
    console.log(`${label}: verified`);
  } catch (error) {
    const message = String(error?.message || error);
    if (/already verified|already been verified/i.test(message)) {
      console.log(`${label}: already verified`);
      return;
    }
    throw new Error(`${label} verification failed`);
  }
}

async function main() {
  const chain = await hre.ethers.provider.getNetwork();
  if (Number(chain.chainId) !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);

  const root = path.resolve(__dirname, "../..");
  const coreFile = path.resolve(env(
    "CORE_V2_REPORT_FILE",
    path.join(root, "reports/core-v2-migration-polygon.json"),
  ));
  const distributorFile = path.resolve(env(
    "DISTRIBUTOR_V2_REPORT",
    path.join(root, "reports/distributor-v2-migration-polygon.json"),
  ));
  const resumeFile = path.resolve(env(
    "CORE_V2_RESUME_FILE",
    path.join(root, "addresses.core-v2-migration.resume.polygon.json"),
  ));
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const coreReport = readJsonIfExists(coreFile);
  const resumeState = readJsonIfExists(resumeFile);
  const distributor = readJsonIfExists(distributorFile);
  const book = readJson(addressFile);

  const completeCore = coreReport?.result === "core-v2-cutover-complete-chapters-still-inactive"
    ? coreReport
    : null;
  const core = completeCore || resumeState;
  if (!core || Number(core.chainId) !== 137 || !Array.isArray(core.chapters) || core.chapters.length !== 5) {
    throw new Error("Neither a complete CORE report nor a valid staged resume state is available");
  }

  const owner = requiredAddress(core.owner, "CORE owner");
  const names = requiredAddress(book.BIGGI_NAMES_LIB, "BIGGI_NAMES_LIB");
  const router = requiredAddress(core.router, "CORE V2 router");
  const hub = requiredAddress(book.TICKET_HUB, "TICKET_HUB");
  const rewards = requiredAddress(book.COLLECTION_REWARDS, "COLLECTION_REWARDS");

  await verify(
    "BiggiVRFRouterV2",
    router,
    [requiredAddress(core.coordinator, "VRF coordinator"), owner, book.VRF_KEY_HASH, core.subscriptionId],
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiVrfRouterV2.sol:BiggiVRFRouterV2",
  );

  const chapters = [...core.chapters].sort((left, right) => Number(left.id) - Number(right.id));
  for (const chapter of chapters) {
    await verify(
      `BiggiEyesMainV2 chapter ${chapter.id}`,
      requiredAddress(chapter.newMain, `chapter ${chapter.id} new Main`),
      [owner],
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMainV2.sol:BiggiEyesMainV2",
      { BiggiNamesLib: names },
    );
  }

  if (core.mainReader) {
    await verify(
      "BiggiMainReader",
      requiredAddress(core.mainReader, "CORE V2 MainReader"),
      [requiredAddress(chapters[0].newMain, "chapter 1 new Main"), hub, rewards],
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMainReader.sol:BiggiMainReader",
    );
  } else {
    console.log("BiggiMainReader: not deployed yet; skipped");
  }

  if (distributor?.DISTRIBUTOR && distributor?.MULTI_COLLECTION_READER) {
    const replacementDistributor = requiredAddress(distributor.DISTRIBUTOR, "Distributor V2");
    await verify(
      "BiggiMultiCollectionDistributor V2",
      replacementDistributor,
      [owner],
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMultiCollectionDistributor.sol:BiggiMultiCollectionDistributor",
    );
    await verify(
      "BiggiMultiCollectionDistributorReaderV2",
      requiredAddress(distributor.MULTI_COLLECTION_READER, "Distributor V2 reader"),
      [replacementDistributor],
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol:BiggiMultiCollectionDistributorReaderV2",
    );
  } else {
    console.log("Distributor V2 and reader: not deployed yet; skipped");
  }
}

main().catch((error) => {
  console.error(error.message || "CORE V2 verification failed");
  process.exitCode = 1;
});
