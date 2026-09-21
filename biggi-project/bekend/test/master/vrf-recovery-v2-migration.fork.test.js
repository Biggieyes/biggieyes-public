const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const candidateLayout = require("../../metadata/main/main-layout.json");
const seedPlan = require("../../metadata/main/core-v2-seed-plan.json");

// Historical contracts are read-only. Every deployment, signature and state change uses Hardhat.
const forkSuite = process.env.VRF_RECOVERY_FORK_URL ? describe : describe.skip;
const ADDRESSES = {
  hub: "0x7b7e561173f498C8274b821090Da64E8ee653f6A",
  router: "0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F",
  registry: "0x09f3728e8607e1B951A6396DcEE4EC134C5e4058",
  controller: "0x9c084D89c0CB6c8424652d1fa82E83aD9c098288",
  collectionRewards: "0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43",
  tokenRewards: "0xA455775BBe0BC863f644516147b95Ef5103b29FA",
  nftRewards: "0xd1cefDf3b4ce4c174291F8eB0729980c50D293b9",
  chapterReader: "0x421c8ed70fC893517481315aC62f4c95331e647f",
  distributor: "0xCE892698159D8D799D5eF7f0dF0111487511fD22",
  distributorReader: "0xa65B4e88E37F085B9009295eA0AcF05e18a82884",
  tokenReader: "0xB558137Ce8a2e065de09f7ef7cF24911E49A9972",
  names: "0xFEfB6Cd04879715bb63E8a51811e68EC85D9dB78",
};
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL_ABI = ["function aggregate(tuple(address target,bytes callData)[] calls) view returns (uint256 blockNumber,bytes[] returnData)"];
const LOCAL_HEAVY_TX = { gasLimit: 15000000 };

