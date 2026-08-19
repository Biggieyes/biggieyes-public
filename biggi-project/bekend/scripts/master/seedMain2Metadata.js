const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const MAX_SUPPLY = 100;
const BATCH_SIZE = 50;
const PUBLIC_BLOCK_URI_CATEGORY = 2;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envInt(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeAddress(value, label) {
  if (!ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${label} is not a valid non-zero address`);
  }
  return ethers.utils.getAddress(value);
}

function chunk(values, size) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeLayoutItem(raw, position) {
  const item = {
    idx: Number(raw?.idx ?? raw?.index ?? raw?.nftIndex),
    background: Number(raw?.background ?? raw?.bg ?? raw?.bgCode),
    blockIdx: Number(raw?.blockIdx ?? raw?.block ?? raw?.blockIndex),
    mainId: Number(raw?.mainId ?? raw?.main ?? raw?.main_id),
  };
  for (const [key, value] of Object.entries(item)) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Metadata item ${position} has invalid ${key}`);
    }
  }
  return item;
}

function expectedLayout() {
  const items = [];
  for (let idx = 1; idx <= MAX_SUPPLY; idx += 1) {
    items.push({
      idx,
      background: 1,
      blockIdx: Math.floor((idx - 1) / 10) + 1,
      mainId: idx,
    });
  }
  return items;
}

function loadAndValidateLayout(filePath) {
  const parsed = readJson(filePath);
  const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(rawItems) || rawItems.length !== MAX_SUPPLY) {
    throw new Error(`PUBLIC_METADATA_FILE must contain exactly ${MAX_SUPPLY} items`);
  }
  const items = rawItems.map(normalizeLayoutItem).sort((a, b) => a.idx - b.idx);
  const expected = expectedLayout();
  for (let i = 0; i < expected.length; i += 1) {
    const actual = items[i];
    const wanted = expected[i];
    if (
      actual.idx !== wanted.idx ||
      actual.background !== wanted.background ||
      actual.blockIdx !== wanted.blockIdx ||
      actual.mainId !== wanted.mainId
    ) {
      throw new Error(
        `PUBLIC_METADATA_FILE mismatch at position ${i + 1}: ` +
        `got ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`
      );
    }
  }
  return items;
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(
    env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"),
    "gwei"
  );
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priorityFee = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const calculatedMaxFee = baseFee.mul(2).add(priorityFee);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee };
}

function metadataState(value) {
  return {
    configuredCount: value[0].toString(),
    fullyConfigured: value[1],
    rewardMatrixConsistent: value[2],
  };
}

function asNumber(value) {
  return ethers.BigNumber.isBigNumber(value) ? value.toNumber() : Number(value);
}

function sameInfo(info, item) {
  return (
    Number(info.background) === item.background &&
    Number(info.blockIdx) === item.blockIdx &&
    Number(info.mainId) === item.mainId
  );
}

async function findMismatchedItems(contract, items, configuredCount) {
  if (configuredCount === 0) return items;
  const mismatches = [];
  for (const group of chunk(items, 25)) {
    const states = await Promise.all(group.map((item) => contract.nftInfo(item.idx)));
    states.forEach((info, index) => {
      const item = group[index];
      if (!sameInfo(info, item)) {
        if (info.minted) {
          throw new Error(`Minted Main2 index ${item.idx} has mismatched metadata; refusing overwrite`);
        }
        mismatches.push(item);
      }
    });
  }
  return mismatches;
}

