const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ZERO = ethers.constants.AddressZero;
const HASH_ZERO = ethers.constants.HashZero;
const EXECUTE = process.env.MODERATOR_V2_CONFIG_EXECUTE === "1";
const CONFIRMATION = "CONFIGURE_PAUSED_MODERATOR_V2_SLOTS";
const CONFIRMATIONS = Number(process.env.TX_CONFIRMATIONS || 1);

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireAddress(name, value) {
  if (!value || !ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${name} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

function parseBool(name, value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  throw new Error(`${name} must be true/false or 1/0`);
}

function referralHashForSlot(slotId) {
  const hashName = `MODERATOR_V2_SLOT_${slotId}_REFERRAL_HASH`;
  const codeName = `MODERATOR_V2_SLOT_${slotId}_REFERRAL_CODE`;
  const configuredHash = String(process.env[hashName] || "").trim();
  const code = process.env[codeName];

  if (code !== undefined && code !== code.trim()) {
    throw new Error(`${codeName} must not contain leading or trailing whitespace`);
  }
  const canonicalReferral = code ? `slot${slotId}:${code}` : "";
  const codeHash = canonicalReferral
    ? ethers.utils.keccak256(ethers.utils.toUtf8Bytes(canonicalReferral))
    : "";
  if (configuredHash && !ethers.utils.isHexString(configuredHash, 32)) {
    throw new Error(`${hashName} must be a bytes32 value`);
  }
  if (configuredHash && codeHash && configuredHash.toLowerCase() !== codeHash.toLowerCase()) {
    throw new Error(`${hashName} does not match ${codeName}`);
  }
  return configuredHash || codeHash || HASH_ZERO;
}

function readDesiredSlots() {
  const slots = [];
  const hashes = new Set();
  let enabledCount = 0;
  let leaderCount = 0;

  for (let slotId = 0; slotId < 10; slotId += 1) {
    const enabled = parseBool(
      `MODERATOR_V2_SLOT_${slotId}_ENABLED`,
      process.env[`MODERATOR_V2_SLOT_${slotId}_ENABLED`],
    );
    const isLeader = parseBool(
      `MODERATOR_V2_SLOT_${slotId}_LEADER`,
      process.env[`MODERATOR_V2_SLOT_${slotId}_LEADER`],
    );
    if (!enabled && isLeader) {
      throw new Error(`Disabled slot ${slotId} cannot be the leader`);
    }

    let payout = ZERO;
    let referralHash = HASH_ZERO;
    if (enabled) {
      payout = requireAddress(
        `MODERATOR_V2_SLOT_${slotId}_PAYOUT`,
        process.env[`MODERATOR_V2_SLOT_${slotId}_PAYOUT`],
      );
      referralHash = referralHashForSlot(slotId);
      if (referralHash === HASH_ZERO) {
        throw new Error(
          `Enabled slot ${slotId} needs MODERATOR_V2_SLOT_${slotId}_REFERRAL_CODE or _REFERRAL_HASH`,
        );
      }
      const normalizedHash = referralHash.toLowerCase();
      if (hashes.has(normalizedHash)) throw new Error(`Duplicate referral hash in slot ${slotId}`);
      hashes.add(normalizedHash);
      enabledCount += 1;
      if (isLeader) leaderCount += 1;
    }
    slots.push({ slotId, enabled, isLeader, payout, referralHash });
  }

  if (enabledCount === 0 || leaderCount !== 1) {
    throw new Error(
      `Slot configuration needs at least one enabled slot and exactly one leader; got ${enabledCount}/${leaderCount}`,
    );
  }
  return { slots, enabledCount, leaderCount };
}

function normalizeSlot(slotId, slot) {
  return {
    slotId,
    enabled: Boolean(slot.enabled ?? slot[0]),
    isLeader: Boolean(slot.isLeader ?? slot[1]),
    payout: ethers.utils.getAddress(slot.payout ?? slot[2]),
    referralHash: slot.referralHash ?? slot[4],
  };
}

function sameIdentity(current, desired) {
  return (
    current.payout.toLowerCase() === desired.payout.toLowerCase() &&
    current.referralHash.toLowerCase() === desired.referralHash.toLowerCase()
  );
}

async function waitFor(tx, label, report) {
  const receipt = await tx.wait(CONFIRMATIONS);
  report.transactions.push({ label, hash: tx.hash, blockNumber: receipt.blockNumber });
  console.log(`${label}: ${tx.hash}`);
}

async function main() {
  const backendRoot = path.resolve(__dirname, "../..");
  const addresses = readJson(
    path.resolve(backendRoot, process.env.MASTER_ADDRESSES_FILE || "addresses.master.json"),
  );
  const deploymentFile = path.resolve(
    backendRoot,
    process.env.MODERATOR_V2_DEPLOYMENT_REPORT ||
      "reports/moderator-v2-deployment-polygon.json",
  );
  const deployment = readJson(deploymentFile);
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137) throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);

  const ownerAddress = requireAddress(
    "OWNER",
    process.env.EXPECT_OWNER || process.env.OWNER || addresses.EXPECT_OWNER || addresses.OWNER,
  );
  const moderatorAddress = requireAddress(
    "MODERATOR_CENTER_V2",
    process.env.MODERATOR_CENTER_V2 || deployment.moderatorCenterV2,
  );
  const code = await ethers.provider.getCode(moderatorAddress);
  if (!code || code === "0x") throw new Error(`ModeratorCenterV2 has no code: ${moderatorAddress}`);

  const desired = readDesiredSlots();
  const moderator = await ethers.getContractAt("ModeratorCenterV2", moderatorAddress);
  const [owner, paused, milestoneLocked, registeredChapterCount, allocator] = await Promise.all([
    moderator.owner(),
    moderator.paused(),
    moderator.milestoneConfigLocked(),
    moderator.registeredChapterCount(),
    moderator.multiCollection(),
  ]);
  if (owner.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`Moderator owner ${owner} does not match ${ownerAddress}`);
  }
  if (!paused) throw new Error("ModeratorCenterV2 must be paused before slot configuration");
  if (!milestoneLocked || registeredChapterCount.eq(0) || allocator === ZERO) {
    throw new Error("ModeratorCenterV2 deployment setup is incomplete");
  }

  const currentSlots = [];
  for (let slotId = 0; slotId < 10; slotId += 1) {
    currentSlots.push(normalizeSlot(slotId, await moderator.slots(slotId)));
  }

  const preflight = {
    mode: EXECUTE ? "execute" : "dry-run",
    network: network.name,
    chainId: chain.chainId,
    moderatorCenterV2: moderatorAddress,
    owner: ownerAddress,
    enabledSlots: desired.enabledCount,
    leaders: desired.leaderCount,
    desiredSlots: desired.slots,
    currentSlots,
  };
  console.log(JSON.stringify(preflight, null, 2));
  if (!EXECUTE) {
    console.log("Dry-run only. Referral plaintext was not printed. No transaction was sent.");
    return;
  }
  if (process.env.MODERATOR_V2_CONFIG_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set MODERATOR_V2_CONFIG_CONFIRM=${CONFIRMATION} to execute`);
  }

  const ownerKey = String(process.env.OWNER_PRIVATE_KEY || "").trim();
  if (!ownerKey) throw new Error("OWNER_PRIVATE_KEY is required for slot configuration");
  const ownerSigner = new ethers.Wallet(ownerKey, ethers.provider);
  if (ownerSigner.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`OWNER_PRIVATE_KEY resolves to ${ownerSigner.address}, expected ${ownerAddress}`);
  }
  const write = moderator.connect(ownerSigner);
  const report = { ...preflight, configuredAt: new Date().toISOString(), transactions: [] };

  for (const current of currentSlots) {
    if (!current.enabled) continue;
    await waitFor(
      await write.configureSlot(current.slotId, false, current.isLeader, current.payout),
      `disable slot ${current.slotId}`,
      report,
    );
  }

  for (const desiredSlot of desired.slots) {
    const current = normalizeSlot(desiredSlot.slotId, await moderator.slots(desiredSlot.slotId));
    if (sameIdentity(current, desiredSlot)) continue;
    if (current.payout !== ZERO || current.referralHash !== HASH_ZERO) {
      await waitFor(
        await write.replaceSlot(desiredSlot.slotId, false, false, ZERO, HASH_ZERO),
        `clear slot ${desiredSlot.slotId}`,
        report,
      );
    }
  }

  for (const desiredSlot of desired.slots) {
    if (!desiredSlot.enabled) continue;
    let current = normalizeSlot(desiredSlot.slotId, await moderator.slots(desiredSlot.slotId));
    if (current.referralHash === HASH_ZERO) {
      await waitFor(
        await write.setReferralHash(desiredSlot.slotId, desiredSlot.referralHash),
        `set referral hash for slot ${desiredSlot.slotId}`,
        report,
      );
      current = normalizeSlot(desiredSlot.slotId, await moderator.slots(desiredSlot.slotId));
    }
    if (!sameIdentity(current, desiredSlot) || !current.enabled || current.isLeader !== desiredSlot.isLeader) {
      await waitFor(
        await write.configureSlot(
          desiredSlot.slotId,
          true,
          desiredSlot.isLeader,
          desiredSlot.payout,
        ),
        `enable slot ${desiredSlot.slotId}`,
        report,
      );
    }
  }

  if (!(await moderator.operationallyReady())) {
    throw new Error("Post-configuration operational readiness check failed");
  }
  const finalSlots = [];
  for (const desiredSlot of desired.slots) {
    const actual = normalizeSlot(desiredSlot.slotId, await moderator.slots(desiredSlot.slotId));
    if (
      actual.enabled !== desiredSlot.enabled ||
      actual.isLeader !== desiredSlot.isLeader ||
      !sameIdentity(actual, desiredSlot)
    ) {
      throw new Error(`Post-configuration mismatch in slot ${desiredSlot.slotId}`);
    }
    finalSlots.push(actual);
  }
  report.finalSlots = finalSlots;
  report.operationallyReady = true;
  const reportFile = path.resolve(backendRoot, "reports/moderator-v2-configuration-polygon.json");
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Configuration report: ${reportFile}`);
  console.log("ModeratorCenterV2 remains paused. Live contracts were not rewired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
