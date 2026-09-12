const { ethers } = require("hardhat");

async function nftRewardsVersion(address, provider = ethers.provider) {
  const contract = new ethers.Contract(address, [
    "function usedVrfRequestIds(uint256) view returns(bool)",
    "function mainContract() view returns(address)",
  ], provider);
  try {
    await contract.usedVrfRequestIds(0);
    return 2;
  } catch (error) {
    if (error.code !== "CALL_EXCEPTION") throw error;
    // A failed RPC or empty address must not be mistaken for the legacy version.
    await contract.mainContract();
    return 1;
  }
}

module.exports = { nftRewardsVersion };
