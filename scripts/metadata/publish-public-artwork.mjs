import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import dotenv from "dotenv";
import FormData from "form-data";
import { Contract, JsonRpcProvider } from "ethers";

// Publishing here only pins new immutable files. It never signs transactions.
const [stage, directoryArg] = process.argv.slice(2);
assert(
  directoryArg,
  "Usage: node publish-public-artwork.mjs STAGE RELEASE_DIRECTORY",
);
const directory = path.resolve(directoryArg);
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
const write = async (name, data) =>
  fs.writeFile(
    path.join(directory, name),
    JSON.stringify(data, null, 2) + "\n",
    { flag: "wx" },
  );
const plan = await read("rename-plan.json");
const contractAddress = "0xe56cC0657A89daf10994204eD745985a61b0E36F";
const colors = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];
const gateway = "https://biggieyes.mypinata.cloud/ipfs/";
const filename = (id) =>
  `Biggi_${id}_${colors[Math.floor((id - 1) / 10)]}_PUBLIC.json`;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const attribute = (json, key) =>
  json.attributes.find((item) => item.trait_type === key)?.value;
const fromIpfs = async (uri) => {
  assert(uri.startsWith("ipfs://"));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(gateway + uri.slice(7), {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        assert.fail(`IPFS HTTP ${response.status}`);
      }
      // Include body consumption in the timeout/retry boundary, not just headers.
      return new Response(await response.arrayBuffer(), {
        headers: response.headers,
      });
    } catch (error) {
      if (attempt === 2) throw error;
      console.log(
        `Retrying IPFS read (${attempt + 1}/2): ${uri.split("/").pop()}`,
      );
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
    }
  }
};
const validate = (json, id) => {
  assert.equal(json.metadata_file, filename(id));
  assert.equal(attribute(json, "Collection Kind"), "PUBLIC");
  assert.equal(attribute(json, "Chapter"), 1);
  assert.equal(attribute(json, "Series"), "Original");
  assert.equal(attribute(json, "Main ID"), id);
  assert.equal(attribute(json, "Block Index"), Math.floor((id - 1) / 10) + 1);
  assert.equal(
    attribute(json, "Block/Eye Color"),
    colors[Math.floor((id - 1) / 10)],
  );
  assert.equal(
    attribute(json, "Linked Block"),
    attribute(json, "Block/Eye Color"),
  );
  assert.equal(attribute(json, "Price Source"), "Paired VRF Collection");
  assert(!json.attributes.some((item) => /^background/i.test(item.trait_type)));
};

async function pin(folder, receiptName, name) {
  try {
    await fs.access(path.join(directory, receiptName));
    throw new Error("Pin receipt already exists; do not upload twice");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const env = dotenv.parse(
    await fs.readFile("biggi-project/bekend/.env.core.polygon"),
  );
  assert(env.PINATA_JWT, "Missing PINATA_JWT");
  const form = new FormData();
  const files = (await fs.readdir(path.join(directory, folder))).sort();
  assert.equal(files.length, folder === "images" ? plan.items.length : 100);
  let bytes = 0;
  for (const name of files) {
    const data = await fs.readFile(path.join(directory, folder, name));
    if (folder === "images") {
      const item = plan.items.find((item) => item.filename === name);
      assert(item && item.sha256 === hash(data), "Unreviewed or changed image");
    } else {
      const json = JSON.parse(data);
      validate(json, attribute(json, "Main ID"));
    }
    bytes += data.length;
    form.append("file", data, { filepath: `${folder}/${name}` });
  }
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  form.append("pinataMetadata", JSON.stringify({ name }));
  console.log(`Uploading ${files.length} ${folder} files, ${bytes} bytes`);
  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.PINATA_JWT}`,
      },
      maxBodyLength: Infinity,
      timeout: 300000,
      validateStatus: () => true,
    },
  );
  assert(
    response.status >= 200 && response.status < 300,
    `Pinata HTTP ${response.status}`,
  );
  const cid = response.data?.IpfsHash;
  assert(/^bafy[a-z2-7]+$/.test(cid), "Invalid Pinata CID");
  await write(receiptName, {
    cid,
    files: files.length,
    bytes,
    name,
    uploadedAt: new Date().toISOString(),
  });
  console.log(`Pinned ${folder}: ipfs://${cid}/`);
}

