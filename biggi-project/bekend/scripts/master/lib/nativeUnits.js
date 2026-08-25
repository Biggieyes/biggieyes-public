const { ethers } = require("ethers");

function parseNativeAmount(value, label = "native amount") {
  const raw = String(value == null ? "" : value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    throw new Error(`${label} must be a non-negative decimal amount in native token units`);
  }
  return ethers.utils.parseEther(raw);
}

module.exports = { parseNativeAmount };
