// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Basis-point constants for Biggi splits.
library BiggiBpsLib {
    uint256 internal constant BPS_DENOM = 10_000;

    // Mint split (overall)
    uint256 internal constant DEV_BPS         = 4000; // 40%
    uint256 internal constant DISTRIBUTOR_BPS = 6000; // 60%

    // Distributor split (from the 60%)
    // 25% -> CollectionRewards
    // 35% -> Reserve
    // 20% -> Buyback
    // 10% -> Treasury
    // 10% -> Community Center
    uint256 internal constant DIST_COLLECTION_BPS = 2500;
    uint256 internal constant DIST_RESERVE_BPS    = 3500;
    uint256 internal constant DIST_BUYBACK_BPS    = 2000;
    uint256 internal constant DIST_TREASURY_BPS   = 1000;
    uint256 internal constant DIST_COMMUNITY_BPS  = 1000;

    // Treasury split for BIGGI received from buyback and ecosystem branches
    // 34% -> TokenRewards
    // 33% -> Reserve
    // 33% -> DripDistributor
    uint256 internal constant TREASURY_TO_REWARDS_BPS = 3400;
    uint256 internal constant TREASURY_TO_RESERVE_BPS = 3300;
    uint256 internal constant TREASURY_TO_DRIP_BPS    = 3300;

    function part(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS_DENOM;
    }
}
