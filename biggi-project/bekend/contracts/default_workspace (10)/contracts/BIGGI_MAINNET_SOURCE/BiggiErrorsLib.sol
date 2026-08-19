// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiErrorsLib — společné chyby pro Biggi tokenomiku
library BiggiErrorsLib {
    /* ========= Obecné ========= */
    error ZeroAddress();      // nějaký vstupní address(0)
    error ToZero();           // cílová adresa je address(0)
    error AmountZero();       // amount == 0
    error NoneAvailable();    // nic není k dispozici (claim apod.)

    /* ========= Role / přístup ========= */
    error NotDistributor();
    error NotBuybackAgent();
    error NotLiquidityManager();
    error NotPolicy();
    error NotCommunityAdmin();

    error OnlyDripLM();       // DripDistributor: onlyDripLM
    error OnlyTreasury();     // DripDistributor: onlyTreasury

    /* ========= Konfigurace / stav ========= */
    error RewardsNotSet();
    error ReserveNotSet();
    error TreasuryNotSet();
    error TokenNotSet();

    error RouterNotSet();         // BuybackAgent: router nebo wrappedNative není nastaven
    error PolicyNotSet();         // pokud je potřeba policy a není nastavená
    error BuybacksPaused();       // policy říká, že buyback je pauznutý
    error CapExceeded();          // DripDistributor CAP (200M BIGGI) překročen
    error NotWhitelistedCollection(); // notifyMint volá ne-whitelisted kolekce
    error OnlyToken();                // funkci smí volat jen samotný BIGGI token kontrakt

    /* ========= Runtime / flow chyby ========= */
    error Cooldown();           // buyback cooldown ještě nevypršel
    error NoBiggi();            // swap proběhl, ale dorazilo 0 BIGGI
    error BadPath();            // nevalidní swap path v buyback agentovi
    error BuybackAborted();     // policy odmítla quota (consumeDailyBuybackQuota)
}
