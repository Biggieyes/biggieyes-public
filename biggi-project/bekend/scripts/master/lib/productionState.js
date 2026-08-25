const { ethers } = require("ethers");
const { ZERO, addressFromKey } = require("./productionActivationPlan");

function makeContract(address, abi, provider) {
  return new ethers.Contract(address, abi, provider);
}

function asString(value) {
  return ethers.BigNumber.isBigNumber(value) ? value.toString() : value;
}

function sameAddress(actual, expected) {
  try {
    return ethers.utils.getAddress(actual) === ethers.utils.getAddress(expected);
  } catch {
    return false;
  }
}

function sameUint(actual, expected) {
  try {
    return ethers.BigNumber.from(actual).eq(expected);
  } catch {
    return false;
  }
}

async function readProductionState(provider, addresses, config) {
  const t = config.tokenomics;
  const receiverAddress = addressFromKey(addresses, config.cre.receiverAddressKey);
  const buybackUpkeep = makeContract(addressFromKey(addresses, t.buybackUpkeep.addressKey), [
    "function owner() view returns(address)",
    "function agent() view returns(address)",
    "function paused() view returns(bool)",
    "function minNativeThresholdWei() view returns(uint256)",
  ], provider);
  const buybackAgent = makeContract(addressFromKey(addresses, t.buybackAgent.addressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function autoBuybackEnabled() view returns(bool)",
  ], provider);
  const policy = makeContract(addressFromKey(addresses, t.policy.addressKey), [
    "function owner() view returns(address)",
    "function buybackAgent() view returns(address)",
    "function swapSlippageBps() view returns(uint256)",
    "function txDeadlineSec() view returns(uint256)",
    "function minBuybackInterval() view returns(uint256)",
    "function buybacksPaused() view returns(bool)",
    "function maxDailyBuybackNative() view returns(uint256)",
  ], provider);
  const liquidityManager = makeContract(addressFromKey(addresses, t.liquidityManager.addressKey), [
    "function owner() view returns(address)",
    "function router() view returns(address)",
    "function factory() view returns(address)",
    "function reserve() view returns(address)",
    "function liquidityVault() view returns(address)",
    "function keeper() view returns(address)",
    "function tokenPct() view returns(uint8)",
    "function slippageBps() view returns(uint256)",
    "function txDeadlineSec() view returns(uint256)",
    "function autoTopUpEnabled() view returns(bool)",
    "function autoTriggerMinPolWei() view returns(uint256)",
    "function autoRequestPolWei() view returns(uint256)",
  ], provider);
  const liquidityOrchestrator = makeContract(addressFromKey(addresses, t.liquidityOrchestrator.addressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function keeper() view returns(address)",
    "function minPolPerTx() view returns(uint256)",
    "function maxPolPerTx() view returns(uint256)",
    "function minDexRefillBiggi() view returns(uint256)",
    "function cooldownSec() view returns(uint256)",
    "function dailyQuotaPol() view returns(uint256)",
  ], provider);
  const liquidityKeeper = makeContract(addressFromKey(addresses, t.liquidityKeeper.addressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function orchestrator() view returns(address)",
    "function reserve() view returns(address)",
    "function allowedCaller() view returns(address)",
    "function amountMode() view returns(uint8)",
    "function fixedAmount() view returns(uint256)",
    "function percentBps() view returns(uint256)",
    "function minIntervalSec() view returns(uint256)",
    "function minReservePol() view returns(uint256)",
    "function maxPerTx() view returns(uint256)",
    "function minDexRefillBiggi() view returns(uint256)",
  ], provider);
  const dripKeeper = makeContract(addressFromKey(addresses, t.dripKeeper.addressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
  ], provider);
  const supplyController = makeContract(addressFromKey(addresses, t.supplyController.addressKey), [
    "function owner() view returns(address)",
    "function reserveDropBps() view returns(uint256)",
    "function dexRefillAmount() view returns(uint256)",
    "function dexCooldown() view returns(uint256)",
    "function rewardsThreshold() view returns(uint256)",
    "function rewardsRefillAmount() view returns(uint256)",
    "function rewardsCooldown() view returns(uint256)",
    "function circuitBreakerEnabled() view returns(bool)",
    "function dexCriticalFloor() view returns(uint256)",
    "function rewardsCriticalFloor() view returns(uint256)",
    "function allowedCallers(address) view returns(bool)",
  ], provider);
  const dexReserveGuard = makeContract(addressFromKey(addresses, t.dexReserveGuard.addressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function minReserveRatioBps() view returns(uint256)",
    "function refillAmount() view returns(uint256)",
    "function cooldown() view returns(uint256)",
    "function keepers(address) view returns(bool)",
  ], provider);
  const receiver = makeContract(receiverAddress, [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function keystoneForwarder() view returns(address)",
    "function expectedWorkflowId() view returns(bytes32)",
    "function expectedWorkflowOwner() view returns(address)",
    "function maxReportBytes() view returns(uint256)",
    "function maxCallDataBytes() view returns(uint256)",
    "function callAllowed(address,bytes4) view returns(bool)",
  ], provider);
  const emission = makeContract(addressFromKey(addresses, "TOKEN_REWARDS_EMISSION_CONTROLLER"), [
    "function owner() view returns(address)",
    "function keepers(address) view returns(bool)",
  ], provider);
  const pair = makeContract(addressFromKey(addresses, config.initialLiquidity.pairAddressKey), [
    "function getReserves() view returns(uint112,uint112,uint32)",
    "function totalSupply() view returns(uint256)",
  ], provider);
  const ticketHub = makeContract(addressFromKey(addresses, config.launch.ticketHubAddressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function ticketPrice() view returns(uint256)",
    "function priceIncreasePerMint() view returns(uint256)",
    "function saleCap() view returns(uint16)",
    "function marketingCap() view returns(uint16)",
    "function chapterActive(uint256) view returns(bool)",
    "function chapterSaleMinted(uint256) view returns(uint16)",
  ], provider);
  const main = makeContract(addressFromKey(addresses, config.launch.vrfCollectionAddressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
  ], provider);
  const main2 = makeContract(addressFromKey(addresses, config.launch.publicCollectionAddressKey), [
    "function owner() view returns(address)",
    "function paused() view returns(bool)",
    "function metadataConsistency() view returns(uint256,bool,bool)",
  ], provider);

  const [
    buybackUpkeepValues,
    buybackAgentValues,
    policyValues,
    liquidityManagerValues,
    liquidityOrchestratorValues,
    liquidityKeeperValues,
    dripKeeperValues,
    supplyValues,
    guardValues,
    receiverValues,
    emissionOwner,
    pairValues,
    ticketHubValues,
    mainValues,
    main2Values,
  ] = await Promise.all([
    Promise.all([buybackUpkeep.owner(), buybackUpkeep.agent(), buybackUpkeep.paused(), buybackUpkeep.minNativeThresholdWei()]),
    Promise.all([buybackAgent.owner(), buybackAgent.paused(), buybackAgent.autoBuybackEnabled()]),
    Promise.all([policy.owner(), policy.buybackAgent(), policy.swapSlippageBps(), policy.txDeadlineSec(), policy.minBuybackInterval(), policy.buybacksPaused(), policy.maxDailyBuybackNative()]),
    Promise.all([liquidityManager.owner(), liquidityManager.router(), liquidityManager.factory(), liquidityManager.reserve(), liquidityManager.liquidityVault(), liquidityManager.keeper(), liquidityManager.tokenPct(), liquidityManager.slippageBps(), liquidityManager.txDeadlineSec(), liquidityManager.autoTopUpEnabled(), liquidityManager.autoTriggerMinPolWei(), liquidityManager.autoRequestPolWei()]),
    Promise.all([liquidityOrchestrator.owner(), liquidityOrchestrator.paused(), liquidityOrchestrator.keeper(), liquidityOrchestrator.minPolPerTx(), liquidityOrchestrator.maxPolPerTx(), liquidityOrchestrator.minDexRefillBiggi(), liquidityOrchestrator.cooldownSec(), liquidityOrchestrator.dailyQuotaPol()]),
    Promise.all([liquidityKeeper.owner(), liquidityKeeper.paused(), liquidityKeeper.orchestrator(), liquidityKeeper.reserve(), liquidityKeeper.allowedCaller(), liquidityKeeper.amountMode(), liquidityKeeper.fixedAmount(), liquidityKeeper.percentBps(), liquidityKeeper.minIntervalSec(), liquidityKeeper.minReservePol(), liquidityKeeper.maxPerTx(), liquidityKeeper.minDexRefillBiggi()]),
    Promise.all([dripKeeper.owner(), dripKeeper.paused()]),
    Promise.all([supplyController.owner(), supplyController.reserveDropBps(), supplyController.dexRefillAmount(), supplyController.dexCooldown(), supplyController.rewardsThreshold(), supplyController.rewardsRefillAmount(), supplyController.rewardsCooldown(), supplyController.circuitBreakerEnabled(), supplyController.dexCriticalFloor(), supplyController.rewardsCriticalFloor()]),
    Promise.all([dexReserveGuard.owner(), dexReserveGuard.paused(), dexReserveGuard.minReserveRatioBps(), dexReserveGuard.refillAmount(), dexReserveGuard.cooldown()]),
    Promise.all([receiver.owner(), receiver.paused(), receiver.keystoneForwarder(), receiver.expectedWorkflowId(), receiver.expectedWorkflowOwner(), receiver.maxReportBytes(), receiver.maxCallDataBytes()]),
    emission.owner(),
    Promise.all([pair.getReserves(), pair.totalSupply()]),
    Promise.all([ticketHub.owner(), ticketHub.paused(), ticketHub.ticketPrice(), ticketHub.priceIncreasePerMint(), ticketHub.saleCap(), ticketHub.marketingCap()]),
    Promise.all([main.owner(), main.paused()]),
    Promise.all([main2.owner(), main2.paused(), main2.metadataConsistency()]),
  ]);

  const chapterIds = Array.from({ length: config.launch.chapterCount }, (_, index) => index + 1);
  const [chapterActiveValues, chapterSaleMintedValues] = await Promise.all([
    Promise.all(chapterIds.map((id) => ticketHub.chapterActive(id))),
    Promise.all(chapterIds.map((id) => ticketHub.chapterSaleMinted(id))),
  ]);
  const calls = {};
  for (const call of config.cre.calls) {
    const selector = ethers.utils.id(call.signature).slice(0, 10);
    calls[call.key] = await receiver.callAllowed(addressFromKey(addresses, call.targetAddressKey), selector);
  }
  const [supplyAllowedCaller, dexKeeper, emissionKeeper] = await Promise.all([
    supplyController.allowedCallers(receiverAddress),
    dexReserveGuard.keepers(receiverAddress),
    emission.keepers(receiverAddress),
  ]);

  const reserves = pairValues[0];
  const metadata = main2Values[2];
  return {
    buybackUpkeep: { owner: buybackUpkeepValues[0], agent: buybackUpkeepValues[1], paused: buybackUpkeepValues[2], minNativeThresholdWei: buybackUpkeepValues[3] },
    buybackAgent: { owner: buybackAgentValues[0], paused: buybackAgentValues[1], autoBuybackEnabled: buybackAgentValues[2] },
    policy: { owner: policyValues[0], buybackAgent: policyValues[1], swapSlippageBps: policyValues[2], txDeadlineSec: policyValues[3], minBuybackInterval: policyValues[4], buybacksPaused: policyValues[5], maxDailyBuybackNative: policyValues[6] },
    liquidityManager: { owner: liquidityManagerValues[0], router: liquidityManagerValues[1], factory: liquidityManagerValues[2], reserve: liquidityManagerValues[3], liquidityVault: liquidityManagerValues[4], keeper: liquidityManagerValues[5], tokenPct: liquidityManagerValues[6], slippageBps: liquidityManagerValues[7], txDeadlineSec: liquidityManagerValues[8], autoTopUpEnabled: liquidityManagerValues[9], autoTriggerMinPolWei: liquidityManagerValues[10], autoRequestPolWei: liquidityManagerValues[11] },
    liquidityOrchestrator: { owner: liquidityOrchestratorValues[0], paused: liquidityOrchestratorValues[1], keeper: liquidityOrchestratorValues[2], minPolPerTx: liquidityOrchestratorValues[3], maxPolPerTx: liquidityOrchestratorValues[4], minDexRefillBiggi: liquidityOrchestratorValues[5], cooldownSec: liquidityOrchestratorValues[6], dailyQuotaPol: liquidityOrchestratorValues[7] },
    liquidityKeeper: { owner: liquidityKeeperValues[0], paused: liquidityKeeperValues[1], orchestrator: liquidityKeeperValues[2], reserve: liquidityKeeperValues[3], allowedCaller: liquidityKeeperValues[4], amountMode: liquidityKeeperValues[5], fixedAmount: liquidityKeeperValues[6], percentBps: liquidityKeeperValues[7], minIntervalSec: liquidityKeeperValues[8], minReservePol: liquidityKeeperValues[9], maxPerTx: liquidityKeeperValues[10], minDexRefillBiggi: liquidityKeeperValues[11] },
    dripKeeper: { owner: dripKeeperValues[0], paused: dripKeeperValues[1] },
    supplyController: { owner: supplyValues[0], reserveDropBps: supplyValues[1], dexRefillAmount: supplyValues[2], dexCooldown: supplyValues[3], rewardsThreshold: supplyValues[4], rewardsRefillAmount: supplyValues[5], rewardsCooldown: supplyValues[6], circuitBreakerEnabled: supplyValues[7], dexCriticalFloor: supplyValues[8], rewardsCriticalFloor: supplyValues[9] },
    dexReserveGuard: { owner: guardValues[0], paused: guardValues[1], minReserveRatioBps: guardValues[2], refillAmount: guardValues[3], cooldown: guardValues[4] },
    creReceiver: { owner: receiverValues[0], paused: receiverValues[1], keystoneForwarder: receiverValues[2], expectedWorkflowId: receiverValues[3], expectedWorkflowOwner: receiverValues[4], maxReportBytes: receiverValues[5], maxCallDataBytes: receiverValues[6] },
    creRoles: { calls, supplyAllowedCaller, dexKeeper, emissionKeeper, liquidityAllowedCaller: liquidityKeeperValues[4], emissionOwner },
    pair: { reserve0: reserves[0], reserve1: reserves[1], lpSupply: pairValues[1], empty: reserves[0].isZero() && reserves[1].isZero() && pairValues[1].isZero() },
    launch: {
      ticketHubOwner: ticketHubValues[0],
      ticketHubPaused: ticketHubValues[1],
      ticketPrice: ticketHubValues[2],
      priceIncreasePerMint: ticketHubValues[3],
      saleCap: ticketHubValues[4],
      marketingCap: ticketHubValues[5],
      mainOwner: mainValues[0],
      mainPaused: mainValues[1],
      main2Owner: main2Values[0],
      main2Paused: main2Values[1],
      main2Metadata: { configuredCount: metadata[0], fullyConfigured: metadata[1], rewardMatrixConsistent: metadata[2] },
      chapterActive: Object.fromEntries(chapterIds.map((id, index) => [String(id), chapterActiveValues[index]])),
      chapterSaleMinted: Object.fromEntries(chapterIds.map((id, index) => [String(id), chapterSaleMintedValues[index]])),
    },
  };
}