try {
  if (stage === "snapshot") {
    const provider = new JsonRpcProvider(
      "https://polygon-bor-rpc.publicnode.com",
      137,
      { staticNetwork: true, batchMaxCount: 1 },
    );
    try {
      assert.equal(await provider.send("eth_chainId", []), "0x89");
      const contract = new Contract(
        contractAddress,
        [
          "function blockBaseURIs(uint16) view returns(string)",
          "function biggiMinted() view returns(uint256)",
          "function paused() view returns(bool)",
          "function MAX_SUPPLY() view returns(uint256)",
          "function metadataConsistency() view returns(uint256,bool,bool)",
        ],
        provider,
      );
      assert.equal(await contract.MAX_SUPPLY(), 100n);
      assert.equal(
        await contract.biggiMinted(),
        0n,
        "Already minted; do not reassign artwork",
      );
      assert.equal(
        await contract.paused(),
        true,
        "Mint must remain paused during preparation",
      );
      const consistency = await contract.metadataConsistency();
      assert.deepEqual([...consistency], [100n, true, true]);
      const blockURIs = [];
      for (let block = 1; block <= 10; block++)
        blockURIs.push(await contract.blockBaseURIs(block));
      const metadata = {};
      for (let id = 1; id <= 100; id++) {
        const uri =
          blockURIs[Math.floor((id - 1) / 10)].replace(/\/?$/, "/") +
          filename(id);
        const json = await (await fromIpfs(uri)).json();
        validate(json, id);
        assert.equal(attribute(json, "Phase"), "placeholder");
        assert.equal(attribute(json, "Image Finalized"), "No");
        metadata[id] = json;
        if (id % 10 === 0) console.log(`Snapshot ${id}/100`);
      }
      await write("onchain-snapshot.json", {
        chainId: 137,
        contract: contractAddress,
        blockURIs,
        paused: true,
        minted: 0,
        metadata,
        checkedAt: new Date().toISOString(),
      });
    } finally {
      provider.destroy();
    }
  } else if (stage === "pin-images") {
    await read("onchain-snapshot.json");
    await pin(
      "images",
      "images-pin.json",
      "BIGGI Originals Public artwork 2026-09-17",
    );
  } else if (stage === "metadata") {
    const snapshot = await read("onchain-snapshot.json");
    const images = await read("images-pin.json");
    await fs.mkdir(path.join(directory, "metadata"));
    for (let id = 1; id <= 100; id++) {
      const original = snapshot.metadata[id];
      const json = structuredClone(original);
      const item = plan.items.find((item) => item.id === id);
      if (item) {
        json.image = `ipfs://${images.cid}/${item.filename}`;
        json.description =
          "BiggiEyes Original public companion collection. One fixed artwork per NFT; no background variants.";
        for (const trait of json.attributes) {
          if (trait.trait_type === "Phase") trait.value = "final";
          if (trait.trait_type === "Image Finalized") trait.value = "Yes";
        }
      }
      validate(json, id);
      const preserved = (data) => ({
        ...data,
        image: undefined,
        description: undefined,
        attributes: data.attributes.filter(
          (trait) => !["Phase", "Image Finalized"].includes(trait.trait_type),
        ),
      });
      assert.deepEqual(
        preserved(json),
        preserved(original),
        "Non-artwork metadata changed",
      );
      if (!item)
        assert.deepEqual(json, original, "Missing artwork must stay prereveal");
      await write(`metadata/${filename(id)}`, json);
    }
    console.log(
      `Prepared 100 metadata files: ${plan.items.length} artworks, ${plan.missing.length} prereveal`,
    );
  } else if (stage === "pin-metadata") {
    await pin(
      "metadata",
      "metadata-pin.json",
      "BIGGI Originals Public metadata 2026-09-17",
    );
  } else if (stage === "verify") {
    const images = await read("images-pin.json");
    const metadata = await read("metadata-pin.json");
    for (let id = 1; id <= 100; id++) {
      const json = await (
        await fromIpfs(`ipfs://${metadata.cid}/${filename(id)}`)
      ).json();
      assert.deepEqual(json, await read(`metadata/${filename(id)}`));
      validate(json, id);
      const item = plan.items.find((item) => item.id === id);
      if (item) {
        assert.equal(json.image, `ipfs://${images.cid}/${item.filename}`);
        const bytes = Buffer.from(
          await (await fromIpfs(json.image)).arrayBuffer(),
        );
        assert.equal(hash(bytes), item.sha256, `Remote image mismatch #${id}`);
      }
      if (id % 10 === 0) console.log(`Remote verification ${id}/100`);
    }
    await write("verification.json", {
      metadataVerified: 100,
      imageHashesVerified: plan.items.length,
      missingIds: plan.missing.map((item) => item.id),
      verifiedAt: new Date().toISOString(),
      onchainUpdated: false,
    });
  } else {
    throw new Error("Unknown stage");
  }
} catch (error) {
  // Axios errors include authorization headers; never serialize the error object.
  console.error(
    error.name === "AssertionError"
      ? error.message
      : `Release failed (${error.code || error.name})`,
  );
  process.exitCode = 1;
}