function writeReport(reportFile, report) {
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  const execute = process.argv.includes("--execute") || env("SEED_MAIN2_METADATA_EXECUTE") === "1";
  const root = path.resolve(__dirname, "../..");
  const reportFile = path.join(root, "reports", "main2-metadata-seed-polygon.json");
  const addresses = readJson(path.join(root, "addresses.master.json"));
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137 || network.name !== "polygon") {
    throw new Error(`Expected Polygon mainnet, got ${network.name} (${chain.chainId})`);
  }

  const main2Address = normalizeAddress(env("MAIN2", addresses.MAIN2), "MAIN2");
  const expectedOwner = normalizeAddress(env("EXPECT_OWNER", addresses.OWNER), "EXPECT_OWNER");
  const privateKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  }
  const signer = new ethers.Wallet(privateKey, ethers.provider);
  if (signer.address !== expectedOwner) {
    throw new Error(`OWNER_PRIVATE_KEY resolves to ${signer.address}, expected ${expectedOwner}`);
  }

  const metadataPathRaw = env("PUBLIC_METADATA_FILE");
  if (!metadataPathRaw) throw new Error("PUBLIC_METADATA_FILE is required");
  const metadataPath = path.isAbsolute(metadataPathRaw)
    ? metadataPathRaw
    : path.resolve(root, metadataPathRaw);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`PUBLIC_METADATA_FILE not found: ${metadataPath}`);
  }
  const items = loadAndValidateLayout(metadataPath);

  const targetUris = [];
  for (let blockIdx = 1; blockIdx <= 10; blockIdx += 1) {
    const uri = env(`PUBLIC_BLOCK_URI_${blockIdx}`);
    if (!uri || !uri.endsWith("/")) {
      throw new Error(`PUBLIC_BLOCK_URI_${blockIdx} must be a non-empty base URI ending in /`);
    }
    targetUris.push(uri);
  }

  const abi = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function biggiMinted() view returns (uint16)",
    "function chapterController() view returns (address)",
    "function chapterId() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function MAX_BATCH() view returns (uint256)",
    "function blockBaseURIs(uint16) view returns (string)",
    "function nftInfo(uint256) view returns (bool minted,uint16 background,uint16 blockIdx,uint256 mainId,uint256 ticketPrice,uint256 blockPrice,uint256 finalPrice)",
    "function metadataConsistency() view returns (uint256 configuredCount,bool fullyConfigured,bool rewardMatrixConsistent)",
    "function setURI(uint8 category,uint16 idx,string uri)",
    "function batchSetNFTBackgroundAndBlock(uint256[] indices,uint16[] bgCodes,uint16[] blockIndices,uint256[] mainIds)",
  ];
  const main2 = new ethers.Contract(main2Address, abi, signer);
  const code = await ethers.provider.getCode(main2Address);
  if (code === "0x") throw new Error("MAIN2 has no deployed bytecode");

  const [owner, paused, minted, controllerAddress, chapterId, maxSupply, maxBatch, beforeRaw, ownerBalance] = await Promise.all([
    main2.owner(),
    main2.paused(),
    main2.biggiMinted(),
    main2.chapterController(),
    main2.chapterId(),
    main2.MAX_SUPPLY(),
    main2.MAX_BATCH(),
    main2.metadataConsistency(),
    signer.getBalance(),
  ]);
  if (ethers.utils.getAddress(owner) !== expectedOwner) {
    throw new Error(`MAIN2 owner is ${owner}, expected ${expectedOwner}`);
  }
  const mintedCount = asNumber(minted);
  if (mintedCount !== 0) throw new Error(`MAIN2 already has ${mintedCount} minted NFTs; refusing prereveal seed`);
  if (!maxSupply.eq(MAX_SUPPLY) || maxBatch.lt(BATCH_SIZE)) {
    throw new Error(`Unexpected Main2 limits: MAX_SUPPLY=${maxSupply}, MAX_BATCH=${maxBatch}`);
  }
  const normalizedController = normalizeAddress(controllerAddress, "MAIN2 chapterController");
  const controller = new ethers.Contract(
    normalizedController,
    ["function isPublicMintUnlocked(uint256) view returns (bool)"],
    ethers.provider
  );
  const publicMintUnlocked = await controller.isPublicMintUnlocked(chapterId);
  if (publicMintUnlocked) {
    throw new Error(`Chapter ${chapterId.toString()} public mint is unlocked; refusing metadata seed`);
  }

  const currentUris = await Promise.all(
    targetUris.map((_, index) => main2.blockBaseURIs(index + 1))
  );
  const uriActions = targetUris
    .map((uri, index) => ({ blockIdx: index + 1, uri, currentUri: currentUris[index] }))
    .filter((action) => action.currentUri !== action.uri);
  const before = metadataState(beforeRaw);
  const mismatches = before.fullyConfigured && before.rewardMatrixConsistent
    ? []
    : await findMismatchedItems(main2, items, Number(before.configuredCount));
  const metadataBatches = chunk(mismatches, BATCH_SIZE);
  const fees = await feeOverrides();

  const actions = [];
  for (const action of uriActions) {
    const gas = await main2.estimateGas.setURI(
      PUBLIC_BLOCK_URI_CATEGORY,
      action.blockIdx,
      action.uri,
      fees
    );
    actions.push({ type: "set-block-uri", ...action, gasEstimate: gas.toString() });
  }
  for (let index = 0; index < metadataBatches.length; index += 1) {
    const batch = metadataBatches[index];
    const gas = await main2.estimateGas.batchSetNFTBackgroundAndBlock(
      batch.map((item) => item.idx),
      batch.map((item) => item.background),
      batch.map((item) => item.blockIdx),
      batch.map((item) => item.mainId),
      fees
    );
    actions.push({
      type: "seed-layout-batch",
      batch: index + 1,
      firstIndex: batch[0].idx,
      lastIndex: batch[batch.length - 1].idx,
      items: batch.length,
      gasEstimate: gas.toString(),
    });
  }

  const estimatedGas = actions.reduce(
    (total, action) => total.add(action.gasEstimate),
    ethers.BigNumber.from(0)
  );
  const bufferedGas = estimatedGas.mul(120).div(100);
  const maximumCost = bufferedGas.mul(fees.maxFeePerGas);
  const report = {
    checkedAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    mode: execute ? "execute" : "dry-run",
    main2: main2Address,
    owner,
    paused,
    chapterController: normalizedController,
    chapterId: chapterId.toString(),
    publicMintUnlocked,
    minted: String(mintedCount),
    metadataFile: path.relative(root, metadataPath).replace(/\\/g, "/"),
    before,
    targetUris,
    uriUpdatesRequired: uriActions.length,
    layoutItemsMismatched: mismatches.length,
    metadataBatchesRequired: metadataBatches.length,
    estimatedGas: estimatedGas.toString(),
    bufferedGas: bufferedGas.toString(),
    maxFeePerGasWei: fees.maxFeePerGas.toString(),
    maxPriorityFeePerGasWei: fees.maxPriorityFeePerGas.toString(),
    maximumCostWei: maximumCost.toString(),
    maximumCostPol: ethers.utils.formatEther(maximumCost),
    ownerBalanceWei: ownerBalance.toString(),
    ownerBalancePol: ethers.utils.formatEther(ownerBalance),
    sufficientBalance: ownerBalance.gte(maximumCost),
    actions,
    transactions: [],
  };
  writeReport(reportFile, report);

  if (!actions.length) {
    const verified = metadataState(await main2.metadataConsistency());
    report.result = verified.fullyConfigured && verified.rewardMatrixConsistent
      ? "already-configured"
      : "no-actions-but-inconsistent";
    report.after = verified;
    writeReport(reportFile, report);
  } else if (!execute) {
    report.result = report.sufficientBalance ? "ready-to-execute" : "insufficient-balance";
    writeReport(reportFile, report);
  } else {
    if (!report.sufficientBalance) {
      throw new Error(
        `Owner balance ${report.ownerBalancePol} POL is below buffered maximum ${report.maximumCostPol} POL`
      );
    }
    const confirmations = envInt("TX_CONFIRMATIONS", 2);
    for (const action of actions) {
      const gasLimit = ethers.BigNumber.from(action.gasEstimate).mul(120).div(100);
      let tx;
      if (action.type === "set-block-uri") {
        tx = await main2.setURI(PUBLIC_BLOCK_URI_CATEGORY, action.blockIdx, action.uri, {
          ...fees,
          gasLimit,
        });
      } else {
        const batch = metadataBatches[action.batch - 1];
        tx = await main2.batchSetNFTBackgroundAndBlock(
          batch.map((item) => item.idx),
          batch.map((item) => item.background),
          batch.map((item) => item.blockIdx),
          batch.map((item) => item.mainId),
          { ...fees, gasLimit }
        );
      }
      console.log(`${action.type} submitted: ${tx.hash}`);
      const receipt = await tx.wait(confirmations);
      if (receipt.status !== 1) throw new Error(`Transaction failed: ${tx.hash}`);
      report.transactions.push({
        type: action.type,
        blockIdx: action.blockIdx || null,
        batch: action.batch || null,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });
      writeReport(reportFile, report);
    }

    const [afterRaw, afterUris] = await Promise.all([
      main2.metadataConsistency(),
      Promise.all(targetUris.map((_, index) => main2.blockBaseURIs(index + 1))),
    ]);
    const after = metadataState(afterRaw);
    if (!after.fullyConfigured || !after.rewardMatrixConsistent) {
      throw new Error(`Post-seed metadata consistency failed: ${JSON.stringify(after)}`);
    }
    afterUris.forEach((uri, index) => {
      if (uri !== targetUris[index]) {
        throw new Error(`Post-seed PUBLIC_BLOCK_URI_${index + 1} mismatch`);
      }
    });
    report.result = "configured";
    report.after = after;
    report.completedAt = new Date().toISOString();
    writeReport(reportFile, report);
  }

  console.log(JSON.stringify({
    result: report.result,
    mode: report.mode,
    main2: report.main2,
    before: report.before,
    after: report.after || null,
    uriUpdatesRequired: report.uriUpdatesRequired,
    metadataBatchesRequired: report.metadataBatchesRequired,
    maximumCostPol: report.maximumCostPol,
    ownerBalancePol: report.ownerBalancePol,
    transactions: report.transactions.length,
    report: reportFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
