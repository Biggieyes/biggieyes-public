// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiCapsLib
/// @notice Shared cap constants used by BIGGI token and dependent reward branches.
library BiggiCapsLib {
    /// @notice Global BIGGI max supply including guardian refill budgets.
    uint256 public constant BIGGI_TOTAL_SUPPLY = 2_200_000_000 * 1e18;

    /// @notice Initial allocation for DripDistributor in initialDistribute().
    uint256 public constant DRIP_DISTRIBUTOR_CAP = 200_000_000 * 1e18;

    /// @notice Initial allocation for TokenRewards in initialDistribute().
    uint256 public constant TOKEN_REWARDS_CAP = 200_000_000 * 1e18;

    /// @notice Initial marketing allocation in initialDistribute().
    uint256 public constant MARKETING_SUPPORT_INITIAL = 200_000_000 * 1e18;

    /// @notice Initial/target reserve allocation (pairing + liquidity).
    uint256 public constant RESERVE_INITIAL = 600_000_000 * 1e18;

    /// @notice Extra guardian budget for DEX/drip refill branch.
    uint256 public constant GUARDIAN_DEX_MINT_CAP = 500_000_000 * 1e18;

    /// @notice Extra guardian budget for token rewards refill branch.
    uint256 public constant GUARDIAN_REWARDS_MINT_CAP = 500_000_000 * 1e18;

    /// @notice Historical max tokens DripDistributor can receive.
    uint256 public constant DRIP_DISTRIBUTOR_TOTAL_CAP = DRIP_DISTRIBUTOR_CAP + GUARDIAN_DEX_MINT_CAP;

    /// @notice Historical max tokens TokenRewards can receive from refill model.
    uint256 public constant TOKEN_REWARDS_TOTAL_CAP = TOKEN_REWARDS_CAP + GUARDIAN_REWARDS_MINT_CAP;
}
