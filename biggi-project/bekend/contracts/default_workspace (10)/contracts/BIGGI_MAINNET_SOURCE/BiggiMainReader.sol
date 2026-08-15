// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiMainReader - lehký view agregátor pro BiggiEyesMain.
 * Přidává helpery požadované FE: getMintDataByTokenId, findTicket a hromadné snapshoty.
 * Nepíšeme žádný stav; jen čteme z hlavního kontraktu.
 */

import "./Library/BiggiIdIndexLib.sol";

interface IBiggiMainMinimal {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);

    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
    function getMintData(uint256 index) external view returns (uint256, uint256, uint256);

    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function biggiMinted() external view returns (uint16);

    function blockMintCounts(uint256 i) external view returns (uint16);
    function backgroundMintCounts(uint256 i) external view returns (uint16);

    function orangeWinnersCount() external view returns (uint8);
    function blockWinnersCount() external view returns (uint8);
    function rainbowRewardClaimedGlobal() external view returns (bool);
    function characterClaimed(uint16 blk) external view returns (bool);
}

contract BiggiMainReader {
    using BiggiIdIndexLib for uint256;

    IBiggiMainMinimal public immutable main;

    constructor(address mainContract) {
        require(mainContract != address(0), "main=0");
        main = IBiggiMainMinimal(mainContract);
    }

    /* ============== Hromadné pohledy ============== */

    function getAllBlockPrices() external view returns (uint256[10] memory prices) {
        for (uint256 i = 0; i < 10; i++) {
            prices[i] = main.getCurrentBlockPrice(uint16(i + 1));
        }
    }

    function getAllBlockMintCounts() external view returns (uint16[10] memory counts) {
        for (uint256 i = 0; i < 10; i++) {
            counts[i] = main.blockMintCounts(i);
        }
    }

    function getAllBackgroundMintCounts() external view returns (uint16[10] memory counts) {
        for (uint256 i = 0; i < 10; i++) {
            counts[i] = main.backgroundMintCounts(i);
        }
    }

    // Mint-time data podle tokenId (pro NftCard)
    function getMintDataByTokenId(uint256 tokenId) external view returns (
        uint256 ticketPrice_,
        uint256 blockPrice_,
        uint256 finalPrice_
    ) {
        if (!main.exists(tokenId)) return (0, 0, 0);
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET || tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET) {
            return (0, 0, 0);
        }
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return main.getMintData(idx);
    }

    // Souhrn odměn + kolik charakterů už padlo
    function getRewardsCounters() external view returns (
        uint8 orange,
        uint8 blockWinners,
        bool rainbow,
        uint8 charactersMinted
    ) {
        orange = main.orangeWinnersCount();
        blockWinners = main.blockWinnersCount();
        rainbow = main.rainbowRewardClaimedGlobal();

        uint8 c;
        for (uint16 i = 1; i <= 10; i++) {
            if (main.characterClaimed(i)) {
                unchecked { c++; }
            }
        }
        charactersMinted = c;
    }

    // Snapshot pro dashboard jedním voláním
    function getFrontendSnapshot()
        external
        view
        returns (
            // základ
            uint256 ticketPriceWei,
            uint16 ticketMinted_,
            uint16 biggiMinted_,
            // pole
            uint256[10] memory currentBlockPrices,
            uint16[10] memory blocksMinted,
            uint16[10] memory bgsMinted,
            // odměny
            uint8 orange_,
            uint8 blockWinners_,
            bool rainbow_,
            uint8 charactersMinted_
        )
    {
        ticketPriceWei   = main.ticketPrice();
        ticketMinted_    = main.ticketMinted();
        biggiMinted_     = main.biggiMinted();

        for (uint256 i = 0; i < 10; i++) {
            currentBlockPrices[i] = main.getCurrentBlockPrice(uint16(i + 1));
            blocksMinted[i]       = main.blockMintCounts(i);
            bgsMinted[i]          = main.backgroundMintCounts(i);
        }

        orange_        = main.orangeWinnersCount();
        blockWinners_  = main.blockWinnersCount();
        rainbow_       = main.rainbowRewardClaimedGlobal();

        uint8 c;
        for (uint16 j = 1; j <= 10; j++) {
            if (main.characterClaimed(j)) { unchecked { c++; } }
        }
        charactersMinted_ = c;
    }

    /// @notice Najde všechny ticket tokenId, které vlastní daná adresa (range 1..MAX_TICKETS)
    function findTicket(address owner) external view returns (uint256[] memory out) {
        uint256 minted = main.ticketMinted();
        if (minted == 0) return out;

        uint256[] memory buf = new uint256[](minted);
        uint256 found;
        for (uint256 i = 0; i < minted; i++) {
            uint256 tokenId = BiggiIdIndexLib.TICKET_OFFSET + i;
            // existuje a vlastní ho daná adresa?
            if (main.exists(tokenId) && main.ownerOf(tokenId) == owner) {
                buf[found] = tokenId;
                unchecked { found++; }
            }
        }
        out = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            out[j] = buf[j];
        }
    }
}
