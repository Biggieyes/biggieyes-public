const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

function loadAddresses() {
  const addressesPath = path.resolve(__dirname, "..", "addresses.json");
  try {
    return JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  } catch {
    return {};
  }
}

function shortError(error) {
  return (
    error?.reason ||
    error?.error?.message ||
    error?.message ||
    String(error)
  );
}

async function safeCall(label, fn) {
  try {
    const value = await fn();
    return { label, ok: true, value };
  } catch (error) {
    return { label, ok: false, error: shortError(error) };
  }
}

function formatResult(result) {
  if (!result.ok) return `${result.label}: REVERT (${result.error})`;
  if (Array.isArray(result.value)) {
    return `${result.label}: ${result.value.join(", ")}`;
  }
  return `${result.label}: ${String(result.value)}`;
}

async function main() {
  const addresses = loadAddresses();
  const collectionRewardsAddress =
    process.env.COLLECTION_REWARDS || addresses.COLLECTION_REWARDS;

  if (!collectionRewardsAddress) {
    throw new Error("COLLECTION_REWARDS is required");
  }

  const [signer] = await ethers.getSigners();
  const network = await signer.provider.getNetwork();
  const rewards = await ethers.getContractAt(
    "BiggiCollectionRewards",
    collectionRewardsAddress
  );

  const owner = await rewards.owner();
  const currentMain = await rewards.main();
  const adapterMain = process.env.MAIN || currentMain;
  const probeUser = process.env.PROBE_USER || signer.address;
  const balance = await signer.getBalance();

  console.log("Network:", network.name, `(${network.chainId})`);
  console.log("Signer:", signer.address);
  console.log("Signer balance:", ethers.utils.formatEther(balance), "POL");
  console.log("CollectionRewards:", collectionRewardsAddress);
  console.log("CollectionRewards owner:", owner);
  console.log("Current main:", currentMain);
  console.log("Adapter source main:", adapterMain);
  console.log("Probe user:", probeUser);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer is not CollectionRewards owner; refusing to deploy");
  }

  const beforeChecks = await Promise.all([
    safeCall("canClaimBlock", () => rewards.canClaimBlock(probeUser, 1)),
    safeCall("canClaimOrange", () => rewards.canClaimOrange(probeUser, 1)),
    safeCall("canClaimRainbow", () => rewards.canClaimRainbow(probeUser)),
  ]);

  console.log("Before switch:");
  for (const result of beforeChecks) {
    console.log(" ", formatResult(result));
  }

  const Adapter = await ethers.getContractFactory(
    "BiggiEyesMainRewardsAdapter"
  );
  const adapter = await Adapter.deploy(adapterMain);
  await adapter.deployed();

  console.log("Adapter deployed:", adapter.address);

  const setMainTx = await rewards.setMain(adapter.address);
  console.log("setMain tx:", setMainTx.hash);
  await setMainTx.wait();

  const updatedMain = await rewards.main();
  if (updatedMain.toLowerCase() !== adapter.address.toLowerCase()) {
    throw new Error(
      `CollectionRewards main mismatch after setMain: ${updatedMain}`
    );
  }

  const afterChecks = await Promise.all([
    safeCall("canClaimBlock", () => rewards.canClaimBlock(probeUser, 1)),
    safeCall("canClaimOrange", () => rewards.canClaimOrange(probeUser, 1)),
    safeCall("canClaimRainbow", () => rewards.canClaimRainbow(probeUser)),
  ]);

  console.log("After switch:");
  for (const result of afterChecks) {
    console.log(" ", formatResult(result));
  }

  const revertedChecks = afterChecks.filter((result) => !result.ok);
  if (revertedChecks.length > 0) {
    throw new Error(
      `Claim view checks still revert after switch: ${revertedChecks
        .map((result) => result.label)
        .join(", ")}`
    );
  }

  console.log("Adapter is live and claim view checks no longer revert.");
  console.log(
    "Record this address in addresses.json if you want a local source-of-truth:",
    adapter.address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
