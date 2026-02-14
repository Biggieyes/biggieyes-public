// Deploy BiggiBuybackDripSetup (orchestrator)
// Run: npx hardhat run scripts/deployBuybackDripSetup.js --network amoy
// Env: BUYBACK_AGENT, DRIP_LM, DRIP_DISTRIBUTOR, RESERVE, TREASURY, ROUTER, POLICY (optional)

const { ethers } = require("hardhat");

async function main() {
  const env = process.env;
  const [deployer] = await ethers.getSigners();
  const owner = env.OWNER || deployer.address;

  const cfg = {
    BUYBACK_AGENT:
      env.BUYBACK_AGENT || "0x06fC8552119d8B46e8dd19C54c81b9E3bDEfa266",
    DRIP_LM: env.DRIP_LM || "0xD32fC50c153Ab47F68763c739A2deA8b5Da81373",
    DRIP_DISTRIBUTOR:
      env.DRIP_DISTRIBUTOR || "0xbA5f786863a17a79A08bc1C35171aD5F32cDC310",
    RESERVE: env.RESERVE || "0xC700EA8E43259C832C2438D01F60C88752894B8f",
    TREASURY: env.TREASURY || "0xE2fa9DFFc69f53b42dC41681bfFd22dA74c64461",
    ROUTER: env.ROUTER || "0xB767E3Cd07fD0Dd96827895AB8b3801A3b141e8a",
    POLICY: env.POLICY || "0xeaf0b4561CF70D130ff4E68C3558f77b432C2EC1",
  };

  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("Args:", cfg);

  const Factory = await ethers.getContractFactory("BiggiBuybackDripSetup");
  const setup = await Factory.deploy(
    owner,
    cfg.BUYBACK_AGENT,
    cfg.DRIP_LM,
    cfg.DRIP_DISTRIBUTOR,
    cfg.RESERVE,
    cfg.TREASURY,
    cfg.ROUTER,
    cfg.POLICY,
  );
  await setup.deployed();
  console.log("BiggiBuybackDripSetup:", setup.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
