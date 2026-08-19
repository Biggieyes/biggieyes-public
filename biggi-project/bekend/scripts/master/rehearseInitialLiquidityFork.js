const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function address(value) {
  return ethers.utils.getAddress(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (network.name !== "hardhat") throw new Error("Fork rehearsal must run only on the Hardhat network");

  const root = path.resolve(__dirname, "../..");
  const A = loadJson(path.resolve(root, "addresses.master.json"));
  const owner = address(A.OWNER);
  const tokenAmount = ethers.utils.parseEther("8000000");
  const nativeAmount = ethers.utils.parseEther("5000");
  const syncNativeAmount = ethers.utils.parseEther("1");
  const syncTokenAmount = ethers.utils.parseEther("1600");
  const slippageBps = 50;

  await ethers.provider.send("hardhat_setBalance", [
    owner,
    ethers.utils.hexStripZeros(ethers.utils.parseEther("6000").toHexString()),
  ]);
  await ethers.provider.send("hardhat_impersonateAccount", [owner]);
  // EDR cannot execute Polygon calls exactly at the historical fork block.
  // Mine one local block so all calls run against fork state at N+1.
  await ethers.provider.send("evm_mine", []);
  const signer = await ethers.getSigner(owner);

  const token = new ethers.Contract(
    A.BIGGI_TOKEN,
    [
      "function owner() view returns(address)",
      "function balanceOf(address) view returns(uint256)",
      "function allowance(address,address) view returns(uint256)",
      "function approve(address,uint256) returns(bool)",
      "function transferFromReserveTo(address,uint256)",
    ],
    signer
  );
  const router = new ethers.Contract(
    A.ROUTER,
    ["function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns(uint256,uint256,uint256)"],
    signer
  );
  const pair = new ethers.Contract(
    A.PAIR,
    [
      "function token0() view returns(address)",
      "function getReserves() view returns(uint112,uint112,uint32)",
      "function totalSupply() view returns(uint256)",
      "function balanceOf(address) view returns(uint256)",
    ],
    signer
  );
  const reserve = new ethers.Contract(
    A.RESERVE,
    [
      "function ownerTopUpDexRefill(uint256)",
      "function dexRefillBiggi() view returns(uint256)",
    ],
    signer
  );
  const lm = new ethers.Contract(
    A.LIQUIDITY_MANAGER,
    ["function executePairing(uint256)"],
    signer
  );
  const vault = new ethers.Contract(
    A.LIQUIDITY_VAULT,
    ["function lpSnapshot(address) view returns(bool,uint256,uint256)"],
    signer
  );

  const reservesBefore = await pair.getReserves();
  const lpSupplyBefore = await pair.totalSupply();
  assert(reservesBefore[0].isZero() && reservesBefore[1].isZero(), "Pair is not empty on the fork");
  assert(lpSupplyBefore.isZero(), "Pair LP supply is not zero on the fork");
  assert(address(await token.owner()) === owner, "Fork signer is not BiggiToken owner");

  const ownerBiggiBefore = await token.balanceOf(owner);
  const reserveBiggiBefore = await token.balanceOf(A.RESERVE);

  await (await token.transferFromReserveTo(owner, tokenAmount)).wait();
  await (await token.approve(A.ROUTER, tokenAmount)).wait();

  const deadline = (await ethers.provider.getBlock("latest")).timestamp + 900;
  await (
    await router.addLiquidityETH(
      A.BIGGI_TOKEN,
      tokenAmount,
      tokenAmount.mul(10_000 - slippageBps).div(10_000),
      nativeAmount.mul(10_000 - slippageBps).div(10_000),
      A.LIQUIDITY_VAULT,
      deadline,
      { value: nativeAmount }
    )
  ).wait();

  const allowanceAfterSeed = await token.allowance(owner, A.ROUTER);
  if (!allowanceAfterSeed.isZero()) await (await token.approve(A.ROUTER, 0)).wait();

  const reservesAfterSeed = await pair.getReserves();
  const token0 = address(await pair.token0());
  const reserveBiggiAfterSeed = token0 === address(A.BIGGI_TOKEN) ? reservesAfterSeed[0] : reservesAfterSeed[1];
  const reservePolAfterSeed = token0 === address(A.BIGGI_TOKEN) ? reservesAfterSeed[1] : reservesAfterSeed[0];
  assert(reserveBiggiAfterSeed.eq(tokenAmount), "Seed BIGGI reserve mismatch");
  assert(reservePolAfterSeed.eq(nativeAmount), "Seed POL reserve mismatch");

  const vaultAfterSeed = await vault.lpSnapshot(A.PAIR);
  assert(vaultAfterSeed[0], "Pair is not whitelisted in Vault");
  assert(vaultAfterSeed[2].gt(0), "Vault received no LP tokens");

  await (await signer.sendTransaction({ to: A.RESERVE, value: syncNativeAmount })).wait();
  await (await reserve.ownerTopUpDexRefill(syncTokenAmount)).wait();
  await (await lm.executePairing(syncNativeAmount)).wait();

  const reservesAfterSync = await pair.getReserves();
  const reserveBiggiAfterSync = token0 === address(A.BIGGI_TOKEN) ? reservesAfterSync[0] : reservesAfterSync[1];
  const reservePolAfterSync = token0 === address(A.BIGGI_TOKEN) ? reservesAfterSync[1] : reservesAfterSync[0];
  const vaultAfterSync = await vault.lpSnapshot(A.PAIR);
  const ownerBiggiAfter = await token.balanceOf(owner);
  const reserveBiggiAfter = await token.balanceOf(A.RESERVE);

  assert(reserveBiggiAfterSync.eq(tokenAmount.add(syncTokenAmount)), "Post-sync BIGGI reserve mismatch");
  assert(reservePolAfterSync.eq(nativeAmount.add(syncNativeAmount)), "Post-sync POL reserve mismatch");
  assert(vaultAfterSync[1].eq(vaultAfterSync[2]), "Vault accounting did not synchronize");
  assert(ownerBiggiAfter.eq(ownerBiggiBefore), "Owner marketing BIGGI balance changed");
  assert(reserveBiggiAfter.eq(reserveBiggiBefore.sub(tokenAmount).sub(syncTokenAmount)), "Reserve BIGGI balance mismatch");

  const report = {
    createdAt: new Date().toISOString(),
    forkOnly: true,
    sendsMainnetTransactions: false,
    owner,
    pair: A.PAIR,
    lpRecipient: A.LIQUIDITY_VAULT,
    seed: {
      biggi: ethers.utils.formatEther(tokenAmount),
      pol: ethers.utils.formatEther(nativeAmount),
      pricePolPerBiggi: "0.000625",
      biggiPerPol: "1600",
      vaultRealLp: vaultAfterSeed[2].toString(),
      vaultAccountedLpBeforeSync: vaultAfterSeed[1].toString(),
    },
    postSeedSync: {
      biggi: ethers.utils.formatEther(syncTokenAmount),
      pol: ethers.utils.formatEther(syncNativeAmount),
      pairBiggi: ethers.utils.formatEther(reserveBiggiAfterSync),
      pairPol: ethers.utils.formatEther(reservePolAfterSync),
      vaultAccountedLp: vaultAfterSync[1].toString(),
      vaultRealLp: vaultAfterSync[2].toString(),
    },
    checks: {
      pairStartedEmpty: true,
      lpMintedDirectlyToVault: true,
      vaultAccountingSynchronized: true,
      ownerMarketingBalancePreserved: true,
      routerAllowanceCleared: (await token.allowance(owner, A.ROUTER)).isZero(),
    },
  };

  const reportFile = path.resolve(root, "reports/initial-liquidity-fork-rehearsal.json");
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, report: reportFile, checks: report.checks }, null, 2));

  await ethers.provider.send("hardhat_stopImpersonatingAccount", [owner]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