function expectedLiveTicketPrice(state, config) {
  const paidMints = Object.values(state.launch.chapterSaleMinted || {}).reduce(
    (total, count) => total.add(count),
    ethers.BigNumber.from(0)
  );
  let price = ethers.BigNumber.from(config.launch.publicTicketStartPriceWei);
  const multiplier = ethers.BigNumber.from(config.launch.priceIncreasePerMintBps);
  for (let index = 0; index < paidMints.toNumber(); index += 1) {
    price = price.mul(multiplier).div(10_000);
  }
  return { paidMints, price };
}

function compareProductionState(state, addresses, config) {
  const checks = [];
  const owner = addressFromKey(addresses, config.authority.ownerAddressKey);
  const t = config.tokenomics;
  const add = (name, category, actual, expected, ok) => checks.push({ name, category, ok, actual: asString(actual), expected: asString(expected) });
  const addr = (name, category, actual, key) => add(name, category, actual, addressFromKey(addresses, key), sameAddress(actual, addressFromKey(addresses, key)));
  const uint = (name, category, actual, expected) => add(name, category, actual, expected, sameUint(actual, expected));
  const bool = (name, category, actual, expected) => add(name, category, actual, expected, actual === expected);

  for (const [name, actual] of [
    ["BuybackUpkeep owner", state.buybackUpkeep.owner],
    ["BuybackAgent owner", state.buybackAgent.owner],
    ["Policy owner", state.policy.owner],
    ["LiquidityManager owner", state.liquidityManager.owner],
    ["LiquidityOrchestrator owner", state.liquidityOrchestrator.owner],
    ["LiquidityKeeper owner", state.liquidityKeeper.owner],
    ["DripKeeper owner", state.dripKeeper.owner],
    ["SupplyController owner", state.supplyController.owner],
    ["DexReserveGuard owner", state.dexReserveGuard.owner],
    ["CRE receiver owner", state.creReceiver.owner],
    ["EmissionController owner", state.creRoles.emissionOwner],
    ["TicketHub owner", state.launch.ticketHubOwner],
    ["Originals VRF owner", state.launch.mainOwner],
    ["Originals Public owner", state.launch.main2Owner],
  ]) add(name, "ownership", actual, owner, sameAddress(actual, owner));

  addr("BuybackUpkeep agent", "parameter", state.buybackUpkeep.agent, t.buybackUpkeep.agentAddressKey);
  uint("BuybackUpkeep threshold", "parameter", state.buybackUpkeep.minNativeThresholdWei, t.buybackUpkeep.minNativeThresholdWei);
  addr("Policy buyback agent", "parameter", state.policy.buybackAgent, t.buybackAgent.addressKey);
  uint("Policy swap slippage", "parameter", state.policy.swapSlippageBps, t.policy.swapSlippageBps);
  uint("Policy deadline", "parameter", state.policy.txDeadlineSec, t.policy.txDeadlineSec);
  uint("Policy buyback interval", "parameter", state.policy.minBuybackInterval, t.policy.minBuybackIntervalSec);
  bool("Policy buybacks paused", "parameter", state.policy.buybacksPaused, t.policy.buybacksPausedAtLaunch);
  uint("Policy daily buyback quota", "parameter", state.policy.maxDailyBuybackNative, t.policy.maxDailyBuybackNativeWei);

  addr("LiquidityManager router", "parameter", state.liquidityManager.router, t.liquidityManager.routerAddressKey);
  addr("LiquidityManager factory", "parameter", state.liquidityManager.factory, t.liquidityManager.factoryAddressKey);
  addr("LiquidityManager reserve", "parameter", state.liquidityManager.reserve, t.liquidityManager.reserveAddressKey);
  addr("LiquidityManager vault", "parameter", state.liquidityManager.liquidityVault, t.liquidityManager.vaultAddressKey);
  addr("LiquidityManager keeper", "parameter", state.liquidityManager.keeper, t.liquidityManager.keeperAddressKey);
  uint("LiquidityManager token pct", "parameter", state.liquidityManager.tokenPct, t.liquidityManager.tokenPct);
  uint("LiquidityManager slippage", "parameter", state.liquidityManager.slippageBps, t.liquidityManager.slippageBps);
  uint("LiquidityManager deadline", "parameter", state.liquidityManager.txDeadlineSec, t.liquidityManager.txDeadlineSec);
  bool("LiquidityManager auto top-up enabled", "parameter", state.liquidityManager.autoTopUpEnabled, t.liquidityManager.autoTopUpEnabled);
  uint("LiquidityManager auto trigger", "parameter", state.liquidityManager.autoTriggerMinPolWei, t.liquidityManager.autoTriggerMinPolWei);
  uint("LiquidityManager auto request", "parameter", state.liquidityManager.autoRequestPolWei, t.liquidityManager.autoRequestPolWei);

  addr("LiquidityOrchestrator keeper", "parameter", state.liquidityOrchestrator.keeper, t.liquidityOrchestrator.keeperAddressKey);
  uint("LiquidityOrchestrator min POL", "parameter", state.liquidityOrchestrator.minPolPerTx, t.liquidityOrchestrator.minPolPerTxWei);
  uint("LiquidityOrchestrator max POL", "parameter", state.liquidityOrchestrator.maxPolPerTx, t.liquidityOrchestrator.maxPolPerTxWei);
  uint("LiquidityOrchestrator min BIGGI", "parameter", state.liquidityOrchestrator.minDexRefillBiggi, t.liquidityOrchestrator.minDexRefillBiggiWei);
  uint("LiquidityOrchestrator cooldown", "parameter", state.liquidityOrchestrator.cooldownSec, t.liquidityOrchestrator.cooldownSec);
  uint("LiquidityOrchestrator daily quota", "parameter", state.liquidityOrchestrator.dailyQuotaPol, t.liquidityOrchestrator.dailyQuotaPolWei);

  addr("LiquidityKeeper orchestrator", "parameter", state.liquidityKeeper.orchestrator, t.liquidityOrchestrator.addressKey);
  addr("LiquidityKeeper reserve", "parameter", state.liquidityKeeper.reserve, t.liquidityManager.reserveAddressKey);
  uint("LiquidityKeeper amount mode", "parameter", state.liquidityKeeper.amountMode, t.liquidityKeeper.amountMode);
  uint("LiquidityKeeper fixed amount", "parameter", state.liquidityKeeper.fixedAmount, t.liquidityKeeper.fixedAmountWei);
  uint("LiquidityKeeper percent", "parameter", state.liquidityKeeper.percentBps, t.liquidityKeeper.percentBps);
  uint("LiquidityKeeper interval", "parameter", state.liquidityKeeper.minIntervalSec, t.liquidityKeeper.minIntervalSec);
  uint("LiquidityKeeper min reserve", "parameter", state.liquidityKeeper.minReservePol, t.liquidityKeeper.minReservePolWei);
  uint("LiquidityKeeper max per tx", "parameter", state.liquidityKeeper.maxPerTx, t.liquidityKeeper.maxPerTxWei);
  uint("LiquidityKeeper min BIGGI", "parameter", state.liquidityKeeper.minDexRefillBiggi, t.liquidityKeeper.minDexRefillBiggiWei);

  uint("Supply reserve drop", "parameter", state.supplyController.reserveDropBps, t.supplyController.reserveDropBps);
  uint("Supply DEX refill", "parameter", state.supplyController.dexRefillAmount, t.supplyController.dexRefillAmountWei);
  uint("Supply DEX cooldown", "parameter", state.supplyController.dexCooldown, t.supplyController.dexCooldownSec);
  uint("Supply rewards threshold", "parameter", state.supplyController.rewardsThreshold, t.supplyController.rewardsThresholdWei);
  uint("Supply rewards refill", "parameter", state.supplyController.rewardsRefillAmount, t.supplyController.rewardsRefillAmountWei);
  uint("Supply rewards cooldown", "parameter", state.supplyController.rewardsCooldown, t.supplyController.rewardsCooldownSec);
  bool("Supply circuit breaker", "parameter", state.supplyController.circuitBreakerEnabled, t.supplyController.circuitBreakerEnabled);
  uint("Supply DEX critical floor", "parameter", state.supplyController.dexCriticalFloor, t.supplyController.dexCriticalFloorWei);
  uint("Supply rewards critical floor", "parameter", state.supplyController.rewardsCriticalFloor, t.supplyController.rewardsCriticalFloorWei);

  uint("DEX guard reserve ratio", "parameter", state.dexReserveGuard.minReserveRatioBps, t.dexReserveGuard.minReserveRatioBps);
  uint("DEX guard refill", "parameter", state.dexReserveGuard.refillAmount, t.dexReserveGuard.refillAmountWei);
  uint("DEX guard cooldown", "parameter", state.dexReserveGuard.cooldown, t.dexReserveGuard.cooldownSec);
  addr("CRE forwarder", "parameter", state.creReceiver.keystoneForwarder, config.cre.forwarderAddressKey);
  uint("CRE max report bytes", "parameter", state.creReceiver.maxReportBytes, config.cre.maxReportBytes);
  uint("CRE max calldata bytes", "parameter", state.creReceiver.maxCallDataBytes, config.cre.maxCallDataBytes);

  const liveTicketPrice = expectedLiveTicketPrice(state, config);
  add(
    "TicketHub paid-mint price curve",
    "parameter",
    state.launch.ticketPrice,
    liveTicketPrice.price,
    sameUint(state.launch.ticketPrice, liveTicketPrice.price)
  );
  uint("TicketHub price multiplier", "parameter", state.launch.priceIncreasePerMint, config.launch.priceIncreasePerMintBps);
  uint("TicketHub sale cap", "parameter", state.launch.saleCap, config.launch.saleCap);
  uint("TicketHub marketing cap", "parameter", state.launch.marketingCap, config.launch.marketingCap);
  uint("Originals Public metadata count", "parameter", state.launch.main2Metadata.configuredCount, "100");
  bool("Originals Public metadata complete", "parameter", state.launch.main2Metadata.fullyConfigured, true);
  bool("Originals Public reward matrix", "parameter", state.launch.main2Metadata.rewardMatrixConsistent, true);

  bool("BuybackUpkeep paused flag", "activationState", state.buybackUpkeep.paused, t.buybackUpkeep.pausedAtLaunch);
  bool("BuybackAgent paused flag", "activationState", state.buybackAgent.paused, t.buybackAgent.pausedAtLaunch);
  bool("BuybackAgent auto buyback enabled", "activationState", state.buybackAgent.autoBuybackEnabled, t.buybackAgent.autoBuybackEnabled);
  bool("LiquidityOrchestrator paused flag", "activationState", state.liquidityOrchestrator.paused, t.liquidityOrchestrator.pausedAtLaunch);
  bool("LiquidityKeeper paused flag", "activationState", state.liquidityKeeper.paused, t.liquidityKeeper.pausedAtLaunch);
  bool("DripKeeper paused flag", "activationState", state.dripKeeper.paused, t.dripKeeper.pausedAtLaunch);
  bool("DEX guard paused flag", "activationState", state.dexReserveGuard.paused, t.dexReserveGuard.pausedAtLaunch);

  const allCallsAllowed = config.cre.calls.every((call) => state.creRoles.calls[call.key] === true);
  bool("CRE five required calls allowed", "creWiring", allCallsAllowed, true);
  add(
    "Legacy LiquidityAutomation remains undeployed",
    "creWiring",
    addresses[config.cre.legacyLiquidityAutomation.addressKey],
    ZERO,
    sameAddress(addresses[config.cre.legacyLiquidityAutomation.addressKey], ZERO)
  );
  bool("CRE Supply role", "creWiring", state.creRoles.supplyAllowedCaller, true);
  bool("CRE DEX role", "creWiring", state.creRoles.dexKeeper, true);
  bool("CRE emission role", "creWiring", state.creRoles.emissionKeeper, true);
  add("CRE liquidity role", "creWiring", state.creRoles.liquidityAllowedCaller, addressFromKey(addresses, config.cre.receiverAddressKey), sameAddress(state.creRoles.liquidityAllowedCaller, addressFromKey(addresses, config.cre.receiverAddressKey)));
  bool("CRE receiver paused flag", "creWiring", state.creReceiver.paused, false);

  bool("Originals VRF paused flag", "launchState", state.launch.mainPaused, false);
  bool("TicketHub paused flag", "launchState", state.launch.ticketHubPaused, false);
  bool("Originals Public paused flag", "launchState", state.launch.main2Paused, false);
  bool("Originals chapter active", "launchState", state.launch.chapterActive[String(config.launch.chapterId)], true);
  for (const chapterId of config.launch.futureChapterIds) {
    bool(`Future chapter ${chapterId} inactive`, "chapterIsolation", state.launch.chapterActive[String(chapterId)], false);
  }
  return checks;
}

function serializeProductionState(value) {
  if (ethers.BigNumber.isBigNumber(value)) return value.toString();
  if (Array.isArray(value)) return value.map(serializeProductionState);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeProductionState(item)]));
  }
  return value;
}

module.exports = {
  compareProductionState,
  expectedLiveTicketPrice,
  readProductionState,
  serializeProductionState,
};
