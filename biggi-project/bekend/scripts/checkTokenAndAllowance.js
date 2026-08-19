// scripts/checkTokenAndAllowance.js
const path = require("path");
const { ethers } = require("hardhat");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function main() {
  const {
    PRIVATE_KEY,
    FACTORY,
    ROUTER,
    BIGGI,
    PAIR
  } = process.env;

  if (!PRIVATE_KEY) {
    throw new Error("Missing PRIVATE_KEY in scripts/.env");
  }

  const provider = ethers.provider;
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const erc20Abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)"
  ];

  const token = new ethers.Contract(BIGGI, erc20Abi, provider);
  const decimals = await token.decimals();
  const name = await token.name().catch(() => "(no-name)");
  const symbol = await token.symbol().catch(() => "(no-symbol)");
  const bal = await token.balanceOf(signer.address);
  const allowance = await token.allowance(signer.address, ROUTER);

  console.log("Signer:", signer.address);
  console.log("Token:", BIGGI, name, symbol, "decimals:", decimals);
  console.log("Balance:", ethers.utils.formatUnits(bal, decimals));
  console.log("Allowance to router:", ethers.utils.formatUnits(allowance, decimals));
  if (PAIR) {
    console.log("Pair (given):", PAIR);
  }
  console.log("Router:", ROUTER);
  if (FACTORY) {
    console.log("Factory:", FACTORY);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
