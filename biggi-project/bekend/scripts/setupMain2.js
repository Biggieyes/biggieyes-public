// Wire BiggiEyesMain2 (public collection)
// Env (req): MAIN2, PRICE_PROVIDER (address of Main VRF)
// Env (opt): DISTRIBUTOR, BIGGI, BIGGI_RATE, TOKEN_SINK, TOKEN_SINK_BPS, TOKEN_SINK_DEPOSIT_MODE,
//            RESERVE, BLOCK_IDX, BLOCK_PRICE
// Run: MAIN2=<addr> PRICE_PROVIDER=<addr> npx hardhat run scripts/setupMain2.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const main2Addr = requireEnv("MAIN2");
  const priceProvider = requireEnv("PRICE_PROVIDER"); // Main (VRF) address
  const distributor = process.env.DISTRIBUTOR;
  const biggi = process.env.BIGGI;
  const biggiRate = process.env.BIGGI_RATE;
  const tokenSink = process.env.TOKEN_SINK;
  const tokenSinkBps = process.env.TOKEN_SINK_BPS;
  const tokenSinkDepositMode = process.env.TOKEN_SINK_DEPOSIT_MODE;
  const reserve = process.env.RESERVE;
  const blockIdx = process.env.BLOCK_IDX;
  const blockPrice = process.env.BLOCK_PRICE;

  const main2 = await ethers.getContractAt("BiggiEyesMain2", main2Addr, signer);

  await (await main2.setPriceProvider(priceProvider)).wait();
  console.log("Price provider set (Main):", priceProvider);

  if (distributor) {
    await (await main2.setDistributor(distributor)).wait();
    console.log("Distributor set:", distributor);
  }
  if (biggi) {
    await (await main2.setBiggiToken(biggi)).wait();
    console.log("BIGGI token set:", biggi);
  }
  if (biggiRate) {
    await (await main2.setBiggiRate(biggiRate)).wait();
    console.log("BIGGI rate set:", biggiRate);
  }
  if (tokenSink || tokenSinkBps) {
    const sink = tokenSink || ethers.constants.AddressZero;
    const bps = tokenSinkBps || 10_000;
    await (await main2.setTokenSink(sink, bps)).wait();
    console.log("Token sink set:", sink, bps);
  }
  if (tokenSinkDepositMode) {
    const enabled = ["1", "true", "yes", "on"].includes(String(tokenSinkDepositMode).toLowerCase());
    await (await main2.setTokenSinkDepositMode(enabled)).wait();
    console.log("Token sink deposit mode set:", enabled);
  }
  if (reserve) {
    await (await main2.setReserveAddress(reserve)).wait();
    console.log("Reserve set:", reserve);
  }
  if (blockIdx && blockPrice) {
    await (await main2.setBlockCurrentPrice(blockIdx, blockPrice)).wait();
    console.log("Block price set:", blockIdx, blockPrice);
  }

  console.log("Main2 setup done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
