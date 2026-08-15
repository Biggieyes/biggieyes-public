// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiMetaRedeemLib
/// @dev Sjednocené utility pro redeem (VRF ticket) a generování URI v BiggiEyes.

library BiggiMetaRedeemLib {
    // === Redeem Helper ===

    function validateTicket(
        mapping(uint256 => bool) storage isTicket,
        mapping(address => uint256) storage ticketCount,
        uint256 ticketId,
        address user
    ) internal view {
        require(isTicket[ticketId], "Not a ticket");
        require(ticketCount[user] > 0, "User does not own any ticket");
    }

    function burnTicket(
        mapping(uint256 => bool) storage isTicket,
        mapping(address => uint256) storage ticketCount,
        uint256 ticketId,
        address user
    ) internal {
        isTicket[ticketId] = false;
        require(ticketCount[user] > 0, "Nothing to burn");
        ticketCount[user]--;
    }

    function setPendingRequest(
        mapping(address => uint256) storage pendingMintRequest,
        mapping(uint256 => address) storage pendingMinters,
        address user,
        uint256 requestId
    ) internal {
        require(pendingMintRequest[user] == 0, "Already pending");
        pendingMintRequest[user] = requestId;
        pendingMinters[requestId] = user;
    }

    function clearPendingRequest(
        mapping(address => uint256) storage pendingMintRequest,
        mapping(uint256 => address) storage pendingMinters,
        address user,
        uint256 requestId
    ) internal {
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
    }

    // === URI Helper ===

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

    function buildTicketUri(
        string memory base
    ) internal pure returns (string memory uri) {
        return string.concat(
            base,
            "Biggi_RANDOM_MINT_TICKET.json"
        );
    }

    // Pomocná funkce pro převod uint256 na string (bez OZ)
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
