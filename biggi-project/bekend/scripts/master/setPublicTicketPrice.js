const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const { ethers, network } = hre;
const ZERO = ethers.constants.AddressZero;

function env(name, fallback = "") {
  const raw = process.env[name];
  return raw == null || raw === "" ? fallback : String(raw).trim();
}

function envInt(name, fallback) {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeAddress(value, label) {
  if (!ethers.utils.isAddress(value) || value === ZERO) {
    throw new Error(`${label} is not a valid non-zero address`);
  }
  return ethers.utils.getAddress(value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asNumber(value) {
  return ethers.BigNumber.isBigNumber(value) ? value.toNumber() : Number(value);
}

async function feeOverrides() {
  const minimumPriorityFee = ethers.utils.parseUnits(
    env("POLYGON_MIN_PRIORITY_FEE_GWEI", "30"),
    "gwei"
  );
  const [feeData, latestBlock] = await Promise.all([
    ethers.provider.getFeeData(),
    ethers.provider.getBlock("latest"),
  ]);
  const priorityFee = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = latestBlock.baseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
  const calculatedMaxFee = baseFee.mul(2).add(priorityFee);
  const maxFee = feeData.maxFeePerGas?.gte(calculatedMaxFee)
    ? feeData.maxFeePerGas
    : calculatedMaxFee;
  return { type: 2, maxPriorityFeePerGas: priorityFee, maxFeePerGas: maxFee };
}

async function main() {
  const execute = process.argv.includes("--execute") || env("SET_PUBLIC_TICKET_PRICE_EXECUTE") === "1";
  const root = path.resolve(__dirname, "../..");
  const addresses = readJson(path.join(root, "addresses.master.json"));
  const reportFile = path.join(root, "reports", "ticket-price-transition-polygon.json");
  const previousReport = fs.existsSync(reportFile) ? readJson(reportFile) : {};
  const lastExecution = previousReport.lastExecution || (
    previousReport.transactionHash
      ? {
          transactionHash: previousReport.transactionHash,
          blockNumber: previousReport.blockNumber,
          executedAt: previousReport.checkedAt,
        }
      : addresses.PUBLIC_TICKET_PRICE_TX_HASH
        ? {
            transactionHash: addresses.PUBLIC_TICKET_PRICE_TX_HASH,
            blockNumber: addresses.PUBLIC_TICKET_PRICE_BLOCK_NUMBER || null,
            executedAt: addresses.PUBLIC_TICKET_PRICE_CONFIGURED_AT || null,
          }
        : null
  );
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 137 || network.name !== "polygon") {
    throw new Error(`Expected Polygon mainnet, got ${network.name} (${chain.chainId})`);
  }

  const ticketHubAddress = normalizeAddress(
    env("TICKET_HUB", addresses.TICKET_HUB),
    "TICKET_HUB"
  );
  const expectedOwner = normalizeAddress(
    env("EXPECT_OWNER", addresses.OWNER),
    "EXPECT_OWNER"
  );
  const chapterCount = envInt("CHAPTER_COUNT", Number(addresses.CHAPTER_COUNT || 5));
  const expectedMarketingCap = envInt(
    "MARKETING_CAP",
    Number(addresses.MARKETING_CAP || 50)
  );
  const expectedSaleCap = envInt("SALE_CAP", Number(addresses.SALE_CAP || 500));
  const expectedCurve = ethers.BigNumber.from(
    env("PRICE_INCREASE_PER_MINT_BPS", String(addresses.PRICE_INCREASE_PER_MINT_BPS || 10033))
  );
  const marketingPrice = ethers.utils.parseEther(env("MARKETING_TICKET_PRICE", "1"));
  const publicPrice = ethers.utils.parseEther(env("PUBLIC_TICKET_PRICE", "500"));
  const privateKey = env("OWNER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("OWNER_PRIVATE_KEY is missing or invalid");
  }

  const signer = new ethers.Wallet(privateKey, ethers.provider);
  if (signer.address !== expectedOwner) {
    throw new Error(`OWNER_PRIVATE_KEY resolves to ${signer.address}, expected ${expectedOwner}`);
  }

  const abi = [
    "function owner() view returns (address)",
    "function paused() view returns (bool)",
    "function ticketPrice() view returns (uint256)",
    "function priceIncreasePerMint() view returns (uint256)",
    "function chapterMarketingCap(uint256) view returns (uint16)",
    "function chapterMarketingMinted(uint256) view returns (uint16)",
    "function chapterSaleCap(uint256) view returns (uint16)",
    "function chapterSaleMinted(uint256) view returns (uint16)",
    "function chapterActive(uint256) view returns (bool)",
    "function setTicketPrice(uint256)",
  ];
  const ticketHub = new ethers.Contract(ticketHubAddress, abi, signer);
  const code = await ethers.provider.getCode(ticketHubAddress);
  if (code === "0x") throw new Error("TICKET_HUB has no deployed bytecode");

  const [contractOwner, paused, currentPrice, curve, ownerBalance] = await Promise.all([
    ticketHub.owner(),
    ticketHub.paused(),
    ticketHub.ticketPrice(),
    ticketHub.priceIncreasePerMint(),
    signer.getBalance(),
  ]);
  if (ethers.utils.getAddress(contractOwner) !== expectedOwner) {
    throw new Error(`TicketHub owner is ${contractOwner}, expected ${expectedOwner}`);
  }
  if (!curve.eq(expectedCurve)) {
    throw new Error(`TicketHub curve is ${curve.toString()}, expected ${expectedCurve.toString()}`);
  }

  const chapters = [];
  for (let chapterId = 1; chapterId <= chapterCount; chapterId += 1) {
    const [marketingCap, marketingMinted, saleCap, saleMinted, active] = await Promise.all([
      ticketHub.chapterMarketingCap(chapterId),
      ticketHub.chapterMarketingMinted(chapterId),
      ticketHub.chapterSaleCap(chapterId),
      ticketHub.chapterSaleMinted(chapterId),
      ticketHub.chapterActive(chapterId),
    ]);
    const state = {
      chapterId,
      marketingCap: asNumber(marketingCap),
      marketingMinted: asNumber(marketingMinted),
      saleCap: asNumber(saleCap),
      saleMinted: asNumber(saleMinted),
      active,
    };
    chapters.push(state);
    if (state.marketingCap !== expectedMarketingCap || state.marketingMinted !== expectedMarketingCap) {
      throw new Error(`Chapter ${chapterId} marketing allocation is not ${expectedMarketingCap}/${expectedMarketingCap}`);
    }
    if (state.saleCap !== expectedSaleCap || state.saleMinted !== 0) {
      throw new Error(`Chapter ${chapterId} paid allocation is not ready (${state.saleMinted}/${state.saleCap})`);
    }
    if (state.active) throw new Error(`Chapter ${chapterId} is already active`);
  }

  if (!currentPrice.eq(marketingPrice) && !currentPrice.eq(publicPrice)) {
    throw new Error(
      `Current TicketHub price ${ethers.utils.formatEther(currentPrice)} POL is neither marketing nor public price`
    );
  }

  const report = {
    checkedAt: new Date().toISOString(),
    network: network.name,
    chainId: chain.chainId,
    mode: execute ? "execute" : "dry-run",
    ticketHub: ticketHubAddress,
    owner: contractOwner,
    ownerBalanceWei: ownerBalance.toString(),
    paused,
    currentPriceWei: currentPrice.toString(),
    targetPriceWei: publicPrice.toString(),
    priceIncreasePerMint: curve.toString(),
    chapters,
    transactionHash: lastExecution?.transactionHash || null,
    blockNumber: lastExecution?.blockNumber || null,
    lastExecution,
  };

  if (currentPrice.eq(publicPrice)) {
    report.result = "already-configured";
  } else {
    const fees = await feeOverrides();
    const gasEstimate = await ticketHub.estimateGas.setTicketPrice(publicPrice, fees);
    report.gasEstimate = gasEstimate.toString();
    if (!execute) {
      report.result = "ready-to-execute";
    } else {
      const tx = await ticketHub.setTicketPrice(publicPrice, {
        ...fees,
        gasLimit: gasEstimate.mul(120).div(100),
      });
      console.log(`Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait(envInt("TX_CONFIRMATIONS", 2));
      if (receipt.status !== 1) throw new Error(`Transaction failed: ${tx.hash}`);
      const verifiedPrice = await ticketHub.ticketPrice();
      if (!verifiedPrice.eq(publicPrice)) {
        throw new Error(`Post-transaction price mismatch: ${verifiedPrice.toString()}`);
      }
      report.result = "configured";
      report.transactionHash = tx.hash;
      report.blockNumber = receipt.blockNumber;
      report.lastExecution = {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        executedAt: new Date().toISOString(),
      };
      report.currentPriceWei = verifiedPrice.toString();
    }
  }

  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    result: report.result,
    mode: report.mode,
    currentPriceWei: report.currentPriceWei,
    targetPriceWei: report.targetPriceWei,
    transactionHash: report.transactionHash,
    report: reportFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
