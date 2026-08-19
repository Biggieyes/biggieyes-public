// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiErrorsLib
/// @notice Shared custom errors for BIGGI contracts.
library BiggiErrorsLib {
    /* ========= General ========= */
    error ZeroAddress();
    error ToZero();
    error AmountZero();
    error NoneAvailable();

    /* ========= Roles / access ========= */
    error NotDistributor();
    error NotBuybackAgent();
    error NotLiquidityManager();
    error NotPolicy();
    error NotCommunityAdmin();
    error NotAllowedCaller();
    error OnlyDripLM();
    error OnlyTreasury();

    /* ========= Configuration / state ========= */
    error RewardsNotSet();
    error ReserveNotSet();
    error TreasuryNotSet();
    error TokenNotSet();
    error RouterNotSet();
    error PolicyNotSet();
    error BuybacksPaused();
    error CapExceeded();
    error NotWhitelistedCollection();
    error OnlyToken();

    /* ========= Runtime / flow ========= */
    error Cooldown();
    error NoBiggi();
    error BadPath();
    error BuybackAborted();
}
