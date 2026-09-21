const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function requiredAddress(value, label) {
  if (!value || !ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
    throw new Error(`${label} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

async function main() {
  const addressFile = path.resolve(env("ADDRESS_FILE", "./addresses.master.json"));
  const book = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  const [signer] = await ethers.getSigners();
  const from = await signer.getAddress();
  const owner = requiredAddress(env("OWNER", book.OWNER), "OWNER");
  const names = requiredAddress(env("BIGGI_NAMES_LIB", book.BIGGI_NAMES_LIB), "BIGGI_NAMES_LIB");
  const coordinator = requiredAddress(env("VRF_COORDINATOR", book.VRF_COORDINATOR), "VRF_COORDINATOR");
  const keyHash = env("VRF_KEY_HASH", book.VRF_KEY_HASH);
  const subId = env("VRF_SUB_ID", book.VRF_SUB_ID);
  const hub = requiredAddress(env("TICKET_HUB", book.TICKET_HUB), "TICKET_HUB");
  const rewards = requiredAddress(env("COLLECTION_REWARDS", book.COLLECTION_REWARDS), "COLLECTION_REWARDS");
  const oldDistributor = requiredAddress(env("DISTRIBUTOR", book.DISTRIBUTOR), "DISTRIBUTOR");
  if (!ethers.utils.isHexString(keyHash, 32)) throw new Error("VRF_KEY_HASH is invalid");
  if (!subId || ethers.BigNumber.from(subId).isZero()) throw new Error("VRF_SUB_ID is invalid");
  if (network.name === "hardhat") await network.provider.send("evm_mine");

  const mainFactory = await ethers.getContractFactory("BiggiEyesMainV2", {
    signer,
    libraries: { BiggiNamesLib: names },
  });
  const routerFactory = await ethers.getContractFactory("BiggiVRFRouterV2", signer);
  const mainReaderFactory = await ethers.getContractFactory("BiggiMainReader", signer);
  const distributorFactory = await ethers.getContractFactory("BiggiMultiCollectionDistributor", signer);
  const distributorReaderFactory = await ethers.getContractFactory("BiggiMultiCollectionDistributorReaderV2", signer);

  async function estimate(label, factory, args, count = 1) {
    const tx = factory.getDeployTransaction(...args);
    const gasEach = await ethers.provider.estimateGas({ ...tx, from });
    return { label, count, gasEach: gasEach.toString(), gasTotal: gasEach.mul(count).toString() };
  }

  const rows = [
    await estimate("BiggiEyesMainV2", mainFactory, [owner], 5),
    await estimate("BiggiVRFRouterV2", routerFactory, [coordinator, owner, keyHash, subId]),
    await estimate("BiggiMainReader", mainReaderFactory, [book.MAIN, hub, rewards]),
    await estimate("BiggiMultiCollectionDistributor", distributorFactory, [owner]),
    await estimate("BiggiMultiCollectionDistributorReaderV2", distributorReaderFactory, [oldDistributor]),
  ];
  const total = rows.reduce((sum, row) => sum.add(row.gasTotal), ethers.BigNumber.from(0));
  console.log(JSON.stringify({
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    estimateType: "eth_estimateGas contract creation only",
    contracts: 9,
    rows,
    totalDeploymentGas: total.toString(),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
