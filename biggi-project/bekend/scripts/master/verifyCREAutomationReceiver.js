const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers } = hre;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function loadJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

function requiredAddress(name, value) {
  if (!ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
    throw new Error(`${name} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const addresses = loadJson(path.resolve(root, env("MASTER_ADDRESSES_FILE", "addresses.master.json")));
  const receiver = requiredAddress(
    "CRE_AUTOMATION_RECEIVER",
    env("CRE_AUTOMATION_RECEIVER", addresses.CRE_AUTOMATION_RECEIVER)
  );
  const owner = requiredAddress(
    "CRE_RECEIVER_INITIAL_OWNER",
    env("CRE_RECEIVER_INITIAL_OWNER", addresses.CRE_RECEIVER_INITIAL_OWNER)
  );
  const forwarder = requiredAddress(
    "CRE_KEYSTONE_FORWARDER",
    env("CRE_KEYSTONE_FORWARDER", addresses.CRE_KEYSTONE_FORWARDER)
  );
  if ((await ethers.provider.getCode(receiver)) === "0x") throw new Error("CRE receiver has no bytecode");

  try {
    await hre.run("verify:verify", {
      address: receiver,
      constructorArguments: [owner, forwarder],
      contract:
        "contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiCREAutomationReceiver.sol:BiggiCREAutomationReceiver",
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (/already verified|source code already verified/i.test(message)) {
      console.log("CRE receiver is already verified.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
