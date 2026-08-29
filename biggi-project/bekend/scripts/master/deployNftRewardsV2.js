const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ZERO = ethers.constants.AddressZero;
const EXECUTE = process.env.NFT_REWARDS_V2_DEPLOY_EXECUTE === "1";
const CONFIRMATION = "DEPLOY_NFT_REWARDS_V2";
const CONFIRMATIONS = Number(process.env.TX_CONFIRMATIONS || 1);
const REPORT_NAME = EXECUTE
  ? "nft-rewards-v2-deployment-polygon.json"
  : "nft-rewards-v2-preflight-polygon.json";

function requireAddress(name, value) {
  if (!value || !ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${name} is missing or invalid`);
  }
  return ethers.utils.getAddress(value);
}

function loadAddresses() {
  const configured = process.env.MASTER_ADDRESSES_FILE || "addresses.master.json";
  const file = path.resolve(__dirname, "../..", configured);
  if (!fs.existsSync(file)) throw new Error(`Address file not found: ${file}`);
  return { file, values: JSON.parse(fs.readFileSync(file, "utf8")) };
}

async function requireCode(name, address) {
  const code = await ethers.provider.getCode(address);
  if (!code || code === "0x") throw new Error(`${name} has no deployed code: ${address}`);
  return (code.length - 2) / 2;
}

function writeReport(report) {
  const file = path.resolve(__dirname, "../../reports", REPORT_NAME);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${file}`);
  return file;
}

async function waitFor(tx, label, report) {
  const receipt = await tx.wait(CONFIRMATIONS);
  report.transactions.push({
    label,
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  });
  console.log(`${label}: ${tx.hash}`);
  return receipt;
}

