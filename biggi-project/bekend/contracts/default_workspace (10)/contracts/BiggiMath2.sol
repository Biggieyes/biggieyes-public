// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/// @title BiggiMath2
/// @dev Utility knihovna pro matematické operace v BiggiEyes, zejména výpočet navyšování cen. Verze 2

library BiggiMath2 {
    /**
     * @dev Zvýší hodnotu o procentuální přírůstek (scaled by 1e4 = 10000 == 100%).
     * Např. increaseByPercent(1 ether, 10033) -> zvýší o 0.33 %.
     * @param value          Původní hodnota (např. cena v wei)
     * @param increasePercent Procento v "basis points" (10000 == 100 %)
     * @return Nová navýšená hodnota
     */
    function increaseByPercent(uint256 value, uint256 increasePercent) internal pure returns (uint256) {
        // Např. 1 ether * 10033 / 10000 = 1.0033 ether (zaokrouhleno dolů, integer aritmetika)
        return (value * increasePercent) / 10000;
    }
}
