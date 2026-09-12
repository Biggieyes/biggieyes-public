const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const { ethers } = require("ethers");

async function main() {
  const root = path.resolve(__dirname, "../..");
  const env = require("dotenv").parse(fs.readFileSync(path.join(root, ".env.core.polygon")));
  const addresses = JSON.parse(fs.readFileSync(path.join(root, "addresses.master.json")));
  const deployment = JSON.parse(fs.readFileSync(path.join(root, "reports/nft-rewards-v2-deployment-polygon.json")));
  const abiRoot = path.join(root, "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI");
  const abi = (name) => JSON.parse(fs.readFileSync(path.join(abiRoot, `${name}.abi.json`)));
  const provider = new ethers.providers.JsonRpcProvider({ url: env.POLYGON_RPC_URL, timeout: 20000 });
  assert.equal((await provider.getNetwork()).chainId, 137);
  const blockTag = await provider.getBlockNumber();
  const overrides = { blockTag };
  const same = (a, b) => assert.equal(a.toLowerCase(), b.toLowerCase());
  same(addresses.NFT_REWARDS, deployment.nftRewardsV2);
  same(addresses.NFT_REWARDS_READER, deployment.nftRewardsReaderV2);
  const nft = new ethers.Contract(addresses.NFT_REWARDS, abi("BiggiNFTRewardsV2"), provider);
  const reader = new ethers.Contract(addresses.NFT_REWARDS_READER, abi("BiggiNftRewardsReader"), provider);
  const router = new ethers.Contract(addresses.VRF_ROUTER, ["function approvedRewardConsumers(address) view returns(bool)"], provider);
  const config = new ethers.Contract(addresses.MASTER_CONFIG, ["function rewardsBundle() view returns(address,address,address,address)"], provider);
  const status = await reader.getStatus(overrides);
  same(status.nftRewards, nft.address);
  same(await reader.nftRewards(overrides), nft.address);
  same(status.owner, await nft.owner(overrides));
  same(status.owner, deployment.finalOwner);
  same(status.vrfRouter, await nft.vrfRouter(overrides));
  same(status.vrfRouter, addresses.VRF_ROUTER);
  assert.equal(status.main, ethers.constants.AddressZero);
  assert.equal(status.registry, ethers.constants.AddressZero);
  assert.equal(await nft.usedVrfRequestIds(0, overrides), false);
  const approved = await router.approvedRewardConsumers(nft.address, overrides);
  assert(approved);
  const bundle = [...await config.rewardsBundle(overrides)];
  same(bundle[2], nft.address);
  if (deployment.masterConfig) assert.deepEqual(bundle, deployment.masterConfig.after);
  assert(status.nextEventId.eq(await nft.nextEventId(overrides)));
  assert(status.nextRewardId.eq(await nft.nextRewardId(overrides)));
  assert.equal(status.name, await nft.name(overrides));
  assert.equal(status.symbol, await nft.symbol(overrides));
  const receipts = [];
  for (const tx of deployment.transactions) {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    assert.equal(receipt.status, 1);
    receipts.push({ label: tx.label, hash: tx.hash, blockNumber: receipt.blockNumber,
      feePOL: ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)) });
  }
  const report = {
    checkedAt: new Date().toISOString(), chainId: 137, blockNumber: blockTag, passed: true,
    contract: nft.address, reader: reader.address, owner: status.owner, vrfRouter: status.vrfRouter,
    vrfConsumerApproved: approved, masterConfigNftRewards: bundle[2],
    nextEventId: String(status.nextEventId), nextRewardId: String(status.nextRewardId),
    mysteryRetryDelay: String(await nft.mysteryRetryDelay(overrides)),
    legacyVrfApprovalRetained: await router.approvedRewardConsumers(deployment.dependencies.nftRewardsV1, overrides),
    transactions: receipts, transactionsSentByThisCheck: 0,
  };
  fs.writeFileSync(path.join(root, "reports/nft-rewards-v2-consistency-polygon.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.code || error.name, "NFT Rewards V2 consistency check failed (details omitted to protect RPC credentials).");
  process.exitCode = 1;
});