async function main() {
  const existingExecutionReport = path.resolve(
    __dirname,
    "../../reports/nft-rewards-v2-deployment-polygon.json",
  );
  if (EXECUTE && fs.existsSync(existingExecutionReport)) {
    const previous = JSON.parse(fs.readFileSync(existingExecutionReport, "utf8"));
    if (previous.nftRewardsV2 || previous.nftRewardsReaderV2) {
      throw new Error(
        `Existing V2 deployment state found in ${existingExecutionReport}; inspect it before any retry`,
      );
    }
  }

  const { file: addressesFile, values: addresses } = loadAddresses();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137) {
    throw new Error(`Expected Polygon chainId 137, got ${chain.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const expectedDeployer = requireAddress(
    "DEPLOYER",
    process.env.DEPLOYER || addresses.deployer || addresses.DEPLOYER,
  );
  if (deployer.address.toLowerCase() !== expectedDeployer.toLowerCase()) {
    throw new Error(`Signer ${deployer.address} is not expected deployer ${expectedDeployer}`);
  }

  const finalOwner = requireAddress(
    "EXPECT_OWNER/OWNER",
    process.env.EXPECT_OWNER || addresses.EXPECT_OWNER || process.env.OWNER || addresses.OWNER,
  );
  const oldRewardsAddress = requireAddress("NFT_REWARDS", addresses.NFT_REWARDS);
  const oldReaderAddress = requireAddress(
    "NFT_REWARDS_READER",
    addresses.NFT_REWARDS_READER,
  );
  const vrfRouterAddress = requireAddress("VRF_ROUTER", addresses.VRF_ROUTER);

  const codeBytes = {};
  for (const [name, address] of Object.entries({
    NFT_REWARDS_V1: oldRewardsAddress,
    NFT_REWARDS_READER_V1: oldReaderAddress,
    VRF_ROUTER: vrfRouterAddress,
  })) {
    codeBytes[name] = await requireCode(name, address);
  }

  const oldRewards = new ethers.Contract(
    oldRewardsAddress,
    [
      "function owner() view returns(address)",
      "function nextEventId() view returns(uint256)",
      "function nextRewardId() view returns(uint256)",
    ],
    ethers.provider,
  );
  const oldReader = new ethers.Contract(
    oldReaderAddress,
    ["function nftRewards() view returns(address)"],
    ethers.provider,
  );
  const vrfRouter = new ethers.Contract(
    vrfRouterAddress,
    [
      "function owner() view returns(address)",
      "function approvedRewardConsumers(address) view returns(bool)",
      "function setRewardConsumerApproval(address,bool)",
    ],
    ethers.provider,
  );

  const [
    oldOwner,
    nextEventId,
    nextRewardId,
    oldReaderTarget,
    oldNativeBalance,
    routerOwner,
    oldConsumerApproved,
    blockNumber,
  ] = await Promise.all([
    oldRewards.owner(),
    oldRewards.nextEventId(),
    oldRewards.nextRewardId(),
    oldReader.nftRewards(),
    ethers.provider.getBalance(oldRewardsAddress),
    vrfRouter.owner(),
    vrfRouter.approvedRewardConsumers(oldRewardsAddress),
    ethers.provider.getBlockNumber(),
  ]);

  if (oldOwner.toLowerCase() !== finalOwner.toLowerCase()) {
    throw new Error(`NFT Rewards V1 owner ${oldOwner} does not match ${finalOwner}`);
  }
  if (routerOwner.toLowerCase() !== finalOwner.toLowerCase()) {
    throw new Error(`VRF router owner ${routerOwner} does not match ${finalOwner}`);
  }
  if (oldReaderTarget.toLowerCase() !== oldRewardsAddress.toLowerCase()) {
    throw new Error(`NFT Rewards reader targets unexpected contract ${oldReaderTarget}`);
  }
  if (!nextEventId.eq(1) || !nextRewardId.eq(1) || !oldNativeBalance.eq(0)) {
    throw new Error(
      `V1 is not pristine: nextEventId=${nextEventId}, nextRewardId=${nextRewardId}, POL=${oldNativeBalance}`,
    );
  }
  if (!oldConsumerApproved) {
    throw new Error("NFT Rewards V1 is not an approved VRF reward consumer");
  }

  let ownerSigner = null;
  if (EXECUTE) {
    const ownerPrivateKey = String(process.env.OWNER_PRIVATE_KEY || "").trim();
    if (!ownerPrivateKey) {
      throw new Error("OWNER_PRIVATE_KEY is required before execution");
    }
    ownerSigner = new ethers.Wallet(ownerPrivateKey, ethers.provider);
    if (ownerSigner.address.toLowerCase() !== finalOwner.toLowerCase()) {
      throw new Error(
        `OWNER_PRIVATE_KEY resolves to ${ownerSigner.address}, expected ${finalOwner}`,
      );
    }
    if (process.env.NFT_REWARDS_V2_DEPLOY_CONFIRM !== CONFIRMATION) {
      throw new Error(`Set NFT_REWARDS_V2_DEPLOY_CONFIRM=${CONFIRMATION} to execute`);
    }
  }

  const V2 = await ethers.getContractFactory("BiggiNFTRewardsV2", deployer);
  const Reader = await ethers.getContractFactory("BiggiNftRewardsReader", deployer);
  const deployerNonce = await ethers.provider.getTransactionCount(
    deployer.address,
    "pending",
  );
  const predictedRewards = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: deployerNonce,
  });
  const predictedReader = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: deployerNonce + 1,
  });
  const rewardsDeployTx = V2.getDeployTransaction(finalOwner, vrfRouterAddress);
  const readerDeployTx = Reader.getDeployTransaction(predictedRewards);
  const approvalData = vrfRouter.interface.encodeFunctionData(
    "setRewardConsumerApproval",
    [predictedRewards, true],
  );

  const [
    rewardsDeployGas,
    readerDeployGas,
    approvalGas,
    gasPrice,
    deployerBalance,
    ownerBalance,
  ] = await Promise.all([
    ethers.provider.estimateGas({ ...rewardsDeployTx, from: deployer.address }),
    ethers.provider.estimateGas({ ...readerDeployTx, from: deployer.address }),
    ethers.provider.estimateGas({
      from: finalOwner,
      to: vrfRouterAddress,
      data: approvalData,
    }),
    ethers.provider.getGasPrice(),
    ethers.provider.getBalance(deployer.address),
    ethers.provider.getBalance(finalOwner),
  ]);

  const deployerGas = rewardsDeployGas.add(readerDeployGas);
  const deployerRequired = deployerGas.mul(gasPrice).mul(125).div(100);
  const ownerRequired = approvalGas.mul(gasPrice).mul(125).div(100);
  const blockers = [];
  if (deployerBalance.lt(deployerRequired)) {
    blockers.push(
      `Deployer POL balance is too low: ${deployerBalance.toString()} < ${deployerRequired.toString()}`,
    );
  }
  if (ownerBalance.lt(ownerRequired)) {
    blockers.push(
      `Owner POL balance is too low: ${ownerBalance.toString()} < ${ownerRequired.toString()}`,
    );
  }

  const report = {
    mode: EXECUTE ? "execute" : "dry-run",
    createdAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    snapshotBlock: blockNumber,
    addressesFile,
    deployer: deployer.address,
    finalOwner,
    dependencies: {
      nftRewardsV1: oldRewardsAddress,
      nftRewardsReaderV1: oldReaderAddress,
      vrfRouter: vrfRouterAddress,
    },
    v1State: {
      owner: oldOwner,
      nextEventId: nextEventId.toString(),
      nextRewardId: nextRewardId.toString(),
      nativeBalanceWei: oldNativeBalance.toString(),
      readerTarget: oldReaderTarget,
      vrfConsumerApproved: oldConsumerApproved,
    },
    codeBytes,
    predicted: {
      nftRewardsV2: predictedRewards,
      nftRewardsReaderV2: predictedReader,
      deployerNonce,
    },
    gas: {
      gasPriceWei: gasPrice.toString(),
      rewardsDeploy: rewardsDeployGas.toString(),
      readerDeploy: readerDeployGas.toString(),
      vrfApproval: approvalGas.toString(),
      deployerRequiredWeiWithBuffer: deployerRequired.toString(),
      ownerRequiredWeiWithBuffer: ownerRequired.toString(),
    },
    balances: {
      deployerWei: deployerBalance.toString(),
      ownerWei: ownerBalance.toString(),
    },
    blockers,
    transactions: [],
    activated: false,
  };

  if (!EXECUTE) {
    writeReport(report);
    if (blockers.length) {
      console.error(`Dry-run blocked:\n- ${blockers.join("\n- ")}`);
      process.exitCode = 2;
    } else {
      console.log("Dry-run passed. No transaction was sent.");
    }
    return;
  }
  if (blockers.length) {
    writeReport(report);
    throw new Error(`Execution blocked:\n- ${blockers.join("\n- ")}`);
  }

  const rewards = await V2.deploy(finalOwner, vrfRouterAddress);
  await waitFor(rewards.deployTransaction, "deploy BiggiNFTRewardsV2", report);
  if (rewards.address.toLowerCase() !== predictedRewards.toLowerCase()) {
    throw new Error(`Unexpected V2 address ${rewards.address}; predicted ${predictedRewards}`);
  }
  report.nftRewardsV2 = rewards.address;
  writeReport(report);

  const reader = await Reader.deploy(rewards.address);
  await waitFor(reader.deployTransaction, "deploy BiggiNftRewardsReader", report);
  if (reader.address.toLowerCase() !== predictedReader.toLowerCase()) {
    throw new Error(`Unexpected reader address ${reader.address}; predicted ${predictedReader}`);
  }
  report.nftRewardsReaderV2 = reader.address;
  writeReport(report);

  const ownerRouter = vrfRouter.connect(ownerSigner);
  await waitFor(
    await ownerRouter.setRewardConsumerApproval(rewards.address, true),
    "approve V2 on BiggiVRFRouter",
    report,
  );
  writeReport(report);

  const [
    deployedCode,
    readerCode,
    deployedOwner,
    deployedRouter,
    deployedNextEventId,
    deployedNextRewardId,
    readerTarget,
    consumerApproved,
  ] = await Promise.all([
    ethers.provider.getCode(rewards.address),
    ethers.provider.getCode(reader.address),
    rewards.owner(),
    rewards.vrfRouter(),
    rewards.nextEventId(),
    rewards.nextRewardId(),
    reader.nftRewards(),
    vrfRouter.approvedRewardConsumers(rewards.address),
  ]);
  if (
    deployedCode === "0x" ||
    readerCode === "0x" ||
    deployedOwner.toLowerCase() !== finalOwner.toLowerCase() ||
    deployedRouter.toLowerCase() !== vrfRouterAddress.toLowerCase() ||
    !deployedNextEventId.eq(1) ||
    !deployedNextRewardId.eq(1) ||
    readerTarget.toLowerCase() !== rewards.address.toLowerCase() ||
    !consumerApproved
  ) {
    throw new Error("NFT Rewards V2 post-deployment verification failed");
  }

  report.postDeployment = {
    owner: deployedOwner,
    vrfRouter: deployedRouter,
    nextEventId: deployedNextEventId.toString(),
    nextRewardId: deployedNextRewardId.toString(),
    readerTarget,
    vrfConsumerApproved: consumerApproved,
    nftRewardsCodeBytes: (deployedCode.length - 2) / 2,
    readerCodeBytes: (readerCode.length - 2) / 2,
  };
  writeReport(report);
  console.log("V2 is deployed and VRF-approved, but production addresses were not switched.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
