// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ Minimalní rozhraní DripDistributor ============ */
interface IDripDistributorSetup {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setTokensPerMint(uint256 v) external;
    function setCollection(address coll, bool allowed) external;
}

/* ============ Minimalní rozhraní BiggiDripLiquidityManager ============ */
interface IDripLMSetup {
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setRouter(address r) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

/**
 * @title SetupDripDistributorAndDripLM
 * @notice Jednorázový nastavovací skript pro:
 *  - DripDistributor (treasury, dripLM, tokensPerMint, whitelist kolekcí)
 *  - DripLM (reserve, dripDistributor, buybackAgent, router, sellPct, slippage, deadline)
 *
 * Použití (Remix):
 * 1) Nasadit tento kontrakt s `initialOwner` = tvoje EOA.
 * 2) Zavolat nejdřív `setupDripDistributor(...)`.
 * 3) Pak zavolat `setupDripLM(...)`.
 */
contract SetupDripDistributorAndDripLM is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * 1) Nastavení DripDistributor
     *
     * @param dripDistributor      adresa DripDistributor kontraktu
     * @param dripLM               adresa BiggiDripLiquidityManager
     * @param treasury             adresa Treasury (která bude dělat depositTokens do DripDistributor)
     * @param collectionsToWhitelist pole kolekcí, které mohou volat notifyMint (main1, main2, případně další)
     * @param tokensPerMint        počet BIGGI (v raw units, např. 1e18) který se účetně připíše za 1 mint
     */
    function setupDripDistributor(
        address dripDistributor,
        address dripLM,
        address treasury,
        address[] calldata collectionsToWhitelist,
        uint256 tokensPerMint
    ) external onlyOwner {
        require(dripDistributor != address(0), "dripDistributor=0");
        require(dripLM != address(0), "dripLM=0");
        require(treasury != address(0), "treasury=0");

        IDripDistributorSetup dd = IDripDistributorSetup(dripDistributor);

        // Treasury a DripLM adresy
        dd.setTreasury(treasury);
        dd.setDripLM(dripLM);

        // tokensPerMint (accounting za jeden mint)
        dd.setTokensPerMint(tokensPerMint);

        // whitelist kolekcí (main1, main2, případně další)
        for (uint256 i = 0; i < collectionsToWhitelist.length; ++i) {
            address c = collectionsToWhitelist[i];
            require(c != address(0), "collection=0");
            dd.setCollection(c, true);
        }
    }

    /**
     * 2) Nastavení DripLM
     *
     * @param dripLM         adresa BiggiDripLiquidityManager
     * @param reserve        adresa Reserve kontraktu (kam DripLM posílá native)
     * @param router         adresa UniswapV2 routeru (WMATIC/WMETH)
     * @param buybackAgent   adresa BiggiBuybackAgent kontraktu
     * @param sellPct        kolik % z nahlášeného biggiBought DripLM prodá (např. 60–70)
     * @param slippageBps    fallback slippage v BPS (např. 200 = 2 %)
     * @param txDeadlineSec  deadline pro swap v sekundách (např. 600 = 10 min)
     */
    function setupDripLM(
        address dripLM,
        address reserve,
        address router,
        address buybackAgent,
        uint8 sellPct,
        uint256 slippageBps,
        uint256 txDeadlineSec
    ) external onlyOwner {
        require(dripLM != address(0), "dripLM=0");
        require(reserve != address(0), "reserve=0");
        require(router != address(0), "router=0");
        require(buybackAgent != address(0), "buybackAgent=0");

        IDripLMSetup lm = IDripLMSetup(dripLM);

        // Router + Reserve + napojení na DripDistributor + BuybackAgent
        lm.setRouter(router);
        lm.setReserve(reserve);
        lm.setDripDistributor(address(0)); // nastavíš zvlášť, pokud chceš, nebo to už uděláš v setupDripDistributor
        lm.setBuybackAgent(buybackAgent);

        // Parametry pro prodeje (stabilizace pumpy)
        lm.setSellPct(sellPct);
        lm.setSlippageBps(slippageBps);
        lm.setTxDeadlineSec(txDeadlineSec);
    }
}
