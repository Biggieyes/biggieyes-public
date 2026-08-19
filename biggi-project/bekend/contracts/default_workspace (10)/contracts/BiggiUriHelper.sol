// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiUriHelper
/// @dev Pomáhá generovat URI pro metadata a obrázky v NFT projektu BiggiEyesLottery.
/// Používá konvenci: Biggi_{mainId}_{blockName}_{backgroundName}.json
/// Příklad: Biggi_81_PINK_B.json

library BiggiUriHelper {
    /// @notice Vytvoří plné URI pro hlavní NFT soubor (Biggi_81_PINK_B.json)
    function buildNftUri(
        string memory base,
        uint256 mainId,
        string memory blockName,       // celý název bloku, např. "PINK"
        string memory backgroundName   // zkratka pozadí, např. "B"
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

    /// @notice Vytvoří URI pro reward NFT (např. Biggi_101_REWARDS_RB.json)
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

    /// @notice Vytvoří URI pro character NFT (např. Biggi_110_REWARD_Homer.json)
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

    /// @notice Vytvoří URI pro vstupenku (mint ticket)
    function buildTicketUri(
        string memory base
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_RANDOM_MINT_TICKET.json"
        );
    }

    /// Pomocná funkce pro převod uint256 na string (bez závislosti na OpenZeppelin)
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
