// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiReader (lite) – view agregátor pro BiggiEyesMain (nová architektura).
 * - Drží se jen getterů, které poskytuje nový hlavní kontrakt.
 * - Žádný stav, žádné změny logiky – čisté "read only" helpery pro FE.
 */

import "./BiggiIdIndexLib.sol";

/* ---------- MINIMAL VIEW INTERFACE NA NOVÝ MAIN ---------- */
interface IBiggiMainView {
    // existence & metadata
    function exists(uint256 tokenId) external view returns (bool);
    function tokenURI(uint256 tokenId) external view returns (string memory);

    // ceny / statistiky
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
    function getMintData(uint256 index) external view returns (
        uint256 ticketPrice_,
        uint256 blockPrice_,
        uint256 finalPrice_
    );

    // veřejné storage gettery (co nový main skutečně má)
    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function biggiMinted() external view returns (uint16);

    function blockMintCounts(uint256 i) external view returns (uint16);
    function backgroundMintCounts(uint256 i) external view returns (uint16);

    // zůstalo v mainu – počítání character NFT po dokončení bloku
    function characterClaimed(uint16 blk) external view returns (bool);
}

contract BiggiReader {
    using BiggiIdIndexLib for uint256;

    IBiggiMainView public immutable main;

    constructor(address mainContract) {
        main = IBiggiMainView(mainContract);
    }

    /* ============== Hromadné pohledy přesunuté z mainu ============== */

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
        // vztahuje se jen na hlavní BIGGI NFT rozsah
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET || tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET) {
            return (0, 0, 0);
        }
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return main.getMintData(idx);
    }

    // Kolik character NFT už padlo (1..10)
    function getCharactersMintedCount() external view returns (uint8 charactersMinted) {
        uint8 c;
        for (uint16 i = 1; i <= 10; i++) {
            if (main.characterClaimed(i)) { unchecked { c++; } }
        }
        charactersMinted = c;
    }

    // Snapshot pro dashboard bez “rewards” polí (ty jsou teď v separátním modulu)
    function getFrontendSnapshotLite()
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
            // character summary
            uint8 charactersMinted
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

        uint8 c;
        for (uint16 j = 1; j <= 10; j++) {
            if (main.characterClaimed(j)) { unchecked { c++; } }
        }
        charactersMinted = c;
    }
}
