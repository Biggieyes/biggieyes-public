// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiErrorsLib — společné chyby pro Biggi tokenomiku
library BiggiErrorsLib {
    /* ========= Obecné ========= */
    error ZeroAddress();
    error ToZero();
    error AmountZero();
    error NoneAvailable();

    /* ========= Role / přístup ========= */
    error NotDistributor();
    error NotBuybackAgent();
    error NotLiquidityManager();
    error NotPolicy();
    error NotCommunityAdmin();

    error OnlyDripLM();
    error OnlyTreasury();

    /* ========= Konfigurace / stav ========= */
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

    /* ========= Runtime / flow chyby ========= */
    error Cooldown();
    error NoBiggi();
    error BadPath();
    error BuybackAborted();
}
