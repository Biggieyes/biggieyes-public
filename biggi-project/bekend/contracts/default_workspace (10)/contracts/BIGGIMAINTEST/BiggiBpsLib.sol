// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BiggiBpsLib {
    uint256 internal constant BPS_DENOM = 10_000;

    // ----- Mint: hlavní split -----
    uint256 internal constant DEV_BPS         = 4000; // 40 %
    uint256 internal constant DISTRIBUTOR_BPS = 6000; // 60 %

    // ----- Distributor: rozpad těch 60 % -----
    // podle tvé aktuální tokenomiky:
    // 30% → CollectionRewards
    // 30% → Reserve
    // 20% → Buyback
    // 10% → Treasury
    // 10% → Community Center
    uint256 internal constant DIST_COLLECTION_BPS = 3000;
    uint256 internal constant DIST_RESERVE_BPS    = 3000;
    uint256 internal constant DIST_BUYBACK_BPS    = 2000;
    uint256 internal constant DIST_TREASURY_BPS   = 1000;
    uint256 internal constant DIST_COMMUNITY_BPS  = 1000;

    // ----- Treasury: split BIGGI z buybacku (aktuální logika 50/50) -----
    uint256 internal constant TREASURY_TO_REWARDS_BPS = 5000; // 50%
    // zbytek 50 % zůstává v Treasury

    function part(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS_DENOM;
    }
}
