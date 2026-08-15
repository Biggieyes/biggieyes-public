// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiPriceMathLib
/// @dev Shared pricing primitives for BiggiEyes block and ticket pricing.
library BiggiPriceMathLib {
    /**
     * @dev Increase a value by a basis-point style percent where 10000 == 100%.
     */
    function increaseByPercent(uint256 value, uint256 increasePercent) internal pure returns (uint256) {
        return (value * increasePercent) / 10000;
    }

    struct BlockInfo {
        uint256 basePrice;
        uint256 priceIncrease;
        uint256 currentPrice;
        uint16 mintCount;
    }

    /// @dev Initialize all 10 blocks in one pass.
    function initializeBlocks(
        BlockInfo[10] storage blocks,
        uint256[10] memory basePrices,
        uint256[10] memory priceIncreases
    ) internal {
        for (uint8 i = 0; i < 10; i++) {
            blocks[i] = BlockInfo({
                basePrice: basePrices[i],
                priceIncrease: priceIncreases[i],
                currentPrice: basePrices[i],
                mintCount: 0
            });
        }
    }
}
