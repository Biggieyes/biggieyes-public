const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;
const POLYGON_FORWARDER = "0x76c9cf548b4179F8901cda1f8623568b58215E62";
const PERFORM_UPKEEP_SELECTOR = ethers.utils.id("performUpkeep(bytes)").slice(0, 10);
const ROLL_CURRENT_WEEK_SELECTOR = ethers.utils.id("rollCurrentWeek()").slice(0, 10);
const MIN_SAFE_BUYBACK_THRESHOLD_WEI = ethers.utils.parseEther("0.001");

const EXPECTED_TARGETS = [
  ["supply-controller", "AUTOMATION", "SUPPLY_CONTROLLER"],
  ["buyback", "AUTOMATION", "BUYBACK_UPKEEP_PROXY"],
  ["liquidity", "AUTOMATION", "LIQUIDITY_KEEPER_PROXY"],
  ["dex-reserve-guard", "AUTOMATION", "DEX_RESERVE_GUARD"],
  ["rewards-week-roll", "WEEK_ROLL", "TOKEN_REWARDS_EMISSION_CONTROLLER"],
];

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ""));
}

function address(value) {
  return isAddress(value) ? ethers.utils.getAddress(value) : ZERO;
}

function sameAddress(a, b) {
  return address(a) === address(b);
}

