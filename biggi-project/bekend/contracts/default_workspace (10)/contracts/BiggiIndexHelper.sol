// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiIndexHelper
/// @dev Pomocná knihovna pro práci s indexy a NFTInfo v BiggiEyesLottery

library BiggiIndexHelper {
    struct NFTInfo {
        bool minted;
        uint16 background;
        uint16 blockIdx;
        uint256 mainId;
        // --- Přidané pro propsání údajů při mintu ---
        uint256 ticketPrice;
        uint256 blockPrice;
        uint256 finalPrice;
    }

    function isUnset(NFTInfo memory info) internal pure returns (bool) {
        return (info.background < 1 || info.background > 10 ||
                info.blockIdx < 1 || info.blockIdx > 10 ||
                info.mainId == 0);
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

    // Hledání duplicitních mainId pomocí pole (ne mappingu)
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

    // True pokud jsou všechny mainId unikátní (pro menší kolekce)
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
