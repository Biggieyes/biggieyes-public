// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BiggiNamesLib {
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

    function backgroundShort(uint16 idx) public pure returns (string memory) {
        if (idx == 1) return "O";
        if (idx == 2) return "B";
        if (idx == 3) return "W";
        if (idx == 4) return "BR";
        if (idx == 5) return "BL";
        if (idx == 6) return "G";
        if (idx == 7) return "V";
        if (idx == 8) return "R";
        if (idx == 9) return "P";
        if (idx == 10) return "RB";
        revert("bg");
    }

    function characterName(uint16 blockIdx) public pure returns (string memory) {
        if (blockIdx == 1) return "Cosmonaut";
        if (blockIdx == 2) return "Snowman";
        if (blockIdx == 3) return "Bugs";
        if (blockIdx == 4) return "Pig";
        if (blockIdx == 5) return "Mickey";
        if (blockIdx == 6) return "Santa";
        if (blockIdx == 7) return "Woody";
        if (blockIdx == 8) return "Buzz";
        if (blockIdx == 9) return "Bart";
        if (blockIdx == 10) return "Homer";
        revert("char");
    }
}
