const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ZERO = ethers.constants.AddressZero;
const HASH_ZERO = ethers.constants.HashZero;

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadProductionConfig(root, file = "config/production-activation.polygon.json") {
  const resolved = path.resolve(root, file);
  if (!fs.existsSync(resolved)) throw new Error(`Production activation config not found: ${resolved}`);
  return { file: resolved, config: loadJson(resolved) };
}

function normalizeAddress(value, label) {
  try {
    const normalized = ethers.utils.getAddress(value);
    if (normalized === ZERO) throw new Error("zero address");
    return normalized;
  } catch {
    throw new Error(`${label} must resolve to a non-zero address`);
  }
}

function addressFromKey(addresses, key, label = key) {
  if (!key || !addresses[key]) throw new Error(`${label} address key is missing: ${key || "<empty>"}`);
  return normalizeAddress(addresses[key], label);
}

function requireUintString(value, label) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an unsigned integer string`);
  return ethers.BigNumber.from(value).toString();
}

function validateProductionConfig(config, addresses) {
  if (!config || config.schemaVersion !== 1) throw new Error("Unsupported production activation schemaVersion");
  if (config.network?.chainId !== 137 || config.network?.name !== "polygon") {
    throw new Error("Production activation config must target Polygon mainnet (chainId 137)");
  }

  const owner = addressFromKey(addresses, config.authority?.ownerAddressKey, "production owner");
  const liquidity = config.initialLiquidity || {};
  for (const [field, key] of Object.entries({
    tokenAddressKey: liquidity.tokenAddressKey,
    routerAddressKey: liquidity.routerAddressKey,
    pairAddressKey: liquidity.pairAddressKey,
    reserveAddressKey: liquidity.reserveAddressKey,
    liquidityManagerAddressKey: liquidity.liquidityManagerAddressKey,
    lpRecipientAddressKey: liquidity.lpRecipientAddressKey,
  })) {
    addressFromKey(addresses, key, `initialLiquidity.${field}`);
  }

  const tokenAmount = ethers.BigNumber.from(requireUintString(liquidity.tokenAmountWei, "initialLiquidity.tokenAmountWei"));
  const nativeAmount = ethers.BigNumber.from(requireUintString(liquidity.nativeAmountWei, "initialLiquidity.nativeAmountWei"));
  const syncToken = ethers.BigNumber.from(requireUintString(liquidity.postSeedSyncTokenWei, "initialLiquidity.postSeedSyncTokenWei"));
  const syncNative = ethers.BigNumber.from(requireUintString(liquidity.postSeedSyncNativeWei, "initialLiquidity.postSeedSyncNativeWei"));
  if (tokenAmount.isZero() || nativeAmount.isZero()) throw new Error("Initial liquidity amounts must be non-zero");
  if (!syncToken.mul(nativeAmount).eq(syncNative.mul(tokenAmount))) {
    throw new Error("Post-seed sync amounts must preserve the configured initial liquidity ratio");
  }
  if (!Number.isInteger(liquidity.slippageBps) || liquidity.slippageBps < 0 || liquidity.slippageBps > 10_000) {
    throw new Error("initialLiquidity.slippageBps must be an integer in 0..10000");
  }
  if (!Number.isInteger(liquidity.deadlineSec) || liquidity.deadlineSec <= 0 || liquidity.deadlineSec > 86_400) {
    throw new Error("initialLiquidity.deadlineSec must be an integer in 1..86400");
  }

  const expectedAddressKeys = [
    config.tokenomics?.buybackUpkeep?.addressKey,
    config.tokenomics?.buybackUpkeep?.agentAddressKey,
    config.tokenomics?.buybackAgent?.addressKey,
    config.tokenomics?.policy?.addressKey,
    config.tokenomics?.liquidityManager?.addressKey,
    config.tokenomics?.liquidityManager?.routerAddressKey,
    config.tokenomics?.liquidityManager?.factoryAddressKey,
    config.tokenomics?.liquidityManager?.reserveAddressKey,
    config.tokenomics?.liquidityManager?.vaultAddressKey,
    config.tokenomics?.liquidityManager?.keeperAddressKey,
    config.tokenomics?.liquidityOrchestrator?.addressKey,
    config.tokenomics?.liquidityOrchestrator?.keeperAddressKey,
    config.tokenomics?.liquidityKeeper?.addressKey,
    config.tokenomics?.dripKeeper?.addressKey,
    config.tokenomics?.supplyController?.addressKey,
    config.tokenomics?.dexReserveGuard?.addressKey,
    config.cre?.receiverAddressKey,
    config.cre?.forwarderAddressKey,
    config.launch?.ticketHubAddressKey,
    config.launch?.vrfCollectionAddressKey,
    config.launch?.publicCollectionAddressKey,
  ];
  expectedAddressKeys.forEach((key) => addressFromKey(addresses, key));
  for (const call of config.cre?.calls || []) {
    addressFromKey(addresses, call.targetAddressKey, `CRE target ${call.key}`);
    if (!call.signature || !/^\w+\(.*\)$/.test(call.signature)) {
      throw new Error(`CRE call ${call.key} has an invalid function signature`);
    }
  }
  if ((config.cre?.calls || []).length !== 5) throw new Error("Exactly five CRE production calls are required");
  const legacyKey = config.cre?.legacyLiquidityAutomation?.addressKey;
  if (!legacyKey || addresses[legacyKey] == null) throw new Error("Legacy LiquidityAutomation address key is missing");
  if (ethers.utils.getAddress(addresses[legacyKey]) !== ZERO) {
    throw new Error("Legacy LiquidityAutomation must remain undeployed at the zero address");
  }
  if (config.launch?.chapterId !== 1) throw new Error("The first public launch must be chapter 1 (Originals)");
  const future = config.launch?.futureChapterIds || [];
  if (future.join(",") !== "2,3,4,5") throw new Error("Future chapter gate must remain exactly chapters 2,3,4,5");

  return { owner, tokenAmount, nativeAmount, syncToken, syncNative };
}

function serializeArg(value) {
  if (ethers.BigNumber.isBigNumber(value)) return value.toString();
  if (Array.isArray(value)) return value.map(serializeArg);
  return value;
}

function encodeCall(signature, args) {
  const iface = new ethers.utils.Interface([`function ${signature}`]);
  const functionName = signature.slice(0, signature.indexOf("("));
  return iface.encodeFunctionData(functionName, args);
}

function transaction({ id, label, to, value = "0", signature = null, args = [], signer, required = true, condition, postcondition, blockedBy = [] }) {
  return {
    id,
    label,
    to,
    value: String(value),
    data: signature ? encodeCall(signature, args) : "0x",
    method: signature,
    args: args.map(serializeArg),
    expectedSigner: signer,
    required,
    condition,
    postcondition,
    blockedBy,
  };
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  try {
    return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
  } catch {
    return false;
  }
}

function sameUint(actual, expected) {
  try {
    return actual != null && ethers.BigNumber.from(actual).eq(expected);
  } catch {
    return false;
  }
}

function hasValidWorkflowIdentity(workflowId, workflowOwner) {
  return (
    ethers.utils.isHexString(workflowId, 32) &&
    workflowId.toLowerCase() !== HASH_ZERO.toLowerCase() &&
    sameAddress(workflowOwner, workflowOwner) &&
    workflowOwner.toLowerCase() !== ZERO.toLowerCase()
  );
}

function buildProductionActivationPlan({
  addresses,
  config,
  state = {},
  blockTimestamp,
  workflowId = HASH_ZERO,
  workflowOwner = ZERO,
  createdAt = new Date().toISOString(),
}) {
  const validated = validateProductionConfig(config, addresses);
  if (!Number.isInteger(blockTimestamp) || blockTimestamp <= 0) throw new Error("A positive blockTimestamp is required");

  const owner = validated.owner;
  const liquidity = config.initialLiquidity;
  const tokenomics = config.tokenomics;
  const receiver = addressFromKey(addresses, config.cre.receiverAddressKey);
  const deadline = blockTimestamp + liquidity.deadlineSec;
  const minToken = validated.tokenAmount.mul(10_000 - liquidity.slippageBps).div(10_000);
  const minNative = validated.nativeAmount.mul(10_000 - liquidity.slippageBps).div(10_000);
  const hasWorkflowIdentity = hasValidWorkflowIdentity(workflowId, workflowOwner);

  const phases = [];
  const remediation = { id: "00-pre-liquidity-remediation", irreversible: false, ready: true, transactions: [] };
  remediation.transactions.push(transaction({
    id: "buyback-threshold",
    label: "Correct BuybackUpkeepProxy threshold",
    to: addressFromKey(addresses, tokenomics.buybackUpkeep.addressKey),
    signature: "setThreshold(uint256)",
    args: [tokenomics.buybackUpkeep.minNativeThresholdWei],
    signer: owner,
    required: !sameUint(state.buybackUpkeep?.minNativeThresholdWei, tokenomics.buybackUpkeep.minNativeThresholdWei),
    condition: `minNativeThresholdWei != ${tokenomics.buybackUpkeep.minNativeThresholdWei}`,
    postcondition: `minNativeThresholdWei == ${tokenomics.buybackUpkeep.minNativeThresholdWei}`,
  }));
  remediation.transactions.push(transaction({
    id: "liquidity-manager-auto-topup-config",
    label: "Correct disabled LiquidityManager auto-top-up values",
    to: addressFromKey(addresses, tokenomics.liquidityManager.addressKey),
    signature: "setAutoTopUpConfig(bool,uint256,uint256)",
    args: [
      tokenomics.liquidityManager.autoTopUpEnabled,
      tokenomics.liquidityManager.autoTriggerMinPolWei,
      tokenomics.liquidityManager.autoRequestPolWei,
    ],
    signer: owner,
    required:
      state.liquidityManager?.autoTopUpEnabled !== tokenomics.liquidityManager.autoTopUpEnabled ||
      !sameUint(state.liquidityManager?.autoTriggerMinPolWei, tokenomics.liquidityManager.autoTriggerMinPolWei) ||
      !sameUint(state.liquidityManager?.autoRequestPolWei, tokenomics.liquidityManager.autoRequestPolWei),
    condition: "disabled LM auto-top-up parameters do not match the canonical manifest",
    postcondition: "autoTopUpEnabled=false and trigger/request are both 5 POL",
  }));
  phases.push(remediation);

  const pairEmpty = state.pair?.empty !== false;
  const initial = {
    id: "10-initial-liquidity",
    irreversible: true,
    ready: pairEmpty,
    expiresAtUnix: deadline,
    mustRegenerateAfterUnix: deadline,
    transactions: [],
    blockers: pairEmpty ? [] : ["BIGGI/WPOL pair is not empty"],
  };
  initial.transactions.push(transaction({
    id: "reserve-to-owner",
    label: "Move exact seed BIGGI from Reserve to owner",
    to: addressFromKey(addresses, liquidity.tokenAddressKey),
    signature: "transferFromReserveTo(address,uint256)",
    args: [owner, liquidity.tokenAmountWei],
    signer: owner,
    required: pairEmpty,
    condition: "pair is empty and Reserve holds the configured BIGGI amount",
    postcondition: "owner receives exactly 8,000,000 BIGGI for router transfer",
  }));
  initial.transactions.push(transaction({
    id: "approve-router",
    label: "Approve exact seed BIGGI to router",
    to: addressFromKey(addresses, liquidity.tokenAddressKey),
    signature: "approve(address,uint256)",
    args: [addressFromKey(addresses, liquidity.routerAddressKey), liquidity.tokenAmountWei],
    signer: owner,
    required: pairEmpty,
    condition: "reserve-to-owner transaction succeeded",
    postcondition: "router allowance equals the exact seed amount",
  }));
  initial.transactions.push(transaction({
    id: "add-liquidity",
    label: "Seed BIGGI/WPOL liquidity with LP minted to Vault",
    to: addressFromKey(addresses, liquidity.routerAddressKey),
    value: liquidity.nativeAmountWei,
    signature: "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
    args: [
      addressFromKey(addresses, liquidity.tokenAddressKey),
      liquidity.tokenAmountWei,
      minToken,
      minNative,
      addressFromKey(addresses, liquidity.lpRecipientAddressKey),
      deadline,
    ],
    signer: owner,
    required: pairEmpty,
    condition: `execute before Unix ${deadline}; pair must still be empty`,
    postcondition: "pair reserves are non-zero and LP is held by LiquidityVault",
  }));
  initial.transactions.push(transaction({
    id: "revoke-router",
    label: "Clear any remaining router allowance",
    to: addressFromKey(addresses, liquidity.tokenAddressKey),
    signature: "approve(address,uint256)",
    args: [addressFromKey(addresses, liquidity.routerAddressKey), "0"],
    signer: owner,
    required: pairEmpty,
    condition: "initial router call completed or failed after approval",
    postcondition: "router allowance is zero",
  }));
  initial.transactions.push(transaction({
    id: "fund-reserve-sync",
    label: "Fund Reserve for post-seed accounting sync",
    to: addressFromKey(addresses, liquidity.reserveAddressKey),
    value: liquidity.postSeedSyncNativeWei,
    signer: owner,
    required: pairEmpty,
    condition: "initial liquidity transaction succeeded",
    postcondition: "Reserve native balance increased by 1 POL",
  }));
  initial.transactions.push(transaction({
    id: "topup-reserve-sync-bucket",
    label: "Attribute proportional BIGGI to Reserve DEX bucket",
    to: addressFromKey(addresses, liquidity.reserveAddressKey),
    signature: "ownerTopUpDexRefill(uint256)",
    args: [liquidity.postSeedSyncTokenWei],
    signer: owner,
    required: pairEmpty,
    condition: "Reserve has sufficient unaccounted BIGGI for the 1 POL sync ratio",
    postcondition: "DEX_REFILL bucket increased by 1,600 BIGGI",
  }));
  initial.transactions.push(transaction({
    id: "execute-post-seed-sync",
    label: "Execute 1 POL LiquidityManager pairing and sync Vault accounting",
    to: addressFromKey(addresses, liquidity.liquidityManagerAddressKey),
    signature: "executePairing(uint256)",
    args: [liquidity.postSeedSyncNativeWei],
    signer: owner,
    required: pairEmpty,
    condition: "initial pair and Reserve sync funding are confirmed",
    postcondition: "LiquidityVault accounted LP equals real LP balance",
  }));
  phases.push(initial);

  const activation = { id: "20-post-liquidity-tokenomics", irreversible: false, ready: false, transactions: [], blockers: ["Requires verified non-zero pair reserves and synchronized Vault LP accounting"] };
  activation.transactions.push(transaction({
    id: "snapshot-supply-baseline",
    label: "Snapshot SupplyController baseline",
    to: addressFromKey(addresses, tokenomics.supplyController.addressKey),
    signature: "snapshotBaseline()",
    signer: owner,
    condition: "initial liquidity and Vault sync passed",
    postcondition: "SupplyController baseline reflects live liquidity",
  }));
  activation.transactions.push(transaction({
    id: "snapshot-dex-guard-baseline",
    label: "Snapshot DexReserveGuard baseline",
    to: addressFromKey(addresses, tokenomics.dexReserveGuard.addressKey),
    signature: "snapshotBaseline()",
    signer: owner,
    condition: "initial liquidity and Vault sync passed",
    postcondition: "DexReserveGuard baseline reflects live liquidity",
  }));
  activation.transactions.push(transaction({
    id: "unpause-liquidity-orchestrator",
    label: "Unpause LiquidityOrchestrator",
    to: addressFromKey(addresses, tokenomics.liquidityOrchestrator.addressKey),
    signature: "unpauseAll()",
    signer: owner,
    required: state.liquidityOrchestrator?.paused !== false,
    condition: "post-liquidity baselines are confirmed",
    postcondition: "LiquidityOrchestrator.paused() == false",
  }));
  activation.transactions.push(transaction({
    id: "unpause-liquidity-keeper",
    label: "Unpause the only approved liquidity keeper proxy",
    to: addressFromKey(addresses, tokenomics.liquidityKeeper.addressKey),
    signature: "unpauseAll()",
    signer: owner,
    required: state.liquidityKeeper?.paused !== false,
    condition: "LiquidityOrchestrator is active",
    postcondition: "LiquidityKeeperProxy.paused() == false",
  }));
  activation.transactions.push(transaction({
    id: "unpause-buyback-upkeep",
    label: "Unpause BuybackUpkeepProxy",
    to: addressFromKey(addresses, tokenomics.buybackUpkeep.addressKey),
    signature: "setPaused(bool)",
    args: [false],
    signer: owner,
    required: state.buybackUpkeep?.paused !== false,
    condition: "canonical 0.5 POL threshold is already confirmed",
    postcondition: "BuybackUpkeepProxy.paused() == false",
  }));
  activation.transactions.push(transaction({
    id: "enable-auto-buyback",
    label: "Enable BuybackAgent automatic execution",
    to: addressFromKey(addresses, tokenomics.buybackAgent.addressKey),
    signature: "toggleAutoBuyback(bool)",
    args: [true],
    signer: owner,
    required: state.buybackAgent?.autoBuybackEnabled !== true,
    condition: "buyback policy and proxy are production-ready",
    postcondition: "BuybackAgent.autoBuybackEnabled() == true",
  }));
  phases.push(activation);

  const creTargets = config.cre.calls.map((call) => addressFromKey(addresses, call.targetAddressKey));
  const creSelectors = config.cre.calls.map((call) => ethers.utils.id(call.signature).slice(0, 10));
  const cre = {
    id: "30-cre-wiring",
    irreversible: false,
    ready: hasWorkflowIdentity,
    workflowIdentityResolved: hasWorkflowIdentity,
    blockers: hasWorkflowIdentity ? [] : ["CRE deploy access and exact workflow ID/owner are required"],
    transactions: [],
  };
  cre.transactions.push(transaction({
    id: "cre-workflow-identity",
    label: "Lock CRE workflow identity",
    to: receiver,
    signature: "setExpectedWorkflowIdentity(bytes32,address)",
    args: [workflowId, workflowOwner],
    signer: owner,
    required:
      !hasWorkflowIdentity ||
      !sameUint(state.creReceiver?.expectedWorkflowId, workflowId) ||
      !sameAddress(state.creReceiver?.expectedWorkflowOwner, workflowOwner),
    condition: "use only the workflow ID and owner returned by CRE after deployment",
    postcondition: "receiver identity equals the deployed production workflow",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-call-allowlist",
    label: "Allow exactly five CRE target/selector pairs",
    to: receiver,
    signature: "setCallsAllowed(address[],bytes4[],bool)",
    args: [creTargets, creSelectors, true],
    signer: owner,
    required: config.cre.calls.some((call) => state.creRoles?.calls?.[call.key] !== true),
    condition: "workflow identity is locked and reviewed",
    postcondition: "the five documented production calls are enabled",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-role-supply",
    label: "Authorize receiver on SupplyController",
    to: addressFromKey(addresses, tokenomics.supplyController.addressKey),
    signature: "setAllowedCaller(address,bool)",
    args: [receiver, true],
    signer: owner,
    required: state.creRoles?.supplyAllowedCaller !== true,
    condition: "receiver call allowlist is configured",
    postcondition: "SupplyController allows the receiver",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-role-dex-guard",
    label: "Authorize receiver on DexReserveGuard",
    to: addressFromKey(addresses, tokenomics.dexReserveGuard.addressKey),
    signature: "setKeeper(address,bool)",
    args: [receiver, true],
    signer: owner,
    required: state.creRoles?.dexKeeper !== true,
    condition: "receiver call allowlist is configured",
    postcondition: "DexReserveGuard recognizes the receiver keeper",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-role-emission",
    label: "Authorize receiver on TokenRewardsEmissionController",
    to: addressFromKey(addresses, "TOKEN_REWARDS_EMISSION_CONTROLLER"),
    signature: "setKeeper(address,bool)",
    args: [receiver, true],
    signer: owner,
    required: state.creRoles?.emissionKeeper !== true,
    condition: "receiver call allowlist is configured",
    postcondition: "TokenRewardsEmissionController recognizes the receiver keeper",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-role-liquidity",
    label: "Set receiver as LiquidityKeeperProxy allowed caller",
    to: addressFromKey(addresses, tokenomics.liquidityKeeper.addressKey),
    signature: "setAllowedCaller(address)",
    args: [receiver],
    signer: owner,
    required: !sameAddress(state.creRoles?.liquidityAllowedCaller, receiver),
    condition: "receiver call allowlist is configured",
    postcondition: "LiquidityKeeperProxy.allowedCaller() equals receiver",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  cre.transactions.push(transaction({
    id: "cre-receiver-unpause",
    label: "Unpause CRE receiver last",
    to: receiver,
    signature: "unpause()",
    signer: owner,
    required: state.creReceiver?.paused !== false,
    condition: "identity, five calls, target roles, liquidity and tokenomics gates all pass",
    postcondition: "CRE receiver is active",
    blockedBy: hasWorkflowIdentity ? [] : ["workflow identity unresolved"],
  }));
  phases.push(cre);

  const launch = { id: "40-originals-launch", irreversible: false, ready: false, blockers: ["Requires final strict gate after CRE activation"], transactions: [] };
  launch.transactions.push(transaction({
    id: "unpause-originals-vrf",
    label: "Unpause Originals VRF collection if needed",
    to: addressFromKey(addresses, config.launch.vrfCollectionAddressKey),
    signature: "unpause()",
    signer: owner,
    required: state.launch?.mainPaused === true,
    condition: "all launch gates pass",
    postcondition: "Originals VRF collection is active",
  }));
  launch.transactions.push(transaction({
    id: "unpause-ticket-hub",
    label: "Unpause central TicketHub if needed",
    to: addressFromKey(addresses, config.launch.ticketHubAddressKey),
    signature: "unpause()",
    signer: owner,
    required: state.launch?.ticketHubPaused === true,
    condition: "all launch gates pass",
    postcondition: "TicketHub is active",
  }));
  launch.transactions.push(transaction({
    id: "unpause-originals-public",
    label: "Unpause Originals Public collection",
    to: addressFromKey(addresses, config.launch.publicCollectionAddressKey),
    signature: "unpause()",
    signer: owner,
    required: state.launch?.main2Paused !== false,
    condition: "metadata is 100/100 and reward matrix is consistent",
    postcondition: "Public collection is active but mint remains controller-gated until VRF exhaustion",
  }));
  launch.transactions.push(transaction({
    id: "activate-originals-chapter",
    label: "Activate only TicketHub chapter 1 (Originals)",
    to: addressFromKey(addresses, config.launch.ticketHubAddressKey),
    signature: "setChapterActive(uint256,bool)",
    args: [config.launch.chapterId, true],
    signer: owner,
    required: state.launch?.chapterActive?.[String(config.launch.chapterId)] !== true,
    condition: "execute last after all final-gate checks pass",
    postcondition: "chapter 1 active; chapters 2-5 remain inactive",
  }));
  phases.push(launch);

  return {
    schemaVersion: 1,
    createdAt,
    network: config.network,
    broadcast: false,
    containsSignatures: false,
    expectedSigner: owner,
    configDigest: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(config))),
    dynamicValues: {
      sourceBlockTimestamp: blockTimestamp,
      liquidityDeadlineUnix: deadline,
      workflowIdentityResolved: hasWorkflowIdentity,
    },
    phases,
  };
}

module.exports = {
  HASH_ZERO,
  ZERO,
  addressFromKey,
  buildProductionActivationPlan,
  encodeCall,
  loadProductionConfig,
  validateProductionConfig,
};
