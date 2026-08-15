// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiReader – odlehčený „view aggregator“ pro BiggiEyesLottery.
 * Cíl: snížit bytecode hlavního kontraktu; veškeré agregace a hromadné přehledy přesouváme sem.
 *
 * Neuchovává žádný stav – jen čte z main kontraktu.
 */

import "./BiggiIdIndexLib.sol";

interface IBiggiEyesLotteryMinimal {
    // základní pohledy a existující gettery v main kontraktu
    function exists(uint256 tokenId) external view returns (bool);
    function tokenURI(uint256 tokenId) external view returns (string memory);

    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
    function getMintData(uint256 index) external view returns (
        uint256 ticketPrice_,
        uint256 blockPrice_,
        uint256 finalPrice_
    );

    // public storage auto-gettery
    function ticketPrice() external view returns (uint256);
    function ticketMinted() external view returns (uint16);
    function biggiMinted() external view returns (uint16);
    function rewardsPool() external view returns (uint256);
    function rewardPercent() external view returns (uint256);

    function blockMintCounts(uint256 i) external view returns (uint16);
    function backgroundMintCounts(uint256 i) external view returns (uint16);

    function orangeWinnersCount() external view returns (uint8);
    function blockWinnersCount() external view returns (uint8);
    function rainbowRewardClaimedGlobal() external view returns (bool);
    function characterClaimed(uint16 blk) external view returns (bool);
}

contract BiggiReader {
    using BiggiIdIndexLib for uint256;

    IBiggiEyesLotteryMinimal public immutable main;

    constructor(address mainContract) {
        main = IBiggiEyesLotteryMinimal(mainContract);
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

    // Souhrnné počitadlo rewards (+ spočítá kolik character NFT už padlo)
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
            if (main.characterClaimed(i)) { unchecked { c++; } }
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
            uint256 rewardsPoolWei,
            uint256 rewardPercentBps,
            // pole
            uint256[10] memory currentBlockPrices,
            uint16[10] memory blocksMinted,
            uint16[10] memory bgsMinted,
            // odměny
            uint8 orange_,
            uint8 blockWinners_,
            bool rainbow_
        )
    {
        ticketPriceWei   = main.ticketPrice();
        ticketMinted_    = main.ticketMinted();
        biggiMinted_     = main.biggiMinted();
        rewardsPoolWei   = main.rewardsPool();
        rewardPercentBps = main.rewardPercent();

        for (uint256 i = 0; i < 10; i++) {
            currentBlockPrices[i] = main.getCurrentBlockPrice(uint16(i + 1));
            blocksMinted[i]       = main.blockMintCounts(i);
            bgsMinted[i]          = main.backgroundMintCounts(i);
        }

        orange_        = main.orangeWinnersCount();
        blockWinners_  = main.blockWinnersCount();
        rainbow_       = main.rainbowRewardClaimedGlobal();
    }
}
