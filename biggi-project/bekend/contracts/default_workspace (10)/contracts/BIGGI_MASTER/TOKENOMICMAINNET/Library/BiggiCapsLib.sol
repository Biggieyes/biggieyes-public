// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiCapsLib — centrální capy pro BIGGI ekosystém
library BiggiCapsLib {
    /// @notice celkový maximální supply BIGGI včetně guardian refill budgetů
    uint256 public constant BIGGI_TOTAL_SUPPLY = 2_200_000_000 * 1e18;

    /// @notice počáteční alokace pro DripDistributor při initialDistribute()
    uint256 public constant DRIP_DISTRIBUTOR_CAP = 200_000_000 * 1e18;

    /// @notice počáteční alokace pro TokenRewards při initialDistribute()
    uint256 public constant TOKEN_REWARDS_CAP = 200_000_000 * 1e18;

    uint256 public constant MARKETING_SUPPORT_INITIAL = 200_000_000 * 1e18;

    /// @notice cílová/počáteční alokace pro Reserve (pro párování + LM)
    uint256 public constant RESERVE_INITIAL = 600_000_000 * 1e18;

    /// @notice extra guardian budget pro refill DEX/drip větve
    uint256 public constant GUARDIAN_DEX_MINT_CAP = 500_000_000 * 1e18;

    /// @notice extra guardian budget pro refill TokenRewards větve
    uint256 public constant GUARDIAN_REWARDS_MINT_CAP = 500_000_000 * 1e18;

    /// @notice celkový strop, který DripDistributor může historicky obdržet
    uint256 public constant DRIP_DISTRIBUTOR_TOTAL_CAP = DRIP_DISTRIBUTOR_CAP + GUARDIAN_DEX_MINT_CAP;

    /// @notice celkový strop, který TokenRewards může obdržet z tokenového refill modelu
    uint256 public constant TOKEN_REWARDS_TOTAL_CAP = TOKEN_REWARDS_CAP + GUARDIAN_REWARDS_MINT_CAP;
}
