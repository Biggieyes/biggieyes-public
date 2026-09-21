const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers } = hre;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function flattenReferences(references) {
  const result = [];
  for (const value of Object.values(references || {})) {
    if (Array.isArray(value)) result.push(...value);
    else result.push(...flattenReferences(value));
  }
  return result;
}

function normalizeBytecode(bytecode, references) {
  let normalized = String(bytecode || "").replace(/^0x/, "");
  for (const reference of [...references].sort((left, right) => right.start - left.start)) {
    const start = Number(reference.start) * 2;
    const length = Number(reference.length) * 2;
    if (start < 0 || length <= 0 || start + length > normalized.length) {
      throw new Error("Compiler bytecode reference is outside runtime bytecode bounds");
    }
    normalized = `${normalized.slice(0, start)}${"0".repeat(length)}${normalized.slice(start + length)}`;
  }
  if (!/^[0-9a-fA-F]*$/.test(normalized)) throw new Error("Normalized runtime bytecode is not hexadecimal");
  return `0x${normalized.toLowerCase()}`;
}

async function compilerRuntime(qualifiedName) {
  const buildInfo = await hre.artifacts.getBuildInfo(qualifiedName);
  if (!buildInfo) throw new Error(`Build info missing for ${qualifiedName}`);
  const [sourceName, contractName] = qualifiedName.split(":");
  const deployed = buildInfo.output.contracts[sourceName]?.[contractName]?.evm?.deployedBytecode;
  if (!deployed?.object) throw new Error(`Deployed compiler bytecode missing for ${qualifiedName}`);
  const linkReferences = flattenReferences(deployed.linkReferences);
  const immutableReferences = flattenReferences(deployed.immutableReferences);
  return {
    bytecode: `0x${deployed.object}`,
    linkReferences,
    immutableReferences,
    allReferences: [...linkReferences, ...immutableReferences],
  };
}

async function compareRuntime(label, address, qualifiedName, expectedLibrary = "") {
  const expected = await compilerRuntime(qualifiedName);
  const actual = await ethers.provider.getCode(address);
  if (actual === "0x") throw new Error(`${label} has no deployed bytecode`);
  const expectedNormalized = normalizeBytecode(expected.bytecode, expected.allReferences);
  const actualNormalized = normalizeBytecode(actual, expected.allReferences);
  const expectedBytes = (expected.bytecode.length - 2) / 2;
  const actualBytes = (actual.length - 2) / 2;
  const normalizedMatch = expectedNormalized === actualNormalized;

  let libraryMatch = true;
  if (expectedLibrary) {
    const expectedHex = expectedLibrary.toLowerCase().replace(/^0x/, "");
    libraryMatch = expected.linkReferences.length > 0 && expected.linkReferences.every((reference) => {
      const start = 2 + Number(reference.start) * 2;
      const length = Number(reference.length) * 2;
      return actual.slice(start, start + length).toLowerCase() === expectedHex;
    });
  }
  if (expectedBytes !== actualBytes || !normalizedMatch || !libraryMatch) {
    throw new Error(`${label} runtime bytecode mismatch`);
  }
  return {
    label,
    address,
    runtimeBytes: actualBytes,
    normalizedHash: ethers.utils.keccak256(actualNormalized),
    normalizedMatch,
    libraryMatch,
    linkReferenceCount: expected.linkReferences.length,
    immutableReferenceCount: expected.immutableReferences.length,
  };
}

async function main() {
  const chain = await ethers.provider.getNetwork();
  if (Number(chain.chainId) !== 137) throw new Error(`Polygon chainId 137 required, received ${chain.chainId}`);
  const root = path.resolve(__dirname, "../..");
  const stateFile = path.resolve(env(
    "CORE_V2_RESUME_FILE",
    path.join(root, "addresses.core-v2-migration.resume.polygon.json"),
  ));
  const addressFile = path.resolve(env("ADDRESS_FILE", path.join(root, "addresses.master.json")));
  const reportFile = path.resolve(env(
    "CORE_V2_RUNTIME_REPORT",
    path.join(root, "reports/core-v2-runtime-verification-polygon.json"),
  ));
  const distributorFile = path.resolve(env(
    "DISTRIBUTOR_V2_REPORT",
    path.join(root, "reports/distributor-v2-migration-polygon.json"),
  ));
  const state = readJson(stateFile);
  const book = readJson(addressFile);
  const distributor = readJson(distributorFile);
  const names = ethers.utils.getAddress(book.BIGGI_NAMES_LIB);
  if (!state.router || !Array.isArray(state.chapters) || state.chapters.length !== 5) {
    throw new Error("CORE V2 staged addresses are incomplete");
  }

  const checks = [];
  checks.push(await compareRuntime(
    "BiggiVRFRouterV2",
    state.router,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiVrfRouterV2.sol:BiggiVRFRouterV2",
  ));
  for (const chapter of [...state.chapters].sort((left, right) => Number(left.id) - Number(right.id))) {
    checks.push(await compareRuntime(
      `BiggiEyesMainV2 chapter ${chapter.id}`,
      chapter.newMain,
      "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMainV2.sol:BiggiEyesMainV2",
      names,
    ));
  }
  if (!state.mainReader) throw new Error("CORE V2 MainReader address is missing");
  checks.push(await compareRuntime(
    "BiggiMainReader",
    state.mainReader,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMainReader.sol:BiggiMainReader",
  ));
  if (!distributor.DISTRIBUTOR || !distributor.MULTI_COLLECTION_READER) {
    throw new Error("Distributor V2 runtime addresses are missing");
  }
  checks.push(await compareRuntime(
    "BiggiMultiCollectionDistributor V2",
    distributor.DISTRIBUTOR,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/BiggiMultiCollectionDistributor.sol:BiggiMultiCollectionDistributor",
  ));
  checks.push(await compareRuntime(
    "BiggiMultiCollectionDistributorReaderV2",
    distributor.MULTI_COLLECTION_READER,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_READERS/BiggiMultiCollectionDistributorReaderV2.sol:BiggiMultiCollectionDistributorReaderV2",
  ));
  const report = {
    chainId: 137,
    blockNumber: await ethers.provider.getBlockNumber(),
    checkpointStatus: state.status,
    namesLibrary: names,
    checks,
    result: "pass",
    checkedAt: new Date().toISOString(),
  };
  writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message || "CORE V2 runtime verification failed");
  process.exitCode = 1;
});
