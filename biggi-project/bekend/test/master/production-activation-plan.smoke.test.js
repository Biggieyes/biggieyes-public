const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  HASH_ZERO,
  ZERO,
  buildProductionActivationPlan,
  loadProductionConfig,
  validateProductionConfig,
} = require("../../scripts/master/lib/productionActivationPlan");
const { expectedLiveTicketPrice } = require("../../scripts/master/lib/productionState");

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

function phase(plan, id) {
  return plan.phases.find((entry) => entry.id === id);
}

function tx(planPhase, id) {
  return planPhase.transactions.find((entry) => entry.id === id);
}

function decode(signature, data) {
  const iface = new ethers.utils.Interface([`function ${signature}`]);
  return iface.decodeFunctionData(signature.slice(0, signature.indexOf("(")), data);
}

describe("Production activation plan", function () {
  const root = path.resolve(__dirname, "../..");
  const addresses = loadAddresses(root);
  const { config } = loadProductionConfig(root);
  const state = {
    buybackUpkeep: { minNativeThresholdWei: "1", paused: true },
    buybackAgent: { autoBuybackEnabled: false },
    liquidityManager: {
      autoTopUpEnabled: false,
      autoTriggerMinPolWei: "5",
      autoRequestPolWei: "5",
    },
    liquidityOrchestrator: { paused: true },
    liquidityKeeper: { paused: true },
    pair: { empty: true },
    creReceiver: {
      paused: true,
      expectedWorkflowId: HASH_ZERO,
      expectedWorkflowOwner: ZERO,
    },
    creRoles: {
      calls: Object.fromEntries(config.cre.calls.map((call) => [call.key, false])),
      supplyAllowedCaller: false,
      dexKeeper: false,
      emissionKeeper: false,
      liquidityAllowedCaller: ZERO,
    },
    launch: {
      mainPaused: false,
      ticketHubPaused: false,
      main2Paused: true,
      chapterActive: { "1": false, "2": false, "3": false, "4": false, "5": false },
    },
  };

  it("validates the canonical Polygon manifest", function () {
    const validated = validateProductionConfig(config, addresses);
    expect(validated.owner).to.equal(ethers.utils.getAddress(addresses.OWNER));
    expect(validated.tokenAmount.toString()).to.equal(ethers.utils.parseEther("8000000").toString());
    expect(validated.nativeAmount.toString()).to.equal(ethers.utils.parseEther("5000").toString());
    expect(config.tokenomics.liquidityManager.tokenPct).to.equal("100");
    expect(config.tokenomics.liquidityManager.slippageBps).to.equal("300");
  });

  it("encodes the five ordered unsigned phases without a workflow identity", function () {
    const blockTimestamp = 1_800_000_000;
    const plan = buildProductionActivationPlan({ addresses, config, state, blockTimestamp });
    expect(plan.broadcast).to.equal(false);
    expect(plan.containsSignatures).to.equal(false);
    expect(plan.phases.map((entry) => entry.id)).to.deep.equal([
      "00-pre-liquidity-remediation",
      "10-initial-liquidity",
      "20-post-liquidity-tokenomics",
      "30-cre-wiring",
      "40-originals-launch",
    ]);

    const remediation = phase(plan, "00-pre-liquidity-remediation");
    const thresholdArgs = decode("setThreshold(uint256)", tx(remediation, "buyback-threshold").data);
    expect(thresholdArgs[0].toString()).to.equal(ethers.utils.parseEther("0.5").toString());
    const autoTopUpArgs = decode(
      "setAutoTopUpConfig(bool,uint256,uint256)",
      tx(remediation, "liquidity-manager-auto-topup-config").data
    );
    expect(autoTopUpArgs[0]).to.equal(false);
    expect(autoTopUpArgs[1].toString()).to.equal(ethers.utils.parseEther("5").toString());
    expect(autoTopUpArgs[2].toString()).to.equal(ethers.utils.parseEther("5").toString());

    const liquidity = phase(plan, "10-initial-liquidity");
    const addLiquidity = tx(liquidity, "add-liquidity");
    const liquidityArgs = decode(
      "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
      addLiquidity.data
    );
    expect(addLiquidity.value).to.equal(ethers.utils.parseEther("5000").toString());
    expect(liquidityArgs[0]).to.equal(ethers.utils.getAddress(addresses.BIGGI_TOKEN));
    expect(liquidityArgs[1].toString()).to.equal(ethers.utils.parseEther("8000000").toString());
    expect(liquidityArgs[2].toString()).to.equal(ethers.utils.parseEther("7960000").toString());
    expect(liquidityArgs[3].toString()).to.equal(ethers.utils.parseEther("4975").toString());
    expect(liquidityArgs[4]).to.equal(ethers.utils.getAddress(addresses.LIQUIDITY_VAULT));
    expect(liquidityArgs[5].toNumber()).to.equal(blockTimestamp + 900);

    const cre = phase(plan, "30-cre-wiring");
    expect(cre.ready).to.equal(false);
    expect(cre.transactions.every((entry) => entry.blockedBy.length > 0)).to.equal(true);
    expect(tx(cre, "cre-workflow-identity").required).to.equal(true);
    expect(cre.transactions.at(-1).id).to.equal("cre-receiver-unpause");

    const launch = phase(plan, "40-originals-launch");
    const chapterCalls = launch.transactions.filter((entry) => entry.method === "setChapterActive(uint256,bool)");
    expect(chapterCalls).to.have.length(1);
    const chapterArgs = decode("setChapterActive(uint256,bool)", chapterCalls[0].data);
    expect(chapterArgs[0].toNumber()).to.equal(1);
    expect(chapterArgs[1]).to.equal(true);

    const allTransactions = plan.phases.flatMap((entry) => entry.transactions);
    expect(allTransactions.some((entry) => entry.to === addresses.LIQUIDITY_AUTOMATION)).to.equal(false);
    expect(allTransactions.some((entry) => entry.to === addresses.DRIP_KEEPER_PROXY && entry.method === "unpauseAll()"))
      .to.equal(false);
  });

  it("reproduces the global Solidity ticket-price curve across chapters", function () {
    const result = expectedLiveTicketPrice({
      launch: { chapterSaleMinted: { "1": "1", "2": "1", "3": "0", "4": "0", "5": "0" } },
    }, config);
    const once = ethers.utils.parseEther("500").mul(10033).div(10_000);
    const twice = once.mul(10033).div(10_000);
    expect(result.paidMints.toString()).to.equal("2");
    expect(result.price.toString()).to.equal(twice.toString());
  });

  it("locks the exact CRE identity before allowlisting and unpauses the receiver last", function () {
    const workflowId = `0x${"11".repeat(32)}`;
    const workflowOwner = ethers.utils.getAddress(addresses.OWNER);
    const plan = buildProductionActivationPlan({
      addresses,
      config,
      state,
      blockTimestamp: 1_800_000_000,
      workflowId,
      workflowOwner,
    });
    const cre = phase(plan, "30-cre-wiring");
    expect(cre.ready).to.equal(true);
    expect(cre.transactions[0].id).to.equal("cre-workflow-identity");
    expect(cre.transactions[1].id).to.equal("cre-call-allowlist");
    expect(cre.transactions.at(-1).id).to.equal("cre-receiver-unpause");
    expect(cre.transactions.every((entry) => entry.blockedBy.length === 0)).to.equal(true);

    const identity = decode(
      "setExpectedWorkflowIdentity(bytes32,address)",
      tx(cre, "cre-workflow-identity").data
    );
    expect(identity[0]).to.equal(workflowId);
    expect(identity[1]).to.equal(workflowOwner);

    const allowlist = decode(
      "setCallsAllowed(address[],bytes4[],bool)",
      tx(cre, "cre-call-allowlist").data
    );
    expect(allowlist[0]).to.have.length(5);
    expect(allowlist[1]).to.have.length(5);
    expect(allowlist[2]).to.equal(true);
  });
});
