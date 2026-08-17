const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const [owner] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("BiggiTicketHub");
  const hub = await factory.deploy(owner.address, owner.address);
  await hub.deployed();
  await (await hub.setTicketCaps(500, 50)).wait();
  const gas = await hub.estimateGas.mintMarketingTicketsForChapter(1, owner.address, 50);
  console.log(`Batch mint 50 estimated gas: ${gas.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
