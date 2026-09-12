const { expect } = require("chai");
const { ethers } = require("hardhat");
const { nftRewardsVersion } = require("../../scripts/master/nftRewardsVersion");

describe("NFT rewards wiring version detection", function () {
  it("distinguishes V1, V2 and missing contract code", async () => {
    const [owner] = await ethers.getSigners();
    const v1 = await (await ethers.getContractFactory("BiggiNFTRewards")).deploy(owner.address);
    const router = await (await ethers.getContractFactory("MockRewardVrfRouterV2")).deploy();
    const v2 = await (await ethers.getContractFactory("BiggiNFTRewardsV2")).deploy(owner.address, router.address);
    await v1.deployed(); await v2.deployed();
    expect(await nftRewardsVersion(v1.address)).to.equal(1);
    expect(await nftRewardsVersion(v2.address)).to.equal(2);
    let failed = false;
    try { await nftRewardsVersion(owner.address); } catch { failed = true; }
    expect(failed).to.equal(true);
  });

  it("does not interpret an RPC outage as a legacy contract", async () => {
    const provider = { _isProvider: true, resolveName: async (v) => v, call: async () => { throw Object.assign(new Error("RPC unavailable"), { code: "SERVER_ERROR" }); } };
    let code;
    try { await nftRewardsVersion("0x1111111111111111111111111111111111111111", provider); } catch (error) { code = error.code; }
    expect(code).to.equal("SERVER_ERROR");
  });
});