forkSuite("VRF V2 five-chapter migration and downstream rehearsal (local fork only)", function () {
  this.timeout(3600000);
  let owner, ownerAddress, hub, oldRouter, router, registry, controller, collectionRewards;
  let tokenRewards, nftRewards, chapterReader, distributor, distributorReader, tokenReader;
  let mainReader, coordinatorSigner, oldMysteryRouter, snapshot;
  const chapters = [];
  const metadataBlockers = [];

  function proposedRows() {
    const layoutPath = path.join(__dirname, "../../metadata/main/main-layout.json");
    const layoutHash = crypto.createHash("sha256").update(fs.readFileSync(layoutPath)).digest("hex");
    expect(layoutHash).to.equal(seedPlan.layoutSha256);
    expect(seedPlan.chainId).to.equal(137);
    expect(seedPlan.rowsPerChapter).to.equal(550);
    expect(seedPlan.broadcastAuthorized).to.equal(false);
    expect(candidateLayout).to.have.length(550);
    return candidateLayout.map((row, index) => {
      expect(row.idx, `candidate layout row ${index + 1}`).to.equal(index + 1);
      expect(row.background, `candidate background ${index + 1}`).to.be.within(1, 10);
      expect(row.blockIdx, `candidate block ${index + 1}`).to.be.within(1, 10);
      expect(row.mainId, `candidate main ID ${index + 1}`).to.be.gt(0);
      return {
        background: row.background,
        blockIdx: row.blockIdx,
        mainId: ethers.BigNumber.from(row.mainId),
        minted: false,
      };
    });
  }

  async function impersonate(address) {
    await network.provider.send("hardhat_impersonateAccount", [address]);
    await network.provider.send("hardhat_setBalance", [address, ethers.utils.hexValue(ethers.utils.parseEther("1000000"))]);
    return ethers.getSigner(address);
  }

  async function owned(name, key) {
    const contract = await ethers.getContractAt(name, ADDRESSES[key]);
    return contract.connect(await impersonate(await contract.owner()));
  }

  async function ownedAt(name, address) {
    const contract = await ethers.getContractAt(name, address);
    return contract.connect(await impersonate(await contract.owner()));
  }

  async function deploy(name, ...args) {
    return (await (await ethers.getContractFactory(name, owner)).deploy(...args)).deployed();
  }

  async function gasUsedSince(startBlock) {
    const endBlock = await ethers.provider.getBlockNumber();
    let total = ethers.BigNumber.from(0);
    for (let blockNumber = startBlock + 1; blockNumber <= endBlock; blockNumber += 1) {
      const block = await ethers.provider.getBlockWithTransactions(blockNumber);
      for (const tx of block.transactions) {
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        total = total.add(receipt.gasUsed);
      }
    }
    return total;
  }

  before(async function () {
    expect(network.name).to.equal("hardhat");
    const metadata = await network.provider.send("hardhat_metadata");
    const block = Number(process.env.VRF_RECOVERY_FORK_BLOCK || 94041102);
    expect(metadata.forkedNetwork.chainId).to.equal(137);
    expect(metadata.forkedNetwork.forkBlockNumber).to.equal(block);
    await network.provider.send("evm_mine");

    // Batched eth_call avoids thousands of remote storage fetches through the fork VM.
    // This provider has no signer. Never log its errors: they can contain an endpoint credential.
    const remote = new ethers.providers.StaticJsonRpcProvider({
      url: process.env.VRF_RECOVERY_FORK_URL, timeout: 60000, throttleLimit: 1,
    }, 137);
    const remoteBatch = new ethers.Contract(MULTICALL, MULTICALL_ABI, remote);
    async function historicalBatch(contract, calls) {
      const payload = calls.map(([method, args = []]) => ({
        target: contract.address, callData: contract.interface.encodeFunctionData(method, args),
      }));
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await remoteBatch.callStatic.aggregate(payload, { blockTag: block });
          break;
        } catch {
          if (attempt === 2) throw new Error(`Historical read failed at block ${block}; no remote writes attempted`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      expect(result.blockNumber).to.equal(block);
      return calls.map(([method], i) => contract.interface.decodeFunctionResult(method, result.returnData[i]));
    }
    try {
      expect(Number(await remote.send("eth_chainId", []))).to.equal(137);
      expect((await remote.getBlock(block)).hash).to.equal(metadata.forkedNetwork.forkBlockHash);
      expect(await remote.getCode(MULTICALL, block)).to.not.equal("0x");
    } catch {
      throw new Error("Read-only snapshot chain/block verification failed");
    }

    hub = await owned("BiggiTicketHub", "hub");
    ownerAddress = await hub.owner();
    owner = await impersonate(ownerAddress);
    oldRouter = await owned("BiggiVRFRouter", "router");
    registry = await owned("BiggiSeriesRegistry", "registry");
    controller = await ethers.getContractAt("BiggiChapterController", ADDRESSES.controller);
    collectionRewards = await owned("BiggiCollectionRewards", "collectionRewards");
    tokenRewards = await ethers.getContractAt("BiggiTokenRewards", ADDRESSES.tokenRewards);
    nftRewards = await owned("BiggiNFTRewards", "nftRewards");
    chapterReader = await ethers.getContractAt("BiggiChapterSeriesReader", ADDRESSES.chapterReader);
    distributor = await owned("BiggiMultiCollectionDistributor", "distributor");
    distributorReader = await ethers.getContractAt("BiggiMultiCollectionDistributorReaderV2", ADDRESSES.distributorReader);
    tokenReader = await ethers.getContractAt("BiggiTokenRewardsReader", ADDRESSES.tokenReader);
    oldMysteryRouter = await nftRewards.vrfRouter();
    expect(await collectionRewards.registry()).to.equal(registry.address);
    expect(await tokenRewards.registry()).to.equal(registry.address);
    expect(await distributor.registry()).to.equal(registry.address);
    expect(await ethers.provider.getBalance(collectionRewards.address)).to.equal(0);

    expect(await ethers.provider.getCode(ADDRESSES.names)).to.not.equal("0x");
    const migrationStartBlock = await ethers.provider.getBlockNumber();
    const mainFactory = await ethers.getContractFactory("BiggiEyesMainV2", {
      signer: owner, libraries: { BiggiNamesLib: ADDRESSES.names },
    });
    const coordinatorAddress = await oldRouter.coordinator();
    const subId = await oldRouter.subId();
    router = await deploy("BiggiVRFRouterV2", coordinatorAddress, ownerAddress, await oldRouter.keyHash(), subId);

    for (let id = 1; id <= 5; id++) {
      console.log(`    Chapter ${id}: reading historical metadata and settings...`);
      const previous = await registry.getChapterCollections(id);
      const oldMain = await ethers.getContractAt("BiggiEyesMain", previous.vrfCollection);
      const publicCollection = await ethers.getContractAt("BiggiEyesMain2", previous.publicCollection);
      expect(await oldMain.biggiMinted()).to.equal(0);
      expect(await hub.chapterActive(id)).to.equal(false);
      expect(await hub.chapterMainCollection(id)).to.equal(oldMain.address);
      const budget = await collectionRewards.collectionBudgets(oldMain.address);
      expect(budget.funded).to.equal(0);
      expect(budget.spent).to.equal(0);
      expect(budget.claimsEnabled).to.equal(false);
      const before = await chapterReader.chapterSnapshot(id);
      console.log(`    Chapter ${id}: chapter snapshot read`);
      const ticketId = (id - 1) * 550 + 3;
      expect(await hub.ticketChapterId(ticketId)).to.equal(id);
      const ticket = {
        id: ticketId, holder: await hub.ownerOf(ticketId), uri: await hub.tokenURI(ticketId),
        price: await hub.mintedTicketPrice(ticketId),
      };
      let rows = [];
      for (let start = 1; start <= 550; start += 55) {
        const calls = Array.from({ length: 55 }, (_, i) => ["nftInfo", [start + i]]);
        rows.push(...await historicalBatch(oldMain, calls));
        console.log(`    Chapter ${id}: fetched ${start + 54}/550 metadata rows`);
      }
      expect(rows.every((row) => !row.minted)).to.equal(true);
      const invalidMetadataRows = rows
        .map((row, index) => ({ index: index + 1, background: Number(row.background), blockIdx: Number(row.blockIdx), mainId: row.mainId.toString() }))
        .filter((row) => row.background < 1 || row.background > 10 || row.blockIdx < 1 || row.blockIdx > 10 || row.mainId === "0");
      if (invalidMetadataRows.length) {
        console.log(`    Chapter ${id}: invalid historical metadata rows before V2 seed`, invalidMetadataRows.slice(0, 10));
        const allRowsUnset = invalidMetadataRows.length === 550 && rows.every((row) =>
          Number(row.background) === 0 && Number(row.blockIdx) === 0 && row.mainId.eq(0) && !row.minted
        );
        const chapterSeed = seedPlan.chapters.find((entry) => entry.chapterId === id);
        const approvedSeed = chapterSeed?.source === "approved-layout-seed";
        if (!approvedSeed || id === 1 || !allRowsUnset) {
          metadataBlockers.push({ id, invalidRows: invalidMetadataRows.length, sample: invalidMetadataRows.slice(0, 3) });
          continue;
        }
        rows = proposedRows();
        console.log(`    Chapter ${id}: using hash-pinned approved metadata seed for local rehearsal only`);
      }
      const settings = await historicalBatch(oldMain, [
        ["compute"], ["contractURI"], ["rewardsBaseURI"], ["charactersBaseURI"],
        ...Array.from({ length: 10 }, (_, i) => ["blockBaseURIs", [i + 1]]),
        ...Array.from({ length: 10 }, (_, i) => ["getCurrentBlockPrice", [i + 1]]),
      ]);
      const main = await (await mainFactory.deploy(ownerAddress)).deployed();
      console.log(`    Chapter ${id}: deployed local V2 Main`);
      await main.setModules(settings[0][0], router.address);
      await main.setChapterId(id);
      for (let start = 0; start < rows.length; start += 55) {
        const batch = rows.slice(start, start + 55);
        await main.batchSetNFTBackgroundAndBlock(
          batch.map((_, i) => start + i + 1), batch.map((row) => row.background),
          batch.map((row) => row.blockIdx), batch.map((row) => row.mainId), LOCAL_HEAVY_TX,
        );
        console.log(`    Chapter ${id}: seeded ${start + batch.length}/550 metadata rows`);
      }
      console.log(`    Chapter ${id}: sealing metadata...`);
      const sealReceipt = await (await main.sealMetadata(LOCAL_HEAVY_TX)).wait();
      console.log(`    Chapter ${id}: metadata sealed with ${sealReceipt.gasUsed.toString()} gas; copying URIs and wiring`);
      await main.setContractURI(settings[1][0]);
      await main.setURI(0, 0, settings[2][0]);
      await main.setURI(1, 0, settings[3][0]);
      for (let b = 1; b <= 10; b++) {
        await main.setURI(3, b, settings[3 + b][0]);
        await main.setBlockCurrentPrice(b, settings[13 + b][0]);
      }
      console.log(`    Chapter ${id}: URIs and prices copied; updating local bindings...`);
      await hub.setChapterMainCollection(id, main.address);
      await main.setTicketHub(hub.address);
      await registry.setChapterCollections(id, main.address, publicCollection.address, hub.address);
      if (id === 1) await router.setMain(main.address);
      else await router.setMainApproval(main.address, true);
      await collectionRewards.configureCollectionBudget(main.address);
      if ((await publicCollection.priceProvider()) === oldMain.address) {
        await publicCollection.connect(await impersonate(await publicCollection.owner())).setPriceProvider(main.address);
      }
      chapters.push({
        id, oldMain, main, publicCollection, before, ticket, rows, settings,
        metadataSource: invalidMetadataRows.length ? "approved-layout-seed" : "historical",
      });
      console.log(`    Chapter ${id}: all 550 rows copied, metadata sealed, bindings updated locally`);
    }
    if (metadataBlockers.length) {
      console.log("    Metadata blockers:", metadataBlockers);
      throw new Error(`Cannot rehearse full five-chapter V2 migration: ${metadataBlockers.length} chapter(s) have unseeded historical metadata`);
    }
    await collectionRewards.setMain(chapters[0].main.address);
    await collectionRewards.setFundingCollection(chapters[0].main.address);
    // NFTRewardsV2 is a separate reward/mystery NFT collection with an immutable
    // router and no main-collection setter; CORE VRF migration must leave it untouched.
    mainReader = await deploy("BiggiMainReader", chapters[0].main.address, hub.address, collectionRewards.address);
    const coordinator = new ethers.Contract(coordinatorAddress, [
      "function addConsumer(uint256 subId,address consumer)",
      "function getSubscription(uint256 subId) view returns (uint96 balance,uint96 nativeBalance,uint64 reqCount,address owner,address[] consumers)",
    ], ethers.provider);
    const subscription = await coordinator.getSubscription(subId);
    await coordinator.connect(await impersonate(subscription.owner)).addConsumer(subId, router.address);
    const consumers = (await coordinator.getSubscription(subId)).consumers;
    expect(consumers).to.include(router.address);
    expect(consumers).to.include(oldRouter.address);
    const coreMigrationGas = await gasUsedSince(migrationStartBlock);
    console.log(`    CORE_V2_MIGRATION_GAS=${coreMigrationGas.toString()}`);
    coordinatorSigner = await impersonate(coordinatorAddress);
    snapshot = await network.provider.send("evm_snapshot");
  });

  beforeEach(async function () {
    expect(await network.provider.send("evm_revert", [snapshot])).to.equal(true);
    snapshot = await network.provider.send("evm_snapshot");
  });

  async function redeem(chapter, ticketId, word, receiver) {
    let holder = await hub.ownerOf(ticketId);
    let signer = await impersonate(holder);
    if (receiver && receiver !== holder) {
      await hub.connect(signer).transferFrom(holder, receiver, ticketId);
      holder = receiver;
      signer = await impersonate(holder);
    }
    await hub.setChapterActive(chapter.id, true);
    await hub.connect(signer).redeemTicket(ticketId, { gasLimit: 1500000 });
    const request = await chapter.main.pendingMintRequest(holder);
    expect(request).to.not.equal(0);
    const data = router.interface.encodeFunctionData("rawFulfillRandomWords", [request, [word]]);
    const intrinsic = 21000 + Array.from(ethers.utils.arrayify(data)).reduce((sum, byte) => sum + (byte ? 16 : 4), 0);
    const receipt = await (await coordinatorSigner.sendTransaction({ to: router.address, data, gasLimit: 750000 + intrinsic })).wait();
    expect(await chapter.main.pendingMintRequest(holder)).to.equal(0);
    expect(await hub.isTicket(ticketId)).to.equal(false);
    return { holder, signer, request, receipt };
  }

  it("preserves all 2750 metadata rows, ticket snapshots, caps, public pricing and reader bindings", async function () {
    const localBatch = new ethers.Contract(MULTICALL, MULTICALL_ABI, ethers.provider);
    for (const ch of chapters) {
      expect(ch.metadataSource).to.equal(ch.id === 1 ? "historical" : "approved-layout-seed");
      for (let start = 0; start < 550; start += 55) {
        const calls = ch.rows.slice(start, start + 55).map((_, i) => ({
          target: ch.main.address, callData: ch.main.interface.encodeFunctionData("nftInfo", [start + i + 1]),
        }));
        const result = await localBatch.callStatic.aggregate(calls);
        result.returnData.forEach((data, i) => {
          const decoded = ch.main.interface.decodeFunctionResult("nftInfo", data);
          const actual = decoded.background == null ? decoded[0] : decoded;
          const expected = ch.rows[start + i];
          expect(Number(actual.background)).to.equal(Number(expected.background));
          expect(Number(actual.blockIdx)).to.equal(Number(expected.blockIdx));
          expect(actual.mainId).to.equal(expected.mainId);
          expect(actual.minted).to.equal(expected.minted);
        });
      }
      expect(await controller.isChapterStackConsistent(ch.id)).to.equal(true);
      expect(await controller.isChapterCapConsistent(ch.id)).to.equal(true);
      const after = await chapterReader.chapterSnapshot(ch.id);
      for (const key of ["seriesId", "chapterNumber", "saleCap", "marketingCap", "totalCap", "saleMinted", "marketingMinted", "totalMinted", "publicUnlocked"]) {
        expect(after[key], `chapter ${ch.id} ${key}`).to.equal(ch.before[key]);
      }
      expect(after.vrfCollection).to.equal(ch.main.address);
      expect(after.publicCollection).to.equal(ch.publicCollection.address);
      expect(after.priceProvider).to.equal(ch.main.address);
      expect(await hub.ownerOf(ch.ticket.id)).to.equal(ch.ticket.holder);
      expect(await hub.tokenURI(ch.ticket.id)).to.equal(ch.ticket.uri);
      expect(await hub.mintedTicketPrice(ch.ticket.id)).to.equal(ch.ticket.price);
      expect(await hub.chapterActive(ch.id)).to.equal(false);
      expect(await ch.main.contractURI()).to.equal(ch.settings[1][0]);
      expect(await ch.main.rewardsBaseURI()).to.equal(ch.settings[2][0]);
      expect(await ch.main.charactersBaseURI()).to.equal(ch.settings[3][0]);
      for (let b = 1; b <= 10; b++) {
        expect(await ch.main.blockBaseURIs(b)).to.equal(ch.settings[3 + b][0]);
        expect(await ch.publicCollection.getCurrentBlockPrice(b)).to.equal(await ch.main.getCurrentBlockPrice(b));
      }
      expect(await tokenRewards.isAllowedCollection(ch.main.address)).to.equal(true);
      expect(await collectionRewards.isEligibleCollection(ch.main.address)).to.equal(true);
      expect(await collectionRewards.isEligibleCollection(ch.oldMain.address)).to.equal(false);
      expect((await collectionRewards.collectionBudgets(ch.main.address)).claimsEnabled).to.equal(false);
    }
    expect(await nftRewards.vrfRouter()).to.equal(oldMysteryRouter);
    expect(await mainReader.main()).to.equal(chapters[0].main.address);
    expect((await mainReader.getFrontendSnapshot()).biggiMinted_).to.equal(0);
    expect(await tokenReader.tokenRewards()).to.equal(tokenRewards.address);
    expect((await tokenReader.getStatus()).s.main).to.equal(chapters[0].oldMain.address);
  });

  it("redeems one existing ticket per chapter and pays weekly BIGGI using collection-aware IDs", async function () {
    const token = new ethers.Contract(await tokenRewards.biggi(), ["function balanceOf(address) view returns (uint256)"], ethers.provider);
    for (const ch of chapters) {
      const { holder, signer, receipt } = await redeem(ch, ch.ticket.id, 0);
      expect(await ch.main.ownerOf(1001)).to.equal(holder);
      expect((await ch.main.getMintData(1))[0]).to.equal(ch.ticket.price);
      const names = receipt.logs.filter((log) => log.address.toLowerCase() === ch.main.address.toLowerCase())
        .map((log) => ch.main.interface.parseLog(log).name);
      expect(names).to.include("VRFFulfillStarted");
      expect(names).to.include("NFTMinted");
      const preview = await tokenRewards.connect(signer).claimablePreviewFor([ch.main.address], [1001]);
      expect(preview.units).to.equal(10);
      expect(preview.amount).to.be.gt(0);
      const balance = await token.balanceOf(holder);
      await tokenRewards.connect(signer).claimWithCollections([ch.main.address], [1001]);
      expect((await token.balanceOf(holder)).sub(balance)).to.equal(preview.amount);
      expect((await tokenRewards.connect(signer).claimablePreviewFor([ch.main.address], [1001])).units).to.equal(0);
      await expect(tokenRewards.connect(signer).claimWithCollections([ch.main.address], [1001])).to.be.revertedWithCustomError(tokenRewards, "NoEligibleTokens");
      expect(await tokenRewards.tokenLastClaimWeek(ch.main.address, 1001)).to.equal(await tokenRewards.currentWeek());
      expect(await tokenReader.nextClaimWeekForCollection(ch.main.address, 1001)).to.equal((await tokenRewards.currentWeek()).add(1));
    }
    expect((await mainReader.getFrontendSnapshot()).biggiMinted_).to.equal(1);
    expect(await mainReader.getMintDataByTokenId(1001)).to.deep.equal(await chapters[0].main.getMintData(1));
  });

  it("keeps collection budgets isolated and pays a complete rainbow set only after its own full funding", async function () {
    const [first, second] = chapters;
    const required = await collectionRewards.maximumCollectionLiability();
    for (const ch of chapters) {
      expect((await collectionRewards.canClaimRainbowFor(ch.main.address, ownerAddress)).reason).to.equal(9);
    }
    await collectionRewards.fundCollectionBudget(first.main.address, { value: required.sub(1) });
    expect((await collectionRewards.collectionBudgets(first.main.address)).claimsEnabled).to.equal(false);
    await collectionRewards.fundCollectionBudget(first.main.address, { value: 1 });
    expect((await collectionRewards.collectionBudgets(first.main.address)).claimsEnabled).to.equal(true);
    expect((await collectionRewards.canClaimRainbowFor(second.main.address, ownerAddress)).reason).to.equal(9);
    expect((await collectionRewards.canClaimRainbowFor(first.main.address, ownerAddress)).ok).to.equal(false);
    for (let i = 0; i < 10; i++) await redeem(first, 31 + i, 540 + i, ownerAddress);
    expect((await collectionRewards.canClaimRainbowFor(first.main.address, ownerAddress)).ok).to.equal(true);
    const amount = await collectionRewards.rainbowReward();
    const balance = await ethers.provider.getBalance(ownerAddress);
    const receipt = await (await collectionRewards.connect(owner).claimRainbowRewardFor(first.main.address)).wait();
    expect((await ethers.provider.getBalance(ownerAddress)).add(receipt.gasUsed.mul(receipt.effectiveGasPrice)).sub(balance)).to.equal(amount);
    expect((await collectionRewards.collectionBudgets(first.main.address)).spent).to.equal(amount);
    expect((await collectionRewards.collectionBudgets(second.main.address)).funded).to.equal(0);
    expect((await mainReader.getRewardsCounters()).rainbow).to.equal(true);
    await expect(collectionRewards.connect(owner).claimRainbowRewardFor(first.main.address)).to.be.revertedWithCustomError(collectionRewards, "AlreadyClaimed");
  });

  it("characterizes deployed legacy distributor attribution and collection-budget gaps", async function () {
    const [first, second] = chapters;
    const [buyer] = await ethers.getSigners();
    await hub.setChapterActive(second.id, true);
    const supportsChapterMintShare = await distributor.supportsChapterMintShare().catch(() => false);
    expect(supportsChapterMintShare).to.equal(false);
    const legacyAttributedChapter = await registry.chapterByCollection(hub.address);
    expect(legacyAttributedChapter).to.equal(0);
    const intendedChapterBefore = await distributor.receivedByChapter(second.id);
    const legacyChapterBefore = await distributor.receivedByChapter(legacyAttributedChapter);
    const hubReceivedBefore = await distributor.receivedByCollection(hub.address);
    const firstBefore = (await collectionRewards.collectionBudgets(first.main.address)).funded;
    const secondBefore = (await collectionRewards.collectionBudgets(second.main.address)).funded;
    await hub.connect(buyer).mintTicketForChapter(second.id, { value: await hub.ticketPrice(), gasLimit: 2000000 });
    expect(await distributor.receivedByCollection(hub.address)).to.be.gt(hubReceivedBefore);
    expect(await distributor.receivedByChapter(second.id)).to.equal(intendedChapterBefore);
    expect(await distributor.receivedByChapter(legacyAttributedChapter)).to.equal(legacyChapterBefore);
    expect((await collectionRewards.collectionBudgets(first.main.address)).funded).to.be.gt(firstBefore);
    expect((await collectionRewards.collectionBudgets(second.main.address)).funded).to.equal(secondBefore);
    expect(await distributorReader.distributor()).to.equal(distributor.address);
    expect((await distributorReader.sourceSnapshot(second.publicCollection.address)).chapterId).to.equal(second.id);
    console.log(
      "    CONFIRMED EXISTING BLOCKER: chapter 2 TicketHub mint was received but not attributed to any chapter, while collection budget credited to chapter 1",
    );
  });

  it("replaces the legacy distributor and funds the exact chapter VRF collection", async function () {
    const [first, second] = chapters;
    const [buyer] = await ethers.getSigners();
    const distributorMigrationStartBlock = await ethers.provider.getBlockNumber();
    const replacement = await deploy("BiggiMultiCollectionDistributor", ownerAddress);
    const recipients = {
      collectionRewards: await distributor.collectionRewards(),
      reserve: await distributor.reserve(),
      buyback: await distributor.buybackAgent(),
      treasury: await distributor.treasury(),
      community: await distributor.communityCenter(),
    };

    await replacement.connect(owner).setRegistry(registry.address);
    await replacement.connect(owner).setCollectionRewards(recipients.collectionRewards);
    await replacement.connect(owner).setReserve(recipients.reserve);
    await replacement.connect(owner).setBuybackAgent(recipients.buyback);
    await replacement.connect(owner).setTreasury(recipients.treasury);
    await replacement.connect(owner).setCommunityCenter(recipients.community);
    await replacement.connect(owner).addCollection(hub.address);
    for (const chapter of chapters) {
      await replacement.connect(owner).addCollection(chapter.main.address);
      await replacement.connect(owner).addCollection(chapter.publicCollection.address);
      expect(await replacement.rewardCollectionForChapter(chapter.id)).to.equal(chapter.main.address);
    }

    await collectionRewards.setDistributor(replacement.address);
    await (await ownedAt("BiggiReserveV4", recipients.reserve)).setDistributor(replacement.address);
    await (await ownedAt("BiggiBuybackAgent", recipients.buyback)).setDistributor(replacement.address);
    await (await ownedAt("BiggiTreasury", recipients.treasury)).setDistributor(replacement.address);
    await (await ownedAt("BiggiCommunityCenter", recipients.community)).setDistributor(replacement.address);
    await hub.setDistributor(replacement.address);

    const replacementReader = await deploy("BiggiMultiCollectionDistributorReaderV2", replacement.address);
    expect(await replacement.distributorVersion()).to.equal(2);
    expect(await replacement.supportsChapterMintShare()).to.equal(true);
    expect(await replacementReader.distributor()).to.equal(replacement.address);
    const distributorMigrationGas = await gasUsedSince(distributorMigrationStartBlock);
    console.log(`    DISTRIBUTOR_V2_MIGRATION_GAS=${distributorMigrationGas.toString()}`);

    const firstBefore = (await collectionRewards.collectionBudgets(first.main.address)).funded;
    const secondBefore = (await collectionRewards.collectionBudgets(second.main.address)).funded;
    const ticketPrice = await hub.ticketPrice();
    const expectedDistributorShare = ticketPrice.mul(6000).div(10000);
    const expectedCollectionShare = expectedDistributorShare.mul(2500).div(10000);
    await hub.setChapterActive(second.id, true);
    await hub.connect(buyer).mintTicketForChapter(second.id, { value: ticketPrice, gasLimit: 2000000 });

    expect(await replacement.receivedByCollection(hub.address)).to.equal(expectedDistributorShare);
    expect(await replacement.receivedByChapter(first.id)).to.equal(0);
    expect(await replacement.receivedByChapter(second.id)).to.equal(expectedDistributorShare);
    expect((await collectionRewards.collectionBudgets(first.main.address)).funded).to.equal(firstBefore);
    expect((await collectionRewards.collectionBudgets(second.main.address)).funded.sub(secondBefore))
      .to.equal(expectedCollectionShare);
    expect(await replacement.pendingCollectionRewards(second.main.address)).to.equal(0);

    const chapterSnapshot = await replacementReader.chapterSnapshot(second.id);
    expect(chapterSnapshot.vrfCollection).to.equal(second.main.address);
    expect(chapterSnapshot.ticketHub).to.equal(hub.address);
    expect(chapterSnapshot.chapterReceived).to.equal(expectedDistributorShare);
    expect(chapterSnapshot.collectionRewardPending).to.equal(0);
  });
});
