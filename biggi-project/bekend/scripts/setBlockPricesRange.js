const { ethers } = require("hardhat");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function setOnContract(contract, label) {
  console.log(`Setting block prices on ${label}...`);
  for (let i = 1; i <= 10; i++) {
    const price = ethers.utils.parseEther(String(i));
    const tx = await contract.setBlockCurrentPrice(i, price);
    console.log(`  block ${i} -> ${price.toString()} (tx ${tx.hash})`);
    await tx.wait();
  }
  console.log(`${label} done.`);
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const mainAddr = requireEnv("MAIN");
  const main = await ethers.getContractAt("BiggiEyesMain", mainAddr, signer);
  await setOnContract(main, `Main ${mainAddr}`);

  const main2Addr = process.env.MAIN2;
  if (main2Addr) {
    const main2 = await ethers.getContractAt("BiggiEyesMain2", main2Addr, signer);
    await setOnContract(main2, `Main2 ${main2Addr}`);
  } else {
    console.log("MAIN2 not set, skipping Main2.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
