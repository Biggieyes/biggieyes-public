const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

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

function rootFile(root, name) {
  return path.resolve(root, name);
}

function loadAddresses(root) {
  const master = loadJson(rootFile(root, "addresses.master.json"));
  const visibility = loadJson(rootFile(root, "addresses.visibility.polygon.json"));
  const phase1 = loadJson(rootFile(root, "addresses.tokenomics.phase1.polygon.json"));
  const phase2 = loadJson(rootFile(root, "addresses.tokenomics.phase2.polygon.json"));
  return { ...master, ...visibility, ...phase1, ...phase2 };
}

async function codeExists(address) {
  return isAddress(address) && (await ethers.provider.getCode(address)) !== "0x";
}

function fmt(bn) {
  return ethers.BigNumber.isBigNumber(bn) ? bn.toString() : String(bn);
}

async function main() {
  const root = path.resolve(__dirname, "../..");
  const A = loadAddresses(root);
  const chain = await ethers.provider.getNetwork();
  const report = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    okForDeployOnly: true,
    okForPublicLaunch: true,
    checks: [],
    warnings: [],
    blockers: [],
    values: {},
  };

  function pass(name, value = true) {
    report.checks.push({ name, ok: true, value });
  }
  function warn(name, value = true) {
    report.warnings.push({ name, value });
  }
  function block(name, value = true) {
    report.okForPublicLaunch = false;
    report.blockers.push({ name, value });
  }

  if (chain.chainId !== 137) block("RPC is not Polygon mainnet", chain.chainId);
  else pass("RPC chainId is Polygon mainnet", chain.chainId);

  const expectedOwner = getAddress(env("EXPECT_OWNER"));
  const compromisedOwner = getAddress(env("COMPROMISED_OWNER_ADDRESS"));
  if (!isAddress(expectedOwner)) block("EXPECT_OWNER is not configured", env("EXPECT_OWNER"));
  if (isAddress(compromisedOwner) && getAddress(expectedOwner) === getAddress(compromisedOwner)) {
    block("EXPECT_OWNER uses the compromised owner address", expectedOwner);
  }
  if (isAddress(compromisedOwner) && getAddress(A.DEV_WALLET) === getAddress(compromisedOwner)) {
    block("DEV_WALLET uses the compromised owner address", A.DEV_WALLET);
  }
  if (isAddress(compromisedOwner) && getAddress(A.MARKETING_SUPPORT) === getAddress(compromisedOwner)) {
    block("MARKETING_SUPPORT uses the compromised owner address", A.MARKETING_SUPPORT);
  }

  const requiredCode = [
    "MAIN",
    "MAIN2",
    "TICKET_HUB",
    "VRF_ROUTER",
    "DISTRIBUTOR",
    "BIGGI_TOKEN",
    "RESERVE",
    "TREASURY",
    "DRIP_DISTRIBUTOR",
    "TOKEN_REWARDS",
    "TOKEN_REWARDS_EMISSION_CONTROLLER",
    "BUYBACK_AGENT",
    "POLICY",
    "COMMUNITY_CENTER",
    "MODERATOR_CENTER",
    "SUPPLY_CONTROLLER",
    "SUPPLY_GUARDIAN",
    "DEX_RESERVE_GUARD",
    "LIQUIDITY_VAULT",
    "LIQUIDITY_MANAGER",
    "LIQUIDITY_ORCHESTRATOR",
    "LIQUIDITY_KEEPER_PROXY",
    "DRIP_LM",
    "DRIP_KEEPER_PROXY",
    "BUYBACK_UPKEEP_PROXY",
    "CRE_AUTOMATION_RECEIVER",
    "SYSTEM_READER",
    "BIGGI_TOKENOMICS_READER",
    "MULTICALL",
  ];
  for (const key of requiredCode) {
    const address = getAddress(A[key]);
    if (!(await codeExists(address))) block(`Missing code: ${key}`, address);
    else pass(`Code exists: ${key}`, address);
  }

  const pairAbi = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ];
  const tokenAbi = [
    "function owner() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function distributed() view returns (bool)",
    "function reserveLocked() view returns (bool)",
    "function reserveAddr() view returns (address)",
    "function dripDistributorAddr() view returns (address)",
    "function tokenRewardsAddr() view returns (address)",
    "function marketingSupportAddr() view returns (address)",
    "function supplyController() view returns (address)",
    "function supplyGuardian() view returns (address)",
  ];
  const hubAbi = [
    "function paused() view returns (bool)",
    "function distributor() view returns (address)",
    "function saleCap() view returns (uint16)",
    "function marketingCap() view returns (uint16)",
    "function saleMinted() view returns (uint16)",
    "function marketingMinted() view returns (uint16)",
    "function ticketPrice() view returns (uint256)",
    "function devWallet() view returns (address)",
    "function tokenSink() view returns (address)",
    "function tokenSinkBps() view returns (uint256)",
    "function tokenSinkDepositMode() view returns (bool)",
  ];
  const mainAbi = [
    "function metadataConsistency() view returns (uint256 configuredCount, bool fullyConfigured, bool rewardMatrixConsistent)",
    "function paused() view returns (bool)",
    "function ticketHub() view returns (address)",
    "function compute() view returns (address)",
    "function vrfRouter() view returns (address)",
  ];
  const main2Abi = [
    "function metadataConsistency() view returns (uint256 configuredCount, bool fullyConfigured, bool rewardMatrixConsistent)",
    "function paused() view returns (bool)",
    "function devWallet() view returns (address)",
  ];
  const vrfAbi = [
    "function coordinator() view returns (address)",
    "function keyHash() view returns (bytes32)",
    "function subId() view returns (uint256)",
    "function main() view returns (address)",
    "function approvedMains(address) view returns (bool)",
  ];
  const vrfCoordinatorAbi = [
    "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address subOwner,address[] consumers)",
  ];
  const pausedAbi = ["function paused() view returns (bool)"];
  const creReceiverAbi = [
    "function paused() view returns (bool)",
    "function keystoneForwarder() view returns (address)",
    "function expectedWorkflowId() view returns (bytes32)",
    "function expectedWorkflowOwner() view returns (address)",
  ];

  if (await codeExists(A.PAIR)) {
    const pair = await ethers.getContractAt(pairAbi, A.PAIR);
    const [token0, token1, reserves, lpSupply] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
      pair.totalSupply(),
    ]);
    const hasBiggi = getAddress(token0) === getAddress(A.BIGGI_TOKEN) || getAddress(token1) === getAddress(A.BIGGI_TOKEN);
    const hasWeth = getAddress(token0) === getAddress(A.WETH) || getAddress(token1) === getAddress(A.WETH);
    report.values.pair = {
      address: A.PAIR,
      token0,
      token1,
      reserve0: fmt(reserves[0]),
      reserve1: fmt(reserves[1]),
      lpSupply: fmt(lpSupply),
    };
    if (!hasBiggi || !hasWeth) block("PAIR token mismatch", report.values.pair);
    else pass("PAIR contains BIGGI and WPOL", A.PAIR);
    if (reserves[0].eq(0) || reserves[1].eq(0) || lpSupply.eq(0)) {
      block("PAIR has no initial liquidity", report.values.pair);
    } else {
      pass("PAIR has initial liquidity", report.values.pair);
    }
  }

  if (await codeExists(A.BIGGI_TOKEN)) {
    const token = await ethers.getContractAt(tokenAbi, A.BIGGI_TOKEN);
    const [owner, totalSupply, distributed, reserveLocked, reserveAddr, dripAddr, tokenRewardsAddr, marketingAddr] =
      await Promise.all([
        token.owner(),
        token.totalSupply(),
        token.distributed(),
        token.reserveLocked(),
        token.reserveAddr(),
        token.dripDistributorAddr(),
        token.tokenRewardsAddr(),
        token.marketingSupportAddr(),
      ]);
    report.values.biggiToken = {
      owner,
      totalSupply: fmt(totalSupply),
      distributed,
      reserveLocked,
      reserveAddr,
      dripDistributorAddr: dripAddr,
      tokenRewardsAddr,
      marketingSupportAddr: marketingAddr,
      reserveBalance: fmt(await token.balanceOf(A.RESERVE)),
      dripDistributorBalance: fmt(await token.balanceOf(A.DRIP_DISTRIBUTOR)),
      tokenRewardsBalance: fmt(await token.balanceOf(A.TOKEN_REWARDS)),
    };
    if (env("EXPECT_OWNER") && getAddress(owner) !== getAddress(env("EXPECT_OWNER"))) {
      warn("BIGGI owner is not EXPECT_OWNER", { owner, expectOwner: env("EXPECT_OWNER") });
    }
    if (!distributed || totalSupply.eq(0)) block("BIGGI initialDistribute not executed", report.values.biggiToken);
    else pass("BIGGI initial distribution executed", report.values.biggiToken);
    if (!reserveLocked) block("BIGGI reserve is not locked yet", report.values.biggiToken);
    if (isAddress(A.MARKETING_SUPPORT) && getAddress(marketingAddr) !== getAddress(A.MARKETING_SUPPORT)) {
      block("BIGGI marketingSupportAddr mismatch", {
        current: marketingAddr,
        expected: A.MARKETING_SUPPORT,
      });
    }
  }

  if (await codeExists(A.TICKET_HUB)) {
    const hub = await ethers.getContractAt(hubAbi, A.TICKET_HUB);
    const [paused, distributor, saleCap, marketingCap, saleMinted, marketingMinted, ticketPrice, devWallet, tokenSink, tokenSinkBps, tokenSinkDepositMode] =
      await Promise.all([
        hub.paused(),
        hub.distributor(),
        hub.saleCap(),
        hub.marketingCap(),
        hub.saleMinted(),
        hub.marketingMinted(),
        hub.ticketPrice(),
        hub.devWallet(),
        hub.tokenSink(),
        hub.tokenSinkBps(),
        hub.tokenSinkDepositMode(),
      ]);
    report.values.ticketHub = {
      paused,
      distributor,
      saleCap,
      marketingCap,
      saleMinted,
      marketingMinted,
      ticketPrice: fmt(ticketPrice),
      devWallet,
      tokenSink,
      tokenSinkBps: fmt(tokenSinkBps),
      tokenSinkDepositMode,
    };
    if (paused) block("TicketHub is paused", report.values.ticketHub);
    if (!isAddress(distributor)) block("TicketHub distributor is not set", report.values.ticketHub);
    else if (getAddress(distributor) !== getAddress(A.DISTRIBUTOR)) block("TicketHub distributor mismatch", report.values.ticketHub);
    const expectedSaleCap = Number(env("SALE_CAP", A.SALE_CAP == null ? "" : A.SALE_CAP));
    const expectedMarketingCap = Number(env("MARKETING_CAP", A.MARKETING_CAP == null ? "" : A.MARKETING_CAP));
    if (ethers.BigNumber.from(saleCap).eq(0)) block("TicketHub saleCap is zero", report.values.ticketHub);
    const saleCapValue = ethers.BigNumber.from(saleCap).toNumber();
    const marketingCapValue = ethers.BigNumber.from(marketingCap).toNumber();
    if (Number.isFinite(expectedSaleCap) && expectedSaleCap > 0 && saleCapValue !== expectedSaleCap) {
      block("TicketHub saleCap mismatch", { current: saleCapValue, expected: expectedSaleCap });
    }
    if (Number.isFinite(expectedMarketingCap) && expectedMarketingCap >= 0 && marketingCapValue !== expectedMarketingCap) {
      block("TicketHub marketingCap mismatch", { current: marketingCapValue, expected: expectedMarketingCap });
    }
    if (isAddress(A.DEV_WALLET) && getAddress(devWallet) !== getAddress(A.DEV_WALLET)) {
      block("TicketHub devWallet mismatch", { current: devWallet, expected: A.DEV_WALLET });
    }
    const expectedTicketPrice = env("TICKET_PRICE_WEI", "");
    if (expectedTicketPrice && !ticketPrice.eq(expectedTicketPrice)) {
      block("TicketHub ticketPrice does not match TICKET_PRICE_WEI", { current: fmt(ticketPrice), expected: expectedTicketPrice });
    }
    if (getAddress(tokenSink) !== getAddress(A.TREASURY) || !tokenSinkDepositMode || !tokenSinkBps.eq(10_000)) {
      block("TicketHub BIGGI token sink is not routed fully to Treasury deposit mode", report.values.ticketHub);
    }
  }

  if (await codeExists(A.MAIN)) {
    const main = await ethers.getContractAt(mainAbi, A.MAIN);
    const [configuredCount, fullyConfigured, rewardMatrixConsistent] = await main.metadataConsistency();
    report.values.mainMetadata = {
      configuredCount: fmt(configuredCount),
      fullyConfigured,
      rewardMatrixConsistent,
      ticketHub: await main.ticketHub(),
      compute: await main.compute(),
      vrfRouter: await main.vrfRouter(),
      paused: await main.paused(),
    };
    if (!fullyConfigured || !rewardMatrixConsistent) block("MAIN metadata is not launch-ready", report.values.mainMetadata);
    else pass("MAIN metadata consistency ok", report.values.mainMetadata);
    if (report.values.mainMetadata.paused) block("MAIN is paused", report.values.mainMetadata);
  }

  if (await codeExists(A.MAIN2)) {
    const main2 = await ethers.getContractAt(main2Abi, A.MAIN2);
    const [metadataState, paused, devWallet] = await Promise.all([
      main2.metadataConsistency(),
      main2.paused(),
      main2.devWallet(),
    ]);
    const [configuredCount, fullyConfigured, rewardMatrixConsistent] = metadataState;
    report.values.main2Metadata = {
      configuredCount: fmt(configuredCount),
      fullyConfigured,
      rewardMatrixConsistent,
      paused,
      devWallet,
    };
    if (!fullyConfigured || !rewardMatrixConsistent) block("MAIN2 metadata is not launch-ready", report.values.main2Metadata);
    else pass("MAIN2 metadata consistency ok", report.values.main2Metadata);
    if (paused) block("MAIN2 is paused", report.values.main2Metadata);
    if (isAddress(A.DEV_WALLET) && getAddress(devWallet) !== getAddress(A.DEV_WALLET)) {
      block("MAIN2 devWallet mismatch", { current: devWallet, expected: A.DEV_WALLET });
    }
  }

  if (await codeExists(A.VRF_ROUTER)) {
    const vrf = await ethers.getContractAt(vrfAbi, A.VRF_ROUTER);
    const coordinator = await vrf.coordinator();
    const subId = await vrf.subId();
    report.values.vrf = {
      coordinator,
      keyHash: await vrf.keyHash(),
      subId: fmt(subId),
      main: await vrf.main(),
      mainApproved: await vrf.approvedMains(A.MAIN),
    };
    if (report.values.vrf.keyHash === ethers.constants.HashZero || report.values.vrf.subId === "0") {
      block("VRF params are not set", report.values.vrf);
    }
    if (getAddress(report.values.vrf.main) !== getAddress(A.MAIN) || !report.values.vrf.mainApproved) {
      block("VRF main binding/approval is not ready", report.values.vrf);
    }

    if (!(await codeExists(coordinator))) {
      block("VRF coordinator has no bytecode", coordinator);
    } else {
      try {
        const coordinatorContract = await ethers.getContractAt(vrfCoordinatorAbi, coordinator);
        const subscription = await coordinatorContract.getSubscription(subId);
        const consumers = subscription.consumers || subscription[4] || [];
        const routerIsConsumer = consumers.some((consumer) => getAddress(consumer) === getAddress(A.VRF_ROUTER));
        report.values.vrfSubscription = {
          coordinator,
          subId: fmt(subId),
          linkBalance: fmt(subscription.balance || subscription[0]),
          nativeBalance: fmt(subscription.nativeBalance || subscription[1]),
          requestCount: fmt(subscription.reqCount || subscription[2]),
          owner: subscription.subOwner || subscription[3],
          consumers,
          routerIsConsumer,
        };
        if (!routerIsConsumer) block("VRF_ROUTER is not a subscription consumer", report.values.vrfSubscription);
        if ((subscription.balance || subscription[0]).eq(0) && (subscription.nativeBalance || subscription[1]).eq(0)) {
          block("VRF subscription has no LINK or native balance", report.values.vrfSubscription);
        }
        const expectedOwner = env("EXPECT_OWNER", "");
        if (expectedOwner && getAddress(report.values.vrfSubscription.owner) !== getAddress(expectedOwner)) {
          block("VRF subscription owner is not EXPECT_OWNER", report.values.vrfSubscription);
        }
      } catch (error) {
        block("VRF subscription cannot be read", String(error && error.message ? error.message : error));
      }
    }
  }

  if (await codeExists(A.CRE_AUTOMATION_RECEIVER)) {
    const receiver = await ethers.getContractAt(creReceiverAbi, A.CRE_AUTOMATION_RECEIVER);
    report.values.creReceiver = {
      address: A.CRE_AUTOMATION_RECEIVER,
      paused: await receiver.paused(),
      keystoneForwarder: await receiver.keystoneForwarder(),
      expectedWorkflowId: await receiver.expectedWorkflowId(),
      expectedWorkflowOwner: await receiver.expectedWorkflowOwner(),
    };
    if (report.values.creReceiver.paused) block("CRE automation receiver is paused", report.values.creReceiver);
    if (getAddress(report.values.creReceiver.keystoneForwarder) !== getAddress(A.CRE_KEYSTONE_FORWARDER)) {
      block("CRE KeystoneForwarder mismatch", report.values.creReceiver);
    }
    if (report.values.creReceiver.expectedWorkflowId === ethers.constants.HashZero) {
      block("CRE workflow ID is not locked", report.values.creReceiver);
    }
    if (!isAddress(report.values.creReceiver.expectedWorkflowOwner)) {
      block("CRE workflow owner is not locked", report.values.creReceiver);
    }
  }

  for (const [key, address] of [
    ["LIQUIDITY_ORCHESTRATOR", A.LIQUIDITY_ORCHESTRATOR],
    ["LIQUIDITY_KEEPER_PROXY", A.LIQUIDITY_KEEPER_PROXY],
    ["DRIP_KEEPER_PROXY", A.DRIP_KEEPER_PROXY],
  ]) {
    if (!(await codeExists(address))) continue;
    const c = await ethers.getContractAt(pausedAbi, address);
    const paused = await c.paused();
    report.values[`${key}.paused`] = paused;
    if (key === "DRIP_KEEPER_PROXY") {
      if (!paused) block("DRIP_KEEPER_PROXY must remain paused", false);
      else pass("DRIP_KEEPER_PROXY remains paused", true);
    } else if (paused) {
      block(`${key} is paused`, true);
    }
  }

  const reportFile = path.resolve(root, env("LAUNCH_PREFLIGHT_REPORT", "reports/launch-readiness-polygon.json"));
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    okForDeployOnly: report.okForDeployOnly,
    okForPublicLaunch: report.okForPublicLaunch,
    blockers: report.blockers.length,
    warnings: report.warnings.length,
    report: reportFile,
  }, null, 2));

  if (env("LAUNCH_PREFLIGHT_STRICT") === "1" && report.blockers.length > 0) {
    throw new Error(`Launch preflight has ${report.blockers.length} blockers. See ${reportFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
