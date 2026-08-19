// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BiggiCompute {
    // jednorázový bonus podle pozadí (finalPrice = blockPrice * (1 + bonus%))
    function bgBonus(uint16 bg) external pure returns (uint8) {
        if (bg == 1) return 5;
        if (bg == 2) return 10;
        if (bg == 3) return 15;
        if (bg == 4) return 20;
        if (bg == 5) return 25;
        if (bg == 6) return 30;
        if (bg == 7) return 35;
        if (bg == 8) return 40;
        if (bg == 9) return 45;
        if (bg == 10) return 50;
        return 0;
    }

    // trvalé zvýšení ceny „stejné barvy bloku“ (při mintu s tímto pozadím)
    function bgIncreasePct(uint16 bg) external pure returns (uint8) {
        if (bg == 1) return 5;
        if (bg == 2) return 2;
        if (bg == 3) return 2;
        if (bg == 4) return 3;
        if (bg == 5) return 3;
        if (bg == 6) return 4;
        if (bg == 7) return 4;
        if (bg == 8) return 5;
        if (bg == 9) return 5;
        if (bg == 10) return 10;
        return 0;
    }
}
