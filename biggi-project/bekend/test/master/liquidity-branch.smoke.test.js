const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

async function deployLiquidityStack() {
  const [owner] = await ethers.getSigners();

  const token = await deploy("BiggiToken", owner.address);
  const reserve = await deploy("BiggiReserveV4", token.address, owner.address);
  const vault = await deploy("LiquidityVault", owner.address);
  const drip = await deploy("BiggiDripDistributor", token.address, owner.address);
  const nftMain = await deploy("MockBlockNft");
  const nftMain2 = await deploy("MockBlockNft");
  const rewards = await deploy(
    "BiggiTokenRewards",
    nftMain.address,
    nftMain2.address,
    token.address,
    owner.address
  );

  const weth = await deploy("MockERC20", "Wrapped Native", "WNATIVE", 18);
  const lpToken = await deploy("MockLpToken");
  const router = await deploy("MockLiquidityRouter", weth.address, lpToken.address);
  const factory = await deploy("MockLiquidityFactory");
  await (await factory.setPair(lpToken.address)).wait();
  await (await lpToken.setPairTokens(token.address, weth.address)).wait();
  await (await lpToken.setReserves(toWei("1000"), toWei("1000"))).wait();

  const lm = await deploy(
    "BiggiLiquidityManager",
    token.address,
    router.address,
    vault.address,
    owner.address,
    reserve.address
  );
  const orchestrator = await deploy(
    "BiggiLiquidityOrchestrator",
    reserve.address,
    lm.address,
    owner.address
  );
  const keeperProxy = await deploy(
    "BiggiLiquidityKeeperProxy",
    orchestrator.address,
    reserve.address,
    owner.address
  );
  const automation = await deploy(
    "LiquidityAutomation",
    lm.address,
    token.address,
    toWei("0.5"),
    toWei("2"),
    1,
    owner.address
  );

  // Token + reserve wiring.
  await (await token.setReserve(reserve.address)).wait();
  await (await token.setDripDistributor(drip.address)).wait();
  await (await token.setTokenRewards(rewards.address)).wait();
  await (await token.setMarketingSupport(owner.address)).wait();
  await (await drip.setTreasury(owner.address)).wait();
  await (await token.initialDistribute()).wait();

  await (await reserve.setLiquidityManager(lm.address)).wait();
  await (await reserve.ownerTopUpDexRefill(toWei("100"))).wait();
  await owner.sendTransaction({ to: reserve.address, value: toWei("10") });

  // Liquidity branch wiring.
  await (await vault.setLiquidityManager(lm.address)).wait();
  await (await vault.addWhitelistedPair(lpToken.address)).wait();

  await (await lm.setFactory(factory.address)).wait();
  await (await lm.setTokenPct(100)).wait();
  await (await lm.setSlippageBps(0)).wait();
  await (await lm.setTxDeadlineSec(3600)).wait();
  await (await lm.setKeeper(orchestrator.address)).wait();

  await (await orchestrator.setLimits(toWei("0.1"), toWei("5"), toWei("1"), 0, 0)).wait();

  return {
    owner,
    token,
    reserve,
    vault,
    drip,
    rewards,
    lm,
    orchestrator,
    keeperProxy,
    automation,
    lpToken,
  };
}

describe("BIGGI_MASTER: liquidity branch smoke", function () {
  it("orchestrator triggers pairing and syncs LP balance in vault", async () => {
    const { reserve, vault, orchestrator, lpToken } = await deployLiquidityStack();

    const beforePol = await reserve.polBalance();
    const beforeDexRefill = await reserve.dexRefillBiggi();

    await (await orchestrator.triggerPairing(toWei("1"))).wait();

    const afterPol = await reserve.polBalance();
    const afterDexRefill = await reserve.dexRefillBiggi();
    const vaultLp = await vault.lpBalanceOf(lpToken.address);
    const vaultLpReal = await lpToken.balanceOf(vault.address);

    expect(afterPol).to.be.lt(beforePol);
    expect(afterDexRefill).to.be.lt(beforeDexRefill);
    expect(vaultLp).to.be.gt(0);
    expect(vaultLp).to.equal(vaultLpReal);
  });

  it("keeper proxy checkUpkeep/performUpkeep executes pairing", async () => {
    const { reserve, orchestrator, keeperProxy } = await deployLiquidityStack();

    await (await orchestrator.setKeeper(keeperProxy.address)).wait();
    await (await keeperProxy.setStrategy(0, toWei("0.5"), 500)).wait(); // FIXED
    await (await keeperProxy.setLimits(0, toWei("0.1"), toWei("2"), toWei("1"))).wait();

    const [needed, data] = await keeperProxy.checkUpkeep("0x");
    expect(needed).to.equal(true);

    const beforePol = await reserve.polBalance();
    await (await keeperProxy.performUpkeep(data)).wait();
    const afterPol = await reserve.polBalance();

    expect(await keeperProxy.lastPerformTs()).to.be.gt(0);
    expect(afterPol).to.be.lt(beforePol);
  });

  it("liquidity automation performs upkeep when set as LM keeper", async () => {
    const { reserve, lm, automation } = await deployLiquidityStack();

    await (await lm.setKeeper(automation.address)).wait();

    const [needed, data] = await automation.checkUpkeep("0x");
    expect(needed).to.equal(true);

    const beforePol = await reserve.polBalance();
    await (await automation.performUpkeep(data)).wait();
    const afterPol = await reserve.polBalance();

    expect(await automation.lastUpkeepTime()).to.be.gt(0);
    expect(afterPol).to.be.lt(beforePol);
  });
});
