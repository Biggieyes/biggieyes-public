// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BiggiMath2.sol"; // Upravená utilitní knihovna

library BiggiPriceLibrary2 {
    using BiggiMath2 for uint256;

    struct BlockInfo {
        uint256 basePrice;     // Výchozí cena bloku (např. 0.1 ether)
        uint256 priceIncrease; // Růst ceny v basis points (např. 10033 = +0.33%)
        uint256 currentPrice;  // Aktuální cena (dynamicky)
        uint16 mintCount;      // Počet NFT s daným background, které už byly mintnuté
    }

    /// Inicializuje všech 10 bloků najednou
    function initializeBlocks(
        BlockInfo[10] storage blocks,
        uint256[10] memory basePrices,
        uint256[10] memory priceIncreases
    ) internal {
        for (uint8 i = 0; i < 10; i++) {
            blocks[i] = BlockInfo({
                basePrice: basePrices[i],
                priceIncrease: priceIncreases[i], // např. 10033 = +0.33 %
                currentPrice: basePrices[i],
                mintCount: 0
            });
        }
    }

    /// Navyšuje aktuální cenu pro zadaný background (barvu) po každém mintu s tímto pozadím
    function updatePrice(BlockInfo storage blockInfo) internal {
        blockInfo.currentPrice = blockInfo.currentPrice.increaseByPercent(blockInfo.priceIncrease);
        blockInfo.mintCount++;
    }

    /// Vrací aktuální cenu backgroundu/bloku
    function getCurrentPrice(BlockInfo storage blockInfo) internal view returns (uint256) {
        return blockInfo.currentPrice;
    }

    /// Vrací kolik NFT s tímto backgroundem už bylo mintnuto
    function getMintCount(BlockInfo storage blockInfo) internal view returns (uint16) {
        return blockInfo.mintCount;
    }
}
