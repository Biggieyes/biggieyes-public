const { expect } = require("chai");
const { ethers } = require("ethers");
const addresses = require("../../addresses.json");

const RPC_URL =
  process.env.POLYGON_RPC_URL || process.env.RPC_URL || process.env.FORK_URL;

const maybeDescribe = RPC_URL ? describe : describe.skip;

const isAddress = (value) =>
  typeof value === "string" &&
  /^0x[0-9a-fA-F]{40}$/.test(value) &&
  value !== "0x0000000000000000000000000000000000000000";

const tokenReaderAbi = [
  "function getStatus() view returns (tuple(address tokenRewards,address token,address main,address main2,uint256 unitReward,uint8[11] blockWeights,uint256 rewardsCap,uint256 rewardsMinted,uint256 rewardsCapRemaining,uint256 tokenRemainingMintable,uint256 rewardBalance,uint256 totalDistributed,uint256 distributedThisWeek,uint256 lastWeekDistributed,uint64 currentWeek,uint64 lastRecordedWeek) s, tuple(string name_, string symbol_, uint8 decimals_) meta)",
];

const nftReaderAbi = [
  "function getStatus() view returns (tuple(address nftRewards,address main,address vrfRouter,address owner,uint256 nextEventId,uint256 nextRewardId,uint256 totalRewardsCreated,string name,string symbol) s)",
];

maybeDescribe("Rewards readers (integration smoke)", function () {
  this.timeout(200000);

  let provider;

  before(() => {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  });

  it("TokenRewardsReader returns sane status", async () => {
    const readerAddr = addresses.TOKEN_REWARDS_READER;
    expect(isAddress(readerAddr)).to.equal(true);

    const contract = new ethers.Contract(readerAddr, tokenReaderAbi, provider);
    const res = await contract.getStatus();
    const status = res?.s || res?.[0];
    const meta = res?.meta || res?.[1];

    expect(isAddress(status.tokenRewards)).to.equal(true);
    expect(isAddress(status.token)).to.equal(true);
    expect(status.rewardsMinted.lte(status.rewardsCap)).to.equal(true);
    expect(status.rewardsCapRemaining.add(status.rewardsMinted).gte(status.rewardsCap)).to.equal(true);
    expect(meta.symbol_).to.not.equal("");
  });

  it("NftRewardsReader returns sane status", async () => {
    const readerAddr = addresses.NFT_REWARDS_READER;
    expect(isAddress(readerAddr)).to.equal(true);

    const contract = new ethers.Contract(readerAddr, nftReaderAbi, provider);
    const status = await contract.getStatus();

    expect(isAddress(status.nftRewards)).to.equal(true);
    expect(isAddress(status.owner)).to.equal(true);
    expect(status.nextRewardId.gte(0)).to.equal(true);
  });
});
