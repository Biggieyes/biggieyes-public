// scripts/mintIfOwner.js
const path = require("path");
const { ethers } = require("hardhat");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function main() {
  const provider = ethers.provider;
  const pk = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("Set PRIVATE_KEY in scripts/.env (or DEPLOYER_PRIVATE_KEY).");
  const signer = new ethers.Wallet(pk, provider);

  const BIGGI = process.env.BIGGI;
  const AMOUNT_TO_MINT = process.env.LIQ_TOKEN_AMOUNT || "1000";
  if (!BIGGI) throw new Error("Set BIGGI in scripts/.env");

  const erc20AbiWithMint = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function CAP() view returns (uint256)",
    "function remainingMintable() view returns (uint256)",
    "function reserveAddr() view returns (address)",
    "function allowance(address,address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
    "function owner() view returns (address)",
    "function transferFromReserveTo(address,uint256)",
    // potential mint signatures (existence checked below)
    "function mint(address,uint256)",
    "function mint(address)",
    "function mint(uint256)",
    "function mintTo(address,uint256)",
    "function mintTo(address)",
    // common cap-style getters (optional)
    "function cap() view returns (uint256)",
    "function MAX_SUPPLY() view returns (uint256)",
    "function maxSupply() view returns (uint256)"
  ];

  console.log("Signer:", signer.address);
  const token = new ethers.Contract(BIGGI, erc20AbiWithMint, signer);

  const decimals = await token.decimals().catch(() => 18);
  const bal = await token.balanceOf(signer.address);
  const totalSupply = await token.totalSupply().catch(() => null);
  const capConst = await token.CAP().catch(() => null);
  const remainingMintable = await token.remainingMintable().catch(() => null);
  const reserveAddr = await token.reserveAddr().catch(() => null);
  const reserveBal = reserveAddr ? await token.balanceOf(reserveAddr).catch(() => null) : null;
  let capValue = null;
  for (const capFn of ["cap", "MAX_SUPPLY", "maxSupply"]) {
    if (token.interface.functions[`${capFn}()`]) {
      capValue = await token[capFn]().catch(() => null);
      if (capValue) break;
    }
  }

  console.log("Current balance:", ethers.utils.formatUnits(bal, decimals));
  if (totalSupply) {
    console.log("totalSupply:", ethers.utils.formatUnits(totalSupply, decimals));
  }
  if (capConst) {
    console.log("CAP (const):", ethers.utils.formatUnits(capConst, decimals));
  }
  if (capValue) {
    console.log("Cap/MAX_SUPPLY:", ethers.utils.formatUnits(capValue, decimals));
    if (totalSupply) {
      const remaining = capValue.sub(totalSupply);
      console.log("Remaining until cap:", ethers.utils.formatUnits(remaining, decimals));
    }
  } else if (remainingMintable) {
    console.log("remainingMintable():", ethers.utils.formatUnits(remainingMintable, decimals));
  }
  if (reserveAddr) {
    console.log("reserveAddr:", reserveAddr, reserveBal ? `bal=${ethers.utils.formatUnits(reserveBal, decimals)}` : "");
  }

  // read owner (if available)
  let ownerAddr = null;
  try {
    ownerAddr = await token.owner();
    console.log("Token owner():", ownerAddr);
  } catch (e) {
    console.log("owner() not available in token interface (or reverted).");
  }

  if (ownerAddr && ownerAddr.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("You are not the token owner. Use the owner key or ask the owner to mint/transfer.");
    return;
  }

  const amountWei = ethers.utils.parseUnits(AMOUNT_TO_MINT.toString(), decimals);
  const iface = token.interface;
  const feeData = await provider.getFeeData();
  const minTip = ethers.utils.parseUnits("30", "gwei"); // keep above network min
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas.gt(minTip)
    ? feeData.maxPriorityFeePerGas
    : minTip;
  const maxFeePerGas = feeData.maxFeePerGas && feeData.maxFeePerGas.gt(maxPriorityFeePerGas.mul(2))
    ? feeData.maxFeePerGas
    : maxPriorityFeePerGas.mul(2);
  const txOpts = { maxPriorityFeePerGas, maxFeePerGas };

  // try mint if there is remaining cap
  let minted = false;
  const tryMints = [
    "mint(address,uint256)",
    "mint(address)",
    "mint(uint256)",
    "mintTo(address,uint256)",
    "mintTo(address)"
  ];
  const canMint = !remainingMintable || remainingMintable.gt(0);
  if (canMint) {
    for (const sig of tryMints) {
      if (iface.functions[sig]) {
        const fn = token[sig] || token.functions?.[sig];
        if (!fn) continue;
        try {
          console.log("Calling", sig, "->", AMOUNT_TO_MINT, "tokens (wei:", amountWei.toString(), ")");
          let args = [];
          if (sig === "mint(address,uint256)" || sig === "mintTo(address,uint256)") {
            args = [signer.address, amountWei];
          } else if (sig === "mint(address)" || sig === "mintTo(address)") {
            args = [signer.address];
          } else if (sig === "mint(uint256)") {
            args = [amountWei];
          }
          const tx = await fn(...args, txOpts);
          console.log("Mint tx:", tx.hash);
          const r = await tx.wait();
          console.log("Mint receipt status:", r.status);
          minted = true;
          break;
        } catch (err) {
          console.log("Error calling", sig, "-", err.message || err);
        }
      }
    }
  }

  // fallback: transfer from reserve if cap reached but reserve has balance
  if (!minted && reserveAddr && reserveBal && reserveBal.gte(amountWei) && iface.functions["transferFromReserveTo(address,uint256)"]) {
    try {
      console.log("Mint unavailable; attempting transferFromReserveTo from reserve to signer...");
      const tx = await token.transferFromReserveTo(signer.address, amountWei, txOpts);
      console.log("transferFromReserveTo tx:", tx.hash);
      const r = await tx.wait();
      console.log("transferFromReserveTo receipt status:", r.status);
      minted = true;
    } catch (err) {
      console.log("Error calling transferFromReserveTo:", err.message || err);
    }
  }

  if (!minted) {
    console.log("Could not mint/transfer tokens. Cap may be reached and reserve may be empty or transfer failed.");
  } else {
    const newBal = await token.balanceOf(signer.address);
    console.log("New balance:", ethers.utils.formatUnits(newBal, decimals));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
