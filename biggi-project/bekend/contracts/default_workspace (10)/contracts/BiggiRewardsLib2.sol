// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BiggiRewardsLib2 {
    // --- Kontrola eligibility pro Orange Reward (všech 10 backgroundů pro jedno mainId v bloku) ---
    function isOrangeEligible(
        address user,
        uint256[10] memory tokenIds,
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf
    ) internal view returns (bool) {
        for (uint8 i = 0; i < 10; i++) {
            if (!exists(tokenIds[i]) || ownerOf(tokenIds[i]) != user) {
                return false;
            }
        }
        return true;
    }

    // --- Kontrola eligibility pro Block Reward (všech N mainId s bg==1 v daném bloku) ---
    function isBlockEligible(
        address user,
        uint256[] memory tokenIds,
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf
    ) internal view returns (bool) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!exists(tokenIds[i]) || ownerOf(tokenIds[i]) != user) {
                return false;
            }
        }
        return true;
    }

    // --- Kontrola eligibility pro Rainbow Reward (všech 10 NFT v Rainbow bloku, bg==1, mainId 1–10) ---
    function isRainbowEligible(
        address user,
        uint256[] memory tokenIds,
        function(uint256) external view returns (bool) exists,
        function(uint256) external view returns (address) ownerOf
    ) internal view returns (bool) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!exists(tokenIds[i]) || ownerOf(tokenIds[i]) != user) {
                return false;
            }
        }
        return true;
    }
}
