const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (v) => ethers.utils.parseEther(v);

async function deploy(name, ...args) {
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.deployed();
  return contract;
}

describe("BIGGI_MASTER: readers smoke", function () {
  it("returns snapshots from liquidity/supply/tokenomics readers without revert", async () => {
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
    const pair = await deploy("MockPairLite", token.address, weth.address);
    await (await pair.setReserves(toWei("1000"), toWei("1000"))).wait();

    const router = await deploy("MockLiquidityRouter", weth.address, ethers.constants.AddressZero);
    const factory = await deploy("MockLiquidityFactory");
    await (await factory.setPair(pair.address)).wait();

    const lm = await deploy(
      "BiggiLiquidityManager",
      token.address,
      router.address,
      vault.address,
      owner.address,
      reserve.address
    );

    await (await token.setReserve(reserve.address)).wait();
    await (await token.setDripDistributor(drip.address)).wait();
    await (await token.setTokenRewards(rewards.address)).wait();
    await (await token.setMarketingSupport(owner.address)).wait();
    await (await drip.setTreasury(owner.address)).wait();
    await (await token.initialDistribute()).wait();

    await (await reserve.setLiquidityManager(lm.address)).wait();
    await (await reserve.ownerTopUpDexRefill(toWei("50"))).wait();
    await owner.sendTransaction({ to: reserve.address, value: toWei("10") });

    await (await vault.setLiquidityManager(lm.address)).wait();
    await (await vault.addWhitelistedPair(pair.address)).wait();

    await (await lm.setFactory(factory.address)).wait();
    await (await lm.setTokenPct(100)).wait();

    const controller = await deploy(
      "BiggiSupplyController",
      owner.address,
      token.address,
      drip.address,
      rewards.address,
      pair.address
    );
    await (await controller.snapshotBaseline()).wait();

    const guard = await deploy(
      "BiggiDexReserveGuard",
      owner.address,
      pair.address,
      token.address,
      weth.address,
      controller.address
    );
    await (await guard.snapshotBaseline()).wait();

    const liqHelperReader = await deploy(
      "BiggiLiquidityHelperReader",
      reserve.address,
      lm.address,
      vault.address,
      router.address
    );
    const liqBranchReader = await deploy(
      "BiggiLiquidityBranchUserReader",
      reserve.address,
      lm.address,
      vault.address
    );
    const supplyReader = await deploy("BiggiSupplyControllerReader", controller.address);
    const guardReader = await deploy("BiggiDexReserveGuardReader", guard.address);
    const tokenomikReader = await deploy(
      "BiggiTokenomikReader",
      token.address,
      router.address,
      pair.address,
      reserve.address,
      reserve.address,
      reserve.address,
      lm.address,
      vault.address,
      drip.address,
      rewards.address
    );

    const [routerAddr, factoryAddr, wethAddr] = await liqHelperReader.routerInfo();
    expect(routerAddr).to.equal(router.address);
    expect(factoryAddr).to.equal(factory.address);
    expect(wethAddr).to.equal(weth.address);
    await liqHelperReader.getSwapPath();
    await liqHelperReader.liquidityPreview(toWei("1"));
    await liqHelperReader.vaultInfo(pair.address);

    const [wiredOk] = await liqBranchReader.wiringSnapshot();
    expect(wiredOk).to.equal(true);
    const [canPairOk] = await liqBranchReader.canPair(toWei("1"), pair.address, toWei("1"));
    expect(canPairOk).to.equal(true);

    const supplyStatus = await supplyReader.getStatus();
    expect(supplyStatus.controller).to.equal(controller.address);
    await guardReader.getStatus();
    await tokenomikReader.getFullStatus();
  });
});
