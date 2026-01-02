// scripts/deployDexAndPair.js
// Spustit: npx hardhat run scripts/deployDexAndPair.js --network amoy

require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const env = process.env;
  const needed = ["BIGGI", AMOY_RPC_URL = "AMOY_RPC_URL", "PRIVATE_KEY"];
  // Basic env check
  if (!env.BIGGI) throw new Error("Chybí .env: BIGGI (adresa tokenu)");
  if (!env.PRIVATE_KEY) throw new Error("Chybí .env: PRIVATE_KEY");

  // Tvoje lokální cesta k WETH souboru (ten jsi uvedl) — Hardhat zkompiluje ten contract
  // cesta (přesně tak, jak jsi poslal):
  // contracts/default_workspace (10)/contracts/BIGGIMAINTEST/UNISWAPV2forTEST/BiggiWETH9.sol
  console.log("Používám WETH z lokálního souboru:", "contracts/default_workspace (10)/contracts/BIGGIMAINTEST/UNISWAPV2forTEST/BiggiWETH9.sol");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Deploy Factory
  const Factory = await ethers.getContractFactory("FactoryWrapper");
  const factory = await Factory.connect(deployer).deploy();
  await factory.deployed();
  console.log("Factory deployed:", factory.address);

  // 2) Deploy / use WETH: pokud máš WETH contract v projektu (cestu výše), tak ho Hardhat zkompiluje.
  // Zkusíme najít compiled artifact podle názvu: BiggiWETH9 (podle názvu souboru)
  let weth;
  try {
    const WETH = await ethers.getContractFactory("BiggiWETH9");
    weth = await WETH.connect(deployer).deploy();
    await weth.deployed();
    console.log("WETH deployed (new):", weth.address);
  } catch (err) {
    console.log("Nepodařilo se nasadit BiggiWETH9 z projektu — zkusím vytvořit router s předanou adresou z .env (WETH), pokud ji máš.");
    if (!env.WETH) throw new Error("Chybí .env: WETH adresa nebo v projektu nenalezen contract BiggiWETH9.");
  }

  const wethAddress = weth ? weth.address : env.WETH;
  if (!wethAddress) throw new Error("WETH adresa není dostupná (nenasazen, ani v .env).");

  // 3) Deploy Router (wrapper)
  const Router = await ethers.getContractFactory("RouterWrapper");
  const router = await Router.connect(deployer).deploy(factory.address, wethAddress);
  await router.deployed();
  console.log("Router deployed:", router.address);

  // 4) (Optional) Deploy pair via factory.createPair(token, weth)
  const tokenAddr = env.BIGGI;
  console.log("Creating pair for:", tokenAddr, "<->", wethAddress);

  const tx = await factory.createPair(tokenAddr, wethAddress);
  const rc = await tx.wait();
  console.log("createPair tx hash:", tx.hash);

  // Read pair address from factory.getPair
  const pairAddr = await factory.getPair(tokenAddr, wethAddress);
  console.log("Pair address:", pairAddr);

  console.log("\n--- SUMMARY ---");
  console.log("Factory:", factory.address);
  console.log("Router :", router.address);
  console.log("WETH   :", wethAddress);
  console.log("Pair   :", pairAddr);

  console.log("\nTeď máš funkční Factory+Router a vytvořený pair. Další krok: přidání likvidity (approve token -> router.addLiquidityETH).");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
