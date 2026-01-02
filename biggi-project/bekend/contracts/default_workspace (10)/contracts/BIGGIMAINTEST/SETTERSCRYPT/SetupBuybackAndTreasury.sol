// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ Minimalní rozhraní BiggiBuybackAgent ============ */
interface IBiggiBuybackAgentSetup {
    function setRouter(address router_) external;
    function setTreasury(address treasury_) external;
    function setPolicy(address policy_) external;
    function setDripLM(address dripLM_) external;
    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external;
    function toggleAutoBuyback(bool enabled) external;
}

/* ============ Minimalní rozhraní BiggiTreasury ============ */
interface IBiggiTreasurySetup {
    function setDistributor(address d) external;
    function setBuybackAgent(address b) external;
    function setTokenRewards(address r) external;
    function setReserve(address r) external;
}

/**
 * @title SetupBuybackAndTreasury
 * @notice Jednorázový nastavovací skript pro:
 *  - BiggiBuybackAgent (router, treasury, policy, dripLM, fallbacks, autoBuyback)
 *  - BiggiTreasury (distributor, buybackAgent, tokenRewards, reserve)
 *
 * Použití (Remix):
 * 1) Nasadíš kontrakt s `initialOwner = tvoje EOA`.
 * 2) Zavoláš `setupBuybackAgent(...)`.
 * 3) Zavoláš `setupTreasury(...)`.
 */
contract SetupBuybackAndTreasury is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Nastaví BuybackAgenta
     *
     * @param buybackAgent   adresa BiggiBuybackAgent kontraktu
     * @param router         adresa UniswapV2 routeru (WMATIC / WETH)
     * @param treasury       adresa BiggiTreasury kontraktu
     * @param policy         adresa BiggiPolicy kontraktu (může být address(0), pokud zatím nemáš)
     * @param dripLM         adresa BiggiDripLiquidityManager (pro dripOnBuy)
     * @param autoEnabled    zda zapnout autoBuyback po nastavení
     * @param slipBps        fallback slippage BPS (např. 200 = 2 %)
     * @param deadlineSec    fallback deadline pro swap (např. 600 = 10 min)
     * @param cooldownSec    fallback cooldown mezi buybacky (např. 300 = 5 min)
     */
    function setupBuybackAgent(
        address buybackAgent,
        address router,
        address treasury,
        address policy,
        address dripLM,
        bool autoEnabled,
        uint256 slipBps,
        uint256 deadlineSec,
        uint256 cooldownSec
    ) external onlyOwner {
        require(buybackAgent != address(0), "buyback=0");
        require(router != address(0), "router=0");
        require(treasury != address(0), "treasury=0");
        // policy může být 0x0
        // dripLM může být 0x0 pokud zatím nechceš napojit

        IBiggiBuybackAgentSetup ba = IBiggiBuybackAgentSetup(buybackAgent);

        ba.setRouter(router);
        ba.setTreasury(treasury);
        ba.setPolicy(policy);
        ba.setDripLM(dripLM);
        ba.setFallbacks(slipBps, deadlineSec, cooldownSec);
        ba.toggleAutoBuyback(autoEnabled);
    }

    /**
     * @notice Nastaví Treasury
     *
     * @param treasury       adresa BiggiTreasury kontraktu
     * @param distributor    adresa Distributor kontraktu (10 % MATIC share)
     * @param buybackAgent   adresa BiggiBuybackAgent
     * @param tokenRewards   adresa BiggiTokenRewards kontraktu
     * @param reserve        adresa Reserve kontraktu (kvůli hooku requestTopUpToLM)
     */
    function setupTreasury(
        address treasury,
        address distributor,
        address buybackAgent,
        address tokenRewards,
        address reserve
    ) external onlyOwner {
        require(treasury != address(0), "treasury=0");
        require(distributor != address(0), "distributor=0");
        require(buybackAgent != address(0), "buyback=0");
        require(tokenRewards != address(0), "tokenRewards=0");
        require(reserve != address(0), "reserve=0");

        IBiggiTreasurySetup t = IBiggiTreasurySetup(treasury);

        t.setDistributor(distributor);
        t.setBuybackAgent(buybackAgent);
        t.setTokenRewards(tokenRewards);
        t.setReserve(reserve);
    }
}
