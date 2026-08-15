// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiCapsLib — centrální capy pro BIGGI ekosystém
library BiggiCapsLib {
    /// @notice celkový maximální supply BIGGI
    uint256 public constant BIGGI_TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice maximální množství, které může DripDistributor držet / obsluhovat
    uint256 public constant DRIP_DISTRIBUTOR_CAP = 200_000_000 * 1e18;

    /// @notice maximální množství pro TokenRewards kontrakt
    uint256 public constant TOKEN_REWARDS_CAP = 200_000_000 * 1e18;

    /// @notice cílová/počáteční alokace pro Reserve (pro párování + LM)
    uint256 public constant RESERVE_INITIAL = 600_000_000 * 1e18;
}
