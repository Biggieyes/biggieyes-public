// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiMetaRedeemLib
/// @dev Shared URI builders for BiggiEyes metadata files.
library BiggiMetaRedeemLib {
    function buildNftUri(
        string memory base,
        uint256 mainId,
        string memory blockName,
        string memory backgroundName
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_",
            _toString(mainId),
            "_",
            blockName,
            "_",
            backgroundName,
            ".json"
        );
    }

    function buildRewardUri(
        string memory base,
        uint256 rewardId
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_",
            _toString(rewardId),
            "_REWARDS_RB.json"
        );
    }

    function buildCharacterUri(
        string memory base,
        uint256 characterId,
        string memory characterName
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_",
            _toString(characterId),
            "_REWARD_",
            characterName,
            ".json"
        );
    }

    function buildPublicCharacterUri(
        string memory base,
        uint256 characterId
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_",
            _toString(characterId),
            "_REWARD.json"
        );
    }

    function buildTicketUri(
        string memory base
    ) internal pure returns (string memory uri) {
        return string.concat(base, "Biggi_RANDOM_MINT_TICKET.json");
    }

    // Small local uint256-to-string helper to avoid extra dependency wiring here.
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
