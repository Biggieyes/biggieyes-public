const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const { ethers } = require("ethers");

const SITE_ID = "dac321e9-74ae-4e07-b765-33be002cc7e8";
const LEGACY = "0x939Df533b80943298E15ad4c8F188102954f34FF";

async function main() {
  const execute = process.argv.includes("--execute");
  assert(process.argv.slice(2).every((arg) => ["--execute", "--dry-run"].includes(arg)));
  const root = path.resolve(__dirname, "../..");
  const env = require("dotenv").parse(fs.readFileSync(path.join(root, ".env.core.polygon")));
  const addresses = JSON.parse(fs.readFileSync(path.join(root, "addresses.master.json")));
  const deploymentFile = path.join(root, "reports/nft-rewards-v2-deployment-polygon.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentFile));
  const publication = JSON.parse(fs.readFileSync(path.join(root, "../../reports/nft-rewards-v2-publication.json")));
  const same = (a, b) => assert.equal(a.toLowerCase(), b.toLowerCase());
  same(deployment.dependencies.nftRewardsV1, LEGACY);
  same(addresses.NFT_REWARDS, deployment.nftRewardsV2);
  same(addresses.NFT_REWARDS_READER, deployment.nftRewardsReaderV2);
  assert.equal(publication.siteId, SITE_ID);
  assert.equal(publication.domain, "biggieyes.com");
  assert.equal(publication.published, true);
  assert.equal(publication.publicVerification?.passed, true);
  same(publication.publicVerification.contract, addresses.NFT_REWARDS);
  same(publication.publicVerification.reader, addresses.NFT_REWARDS_READER);
  const age = Date.now() - Date.parse(publication.publicVerification.checkedAt);
  assert(Number.isFinite(age) && age >= 0 && age < 60 * 60 * 1000, "Public UI verification must be recent");

  const response = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}`, {
    headers: { Authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}` }, signal: AbortSignal.timeout(20000),
  });
  assert(response.ok, "Netlify site verification failed");
  const site = await response.json();
  assert.equal(site.custom_domain, "biggieyes.com");
  assert.equal(site.published_deploy?.id, publication.deployId, "Another frontend deploy is published");
  const page = await fetch("https://biggieyes.com/app/", { cache: "no-store", signal: AbortSignal.timeout(20000) });
  assert(page.ok && (await page.text()).includes(publication.entry), "Public app build mismatch");

  const provider = new ethers.providers.JsonRpcProvider({ url: env.POLYGON_RPC_URL, timeout: 20000 });
  assert.equal((await provider.getNetwork()).chainId, 137);
  const signer = new ethers.Wallet(env.OWNER_PRIVATE_KEY.trim(), provider);
  same(signer.address, deployment.finalOwner);
  const nft = new ethers.Contract(addresses.NFT_REWARDS, [
    "function owner() view returns(address)", "function vrfRouter() view returns(address)",
    "function usedVrfRequestIds(uint256) view returns(bool)",
  ], provider);
  const reader = new ethers.Contract(addresses.NFT_REWARDS_READER, ["function nftRewards() view returns(address)"], provider);
  const config = new ethers.Contract(addresses.MASTER_CONFIG, ["function rewardsBundle() view returns(address,address,address,address)"], provider);
  const old = new ethers.Contract(LEGACY, [
    "function owner() view returns(address)", "function nextEventId() view returns(uint256)",
    "function nextRewardId() view returns(uint256)",
  ], provider);
  const router = new ethers.Contract(addresses.VRF_ROUTER, [
    "function owner() view returns(address)", "function approvedRewardConsumers(address) view returns(bool)",
    "function setRewardConsumerApproval(address,bool)",
  ], signer);
  same(await router.owner(), signer.address);
  same(await old.owner(), signer.address);
  same(await nft.owner(), signer.address);
  same(await nft.vrfRouter(), router.address);
  same(await reader.nftRewards(), nft.address);
  same((await config.rewardsBundle())[2], nft.address);
  assert.equal(await nft.usedVrfRequestIds(0), false);
  assert(await router.approvedRewardConsumers(nft.address), "V2 must stay approved");
  // No legacy events means there can be no pending legacy mystery draw to strand.
  assert((await old.nextEventId()).eq(1) && (await old.nextRewardId()).eq(1), "V1 has reward records; review before retirement");
  assert((await provider.getBalance(LEGACY)).isZero(), "V1 holds POL; review before retirement");
  let oldApproved = await router.approvedRewardConsumers(LEGACY);
  if (oldApproved) {
    const gasLimit = (await router.estimateGas.setRewardConsumerApproval(LEGACY, false)).mul(120).div(100);
    const quoted = (await provider.getGasPrice()).mul(120).div(100);
    const minimum = ethers.utils.parseUnits("25", "gwei");
    const gasPrice = quoted.gt(minimum) ? quoted : minimum;
    const maxFee = gasLimit.mul(gasPrice);
    assert(maxFee.lte(ethers.utils.parseEther("0.1")), "Fee exceeds retirement safety ceiling");
    assert((await signer.getBalance()).gte(maxFee), "Insufficient owner POL");
    assert.equal(await signer.getTransactionCount("pending"), await signer.getTransactionCount("latest"), "Owner has pending transactions");
    console.log("Preflight passed: retire V1 only; V2 approved. Maximum fee POL:", ethers.utils.formatEther(maxFee));
    if (!execute) return;
    assert.equal(process.env.NFT_REWARDS_V1_RETIRE_CONFIRM, "RETIRE_NFT_REWARDS_V1");
    const tx = await router.setRewardConsumerApproval(LEGACY, false, { gasLimit, gasPrice, type: 0 });
    console.log("V1 approval retirement transaction:", tx.hash);
    const receipt = await tx.wait(2);
    assert.equal(receipt.status, 1);
    deployment.transactions.push({ label: "revoke legacy V1 reward-consumer approval", hash: tx.hash,
      blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(),
      feePOL: ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice)) });
    oldApproved = await router.approvedRewardConsumers(LEGACY);
  }
  assert.equal(oldApproved, false);
  assert.equal(await router.approvedRewardConsumers(nft.address), true);
  if (execute) {
    deployment.activated = true;
    deployment.frontendPublished = true;
    deployment.activationNote = "Public V2 frontend verified; legacy V1 reward-consumer approval revoked. V2 approval retained.";
    deployment.activatedAt = new Date().toISOString();
    deployment.netlifyDeployId = publication.deployId;
    deployment.legacyRetirement = { address: LEGACY, approved: false, v2Approved: true, checkedAt: new Date().toISOString() };
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2) + "\n");
  }
  console.log(JSON.stringify({ chainId: 137, v1Approved: false, v2Approved: true, frontendDeployId: publication.deployId }));
}

main().catch((error) => {
  console.error(error.code || error.name, "V1 retirement stopped; sensitive error details omitted. Recheck publication and on-chain state before retry.");
  process.exitCode = 1;
});
