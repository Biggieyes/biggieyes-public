// Set metadata URIs and batch NFT background/block data for Main1
// Env (opt): MAIN, BATCH_JSON, SKIP_URIS=1, SKIP_BATCHES=1
//            ORANGE_METADATA, BLACK_METADATA, WHITE_METADATA, BROWN_METADATA, BLUE_METADATA,
//            GREEN_METADATA, VIOLET_METADATA, RED_METADATA, PINK_METADATA, RAINBOW_METADATA,
//            SPECIAL_CHARACTERS, RAINBOW_REWARDS, MINT_TICKET
// Run: MAIN=<addr> npx hardhat run scripts/setMain1MetadataAndBatches.js --network amoy

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const addresses = require("../addresses.json");

const URI_REWARDS = 0;
const URI_CHARACTERS = 1;
const URI_TICKET = 2;
const URI_BLOCK = 3;

function requireAddress() {
  return (
    process.env.MAIN ||
    addresses.MAIN ||
    addresses.COLLECTION ||
    addresses.COLLECTION_VRF
  );
}

function getEnvOrDefault(name, fallback) {
  return process.env[name] || fallback;
}

function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v.toNumber) return v.toNumber();
  return Number(v);
}

function isZeroSafe(v) {
  if (v == null) return true;
  if (typeof v === "number") return v === 0;
  if (typeof v === "string") return v === "0";
  if (v.isZero) return v.isZero();
  return Number(v) === 0;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);

  const mainAddr = requireAddress();
  if (!mainAddr) throw new Error("MAIN address not found (set MAIN or update addresses.json)");

  const main = await hre.ethers.getContractAt("BiggiEyesMain", mainAddr, signer);

  const doUris = process.env.SKIP_URIS !== "1";
  const doBatches = process.env.SKIP_BATCHES !== "1";

  if (doUris) {
    console.log("\nSetting metadata URIs...");

    const rewardsUri = getEnvOrDefault(
      "RAINBOW_REWARDS",
      "https://biggieyes.mypinata.cloud/ipfs/bafybeibgx66o5yhcjnhrjtevuzzw4aow3cpfe7ni6qbyo3kdhpbrap2xum/"
    );
    const charactersUri = getEnvOrDefault(
      "SPECIAL_CHARACTERS",
      "https://biggieyes.mypinata.cloud/ipfs/bafybeic7vx2gx5sfaoo4346azobz2k5ma3pwgatn5gwfv4lgeuvtxqu6vi/"
    );
    const ticketUri = getEnvOrDefault(
      "MINT_TICKET",
      "https://biggieyes.mypinata.cloud/ipfs/bafybeid32cnhzvsmg56nwlgf2lcowqcnaqch2us7g4af6oyta6cwhkzrgu/"
    );

    const blockUris = [
      null,
      getEnvOrDefault(
        "ORANGE_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeidqofd7yb5hx7no2rfmj6yno4vknwl72rddepgyqcfsehcoxeyxua/"
      ),
      getEnvOrDefault(
        "BLACK_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeibp2dcjca63m2wvv24bmslaafk453n7hgwou4s7cj5qzfpq77vn2m/"
      ),
      getEnvOrDefault(
        "WHITE_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeihxrvvxc5obkhwyjet2ragz6ptfhi7qaofdfegulls3qtowlotmnm/"
      ),
      getEnvOrDefault(
        "BROWN_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeia3mpe2dxnvkwzgrb2p4mzs3ctyvf3nh6wc63opofp22o6qs26sku/"
      ),
      getEnvOrDefault(
        "BLUE_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeigklbjqff4denbtyvczgtoj7e72ciqehdylpd2iqckqxb4xmpc7ny/"
      ),
      getEnvOrDefault(
        "GREEN_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeicphajfgbod675wrmc4j5pjhm772hquy5q3cro73cyf3pakqwjd4e/"
      ),
      getEnvOrDefault(
        "VIOLET_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeihpf7ctn4mrzmpad6i5v6aowof2wyjtucbpmywuwnhgydb6rllnge/"
      ),
      getEnvOrDefault(
        "RED_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeierki4a7ofgeexbsasuoeaz3hprn4gp4ig7c3yghpgpxuru3qlom4/"
      ),
      getEnvOrDefault(
        "PINK_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeighkjzen4splgnka3xqmudil37g3fbzo5brn3wvpu7plozipmybsi/"
      ),
      getEnvOrDefault(
        "RAINBOW_METADATA",
        "https://biggieyes.mypinata.cloud/ipfs/bafybeidllktvh4m5m5fcuncravyecwgo35ccz4u4j3zoe4iddjz4ofkhd4/"
      ),
    ];

    console.log("- rewardsBaseURI:", rewardsUri);
    console.log("- charactersBaseURI:", charactersUri);
    console.log("- ticketBaseURI:", ticketUri);

    await (await main.setURI(URI_REWARDS, 0, rewardsUri)).wait();
    await (await main.setURI(URI_CHARACTERS, 0, charactersUri)).wait();
    await (await main.setURI(URI_TICKET, 0, ticketUri)).wait();

    for (let i = 1; i <= 10; i++) {
      const uri = blockUris[i];
      if (!uri) throw new Error(`Missing block URI for index ${i}`);
      console.log(`- blockBaseURI[${i}]:`, uri);
      await (await main.setURI(URI_BLOCK, i, uri)).wait();
    }

    console.log("Metadata URIs set.");
  }

  if (doBatches) {
    console.log("\nSetting batch NFT background/block data...");

    const jsonPath = getEnvOrDefault(
      "BATCH_JSON",
      "C:\\Users\\biggi\\OneDrive\\Obr\u00e1zky\\Desktop\\BIGGIEYES NFT\\!!!!FINAL!!!!\\Batch\\BATCH_UPLOAD.json"
    );

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`BATCH_UPLOAD.json not found at: ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const fields = ["indices", "bg_codes", "block_indices", "main_ids"];
    const length = data.indices?.length || 0;
    if (!length) throw new Error("BATCH_UPLOAD.json missing indices");
    if (!fields.every((f) => Array.isArray(data[f]) && data[f].length === length)) {
      throw new Error("Array length mismatch in BATCH_UPLOAD.json");
    }

    const batchSize = 55;
    const batchCount = Math.ceil(length / batchSize);

    console.log(`Total items: ${length}, batches: ${batchCount}`);

    for (let i = 0; i < batchCount; i++) {
      const start = i * batchSize;
      const end = Math.min((i + 1) * batchSize, length);

      const batchIndices = data.indices.slice(start, end);
      const batchBg = data.bg_codes.slice(start, end);
      const batchBlocks = data.block_indices.slice(start, end);
      const batchMainIds = data.main_ids.slice(start, end);

      const filtered = { indices: [], bg: [], blocks: [], mainIds: [] };

      for (let j = 0; j < batchIndices.length; j++) {
        const idx = batchIndices[j];
        const info = await main.nftInfo(idx);
        const minted = info.minted ?? info[0];
        const background = info.background ?? info[1];
        const blockIdx = info.blockIdx ?? info[2];
        const mainId = info.mainId ?? info[3];

        const isSet = Boolean(minted) ||
          toNumberSafe(background) > 0 ||
          toNumberSafe(blockIdx) > 0 ||
          !isZeroSafe(mainId);

        if (!isSet) {
          filtered.indices.push(idx);
          filtered.bg.push(batchBg[j]);
          filtered.blocks.push(batchBlocks[j]);
          filtered.mainIds.push(batchMainIds[j]);
        }
      }

      if (filtered.indices.length === 0) {
        console.log(`Batch ${i + 1}: skipped (all set)`);
        continue;
      }

      console.log(`Batch ${i + 1}: setting ${filtered.indices.length} items`);
      const tx = await main.batchSetNFTBackgroundAndBlock(
        filtered.indices,
        filtered.bg,
        filtered.blocks,
        filtered.mainIds
      );
      await tx.wait();
      console.log(`Batch ${i + 1}: done`);
    }

    console.log("Batch metadata set.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
