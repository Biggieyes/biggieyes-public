// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiIdIndexLib
/// @dev Helper library for token ranges, NFT metadata structs, and index checks.
library BiggiIdIndexLib {
    // --- Token ranges ---
    uint256 internal constant TICKET_OFFSET = 1;
    uint256 internal constant BIGGI_OFFSET = 1001;
    uint256 internal constant CHARACTER_OFFSET = 2001;
    uint256 internal constant REWARDS_OFFSET = 3001;
    uint256 internal constant MAX_SUPPLY = 550;

    // --- NFTInfo struct ---
    struct NFTInfo {
        bool minted;
        uint16 background;
        uint16 blockIdx;
        uint256 mainId;
        uint256 ticketPrice;
        uint256 blockPrice;
        uint256 finalPrice;
    }

    // --- ID helpers ---
    function isTicket(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= TICKET_OFFSET && tokenId < BIGGI_OFFSET;
    }

    function isMainNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= BIGGI_OFFSET && tokenId < CHARACTER_OFFSET;
    }

    function isCharacterNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= CHARACTER_OFFSET && tokenId < REWARDS_OFFSET;
    }

    function isRewardNft(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= REWARDS_OFFSET && tokenId < REWARDS_OFFSET + 20;
    }

    function nftIndexFromTokenId(uint256 tokenId) internal pure returns (uint256) {
        require(isMainNft(tokenId), "Not a main NFT");
        return tokenId - BIGGI_OFFSET + 1;
    }

    function tokenIdFromNftIndex(uint256 idx) internal pure returns (uint256) {
        require(idx >= 1 && idx <= MAX_SUPPLY, "Index out of range");
        return BIGGI_OFFSET + idx - 1;
    }

    function isValidMintIndex(uint256 idx) internal pure returns (bool) {
        return idx >= 1 && idx <= MAX_SUPPLY;
    }

    function randomToMintIndex(uint256 random, uint256 totalSupply) internal pure returns (uint256) {
        require(totalSupply > 0 && totalSupply <= MAX_SUPPLY, "Bad supply");
        return (random % totalSupply) + 1;
    }

    enum BiggiTokenType { Ticket, Main, Character, Reward, Unknown }

    function getTokenType(uint256 tokenId) internal pure returns (BiggiTokenType) {
        if (isTicket(tokenId)) return BiggiTokenType.Ticket;
        if (isMainNft(tokenId)) return BiggiTokenType.Main;
        if (isCharacterNft(tokenId)) return BiggiTokenType.Character;
        if (isRewardNft(tokenId)) return BiggiTokenType.Reward;
        return BiggiTokenType.Unknown;
    }

    // --- NFTInfo helpers ---
    function isUnset(NFTInfo memory info) internal pure returns (bool) {
        return (
            info.background < 1 || info.background > 10 ||
            info.blockIdx < 1 || info.blockIdx > 10 ||
            info.mainId == 0
        );
    }

    function findUnsetIndices(
        mapping(uint256 => NFTInfo) storage nftInfo,
        uint256 maxSupply
    ) internal view returns (uint256[] memory) {
        uint256[] memory unset = new uint256[](maxSupply);
        uint256 count = 0;
        for (uint256 i = 1; i <= maxSupply; i++) {
            if (isUnset(nftInfo[i])) {
                unset[count] = i;
                count++;
            }
        }
        uint256[] memory res = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            res[j] = unset[j];
        }
        return res;
    }

    function hasUnsetIndices(
        mapping(uint256 => NFTInfo) storage nftInfo,
        uint256 maxSupply
    ) internal view returns (bool) {
        for (uint256 i = 1; i <= maxSupply; i++) {
            if (isUnset(nftInfo[i])) {
                return true;
            }
        }
        return false;
    }

    /// @dev Legacy global-mainId uniqueness helper. The current 550-item metadata
    /// matrix intentionally reuses mainId values across backgrounds, so launch
    /// readiness must use the matrix-aware checks in the collection contracts.
    function findDuplicateMainIds(
        mapping(uint256 => NFTInfo) storage nftInfo,
        uint256 maxSupply
    ) internal view returns (uint256[] memory) {
        uint256[] memory allMainIds = new uint256[](maxSupply);
        uint256 total = 0;
        uint256[] memory duplicatesTemp = new uint256[](maxSupply);
        uint256 dupCount = 0;

        for (uint256 i = 1; i <= maxSupply; i++) {
            uint256 mainId = nftInfo[i].mainId;
            if (mainId == 0) continue;

            bool alreadyDuplicate = false;
            bool alreadyPresent = false;
            for (uint256 j = 0; j < total; j++) {
                if (allMainIds[j] == mainId) {
                    alreadyPresent = true;
                    for (uint256 d = 0; d < dupCount; d++) {
                        if (duplicatesTemp[d] == mainId) {
                            alreadyDuplicate = true;
                            break;
                        }
                    }
                    if (!alreadyDuplicate) {
                        duplicatesTemp[dupCount] = mainId;
                        dupCount++;
                    }
                    break;
                }
            }
            if (!alreadyPresent) {
                allMainIds[total] = mainId;
                total++;
            }
        }

        uint256[] memory duplicates = new uint256[](dupCount);
        for (uint256 k = 0; k < dupCount; k++) {
            duplicates[k] = duplicatesTemp[k];
        }
        return duplicates;
    }

    /// @dev Legacy global-mainId uniqueness helper. Do not use as a launch
    /// readiness check for the current metadata matrix.
    function isAllMainIdsUnique(
        mapping(uint256 => NFTInfo) storage nftInfo,
        uint256 maxSupply
    ) internal view returns (bool) {
        uint256[] memory allMainIds = new uint256[](maxSupply);
        uint256 total = 0;

        for (uint256 i = 1; i <= maxSupply; i++) {
            uint256 mainId = nftInfo[i].mainId;
            if (mainId == 0) continue;
            for (uint256 j = 0; j < total; j++) {
                if (allMainIds[j] == mainId) {
                    return false;
                }
            }
            allMainIds[total] = mainId;
            total++;
        }
        return true;
    }
}
