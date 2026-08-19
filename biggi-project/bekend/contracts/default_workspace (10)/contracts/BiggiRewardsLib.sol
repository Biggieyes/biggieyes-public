// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BiggiRewardsLib {
    // --- Kontrola eligibility pro Orange Reward (všech 10 backgroundů pro jedno mainId v bloku) ---
    function isOrangeEligible(
        address user,
        uint16 blockIdx,
        uint256 mainId,
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf,
        function(uint256) pure returns (uint256) tokenIdFromNftIndex
    ) internal view returns (bool) {
        // Pouze Orange blok (blockIdx == 1) má 10 backgroundů na jeden mainId
        if (blockIdx != 1) return false;
        for (uint16 bg = 1; bg <= 10; bg++) {
            uint256 idx = (blockIdx - 1) * 100 + (mainId - 1) * 10 + (bg - 1) + 1;
            uint256 tokenId = tokenIdFromNftIndex(idx);
            if (!exists(tokenId) || ownerOf(tokenId) != user) {
                return false;
            }
        }
        return true;
    }

    // --- Kontrola eligibility pro Block Reward (všech 10 mainId s bg==1 v daném bloku) ---
    function isBlockEligible(
        address user,
        uint16 blockIdx,
        uint256 mainCount, // = _totalBlockNFTs(blockIdx)
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf,
        function(uint256) pure returns (uint256) tokenIdFromNftIndex
    ) internal view returns (bool) {
        // Rainbow blok (blockIdx == 10) není způsobilý
        if (blockIdx == 10) return false;
        for (uint256 mainId = 1; mainId <= mainCount; mainId++) {
            uint256 idx = (blockIdx - 1) * 100 + (mainId - 1) * 10 + (1 - 1) + 1; // bg==1
            uint256 tokenId = tokenIdFromNftIndex(idx);
            if (!exists(tokenId) || ownerOf(tokenId) != user) {
                return false;
            }
        }
        return true;
    }

    // --- Kontrola eligibility pro Rainbow Reward (všech 10 NFT v Rainbow bloku, bg==1, mainId 1–10) ---
    function isRainbowEligible(
        address user,
        uint256 mainCount, // = _totalBlockNFTs(10)
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf,
        function(uint256) pure returns (uint256) tokenIdFromNftIndex
    ) internal view returns (bool) {
        // Rainbow blok = blockIdx 10, mainId 1–10, bg==1
        uint16 blockIdx = 10;
        for (uint256 mainId = 1; mainId <= mainCount; mainId++) {
            uint256 idx = (blockIdx - 1) * 100 + (mainId - 1) * 10 + (1 - 1) + 1; // bg==1
            uint256 tokenId = tokenIdFromNftIndex(idx);
            if (!exists(tokenId) || ownerOf(tokenId) != user) {
                return false;
            }
        }
        return true;
    }
}
