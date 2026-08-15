// Wire BiggiEyesMain (VRF collection)
// Env (req): MAIN
// Env (opt): VRF_ROUTER, COMPUTE, DISTRIBUTOR, RESERVE, BIGGI, BIGGI_RATE, TOKEN_SINK, TOKEN_SINK_BPS,
//            TICKET_PRICE, PRICE_INCREASE_BPS, BLOCK_IDX, BLOCK_PRICE
// Run: MAIN=<addr> [VRF_ROUTER=<addr>] [DISTRIBUTOR=<addr>] ... npx hardhat run scripts/setupMain.js --network <net>

const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const mainAddr = requireEnv("MAIN");
  const vrfRouter = process.env.VRF_ROUTER;
  const compute = process.env.COMPUTE;
  const distributor = process.env.DISTRIBUTOR;
  const reserve = process.env.RESERVE;
  const biggi = process.env.BIGGI;
  const biggiRate = process.env.BIGGI_RATE;
  const tokenSink = process.env.TOKEN_SINK;
  const tokenSinkBps = process.env.TOKEN_SINK_BPS;
  const ticketPrice = process.env.TICKET_PRICE;
  const priceIncrease = process.env.PRICE_INCREASE_BPS;
  const blockIdx = process.env.BLOCK_IDX;
  const blockPrice = process.env.BLOCK_PRICE;

  const main = await ethers.getContractAt("BiggiEyesMain", mainAddr, signer);

  if (vrfRouter || compute) {
    await (await main.setModules(compute || ethers.constants.AddressZero, vrfRouter || ethers.constants.AddressZero)).wait();
    console.log("Modules set:", { compute, vrfRouter });
  }
  if (distributor) {
    await (await main.setDistributor(distributor)).wait();
    console.log("Distributor set:", distributor);
  }
  if (reserve) {
    await (await main.setReserveAddress(reserve)).wait();
    console.log("Reserve set:", reserve);
  }
  if (biggi) {
    await (await main.setBiggiToken(biggi)).wait();
    console.log("BIGGI token set:", biggi);
  }
  if (biggiRate) {
    await (await main.setBiggiRate(biggiRate)).wait();
    console.log("BIGGI rate set:", biggiRate);
  }
  if (tokenSink || tokenSinkBps) {
    const sink = tokenSink || ethers.constants.AddressZero;
    const bps = tokenSinkBps || 10_000;
    await (await main.setTokenSink(sink, bps)).wait();
    console.log("Token sink set:", sink, bps);
  }
  if (ticketPrice) {
    await (await main.setTicketPrice(ticketPrice)).wait();
    console.log("Ticket price set:", ticketPrice);
  }
  if (priceIncrease) {
    await (await main.setPriceIncreasePerMint(priceIncrease)).wait();
    console.log("Price increase per mint set (bps):", priceIncrease);
  }
  if (blockIdx && blockPrice) {
    await (await main.setBlockCurrentPrice(blockIdx, blockPrice)).wait();
    console.log("Block price set:", blockIdx, blockPrice);
  }

  console.log("Main setup done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
