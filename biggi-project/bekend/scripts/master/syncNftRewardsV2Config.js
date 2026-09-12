const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const { ethers } = require("ethers");

async function main() {
  const execute = process.argv.includes("--execute");
  assert(process.argv.slice(2).every((arg) => ["--execute", "--dry-run"].includes(arg)));
  const root = path.resolve(__dirname, "../..");
  const env = require("dotenv").parse(fs.readFileSync(path.join(root, ".env.core.polygon")));
  const addresses = JSON.parse(fs.readFileSync(path.join(root, "addresses.master.json")));
  const file = path.join(root, "reports/nft-rewards-v2-deployment-polygon.json");
  const report = JSON.parse(fs.readFileSync(file));
  const provider = new ethers.providers.JsonRpcProvider({ url: env.POLYGON_RPC_URL, timeout: 20000 });
  assert.equal((await provider.getNetwork()).chainId, 137);
  const signer = new ethers.Wallet(env.OWNER_PRIVATE_KEY.trim(), provider);
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const config = new ethers.Contract(addresses.MASTER_CONFIG, [
    "function owner() view returns(address)",
    "function rewardsBundle() view returns(address,address,address,address)",
    "function setRewards(address,address,address,address)",
  ], signer);
  assert(same(await config.owner(), signer.address) && same(signer.address, report.finalOwner));
  assert(same(addresses.NFT_REWARDS, report.nftRewardsV2));
  const rewards = new ethers.Contract(report.nftRewardsV2, ["function vrfRouter() view returns(address)"], provider);
  assert(same(await rewards.vrfRouter(), addresses.VRF_ROUTER));
  const router = new ethers.Contract(addresses.VRF_ROUTER, ["function approvedRewardConsumers(address) view returns(bool)"], provider);
  assert(await router.approvedRewardConsumers(rewards.address));
  const before = [...await config.rewardsBundle()];
  assert(same(before[2], report.dependencies.nftRewardsV1) || same(before[2], rewards.address), "Unexpected current NFT rewards");
  const after = [...before];
  after[2] = rewards.address;
  if (!same(before[2], after[2])) {
    const gasLimit = (await config.estimateGas.setRewards(...after)).mul(120).div(100);
    const quoted = (await provider.getGasPrice()).mul(120).div(100);
    const minimum = ethers.utils.parseUnits("25", "gwei");
    const gasPrice = quoted.gt(minimum) ? quoted : minimum;
    assert((await signer.getBalance()).gte(gasLimit.mul(gasPrice)));
    assert.equal(await signer.getTransactionCount("pending"), await signer.getTransactionCount("latest"));
    console.log("Only MASTER_CONFIG.rewards.nftRewards changes:", before[2], "->", after[2]);
    console.log("Maximum fee POL:", ethers.utils.formatEther(gasLimit.mul(gasPrice)));
    if (!execute) return;
    assert.equal(process.env.NFT_REWARDS_V2_DEPLOY_CONFIRM, "DEPLOY_NFT_REWARDS_V2");
    assert.deepEqual([...await config.rewardsBundle()], before, "Bundle changed during preflight");
    const tx = await config.setRewards(...after, { gasLimit, gasPrice, type: 0 });
    console.log("Configuration transaction:", tx.hash);
    const receipt = await tx.wait(2);
    assert.equal(receipt.status, 1);
    report.transactions.push({ label: "update NFT rewards in MasterConfig", hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() });
    report.masterConfig = { address: config.address, before, after, updatedAt: new Date().toISOString() };
  }
  assert.deepEqual([...await config.rewardsBundle()], after);
  if (execute) fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  console.log("MasterConfig NFT rewards target verified; other bundle addresses unchanged.");
}

main().catch((error) => {
  console.error(error.code || error.name, "NFT configuration update failed; inspect on-chain state before retry.");
  process.exitCode = 1;
});
