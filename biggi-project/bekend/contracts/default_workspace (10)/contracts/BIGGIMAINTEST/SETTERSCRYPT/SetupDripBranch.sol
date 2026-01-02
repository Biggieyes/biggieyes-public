// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ Minimalní rozhraní DripDistributor ============ */
interface IDripDistributorSetup {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setCollection(address coll, bool allowed) external;
    function setTokensPerMint(uint256 v) external;
}

/* ============ Minimalní rozhraní BiggiDripLiquidityManager ============ */
interface IDripLMSetup {
    function setRouter(address r) external;
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

/**
 * @title SetupDripBranch
 * @notice Jednorázový nastavovací skript pro DRIP větev:
 *  - DripDistributor
 *  - BiggiDripLiquidityManager
 *
 * Použití (Remix):
 * 1) Nasadíš kontrakt s `initialOwner = tvoje EOA`.
 * 2) Zavoláš `setupDripDistributor(...)`.
 * 3) Zavoláš `setupDripLM(...)`.
 */
contract SetupDripBranch is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Nastaví DripDistributor:
     *  - dripLM adresu
     *  - treasury adresu
     *  - whitelistne main kolekce
     *  - nastaví tokensPerMint (v RAW jednotkách, např. 1e18 = 1 BIGGI)
     *
     * @param dripDistributor adresa DripDistributor kontraktu
     * @param dripLM          adresa BiggiDripLiquidityManager
     * @param treasury        adresa Treasury (ta bude volat depositTokens / topUp)
     * @param main1           adresa první main kolekce (BiggiEyesMain)
     * @param main2           adresa druhé main kolekce (BiggiEyesMain2), může být address(0) pokud nechceš whitelystovat
     * @param tokensPerMint   kolik BIGGI se účetně přidá do availableTokens za 1 mint
     */
    function setupDripDistributor(
        address dripDistributor,
        address dripLM,
        address treasury,
        address main1,
        address main2,
        uint256 tokensPerMint
    ) external onlyOwner {
        require(dripDistributor != address(0), "dripDist=0");
        require(dripLM != address(0), "dripLM=0");
        require(treasury != address(0), "treasury=0");
        require(main1 != address(0), "main1=0");
        require(tokensPerMint > 0, "tokensPerMint=0");

        IDripDistributorSetup d = IDripDistributorSetup(dripDistributor);

        d.setDripLM(dripLM);
        d.setTreasury(treasury);
        d.setCollection(main1, true);

        if (main2 != address(0)) {
            d.setCollection(main2, true);
        }

        d.setTokensPerMint(tokensPerMint);
    }

    /**
     * @notice Nastaví BiggiDripLiquidityManager:
     *  - router (DEX)
     *  - reserve (kam se posílá nativ po swapech)
     *  - dripDistributor
     *  - buybackAgent (kdo volá dripOnBuy)
     *  - prodejní parametry (sellPct, slippage, deadline)
     *
     * @param dripLM         adresa BiggiDripLiquidityManager kontraktu
     * @param router         adresa UniswapV2 routeru (např. QuickSwap)
     * @param reserve        adresa Reserve kontraktu
     * @param dripDistributor adresa DripDistributor kontraktu
     * @param buybackAgent   adresa BiggiBuybackAgent kontraktu
     * @param sellPct        kolik % z nahlášeného množství se bude prodávat (0–100)
     * @param slippageBps    slippage v BPS (např. 200 = 2 %)
     * @param deadlineSec    deadline pro swap (např. 600 = 10 minut)
     */
    function setupDripLM(
        address dripLM,
        address router,
        address reserve,
        address dripDistributor,
        address buybackAgent,
        uint8 sellPct,
        uint256 slippageBps,
        uint256 deadlineSec
    ) external onlyOwner {
        require(dripLM != address(0), "dripLM=0");
        require(router != address(0), "router=0");
        require(reserve != address(0), "reserve=0");
        require(dripDistributor != address(0), "dripDist=0");
        require(buybackAgent != address(0), "buyback=0");
        require(sellPct <= 100, "sellPct>100");
        require(deadlineSec > 0, "deadline=0");

        IDripLMSetup lm = IDripLMSetup(dripLM);

        lm.setRouter(router);
        lm.setReserve(reserve);
        lm.setDripDistributor(dripDistributor);
        lm.setBuybackAgent(buybackAgent);
        lm.setSellPct(sellPct);
        lm.setSlippageBps(slippageBps);
        lm.setTxDeadlineSec(deadlineSec);
    }
}
