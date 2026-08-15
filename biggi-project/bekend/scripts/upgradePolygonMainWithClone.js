const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;

const ZERO = ethers.constants.AddressZero;
const BATCH_SIZE = 55;

function loadAddresses() {
  const p = path.resolve(__dirname, "..", "addresses.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function pickAddress(raw, ...keys) {
  for (const key of keys) {
    const v = process.env[key] || raw[key];
    if (!v) continue;
    try {
      return ethers.utils.getAddress(v);
    } catch {
      // ignore invalid address candidates
    }
  }
  return ZERO;
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  try {
    return ethers.utils.getAddress(a) === ethers.utils.getAddress(b);
  } catch {
    return false;
  }
}

async function ensureOwner(label, contract, signerAddress) {
  if (!contract || typeof contract.owner !== "function") return;
  const owner = await contract.owner();
  if (!sameAddress(owner, signerAddress)) {
    throw new Error(`${label} owner mismatch: signer ${signerAddress}, owner ${owner}`);
  }
}

async function getContractCode(addr) {
  const code = await ethers.provider.getCode(addr);
  if (!code || code === "0x") throw new Error(`No contract code at ${addr}`);
}

async function batchFetchMetadata(rpcUrl, mainAddr, iface) {
  const all = [];
  for (let start = 1; start <= 550; start += 20) {
    const body = [];
    for (let i = start; i < start + 20 && i <= 550; i++) {
      body.push({
        jsonrpc: "2.0",
        id: i,
        method: "eth_call",
        params: [
          {
            to: mainAddr,
            data: iface.encodeFunctionData("nftInfo", [i]),
          },
          "latest",
        ],
      });
    }

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Metadata batch fetch failed with HTTP ${res.status}`);
    }
    const payload = await res.json();
    for (const item of payload) {
      if (!item || item.error || !item.result) {
        throw new Error(`Invalid metadata response: ${JSON.stringify(item)}`);
      }
      const decoded = iface.decodeFunctionResult("nftInfo", item.result);
      all.push({
        index: Number(item.id),
        minted: Boolean(decoded.minted ?? decoded[0]),
        background: Number(decoded.background ?? decoded[1]),
        blockIdx: Number(decoded.blockIdx ?? decoded[2]),
        mainId: Number((decoded.mainId ?? decoded[3]).toString()),
      });
    }
    console.log(`Metadata fetched ${Math.min(start + 19, 550)}/550`);
  }
  all.sort((a, b) => a.index - b.index);
  return all;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const addresses = loadAddresses();
  const oldMainAddr = pickAddress(addresses, "OLD_MAIN", "MAIN", "COLLECTION", "COLLECTION_VRF");
  const collectionRewardsAddr = pickAddress(addresses, "COLLECTION_REWARDS");
  const tokenRewardsAddr = pickAddress(addresses, "TOKEN_REWARDS");

  if (oldMainAddr === ZERO) throw new Error("MAIN/COLLECTION_VRF not configured");
  if (collectionRewardsAddr === ZERO) throw new Error("COLLECTION_REWARDS not configured");

  const rpcUrl =
    network?.config?.url ||
    process.env.POLYGON_RPC_URL ||
    "https://polygon.drpc.org";

  console.log("Network:", network.name);
  console.log("Signer:", signer.address);
  console.log("Old MAIN:", oldMainAddr);
  console.log("CollectionRewards:", collectionRewardsAddr);
  console.log("TokenRewards:", tokenRewardsAddr);

  await getContractCode(oldMainAddr);
  await getContractCode(collectionRewardsAddr);

  const oldMain = await ethers.getContractAt("BiggiEyesMain", oldMainAddr, signer);
  const collectionRewards = await ethers.getContractAt(
    "BiggiCollectionRewards",
    collectionRewardsAddr,
    signer,
  );

  await ensureOwner("Old MAIN", oldMain, signer.address);
  await ensureOwner("CollectionRewards", collectionRewards, signer.address);

  const currentConfig = {
    owner: await oldMain.owner(),
    compute: await oldMain.compute(),
    vrfRouter: await oldMain.vrfRouter(),
    distributor: await oldMain.distributor(),
    biggi: await oldMain.BIGGI(),
    tokenSink: await oldMain.tokenSink(),
    tokenSinkBps: await oldMain.tokenSinkBps(),
    reserveAddress: await oldMain.reserveAddress(),
    biggiPerEth: await oldMain.biggiPerEth(),
    ticketPrice: await oldMain.ticketPrice(),
    priceIncreasePerMint: await oldMain.priceIncreasePerMint(),
  };

  const currentUris = {
    rewardsBaseURI: await oldMain.rewardsBaseURI(),
    charactersBaseURI: await oldMain.charactersBaseURI(),
    ticketBaseURI: await oldMain.ticketBaseURI(),
    blockBaseURIs: [],
    blockPrices: [],
  };
  for (let i = 1; i <= 10; i++) {
    currentUris.blockBaseURIs.push(await oldMain.blockBaseURIs(i));
    currentUris.blockPrices.push(await oldMain.getCurrentBlockPrice(i));
  }

  const metadata = await batchFetchMetadata(rpcUrl, oldMainAddr, oldMain.interface);
  const nonzeroMetadata = metadata.filter((row) => row.blockIdx && row.background && row.mainId);
  if (nonzeroMetadata.length !== 550) {
    throw new Error(`Expected 550 seeded metadata rows, got ${nonzeroMetadata.length}`);
  }

  const NamesLib = await ethers.getContractFactory("BiggiNamesLib");
  const namesLib = await NamesLib.deploy();
  await namesLib.deployed();
  console.log("BiggiNamesLib:", namesLib.address);

  const Main = await ethers.getContractFactory("BiggiEyesMain", {
    libraries: { BiggiNamesLib: namesLib.address },
  });
  const newMain = await Main.deploy(currentConfig.owner);
  await newMain.deployed();
  console.log("New MAIN:", newMain.address);

  await (await newMain.setModules(currentConfig.compute, currentConfig.vrfRouter)).wait();
  await (await newMain.setDistributor(currentConfig.distributor)).wait();
  await (await newMain.setBiggiToken(currentConfig.biggi)).wait();
  await (await newMain.setBiggiRate(currentConfig.biggiPerEth)).wait();
  await (
    await newMain.setTokenSink(currentConfig.tokenSink, currentConfig.tokenSinkBps)
  ).wait();
  await (await newMain.setReserveAddress(currentConfig.reserveAddress)).wait();
  await (await newMain.setTicketPrice(currentConfig.ticketPrice)).wait();
  await (
    await newMain.setPriceIncreasePerMint(currentConfig.priceIncreasePerMint)
  ).wait();

  await (await newMain.setURI(0, 0, currentUris.rewardsBaseURI)).wait();
  await (await newMain.setURI(1, 0, currentUris.charactersBaseURI)).wait();
  await (await newMain.setURI(2, 0, currentUris.ticketBaseURI)).wait();
  for (let i = 1; i <= 10; i++) {
    await (await newMain.setURI(3, i, currentUris.blockBaseURIs[i - 1])).wait();
    await (
      await newMain.setBlockCurrentPrice(i, currentUris.blockPrices[i - 1])
    ).wait();
  }

  for (let start = 0; start < nonzeroMetadata.length; start += BATCH_SIZE) {
    const chunk = nonzeroMetadata.slice(start, start + BATCH_SIZE);
    await (
      await newMain.batchSetNFTBackgroundAndBlock(
        chunk.map((row) => row.index),
        chunk.map((row) => row.background),
        chunk.map((row) => row.blockIdx),
        chunk.map((row) => row.mainId),
      )
    ).wait();
    console.log(`Seeded metadata ${Math.min(start + BATCH_SIZE, nonzeroMetadata.length)}/${nonzeroMetadata.length}`);
  }

  const MainReader = await ethers.getContractFactory("BiggiMainReader");
  const newReader = await MainReader.deploy(newMain.address);
  await newReader.deployed();
  console.log("New MAIN_READER:", newReader.address);

  const Adapter = await ethers.getContractFactory("BiggiEyesMainRewardsAdapter");
  const newAdapter = await Adapter.deploy(newMain.address);
  await newAdapter.deployed();
  console.log("New COLLECTION_REWARDS_MAIN_ADAPTER:", newAdapter.address);

  await (await collectionRewards.setMain(newAdapter.address)).wait();

  if (currentConfig.vrfRouter !== ZERO) {
    const router = await ethers.getContractAt("BiggiVRFRouter", currentConfig.vrfRouter, signer);
    await ensureOwner("VRF_ROUTER", router, signer.address);
    await (await router.setMain(newMain.address)).wait();
  }

  if (tokenRewardsAddr !== ZERO) {
    try {
      const tokenRewards = await ethers.getContractAt("BiggiTokenRewards", tokenRewardsAddr, signer);
      await ensureOwner("TOKEN_REWARDS", tokenRewards, signer.address);
      await (await tokenRewards.setCollectionAllowed(newMain.address, true)).wait();
      console.log("TOKEN_REWARDS allowed new MAIN");
    } catch (error) {
      console.warn(`WARN: TOKEN_REWARDS allowlist skipped: ${error.message}`);
    }
  }

  try {
    await (await oldMain.pause()).wait();
    console.log("Old MAIN paused");
  } catch (error) {
    console.warn(`WARN: old MAIN pause skipped: ${error.message}`);
  }

  const output = {
    network: network.name,
    signer: signer.address,
    oldMain: oldMainAddr,
    newMain: newMain.address,
    newMainReader: newReader.address,
    newCollectionRewardsMainAdapter: newAdapter.address,
    vrfRouter: currentConfig.vrfRouter,
    collectionRewards: collectionRewardsAddr,
    tokenRewards: tokenRewardsAddr,
  };

  const outPath = path.resolve(__dirname, "..", "addresses.main-upgrade.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log("Upgrade output:", outPath);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
