const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const root = path.resolve(__dirname, "../..");
const sourceRoot = "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const addresses = JSON.parse(fs.readFileSync(path.join(root, "addresses.core.polygon.json"), "utf8"));
  const owner = addresses.OWNER;
  const contracts = [
    {
      name: "BiggiTicketHub",
      address: addresses.TICKET_HUB,
      contract: `${sourceRoot}/BiggiTicketHub.sol:BiggiTicketHub`,
      constructorArguments: [owner, addresses.MAIN],
    },
    {
      name: "BiggiSeriesRegistry",
      address: addresses.REGISTRY,
      contract: `${sourceRoot}/BiggiSeriesRegistry.sol:BiggiSeriesRegistry`,
      constructorArguments: [owner],
    },
    {
      name: "BiggiChapterController",
      address: addresses.CHAPTER_CONTROLLER,
      contract: `${sourceRoot}/BiggiChapterController.sol:BiggiChapterController`,
      constructorArguments: [owner, addresses.REGISTRY],
    },
    {
      name: "BiggiMainReader",
      address: addresses.MAIN_READER,
      contract: `${sourceRoot}/CORE_READERS/BiggiMainReader.sol:BiggiMainReader`,
      constructorArguments: [addresses.MAIN, addresses.TICKET_HUB, process.env.COLLECTION_REWARDS],
    },
    {
      name: "BiggiChapterSeriesReader",
      address: addresses.CHAPTER_SERIES_READER,
      contract: `${sourceRoot}/CORE_READERS/BiggiChapterSeriesReader.sol:BiggiChapterSeriesReader`,
      constructorArguments: [addresses.CHAPTER_CONTROLLER, addresses.REGISTRY],
    },
  ];

  for (const chapter of addresses.chapters) {
    if (Number(chapter.chapterId) > 1) {
      contracts.push({
        name: `Chapter ${chapter.chapterId} BiggiEyesMain`,
        address: chapter.MAIN,
        contract: `${sourceRoot}/BiggiMain.sol:BiggiEyesMain`,
        constructorArguments: [owner],
        libraries: {
          [`${sourceRoot}/CORE_LIBRARY/BiggiNamesLib.sol:BiggiNamesLib`]: addresses.BIGGI_NAMES_LIB,
        },
      });
    }
    contracts.push({
      name: `Chapter ${chapter.chapterId} BiggiEyesMain2`,
      address: chapter.MAIN2,
      contract: `${sourceRoot}/BiggiMain2.sol:BiggiEyesMain2`,
      constructorArguments: [owner],
      libraries: {
        [`${sourceRoot}/CORE_LIBRARY/BiggiNamesLib2.sol:BiggiNamesLib2`]: addresses.BIGGI_NAMES_LIB2,
      },
    });
  }

  const report = { network: hre.network.name, contracts: [], failures: [], verifiedAt: null };
  for (const item of contracts) {
    try {
      await hre.run("verify:verify", {
        address: item.address,
        constructorArguments: item.constructorArguments,
        contract: item.contract,
        libraries: item.libraries || {},
      });
      report.contracts.push({ name: item.name, address: item.address, status: "verified" });
    } catch (error) {
      const message = error.message || String(error);
      if (/already(?: been)? verified/i.test(message)) {
        report.contracts.push({ name: item.name, address: item.address, status: "already-verified" });
      } else {
        const failure = { name: item.name, address: item.address, status: "failed", error: message };
        report.contracts.push(failure);
        report.failures.push(failure);
      }
    }
    await sleep(1200);
  }

  report.verifiedAt = new Date().toISOString();
  const reportFile = path.join(root, "reports", "core-series-source-verification-polygon.json");
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Source verification: ${report.contracts.length - report.failures.length}/${report.contracts.length}`);
  console.log(`Report: ${reportFile}`);
  if (report.failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
