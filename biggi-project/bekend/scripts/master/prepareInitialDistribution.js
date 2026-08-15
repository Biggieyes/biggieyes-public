const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const E18 = ethers.BigNumber.from("1000000000000000000");

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || "")) && String(value).toLowerCase() !== ZERO.toLowerCase();
}

function getAddress(value) {
  return isAddress(value) ? ethers.utils.getAddress(value) : ZERO;
}

function loadJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadAddresses(root) {
  return {
    ...loadJson(path.resolve(root, "addresses.master.json")),
    ...loadJson(path.resolve(root, "addresses.visibility.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase1.polygon.json")),
    ...loadJson(path.resolve(root, "addresses.tokenomics.phase2.polygon.json")),
  };
}

function tokens(amount) {
  return ethers.BigNumber.from(amount).mul(E18);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const root = path.resolve(__dirname, "../..");
  const A = loadAddresses(root);
  const chain = await ethers.provider.getNetwork();
  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const execute = env("EXECUTE_INITIAL_DISTRIBUTION") === "1";
  const confirmed = env("I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE") === "1";
  const compromisedOwner = getAddress(env("COMPROMISED_OWNER_ADDRESS"));
  if (execute && isAddress(compromisedOwner) && getAddress(deployer.address) === compromisedOwner) {
    throw new Error("Refusing initial distribution transaction from COMPROMISED_OWNER_ADDRESS");
  }
  const report = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    execute,
    deployer: deployer.address,
    actions: [],
    blockers: [],
    values: {},
  };

  const token = await ethers.getContractAt("BiggiToken", A.BIGGI_TOKEN);
  const owner = await token.owner();
  const expectedOwner = getAddress(env("EXPECT_OWNER", deployer.address));
  const totalSupply = await token.totalSupply();
  const distributed = await token.distributed();
  const reserveLocked = await token.reserveLocked();

  const expected = {
    reserve: tokens("600000000"),
    dripDistributor: tokens("200000000"),
    tokenRewards: tokens("200000000"),
    marketingSupport: tokens("200000000"),
  };

  report.values.before = {
    owner,
    expectedOwner,
    totalSupply: totalSupply.toString(),
    distributed,
    reserveLocked,
    reserveAddr: await token.reserveAddr(),
    dripDistributorAddr: await token.dripDistributorAddr(),
    tokenRewardsAddr: await token.tokenRewardsAddr(),
    marketingSupportAddr: await token.marketingSupportAddr(),
    expectedMint: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v.toString()])),
  };

  if (getAddress(owner) !== getAddress(deployer.address)) {
    report.blockers.push(`Deployer is not BIGGI owner. owner=${owner}, deployer=${deployer.address}`);
  }
  if (env("EXPECT_OWNER") && getAddress(owner) !== expectedOwner) {
    report.blockers.push(`BIGGI owner does not match EXPECT_OWNER. owner=${owner}, EXPECT_OWNER=${expectedOwner}`);
  }
  if (distributed || !totalSupply.eq(0)) {
    report.blockers.push("BIGGI is already distributed or totalSupply is non-zero.");
  }
  for (const [label, expectedAddress] of [
    ["reserveAddr", A.RESERVE],
    ["dripDistributorAddr", A.DRIP_DISTRIBUTOR],
    ["tokenRewardsAddr", A.TOKEN_REWARDS],
    ["marketingSupportAddr", A.MARKETING_SUPPORT || A.DEV_WALLET || A.OWNER || deployer.address],
  ]) {
    const current = getAddress(report.values.before[label]);
    if (current !== getAddress(expectedAddress)) {
      report.blockers.push(`${label} mismatch: current=${current}, expected=${getAddress(expectedAddress)}`);
    }
  }

  if (!execute) {
    report.actions.push("DRY_RUN: would call BiggiToken.initialDistribute().");
  } else if (!confirmed) {
    report.blockers.push("Set I_UNDERSTAND_INITIAL_DISTRIBUTION_LOCKS_RESERVE=1 to execute.");
  } else if (report.blockers.length === 0) {
    const tx = await token.initialDistribute();
    console.log(`[TX] initialDistribute: ${tx.hash}`);
    const receipt = await tx.wait();
    report.actions.push({ tx: tx.hash, status: receipt.status, blockNumber: receipt.blockNumber });
  }

  report.values.after = {
    totalSupply: (await token.totalSupply()).toString(),
    distributed: await token.distributed(),
    reserveLocked: await token.reserveLocked(),
    reserveBalance: (await token.balanceOf(A.RESERVE)).toString(),
    dripDistributorBalance: (await token.balanceOf(A.DRIP_DISTRIBUTOR)).toString(),
    tokenRewardsBalance: (await token.balanceOf(A.TOKEN_REWARDS)).toString(),
  };

  const reportFile = path.resolve(root, env("INITIAL_DISTRIBUTION_REPORT", "reports/initial-distribution-polygon.json"));
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ execute, blockers: report.blockers.length, report: reportFile }, null, 2));

  if (execute && report.blockers.length > 0) {
    throw new Error(`Initial distribution blocked. See ${reportFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
