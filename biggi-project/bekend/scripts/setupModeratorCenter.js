// Setup ModeratorCenter wiring
// Run: npx hardhat run scripts/setupModeratorCenter.js --network polygon

const { ethers } = require("hardhat");

async function main() {
  const MODERATOR_CENTER =
    process.env.MODERATOR_CENTER ||
    "0x41D9c920aB2779305d1B024e8Dc0B2087a74c6E6";
  const DISTRIBUTOR =
    process.env.DISTRIBUTOR ||
    "0xc8382527D0cb095fDa284547EA91eC352E7C75Cd";
  const DRIP_LM =
    process.env.DRIP_LM || "0xD32fC50c153Ab47F68763c739A2deA8b5Da81373";

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("ModeratorCenter:", MODERATOR_CENTER);
  console.log("Distributor:", DISTRIBUTOR);
  console.log("DripLM:", DRIP_LM);

  const moderatorAbi = [
    "function multiCollection() view returns (address)",
    "function setMultiCollection(address)",
  ];
  const dripLmAbi = [
    "function moderatorCenter() view returns (address)",
    "function setModeratorCenter(address)",
  ];

  const moderator = new ethers.Contract(
    MODERATOR_CENTER,
    moderatorAbi,
    deployer,
  );
  const dripLm = new ethers.Contract(DRIP_LM, dripLmAbi, deployer);

  const currentMc = await moderator.multiCollection();
  if (currentMc.toLowerCase() !== DISTRIBUTOR.toLowerCase()) {
    const tx = await moderator.setMultiCollection(DISTRIBUTOR);
    console.log("setMultiCollection tx:", tx.hash);
    await tx.wait();
    console.log("setMultiCollection done.");
  } else {
    console.log("setMultiCollection: already set.");
  }

  const currentMod = await dripLm.moderatorCenter();
  if (currentMod.toLowerCase() !== MODERATOR_CENTER.toLowerCase()) {
    const tx = await dripLm.setModeratorCenter(MODERATOR_CENTER);
    console.log("setModeratorCenter tx:", tx.hash);
    await tx.wait();
    console.log("setModeratorCenter done.");
  } else {
    console.log("setModeratorCenter: already set.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
