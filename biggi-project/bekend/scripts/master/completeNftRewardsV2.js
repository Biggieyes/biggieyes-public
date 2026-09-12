const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

async function main() {
  const execute = process.argv.includes("--execute");
  if (process.argv.slice(2).some((arg) => !["--execute", "--dry-run"].includes(arg))) {
    throw new Error("Unknown argument");
  }
  const root = path.resolve(__dirname, "../..");
  const env = dotenv.parse(fs.readFileSync(path.join(root, ".env.core.polygon")));
  const file = path.join(root, "reports/nft-rewards-v2-deployment-polygon.json");
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const addresses = JSON.parse(fs.readFileSync(path.join(root, "addresses.master.json"), "utf8"));
  const provider = new ethers.providers.JsonRpcProvider({ url: env.POLYGON_RPC_URL, timeout: 20000 });
  assert.equal((await provider.getNetwork()).chainId, 137);
  const owner = new ethers.Wallet(env.OWNER_PRIVATE_KEY.trim(), provider);
  const equalAddress = (actual, expected) => assert.equal(actual.toLowerCase(), expected.toLowerCase());
  equalAddress(owner.address, report.finalOwner);
  equalAddress(owner.address, env.EXPECT_OWNER || addresses.EXPECT_OWNER || addresses.OWNER);
  equalAddress(report.dependencies.vrfRouter, addresses.VRF_ROUTER);
  const rewards = new ethers.Contract(report.nftRewardsV2, [
    "function owner() view returns(address)", "function vrfRouter() view returns(address)",
    "function nextEventId() view returns(uint256)", "function nextRewardId() view returns(uint256)",
  ], provider);
  const reader = new ethers.Contract(report.nftRewardsReaderV2, ["function nftRewards() view returns(address)"], provider);
  const router = new ethers.Contract(addresses.VRF_ROUTER, [
    "function owner() view returns(address)", "function approvedRewardConsumers(address) view returns(bool)",
    "function setRewardConsumerApproval(address,bool)",
  ], owner);
  for (const [label, address] of [["deploy BiggiNFTRewardsV2", rewards.address], ["deploy BiggiNftRewardsReader", reader.address]]) {
    const tx = report.transactions.find((item) => item.label === label);
    assert(tx, "Missing deployment transaction");
    const receipt = await provider.getTransactionReceipt(tx.hash);
    assert.equal(receipt.status, 1);
    equalAddress(receipt.contractAddress, address);
    assert.notEqual(await provider.getCode(address), "0x");
  }
  equalAddress(await rewards.owner(), owner.address);
  equalAddress(await rewards.vrfRouter(), router.address);
  equalAddress(await router.owner(), owner.address);
  equalAddress(await reader.nftRewards(), rewards.address);
  assert((await rewards.nextEventId()).eq(1) && (await rewards.nextRewardId()).eq(1), "V2 is not pristine");
  const old = new ethers.Contract(report.dependencies.nftRewardsV1, rewards.interface, provider);
  assert((await old.nextEventId()).eq(1) && (await old.nextRewardId()).eq(1), "V1 has rewards; review migration");
  assert((await provider.getBalance(old.address)).isZero(), "V1 has POL; review migration");
  let approved = await router.approvedRewardConsumers(rewards.address);
  if (!approved) {
    const gasLimit = (await router.estimateGas.setRewardConsumerApproval(rewards.address, true)).mul(120).div(100);
    const quoted = (await provider.getGasPrice()).mul(120).div(100);
    const minimum = ethers.utils.parseUnits("25", "gwei");
    const gasPrice = quoted.gt(minimum) ? quoted : minimum;
    assert((await owner.getBalance()).gte(gasLimit.mul(gasPrice)), "Insufficient owner POL");
    assert.equal(await owner.getTransactionCount("pending"), await owner.getTransactionCount("latest"), "Owner has pending transactions");
    console.log("Approval fee ceiling POL:", ethers.utils.formatEther(gasLimit.mul(gasPrice)));
    if (!execute) { console.log("Dry-run passed; no transaction sent."); return; }
    assert.equal(process.env.NFT_REWARDS_V2_DEPLOY_CONFIRM, "DEPLOY_NFT_REWARDS_V2");
    const tx = await router.setRewardConsumerApproval(rewards.address, true, { gasPrice, gasLimit, type: 0 });
    console.log("VRF approval transaction:", tx.hash);
    const receipt = await tx.wait(2);
    assert.equal(receipt.status, 1);
    report.transactions.push({ label: "approve V2 on BiggiVRFRouter", hash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() });
    approved = await router.approvedRewardConsumers(rewards.address);
    assert(approved);
  }
  report.postDeployment = {
    owner: await rewards.owner(), vrfRouter: await rewards.vrfRouter(),
    nextEventId: String(await rewards.nextEventId()), nextRewardId: String(await rewards.nextRewardId()),
    readerTarget: await reader.nftRewards(), vrfConsumerApproved: approved,
    nftRewardsCodeBytes: ((await provider.getCode(rewards.address)).length - 2) / 2,
    readerCodeBytes: ((await provider.getCode(reader.address)).length - 2) / 2,
  };
  report.completedAt = new Date().toISOString();
  if (execute) fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  console.log("V2 deployment and VRF approval verified. No production addresses changed.");
}

main().catch((error) => {
  console.error(error.code || error.name, error.reason || "Completion failed; inspect on-chain state before retry.");
  process.exitCode = 1;
});
