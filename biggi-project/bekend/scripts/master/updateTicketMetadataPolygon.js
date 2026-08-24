const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

dotenv.config({
  path: path.resolve(__dirname, "../../.env.core.polygon"),
  override: true,
});

const EXPECTED_TRAITS = {
  "Ticket Type": "Random Mint Ticket",
  "Mint Mechanism": "Chainlink VRF",
};
const POLYGON_GAS_STATION = "https://gasstation.polygon.technology/v2";
const MAX_GAS_FEE_GWEI = 2_000;

const ABI = [
  "function owner() view returns (address)",
  "function chapterActive(uint256) view returns (bool)",
  "function chapterMarketingMinted(uint256) view returns (uint16)",
  "function chapterSaleMinted(uint256) view returns (uint16)",
  "function chapterTicketBaseURI(uint256) view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function setChapterTicketBaseURI(uint256,string) external",
];

function fail(message) {
  throw new Error(message);
}

function sameAddress(a, b) {
  return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
}

function traitMap(metadata) {
  return Object.fromEntries(
    (metadata.attributes || []).map((trait) => [trait.trait_type, trait.value]),
  );
}

async function validateMetadata(chapter, filename) {
  const url = `${chapter.newBaseURI}${filename}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) fail(`Chapter ${chapter.chapterId} metadata returned HTTP ${response.status}`);
  const metadata = await response.json();
  const traits = traitMap(metadata);
  const expected = {
    ...EXPECTED_TRAITS,
    Chapter: `Chapter ${chapter.chapterId}`,
    Series: chapter.series,
  };
  if (JSON.stringify(traits) !== JSON.stringify({
    "Ticket Type": expected["Ticket Type"],
    Chapter: expected.Chapter,
    Series: expected.Series,
    "Mint Mechanism": expected["Mint Mechanism"],
  })) {
    fail(`Chapter ${chapter.chapterId} traits do not match the release manifest`);
  }
  if (typeof metadata.image !== "string" || !metadata.image.startsWith("ipfs://")) {
    fail(`Chapter ${chapter.chapterId} metadata image is not an IPFS URI`);
  }
}

async function getPolygonFees() {
  const response = await fetch(POLYGON_GAS_STATION, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`Polygon Gas Station returned HTTP ${response.status}`);
  const recommendation = await response.json();
  const standard = recommendation.standard;
  if (!standard?.maxPriorityFee || !standard?.maxFee) {
    fail("Polygon Gas Station response has no standard fee recommendation");
  }
  const maxPriorityFeeGwei = Math.ceil(Number(standard.maxPriorityFee));
  const maxFeeGwei = Math.ceil(Number(standard.maxFee));
  if (
    maxPriorityFeeGwei < 25 ||
    maxFeeGwei < maxPriorityFeeGwei ||
    maxFeeGwei > MAX_GAS_FEE_GWEI
  ) {
    fail(
      `Polygon fee recommendation rejected: priority=${maxPriorityFeeGwei}, max=${maxFeeGwei} gwei`,
    );
  }
  return {
    maxPriorityFeePerGas: ethers.utils.parseUnits(String(maxPriorityFeeGwei), "gwei"),
    maxFeePerGas: ethers.utils.parseUnits(String(maxFeeGwei), "gwei"),
    maxPriorityFeeGwei,
    maxFeeGwei,
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const manifestPath = path.resolve(
    __dirname,
    process.env.TICKET_METADATA_MANIFEST || "../../../../metadata/tickets/polygon-ticket-traits-v2.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.OWNER_PRIVATE_KEY;
  if (!rpcUrl) fail("POLYGON_RPC_URL is missing");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey || "")) fail("OWNER_PRIVATE_KEY is missing or invalid");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== manifest.chainId) {
    fail(`Connected chain ${network.chainId}, expected ${manifest.chainId}`);
  }
  const code = await provider.getCode(manifest.ticketHub);
  if (code === "0x") fail(`No contract at TicketHub ${manifest.ticketHub}`);

  const signer = new ethers.Wallet(privateKey, provider);
  const ticketHub = new ethers.Contract(manifest.ticketHub, ABI, signer);
  const owner = await ticketHub.owner();
  const expectedOwner = process.env.EXPECT_OWNER || process.env.OWNER;
  if (!sameAddress(signer.address, owner)) {
    fail(`OWNER_PRIVATE_KEY resolves to ${signer.address}, TicketHub owner is ${owner}`);
  }
  if (expectedOwner && !sameAddress(owner, expectedOwner)) {
    fail(`TicketHub owner ${owner} does not match EXPECT_OWNER ${expectedOwner}`);
  }

  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`TicketHub: ${manifest.ticketHub}`);
  console.log(`Owner: ${owner}`);

  const pending = [];
  for (const chapter of manifest.chapters) {
    await validateMetadata(chapter, manifest.metadataFilename);
    const [active, marketingMinted, saleMinted, currentBaseURI, currentTokenURI] =
      await Promise.all([
        ticketHub.chapterActive(chapter.chapterId),
        ticketHub.chapterMarketingMinted(chapter.chapterId),
        ticketHub.chapterSaleMinted(chapter.chapterId),
        ticketHub.chapterTicketBaseURI(chapter.chapterId),
        ticketHub.tokenURI(chapter.firstTicketId),
      ]);
    if (active) fail(`Chapter ${chapter.chapterId} is active; refusing metadata migration`);
    if (Number(marketingMinted) !== 50 || Number(saleMinted) !== 0) {
      fail(
        `Chapter ${chapter.chapterId} mint counts are ${marketingMinted}/${saleMinted}, expected 50/0`,
      );
    }
    if (currentBaseURI !== chapter.oldBaseURI && currentBaseURI !== chapter.newBaseURI) {
      fail(`Chapter ${chapter.chapterId} has unexpected current base URI: ${currentBaseURI}`);
    }
    const state = currentBaseURI === chapter.newBaseURI ? "current" : "pending";
    console.log(
      `Chapter ${chapter.chapterId} ${chapter.series}: ${state}; token ${chapter.firstTicketId}; ${currentTokenURI}`,
    );
    if (state === "pending") pending.push(chapter);
  }

  if (!pending.length) {
    console.log("All chapter ticket metadata URIs are already current.");
    return;
  }

  let estimatedGas = ethers.BigNumber.from(0);
  for (const chapter of pending) {
    estimatedGas = estimatedGas.add(
      await ticketHub.estimateGas.setChapterTicketBaseURI(
        chapter.chapterId,
        chapter.newBaseURI,
      ),
    );
  }
  const fees = await getPolygonFees();
  const balance = await signer.getBalance();
  const estimatedCost = estimatedGas.mul(fees.maxFeePerGas);
  console.log(`Pending chapters: ${pending.length}`);
  console.log(`Estimated gas: ${estimatedGas.toString()}`);
  console.log(
    `Polygon standard fee: priority ${fees.maxPriorityFeeGwei} gwei; max ${fees.maxFeeGwei} gwei`,
  );
  console.log(`Estimated maximum cost: ${ethers.utils.formatEther(estimatedCost)} POL`);
  console.log(`Owner balance: ${ethers.utils.formatEther(balance)} POL`);
  if (balance.lt(estimatedCost.mul(12).div(10))) fail("Owner balance is below the guarded gas estimate");

  if (!execute) {
    console.log("Dry run complete. Add --execute to submit the five owner transactions.");
    return;
  }

  for (const chapter of pending) {
    const tx = await ticketHub.setChapterTicketBaseURI(
      chapter.chapterId,
      chapter.newBaseURI,
      {
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        maxFeePerGas: fees.maxFeePerGas,
      },
    );
    console.log(`Chapter ${chapter.chapterId} transaction: ${tx.hash}`);
    await tx.wait(2);
    const [baseURI, tokenURI] = await Promise.all([
      ticketHub.chapterTicketBaseURI(chapter.chapterId),
      ticketHub.tokenURI(chapter.firstTicketId),
    ]);
    if (baseURI !== chapter.newBaseURI) fail(`Chapter ${chapter.chapterId} base URI verification failed`);
    if (tokenURI !== `${chapter.newBaseURI}${manifest.metadataFilename}`) {
      fail(`Chapter ${chapter.chapterId} token URI verification failed: ${tokenURI}`);
    }
    console.log(`Chapter ${chapter.chapterId} verified: ${tokenURI}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
