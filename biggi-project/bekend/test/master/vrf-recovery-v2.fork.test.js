const { expect } = require("chai");
const { ethers, network } = require("hardhat");

// Opt-in historical rehearsal. This file cannot transact on a remote network.
const forkSuite = process.env.VRF_RECOVERY_FORK_URL ? describe : describe.skip;
forkSuite("VRF V2 Polygon migration rehearsal (local fork only)", function () {
  this.timeout(1200000);

  it("preserves the existing ticket, exact metadata and chapter wiring through redeem and reveal", async function () {
    expect(network.name).to.equal("hardhat");
    const metadata = await network.provider.send("hardhat_metadata");
    expect(metadata.forkedNetwork.chainId).to.equal(137);
    expect(metadata.forkedNetwork.forkBlockNumber).to.equal(Number(process.env.VRF_RECOVERY_FORK_BLOCK || 94041102));
    await network.provider.send("evm_mine");

    const oldMain = await ethers.getContractAt("BiggiEyesMain", "0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4");
    const hub = await ethers.getContractAt("BiggiTicketHub", "0x7b7e561173f498C8274b821090Da64E8ee653f6A");
    const oldRouter = await ethers.getContractAt("BiggiVRFRouter", "0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F");
    const registry = await ethers.getContractAt("BiggiSeriesRegistry", "0x09f3728e8607e1B951A6396DcEE4EC134C5e4058");
    const controller = await ethers.getContractAt("BiggiChapterController", "0x9c084D89c0CB6c8424652d1fa82E83aD9c098288");

    expect(await oldMain.biggiMinted()).to.equal(0);
    expect(await hub.chapterActive(1)).to.equal(false);
    const ownerAddress = await oldMain.owner();
    const holderAddress = await hub.ownerOf(3);
    const ticketUri = await hub.tokenURI(3);
    expect(await oldMain.pendingMintRequest(holderAddress)).to.equal(0);
    async function impersonate(address) {
      await network.provider.send("hardhat_impersonateAccount", [address]);
      await network.provider.send("hardhat_setBalance", [address, "0x56bc75e2d63100000"]);
      return ethers.getSigner(address);
    }
    const owner = await impersonate(ownerAddress);
    const holder = await impersonate(holderAddress);
    async function deploy(name, ...args) {
      const factory = await ethers.getContractFactory(name, owner);
      return (await factory.deploy(...args)).deployed();
    }
    const names = await deploy("BiggiNamesLib");
    const mainFactory = await ethers.getContractFactory("BiggiEyesMainV2", {
      signer: owner, libraries: { BiggiNamesLib: names.address },
    });
    const main = await (await mainFactory.deploy(ownerAddress)).deployed();
    const coordinatorAddress = await oldRouter.coordinator();
    const subId = await oldRouter.subId();
    const router = await deploy("BiggiVRFRouterV2", coordinatorAddress, ownerAddress, await oldRouter.keyHash(), subId);
    await main.setModules(await oldMain.compute(), router.address);

    const rows = [];
    console.log("    Reading the exact 550-row on-chain metadata matrix...");
    for (let index = 1; index <= 550; index++) {
      const info = await oldMain.nftInfo(index);
      expect(info.minted).to.equal(false);
      rows.push([index, info.background, info.blockIdx, info.mainId]);
      if (index % 100 === 0) console.log(`    Read ${index}/550 metadata rows`);
    }
    for (let start = 0; start < rows.length; start += 55) {
      const batch = rows.slice(start, start + 55);
      await main.batchSetNFTBackgroundAndBlock(...[0, 1, 2, 3].map((col) => batch.map((row) => row[col])));
      console.log(`    Seeded ${start + batch.length}/550 V2 metadata rows`);
    }
    await main.sealMetadata();
    console.log("    Metadata sealed; copying prices and IPFS URIs...");
    for (let block = 1; block <= 10; block++) {
      await main.setURI(3, block, await oldMain.blockBaseURIs(block));
      await main.setBlockCurrentPrice(block, await oldMain.getCurrentBlockPrice(block));
    }
    await main.setURI(0, 0, await oldMain.rewardsBaseURI());
    await main.setURI(1, 0, await oldMain.charactersBaseURI());
    await main.setContractURI(await oldMain.contractURI());
    console.log("    Prices and URIs copied; checking chapter and subscription bindings...");

    const oldChapter = await registry.getChapterCollections(1);
    await hub.connect(owner).setChapterMainCollection(1, main.address);
    await main.setTicketHub(hub.address);
    await registry.connect(owner).setChapterCollections(1, main.address, oldChapter.publicCollection, hub.address);
    await router.setMain(main.address);
    const coordinator = new ethers.Contract(coordinatorAddress, [
      "function addConsumer(uint256 subId,address consumer)",
      "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
    ], ethers.provider);
    const subscription = await coordinator.getSubscription(subId);
    const subOwner = await impersonate(subscription.owner);
    await coordinator.connect(subOwner).addConsumer(subId, router.address);
    expect((await coordinator.getSubscription(subId)).consumers).to.include(router.address);

    expect(await controller.isChapterStackConsistent(1)).to.equal(true);
    expect(await controller.isChapterCapConsistent(1)).to.equal(true);
    expect(await controller.getChapterPriceProvider(1)).to.equal(main.address);
    expect(await hub.ownerOf(3)).to.equal(holderAddress);
    expect(await hub.tokenURI(3)).to.equal(ticketUri);
    expect(await hub.chapterActive(1)).to.equal(false);
    expect(await main.metadataConsistency()).to.deep.equal(await oldMain.metadataConsistency());
    console.log("    Bindings validated; comparing complete NFT records...");
    for (let index = 1; index <= 550; index++) {
      expect(await main.nftInfo(index)).to.deep.equal(await oldMain.nftInfo(index));
    }

    // Activation and coordinator impersonation below occur only in this disposable local fork.
    await hub.connect(owner).setChapterActive(1, true);
    await hub.connect(holder).redeemTicket(3, { gasLimit: 1500000 });
    const id = await main.pendingMintRequest(holderAddress);
    const ticketPrice = await main.pendingTicketPrice(id);
    expect(id).to.not.equal(0);
    expect(await hub.isTicket(3)).to.equal(false);
    const coordinatorSigner = await impersonate(coordinatorAddress);
    const data = router.interface.encodeFunctionData("rawFulfillRandomWords", [id, [0]]);
    const intrinsicGas = 21000 + Array.from(ethers.utils.arrayify(data)).reduce((sum, byte) => sum + (byte === 0 ? 4 : 16), 0);
    const receipt = await (await coordinatorSigner.sendTransaction({
      to: router.address, data, gasLimit: 750000 + intrinsicGas,
    })).wait();
    expect(receipt.status).to.equal(1);
    expect(await main.ownerOf(1001)).to.equal(holderAddress);
    expect(await main.pendingMintRequest(holderAddress)).to.equal(0);
    expect((await main.getMintData(1))[0]).to.equal(ticketPrice);
    const events = receipt.logs.filter((log) => log.address.toLowerCase() === main.address.toLowerCase())
      .map((log) => main.interface.parseLog(log).name);
    expect(events).to.include("VRFFulfillStarted");
    expect(events).to.include("NFTMinted");
    console.log("    Original ticket #3 -> V2 NFT #1001; 550 metadata rows identical; chapter/controller bindings consistent");
    console.log(`    Synthetic callback receipt gas ${receipt.gasUsed.toString()} (includes intrinsic gas and refunds)`);
  });
});
