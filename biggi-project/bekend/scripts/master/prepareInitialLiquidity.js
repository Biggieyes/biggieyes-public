const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envBool(name, fallback = false) {
  const raw = env(name, "");
  if (raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
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

async function main() {
  const root = path.resolve(__dirname, "../..");
  const A = loadAddresses(root);
  const signers = await ethers.getSigners();
  const deployer = signers[0] || null;
  const signerAddress = deployer ? getAddress(deployer.address) : ZERO;
  const deployerAddress = getAddress(
    env("LIQUIDITY_OWNER", env("EXPECT_OWNER", A.OWNER || env("DEPLOYER", A.DEPLOYER || signerAddress)))
  );
  const chain = await ethers.provider.getNetwork();
  if (network.name === "polygon" && chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const execute = envBool("EXECUTE_INITIAL_LIQUIDITY", false);
  const compromisedOwner = getAddress(env("COMPROMISED_OWNER_ADDRESS"));
  if (execute && !deployer) {
    throw new Error("EXECUTE_INITIAL_LIQUIDITY requires a local signer; dry-run can use DEPLOYER/EXPECT_OWNER.");
  }
  if (
    execute &&
    isAddress(compromisedOwner) &&
    (deployerAddress === compromisedOwner || signerAddress === compromisedOwner)
  ) {
    throw new Error("Refusing initial liquidity transaction from COMPROMISED_OWNER_ADDRESS");
  }
  const tokenAmountRaw = env("LIQ_TOKEN_AMOUNT", "");
  const nativeAmountRaw = env("LIQ_NATIVE_AMOUNT", env("LIQ_ETH_AMOUNT", ""));
  const transferFromReserve = envBool("TRANSFER_FROM_RESERVE", false);
  const lpRecipient = getAddress(env("LIQ_LP_RECIPIENT", deployerAddress));
  const slippageBps = Number(env("LIQ_INITIAL_SLIPPAGE_BPS", "50"));
  const allowVaultRecipient = envBool("ALLOW_UNSYNCED_VAULT_LP", false);
  const requireEmptyPair = envBool("LIQ_REQUIRE_EMPTY_PAIR", true);
  const requireVaultRecipient = envBool("LIQ_REQUIRE_VAULT_RECIPIENT", true);
  const irreversibleConfirmed = envBool("I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE", false);
  const postSeedSyncPolRaw = env("LIQ_POST_SEED_SYNC_POL", "1");
  const deadlineSec = Number(env("LIQ_DEADLINE_SEC", "900"));

  const report = {
    network: network.name,
    chainId: chain.chainId,
    createdAt: new Date().toISOString(),
    execute,
    deployer: deployerAddress,
    signer: signerAddress,
    actions: [],
    blockers: [],
    warnings: [],
    values: {
      lpRecipient,
      transferFromReserve,
      slippageBps,
      requireEmptyPair,
      requireVaultRecipient,
      irreversibleConfirmed,
      postSeedSyncPol: postSeedSyncPolRaw,
      deadlineSec,
    },
  };

  if (!tokenAmountRaw) report.blockers.push("Missing LIQ_TOKEN_AMOUNT, example: 8000000");
  if (!nativeAmountRaw) report.blockers.push("Missing LIQ_NATIVE_AMOUNT, example: 5000");
  if (deployer && signerAddress !== deployerAddress) {
    report.blockers.push("Configured transaction signer does not match the required liquidity owner wallet.");
  }
  if (execute && !irreversibleConfirmed) {
    report.blockers.push("Set I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE=1 for execution.");
  }
  if (slippageBps < 0 || slippageBps > 10_000) report.blockers.push("LIQ_INITIAL_SLIPPAGE_BPS must be 0..10000");
  if (!Number.isInteger(deadlineSec) || deadlineSec <= 0) {
    report.blockers.push("LIQ_DEADLINE_SEC must be a positive integer");
  }
  if (requireVaultRecipient && getAddress(lpRecipient) !== getAddress(A.LIQUIDITY_VAULT)) {
    report.blockers.push("LIQ_LP_RECIPIENT must equal LIQUIDITY_VAULT for the production launch.");
  }
  if (
    getAddress(lpRecipient) === getAddress(A.LIQUIDITY_VAULT) &&
    !allowVaultRecipient &&
    ethers.utils.parseEther(postSeedSyncPolRaw).isZero()
  ) {
    report.blockers.push(
      "LIQ_LP_RECIPIENT is LiquidityVault but no post-seed LiquidityManager sync is configured."
    );
  }

  const token = await ethers.getContractAt(
    [
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
      "function distributed() view returns (bool)",
      "function owner() view returns (address)",
      "function reserveAddr() view returns (address)",
      "function transferFromReserveTo(address,uint256) external",
    ],
    A.BIGGI_TOKEN
  );
  const router = await ethers.getContractAt(
    [
      "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)",
      "function WETH() view returns (address)",
    ],
    A.ROUTER
  );
  const factory = await ethers.getContractAt(
    ["function getPair(address,address) view returns (address)"],
    A.FACTORY
  );
  const pair = await ethers.getContractAt(
    [
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
    ],
    A.PAIR
  );
  const vault = await ethers.getContractAt(
    [
      "function liquidityManager() view returns (address)",
      "function whitelistedPairs(address) view returns (bool)",
      "function lpSnapshot(address) view returns (bool,uint256,uint256)",
    ],
    A.LIQUIDITY_VAULT
  );
  const liquidityManager = await ethers.getContractAt(
    [
      "function reserve() view returns (address)",
      "function liquidityVault() view returns (address)",
      "function executePairing(uint256)",
    ],
    A.LIQUIDITY_MANAGER
  );
  const reserve = await ethers.getContractAt(
    [
      "function ownerTopUpDexRefill(uint256)",
      "function dexRefillBiggi() view returns (uint256)",
    ],
    A.RESERVE
  );

  const decimals = await token.decimals();
  const amountTokenDesired = tokenAmountRaw
    ? ethers.utils.parseUnits(tokenAmountRaw, decimals)
    : ethers.BigNumber.from(0);
  const amountNativeDesired = nativeAmountRaw
    ? ethers.utils.parseEther(nativeAmountRaw)
    : ethers.BigNumber.from(0);
  const minToken = amountTokenDesired.mul(10_000 - slippageBps).div(10_000);
  const minNative = amountNativeDesired.mul(10_000 - slippageBps).div(10_000);
  const postSeedSyncNative = ethers.utils.parseEther(postSeedSyncPolRaw);
  const postSeedSyncToken = amountNativeDesired.isZero()
    ? ethers.BigNumber.from(0)
    : postSeedSyncNative.mul(amountTokenDesired).div(amountNativeDesired);
  const [
    reservesBefore,
    lpSupplyBefore,
    tokenBalanceBefore,
    reserveTokenBalanceBefore,
    nativeBalance,
    tokenOwner,
    tokenReserve,
    routerWeth,
    pairToken0,
    pairToken1,
    factoryPair,
    vaultManager,
    pairWhitelisted,
    lmReserve,
    lmVault,
  ] = await Promise.all([
    pair.getReserves(),
    pair.totalSupply(),
    token.balanceOf(deployerAddress),
    token.balanceOf(A.RESERVE),
    ethers.provider.getBalance(deployerAddress),
    token.owner(),
    token.reserveAddr(),
    router.WETH(),
    pair.token0(),
    pair.token1(),
    factory.getPair(A.BIGGI_TOKEN, A.WETH),
    vault.liquidityManager(),
    vault.whitelistedPairs(A.PAIR),
    liquidityManager.reserve(),
    liquidityManager.liquidityVault(),
  ]);

  report.values.before = {
    distributed: await token.distributed(),
    tokenBalance: tokenBalanceBefore.toString(),
    reserveTokenBalance: reserveTokenBalanceBefore.toString(),
    nativeBalance: nativeBalance.toString(),
    pairReserve0: reservesBefore[0].toString(),
    pairReserve1: reservesBefore[1].toString(),
    pairLpSupply: lpSupplyBefore.toString(),
    amountTokenDesired: amountTokenDesired.toString(),
    amountNativeDesired: amountNativeDesired.toString(),
    amountTokenMin: minToken.toString(),
    amountNativeMin: minNative.toString(),
    postSeedSyncNative: postSeedSyncNative.toString(),
    postSeedSyncToken: postSeedSyncToken.toString(),
    tokenOwner,
    tokenReserve,
    routerWeth,
    pairToken0,
    pairToken1,
    factoryPair,
    vaultManager,
    pairWhitelisted,
    lmReserve,
    lmVault,
    initialPricePolPerBiggiE18: amountTokenDesired.isZero()
      ? "0"
      : amountNativeDesired.mul(ethers.constants.WeiPerEther).div(amountTokenDesired).toString(),
    initialBiggiPerPolE18: amountNativeDesired.isZero()
      ? "0"
      : amountTokenDesired.mul(ethers.constants.WeiPerEther).div(amountNativeDesired).toString(),
  };

  if (!(await token.distributed())) report.blockers.push("BIGGI initial distribution is not executed.");
  if (getAddress(tokenOwner) !== deployerAddress) {
    report.blockers.push("Required liquidity owner is not the BiggiToken owner for reserve transfer.");
  }
  if (getAddress(tokenReserve) !== getAddress(A.RESERVE)) report.blockers.push("BiggiToken reserveAddr mismatch.");
  if (getAddress(routerWeth) !== getAddress(A.WETH)) report.blockers.push("Router WETH mismatch.");
  if (getAddress(factoryPair) !== getAddress(A.PAIR)) report.blockers.push("Factory pair mismatch.");
  const expectedTokens = new Set([getAddress(A.BIGGI_TOKEN), getAddress(A.WETH)]);
  if (!expectedTokens.has(getAddress(pairToken0)) || !expectedTokens.has(getAddress(pairToken1))) {
    report.blockers.push("Pair token0/token1 mismatch.");
  }
  if (getAddress(vaultManager) !== getAddress(A.LIQUIDITY_MANAGER)) report.blockers.push("Vault liquidityManager mismatch.");
  if (!pairWhitelisted) report.blockers.push("BIGGI/WPOL pair is not whitelisted in LiquidityVault.");
  if (getAddress(lmReserve) !== getAddress(A.RESERVE)) report.blockers.push("LiquidityManager reserve mismatch.");
  if (getAddress(lmVault) !== getAddress(A.LIQUIDITY_VAULT)) report.blockers.push("LiquidityManager vault mismatch.");
  if (
    requireEmptyPair &&
    (!reservesBefore[0].isZero() || !reservesBefore[1].isZero() || !lpSupplyBefore.isZero())
  ) {
    report.blockers.push("BIGGI/WPOL pair is no longer empty; initial-price transaction is blocked.");
  }
  if (nativeBalance.lte(amountNativeDesired.add(postSeedSyncNative))) {
    report.blockers.push("Liquidity owner native balance is not enough for requested liquidity, post-seed sync and gas.");
  }
  if (transferFromReserve && reserveTokenBalanceBefore.lt(amountTokenDesired.add(postSeedSyncToken))) {
    report.blockers.push("Reserve BIGGI balance is too low for the configured initial allocation.");
  }
  if (!transferFromReserve && tokenBalanceBefore.lt(amountTokenDesired)) {
    report.blockers.push("Liquidity owner BIGGI balance is too low. Set TRANSFER_FROM_RESERVE=1 or transfer BIGGI manually.");
  }

  if (!execute) {
    if (transferFromReserve) {
      report.actions.push("DRY_RUN: would transfer exactly LIQ_TOKEN_AMOUNT from Reserve to the owner wallet.");
    }
    report.actions.push("DRY_RUN: would approve exactly LIQ_TOKEN_AMOUNT to the router.");
    report.actions.push("DRY_RUN: would call addLiquidityETH with LP minted directly to LiquidityVault.");
    report.actions.push(
      `DRY_RUN: would run post-seed LiquidityManager pairing with ${postSeedSyncPolRaw} POL and proportional BIGGI to synchronize Vault accounting.`
    );
  } else if (report.blockers.length === 0) {
    if (transferFromReserve) {
      const tx = await token.transferFromReserveTo(deployerAddress, amountTokenDesired);
      console.log(`[TX] transferFromReserveTo: ${tx.hash}`);
      const rc = await tx.wait();
      report.actions.push({ action: "transferFromReserveTo", tx: tx.hash, status: rc.status, blockNumber: rc.blockNumber });
    }

    const allowance = await token.allowance(deployerAddress, A.ROUTER);
    if (allowance.lt(amountTokenDesired)) {
      const tx = await token.approve(A.ROUTER, amountTokenDesired);
      console.log(`[TX] approve router: ${tx.hash}`);
      const rc = await tx.wait();
      report.actions.push({ action: "approve", tx: tx.hash, status: rc.status, blockNumber: rc.blockNumber });
    }

    const deadline = Math.floor(Date.now() / 1000) + deadlineSec;
    let seedSucceeded = false;
    try {
      const tx = await router.addLiquidityETH(
        A.BIGGI_TOKEN,
        amountTokenDesired,
        minToken,
        minNative,
        lpRecipient,
        deadline,
        { value: amountNativeDesired }
      );
      console.log(`[TX] addLiquidityETH: ${tx.hash}`);
      const rc = await tx.wait();
      report.actions.push({ action: "addLiquidityETH", tx: tx.hash, status: rc.status, blockNumber: rc.blockNumber });
      seedSucceeded = rc.status === 1;
    } catch (error) {
      report.blockers.push(`addLiquidityETH failed after reserve transfer/approval: ${error.message}`);
    } finally {
      const remainingAllowance = await token.allowance(deployerAddress, A.ROUTER);
      if (!remainingAllowance.isZero()) {
        const tx = await token.approve(A.ROUTER, 0);
        console.log(`[TX] revoke router allowance: ${tx.hash}`);
        const rc = await tx.wait();
        report.actions.push({ action: "revokeRouterAllowance", tx: tx.hash, status: rc.status, blockNumber: rc.blockNumber });
      }
    }

    if (seedSucceeded && !postSeedSyncNative.isZero()) {
      try {
        const fundTx = await deployer.sendTransaction({ to: A.RESERVE, value: postSeedSyncNative });
        console.log(`[TX] fund Reserve for post-seed sync: ${fundTx.hash}`);
        const fundRc = await fundTx.wait();
        report.actions.push({ action: "fundReserveForPostSeedSync", tx: fundTx.hash, status: fundRc.status, blockNumber: fundRc.blockNumber });

        const bucketTx = await reserve.ownerTopUpDexRefill(postSeedSyncToken);
        console.log(`[TX] top up Reserve DEX bucket: ${bucketTx.hash}`);
        const bucketRc = await bucketTx.wait();
        report.actions.push({ action: "ownerTopUpDexRefill", tx: bucketTx.hash, status: bucketRc.status, blockNumber: bucketRc.blockNumber });

        const syncTx = await liquidityManager.executePairing(postSeedSyncNative);
        console.log(`[TX] post-seed LiquidityManager pairing: ${syncTx.hash}`);
        const syncRc = await syncTx.wait();
        report.actions.push({ action: "postSeedLiquidityManagerPairing", tx: syncTx.hash, status: syncRc.status, blockNumber: syncRc.blockNumber });
      } catch (error) {
        report.blockers.push(`Post-seed LiquidityManager sync failed: ${error.message}`);
      }
    }
  }

  const [reservesAfter, lpSupplyAfter] = await Promise.all([pair.getReserves(), pair.totalSupply()]);
  report.values.after = {
    tokenBalance: (await token.balanceOf(deployerAddress)).toString(),
    pairReserve0: reservesAfter[0].toString(),
    pairReserve1: reservesAfter[1].toString(),
    pairLpSupply: lpSupplyAfter.toString(),
    lpRecipientBalance: (await pair.balanceOf(lpRecipient)).toString(),
  };
  if (getAddress(lpRecipient) === getAddress(A.LIQUIDITY_VAULT)) {
    const snapshot = await vault.lpSnapshot(A.PAIR);
    report.values.after.vaultPairWhitelisted = snapshot[0];
    report.values.after.vaultAccountedLp = snapshot[1].toString();
    report.values.after.vaultRealLp = snapshot[2].toString();
    if (!snapshot[1].eq(snapshot[2])) {
      report.warnings.push("Vault LP accounting is not synchronized yet; execute one normal LiquidityManager pairing before activation.");
    }
    if (execute && !postSeedSyncNative.isZero() && !snapshot[1].eq(snapshot[2])) {
      report.blockers.push("Post-seed LiquidityManager pairing did not synchronize Vault accounting.");
    }
  }

  const reportFile = path.resolve(root, env("INITIAL_LIQUIDITY_REPORT", "reports/initial-liquidity-polygon.json"));
  const evidenceFile = path.resolve(
    root,
    "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT/EVIDENCE/initial-liquidity-polygon.json"
  );
  const reportBody = `${JSON.stringify(report, null, 2)}\n`;
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
  fs.writeFileSync(reportFile, reportBody);
  fs.writeFileSync(evidenceFile, reportBody);
  console.log(JSON.stringify({
    execute,
    readyToExecute: report.blockers.length === 0,
    blockers: report.blockers.length,
    warnings: report.warnings.length,
    report: reportFile,
  }, null, 2));

  if (execute && report.blockers.length > 0) {
    throw new Error(`Initial liquidity blocked. See ${reportFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
