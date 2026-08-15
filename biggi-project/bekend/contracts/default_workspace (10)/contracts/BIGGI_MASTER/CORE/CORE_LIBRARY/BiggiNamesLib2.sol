// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BiggiNamesLib2 {
    function blockName(uint16 idx) public pure returns (string memory) {
        if (idx == 1) return "ORANGE";
        if (idx == 2) return "BLACK";
        if (idx == 3) return "WHITE";
        if (idx == 4) return "BROWN";
        if (idx == 5) return "BLUE";
        if (idx == 6) return "GREEN";
        if (idx == 7) return "VIOLET";
        if (idx == 8) return "RED";
        if (idx == 9) return "PINK";
        if (idx == 10) return "RAINBOW";
        revert("name");
    }

    // Public branch uses one shared PUBLIC background suffix.
    function backgroundShort(uint16 /* idx */) public pure returns (string memory) {
        return "PUBLIC";
    }
}