async function main() {
  const chain = await ethers.provider.getNetwork();
  const root = path.resolve(__dirname, "../..");
  const addressesFile = path.resolve(root, env("MASTER_ADDRESSES_FILE", "addresses.master.json"));
  const testConfigFile = path.resolve(root, "cre-workflows/biggi-cre/my-workflow/config.test.json");
  const productionConfigFile = path.resolve(root, "cre-workflows/biggi-cre/my-workflow/config.production.json");
  const reportFile = path.resolve(root, "reports/cre-preflight-polygon.json");
  const addresses = loadJson(addressesFile);
  const testConfig = loadJson(testConfigFile);
  const productionConfig = loadJson(productionConfigFile);
  const errors = [];
  const warnings = [];
  const checks = [];

  function check(name, ok, value) {
    checks.push({ name, ok, value });
    if (!ok) errors.push({ name, value });
  }

  function warn(name, value) {
    warnings.push({ name, value });
  }

  check("Polygon mainnet chainId", network.name === "polygon" && chain.chainId === 137, {
    network: network.name,
    chainId: chain.chainId,
  });

  const forwarder = address(env("CRE_KEYSTONE_FORWARDER", addresses.CRE_KEYSTONE_FORWARDER || POLYGON_FORWARDER));
  check("Official Polygon KeystoneForwarder", sameAddress(forwarder, POLYGON_FORWARDER), forwarder);
  check("KeystoneForwarder has bytecode", (await ethers.provider.getCode(forwarder)) !== "0x", forwarder);

  check("Test config is dry-run", testConfig.dryRun === true, testConfig.dryRun);
  check("Production config is write-enabled", productionConfig.dryRun === false, productionConfig.dryRun);
  check("Test chain selector", testConfig.chainSelectorName === "polygon-mainnet", testConfig.chainSelectorName);
  check(
    "Production chain selector",
    productionConfig.chainSelectorName === "polygon-mainnet",
    productionConfig.chainSelectorName
  );
  check("CRE schedules match", testConfig.schedule === productionConfig.schedule, {
    test: testConfig.schedule,
    production: productionConfig.schedule,
  });

  const testTargets = new Map(testConfig.targets.map((target) => [target.name, target]));
  const productionTargets = new Map(productionConfig.targets.map((target) => [target.name, target]));
  check("Expected CRE target count", testTargets.size === EXPECTED_TARGETS.length && productionTargets.size === EXPECTED_TARGETS.length, {
    expected: EXPECTED_TARGETS.length,
    test: testTargets.size,
    production: productionTargets.size,
  });

  for (const [name, kind, addressKey] of EXPECTED_TARGETS) {
    const expectedAddress = address(addresses[addressKey]);
    const testTarget = testTargets.get(name);
    const productionTarget = productionTargets.get(name);
    check(`${name}: present in both configs`, Boolean(testTarget && productionTarget), {
      test: Boolean(testTarget),
      production: Boolean(productionTarget),
    });
    if (!testTarget || !productionTarget) continue;
    check(`${name}: kind`, testTarget.kind === kind && productionTarget.kind === kind, {
      expected: kind,
      test: testTarget.kind,
      production: productionTarget.kind,
    });
    check(
      `${name}: address matches deployment`,
      expectedAddress !== ZERO && sameAddress(testTarget.address, expectedAddress) && sameAddress(productionTarget.address, expectedAddress),
      { expected: expectedAddress, test: testTarget.address, production: productionTarget.address }
    );
    if (expectedAddress === ZERO) continue;
    check(`${name}: target has bytecode`, (await ethers.provider.getCode(expectedAddress)) !== "0x", expectedAddress);

    try {
      if (kind === "AUTOMATION") {
        const contract = await ethers.getContractAt(
          ["function checkUpkeep(bytes) view returns (bool,bytes)"],
          expectedAddress
        );
        const [needed, performData] = await contract.checkUpkeep("0x");
        checks.push({ name: `${name}: checkUpkeep callable`, ok: true, value: { needed, performData } });
      } else {
        const contract = await ethers.getContractAt(
          [
            "function currentWeek() view returns (uint64)",
            "function weekState(uint64) view returns (bool,uint256,uint256,uint256,uint256,uint256)",
          ],
          expectedAddress
        );
        const currentWeek = await contract.currentWeek();
        const weekState = await contract.weekState(currentWeek);
        checks.push({
          name: `${name}: week state readable`,
          ok: true,
          value: { currentWeek: currentWeek.toString(), initialized: weekState[0] },
        });
      }
    } catch (error) {
      check(`${name}: read interface callable`, false, error.message);
    }
  }

  check("Legacy DripKeeper is not a CRE target", !testTargets.has("drip") && !productionTargets.has("drip"), {
    reason: "BuybackAgent calls DripLM directly after a successful buyback",
  });

  const buybackAgentAddress = address(addresses.BUYBACK_AGENT);
  const buybackProxyAddress = address(addresses.BUYBACK_UPKEEP_PROXY);
  const dripLmAddress = address(addresses.DRIP_LM);
  const dripProxyAddress = address(addresses.DRIP_KEEPER_PROXY);
  if ([buybackAgentAddress, buybackProxyAddress, dripLmAddress, dripProxyAddress].every((value) => value !== ZERO)) {
    const agent = await ethers.getContractAt(
      ["function keeper() view returns(address)", "function dripLM() view returns(address)"],
      buybackAgentAddress
    );
    const dripLm = await ethers.getContractAt(["function buybackAgent() view returns(address)"], dripLmAddress);
    const dripProxy = await ethers.getContractAt(["function paused() view returns(bool)"], dripProxyAddress);
    check("BuybackAgent keeper is BuybackUpkeepProxy", sameAddress(await agent.keeper(), buybackProxyAddress), {
      expected: buybackProxyAddress,
      actual: await agent.keeper(),
    });
    check("BuybackAgent points to DripLM", sameAddress(await agent.dripLM(), dripLmAddress), {
      expected: dripLmAddress,
      actual: await agent.dripLM(),
    });
    check("DripLM authorizes BuybackAgent", sameAddress(await dripLm.buybackAgent(), buybackAgentAddress), {
      expected: buybackAgentAddress,
      actual: await dripLm.buybackAgent(),
    });
    check("Legacy DripKeeper remains paused", await dripProxy.paused(), dripProxyAddress);

    const buybackProxy = await ethers.getContractAt(
      ["function minNativeThresholdWei() view returns(uint256)"],
      buybackProxyAddress
    );
    const buybackThreshold = await buybackProxy.minNativeThresholdWei();
    check(
      "BuybackUpkeep threshold is not dust-level",
      buybackThreshold.gte(MIN_SAFE_BUYBACK_THRESHOLD_WEI),
      {
        actualWei: buybackThreshold.toString(),
        minimumWei: MIN_SAFE_BUYBACK_THRESHOLD_WEI.toString(),
        canonicalDefaultWei: ethers.utils.parseEther("0.5").toString(),
      }
    );
  }

  const configuredReceiver = address(
    env("CRE_AUTOMATION_RECEIVER", addresses.CRE_AUTOMATION_RECEIVER || productionConfig.receiverAddress)
  );
  if (configuredReceiver === ZERO) {
    warn("CRE receiver not deployed yet", "Expected before CRE approval; production config remains intentionally blocked");
    check("Production receiver remains zero before deployment", address(productionConfig.receiverAddress) === ZERO, productionConfig.receiverAddress);
  } else {
    check("CRE receiver has bytecode", (await ethers.provider.getCode(configuredReceiver)) !== "0x", configuredReceiver);
    check("Production receiver matches deployment", sameAddress(productionConfig.receiverAddress, configuredReceiver), {
      expected: configuredReceiver,
      actual: productionConfig.receiverAddress,
    });
    const receiver = await ethers.getContractAt(
      [
        "function keystoneForwarder() view returns(address)",
        "function paused() view returns(bool)",
        "function callAllowed(address,bytes4) view returns(bool)",
      ],
      configuredReceiver
    );
    check("Receiver uses official forwarder", sameAddress(await receiver.keystoneForwarder(), forwarder), {
      expected: forwarder,
      actual: await receiver.keystoneForwarder(),
    });
    if (!(await receiver.paused())) warn("CRE receiver is already unpaused", configuredReceiver);
    for (const [name, kind, addressKey] of EXPECTED_TARGETS) {
      const target = address(addresses[addressKey]);
      const selector = kind === "WEEK_ROLL" ? ROLL_CURRENT_WEEK_SELECTOR : PERFORM_UPKEEP_SELECTOR;
      check(`${name}: receiver selector allowlisted`, await receiver.callAllowed(target, selector), { target, selector });
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    ok: errors.length === 0,
    forwarder,
    receiver: configuredReceiver,
    checks,
    warnings,
    errors,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({ ok: report.ok, checks: checks.length, warnings: warnings.length, errors: errors.length, report: reportFile }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
