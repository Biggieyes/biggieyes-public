const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function address(value) {
  try {
    return ethers.utils.getAddress(value);
  } catch {
    return ZERO;
  }
}

function writeReport(file, report) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReceipt(txHash, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch (error) {
      lastError = error;
    }
    await sleep(4000);
  }
  throw new Error(`Timed out waiting for ${txHash}${lastError ? `: ${lastError.message}` : ""}`);
}

async function readOwner(contract, attempts = 10) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return address(await contract.owner());
    } catch (error) {
      lastError = error;
      await sleep(2000);
    }
  }
  throw lastError;
}

async function getSafeNonce(account) {
  const urls = [
    env("POLYGON_RPC_URL"),
    "https://polygon-rpc.com",
  ].filter(Boolean);
  const providers = urls.map((url) => new ethers.providers.JsonRpcProvider(url));
  const timeout = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("nonce RPC timeout")), 10000)),
  ]);
  const values = await Promise.all(
    providers.flatMap((provider) => [
      timeout(provider.getTransactionCount(account, "latest")).catch(() => 0),
      timeout(provider.getTransactionCount(account, "pending")).catch(() => 0),
    ])
  );
  const nonce = Math.max(...values);
  if (nonce === 0) throw new Error("Unable to read a safe Polygon nonce");
  return nonce;
}

async function readPendingOwner(contract) {
  try {
    return { supported: true, value: address(await contract.pendingOwner()) };
  } catch {
    return { supported: false, value: ZERO };
  }
}

async function main() {
  if (env("EXECUTE_OWNERSHIP_TRANSFER") !== "1") {
    throw new Error("Set EXECUTE_OWNERSHIP_TRANSFER=1 to send ownership transactions");
  }

  const [signer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  if (network.name !== "polygon" || chain.chainId !== 137) {
    throw new Error(`Expected Polygon mainnet, got ${network.name}/${chain.chainId}`);
  }

  const root = path.resolve(__dirname, "../..");
  const batchFile = path.resolve(root, env("OWNERSHIP_BATCH_FILE", "reports/ownership-transfer-batch.json"));
  const reportFile = path.resolve(root, "reports/ownership-transfer-execution-polygon.json");
  const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
  const targetOwner = address(batch.targetOwner);
  const expectedOwner = address(env("EXPECT_OWNER"));
  const evacuationOwner = address(env("COMPROMISED_OWNER_ADDRESS"));

  if (targetOwner === ZERO || targetOwner !== expectedOwner) {
    throw new Error(`Batch target ${targetOwner} does not match EXPECT_OWNER ${expectedOwner}`);
  }
  if (targetOwner === evacuationOwner) throw new Error("Target owner must differ from compromised owner");
  if (address(signer.address) !== evacuationOwner) {
    throw new Error(`Signer ${signer.address} is not the current evacuation owner ${evacuationOwner}`);
  }
  if (!Array.isArray(batch.txs) || batch.txs.length !== 30) {
    throw new Error(`Expected exactly 30 ownership transfers, got ${batch.txs?.length}`);
  }

  const existing = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : null;
  const report = existing && existing.targetOwner === targetOwner
    ? existing
    : {
        createdAt: new Date().toISOString(),
        network: network.name,
        chainId: chain.chainId,
        signer: signer.address,
        targetOwner,
        batchFile,
        results: [],
      };
  const byAddress = new Map(report.results.map((item) => [item.address.toLowerCase(), item]));
  const abi = [
    "function owner() view returns(address)",
    "function pendingOwner() view returns(address)",
    "function transferOwnership(address)",
  ];
  let nextNonce = await getSafeNonce(signer.address);

  console.log(`Ownership evacuation: ${batch.txs.length} contracts -> ${targetOwner}`);
  console.log(`Starting nonce: ${nextNonce}`);
  for (let index = 0; index < batch.txs.length; index++) {
    const item = batch.txs[index];
    const target = address(item.to);
    if (target === ZERO || (await ethers.provider.getCode(target)) === "0x") {
      throw new Error(`${item.label}: missing target bytecode`);
    }

    const contract = new ethers.Contract(target, abi, signer);
    const ownerBefore = await readOwner(contract);
    const pendingBefore = await readPendingOwner(contract);
    let result = byAddress.get(target.toLowerCase()) || {
      index: index + 1,
      label: item.label,
      address: target,
    };

    if (ownerBefore === targetOwner) {
      result = { ...result, status: "owner-transferred", owner: ownerBefore };
      byAddress.set(target.toLowerCase(), result);
      report.results = [...byAddress.values()];
      writeReport(reportFile, report);
      console.log(`[${index + 1}/30] SKIP owner already transferred: ${item.label}`);
      continue;
    }
    if (pendingBefore.supported && pendingBefore.value === targetOwner) {
      result = {
        ...result,
        status: "pending-acceptance",
        owner: ownerBefore,
        pendingOwner: pendingBefore.value,
      };
      byAddress.set(target.toLowerCase(), result);
      report.results = [...byAddress.values()];
      writeReport(reportFile, report);
      console.log(`[${index + 1}/30] SKIP pending acceptance: ${item.label}`);
      continue;
    }
    if (ownerBefore !== evacuationOwner) {
      throw new Error(`${item.label}: unexpected owner ${ownerBefore}`);
    }

    const estimatedGas = await contract.estimateGas.transferOwnership(targetOwner);
    const tx = await contract.transferOwnership(targetOwner, {
      gasLimit: estimatedGas.mul(120).div(100),
      nonce: nextNonce,
    });
    nextNonce += 1;
    console.log(`[${index + 1}/30] SENT ${item.label}: ${tx.hash}`);
    const receipt = await waitForReceipt(tx.hash);
    if (receipt.status !== 1) throw new Error(`${item.label}: transaction failed ${tx.hash}`);

    const ownerAfter = await readOwner(contract);
    const pendingAfter = await readPendingOwner(contract);
    if (pendingAfter.supported) {
      if (ownerAfter !== evacuationOwner || pendingAfter.value !== targetOwner) {
        throw new Error(`${item.label}: unexpected two-step state owner=${ownerAfter} pending=${pendingAfter.value}`);
      }
      result = {
        ...result,
        status: "pending-acceptance",
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        owner: ownerAfter,
        pendingOwner: pendingAfter.value,
      };
    } else {
      if (ownerAfter !== targetOwner) {
        throw new Error(`${item.label}: owner did not transfer, actual=${ownerAfter}`);
      }
      result = {
        ...result,
        status: "owner-transferred",
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        owner: ownerAfter,
      };
    }
    byAddress.set(target.toLowerCase(), result);
    report.results = [...byAddress.values()];
    report.updatedAt = new Date().toISOString();
    writeReport(reportFile, report);
    console.log(`[${index + 1}/30] CONFIRMED ${item.label}: ${result.status}`);
  }

  report.updatedAt = new Date().toISOString();
  report.summary = {
    transferred: report.results.filter((item) => item.status === "owner-transferred").length,
    pendingAcceptance: report.results.filter((item) => item.status === "pending-acceptance").length,
    total: report.results.length,
  };
  writeReport(reportFile, report);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
