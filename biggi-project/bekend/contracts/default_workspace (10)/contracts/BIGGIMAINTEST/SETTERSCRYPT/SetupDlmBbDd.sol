// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ BiggiBuybackAgent ============ */
interface IBiggiBuybackAgentSetup {
    function setRouter(address router_) external;
    function setTreasury(address treasury_) external;
    function setPolicy(address policy_) external;
    function setDripLM(address dripLM_) external;
    function setSwapPath(address[] calldata newPath) external;
    function clearSwapPath() external;
    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external;
    function toggleAutoBuyback(bool enabled) external;
}

/* ============ BiggiDripLiquidityManager ============ */
interface IBiggiDripLMSetup {
    function setRouter(address r) external;
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

/* ============ DripDistributor ============ */
interface IDripDistributorSetup {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setTokensPerMint(uint256 v) external;
    function setCollection(address coll, bool allowed) external;
}

/**
 * @title SetupBuybackDripBranch
 * @notice Jednorázový nastavovací skript pro větev:
 *  - BiggiBuybackAgent
 *  - BiggiDripLiquidityManager
 *  - DripDistributor
 *
 * Použití:
 *  - nasadíš kontrakt s initialOwner = tvoje EOA
 *  - postupně voláš níže uvedené funkce podle toho, co chceš nastavit
 */
contract SetupBuybackDripBranch is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /* =========================================================
     * 1) BUYBACK AGENT
     * =======================================================*/

    /**
     * @notice Základní wiring pro BiggiBuybackAgent.
     *
     * @param buyback  adresa BiggiBuybackAgent kontraktu
     * @param router   adresa UniswapV2 routeru (QuickSwap / jiný DEX)
     * @param treasury adresa BiggiTreasury kontraktu
     * @param dripLM   adresa BiggiDripLiquidityManager (může být 0, pokud ještě není nasazen)
     * @param policy   adresa BiggiPolicy (může být 0 = žádná policy)
     */
    function setupBuybackCore(
        address buyback,
        address router,
        address treasury,
        address dripLM,
        address policy
    ) external onlyOwner {
        require(buyback != address(0), "buyback=0");
        require(router != address(0), "router=0");
        require(treasury != address(0), "treasury=0");

        IBiggiBuybackAgentSetup B = IBiggiBuybackAgentSetup(buyback);

        B.setRouter(router);
        B.setTreasury(treasury);
        B.setPolicy(policy);   // může být 0
        B.setDripLM(dripLM);   // může být 0
    }

    /**
     * @notice Nastavení swap path a fallback parametrů pro BuybackAgent.
     *
     * @param buyback    adresa BiggiBuybackAgent
     * @param path       swap path (např. [WMATIC, BIGGI]); pokud prázdné, clearne se
     * @param slipBps    fallback slippage BPS (např. 200 = 2 %)
     * @param deadline   fallback deadline v sekundách (např. 600)
     * @param cooldown   fallback min. interval v sekundách (např. 300)
     * @param autoEnable pokud true, zapne autoBuybackEnabled
     */
    function configureBuybackSwapAndFallbacks(
        address buyback,
        address[] calldata path,
        uint256 slipBps,
        uint256 deadline,
        uint256 cooldown,
        bool autoEnable
    ) external onlyOwner {
        require(buyback != address(0), "buyback=0");

        IBiggiBuybackAgentSetup B = IBiggiBuybackAgentSetup(buyback);

        if (path.length == 0) {
            B.clearSwapPath();
        } else {
            B.setSwapPath(path);
        }

        B.setFallbacks(slipBps, deadline, cooldown);
        B.toggleAutoBuyback(autoEnable);
    }

    /* =========================================================
     * 2) DRIP LIQUIDITY MANAGER
     * =======================================================*/

    /**
     * @notice Základní wiring pro BiggiDripLiquidityManager.
     *
     * @param dripLM         adresa BiggiDripLiquidityManager
     * @param router         adresa UniswapV2 routeru
     * @param reserve        adresa BiggiReserveV4 (kde končí native z DripLM)
     * @param dripDistributor adresa DripDistributor kontraktu
     * @param buybackAgent   adresa BiggiBuybackAgent kontraktu
     */
    function setupDripLMCore(
        address dripLM,
        address router,
        address reserve,
        address dripDistributor,
        address buybackAgent
    ) external onlyOwner {
        require(dripLM != address(0), "dripLM=0");
        require(router != address(0), "router=0");
        require(reserve != address(0), "reserve=0");
        require(dripDistributor != address(0), "dripD=0");
        require(buybackAgent != address(0), "buyback=0");

        IBiggiDripLMSetup D = IBiggiDripLMSetup(dripLM);

        D.setRouter(router);
        D.setReserve(reserve);
        D.setDripDistributor(dripDistributor);
        D.setBuybackAgent(buybackAgent);
    }

    /**
     * @notice Jemné nastavení parametrů DripLM (sellPct, slippage, deadline).
     *
     * @param dripLM   adresa BiggiDripLiquidityManager
     * @param sellPct  kolik % z nahlášeného buybacku se má prodávat (např. 60 nebo 70)
     * @param slipBps  slippage BPS pro DripLM (např. 200 = 2%)
     * @param deadline deadline v sekundách pro swap (např. 600)
     */
    function configureDripLMParams(
        address dripLM,
        uint8 sellPct,
        uint256 slipBps,
        uint256 deadline
    ) external onlyOwner {
        require(dripLM != address(0), "dripLM=0");

        IBiggiDripLMSetup D = IBiggiDripLMSetup(dripLM);

        D.setSellPct(sellPct);
        D.setSlippageBps(slipBps);
        D.setTxDeadlineSec(deadline);
    }

    /* =========================================================
     * 3) DRIP DISTRIBUTOR
     * =======================================================*/

    /**
     * @notice Základní wiring DripDistributoru na DripLM a Treasury.
     *
     * @param dripDistributor adresa DripDistributor
     * @param dripLM          adresa BiggiDripLiquidityManager
     * @param treasury        adresa BiggiTreasury (bude posílat top-up přes depositTokens)
     * @param tokensPerMint   účetní alokace za jeden mint (v raw units, např. 1000 * 1e18)
     */
    function setupDripDistributorCore(
        address dripDistributor,
        address dripLM,
        address treasury,
        uint256 tokensPerMint
    ) external onlyOwner {
        require(dripDistributor != address(0), "dripD=0");
        require(dripLM != address(0), "dripLM=0");
        require(treasury != address(0), "treasury=0");

        IDripDistributorSetup DD = IDripDistributorSetup(dripDistributor);

        DD.setDripLM(dripLM);
        DD.setTreasury(treasury);
        DD.setTokensPerMint(tokensPerMint);
    }

    /**
     * @notice Hromadné whitelisting kolekcí pro notifyMint() v DripDistributor.
     *
     * @param dripDistributor adresa DripDistributor
     * @param collections     pole adres kolekcí
     * @param flags           pole bool (true = povolit, false = zakázat), musí mít stejnou délku jako collections
     */
    function setupDripDistributorCollections(
        address dripDistributor,
        address[] calldata collections,
        bool[] calldata flags
    ) external onlyOwner {
        require(dripDistributor != address(0), "dripD=0");
        require(collections.length == flags.length, "len mismatch");

        IDripDistributorSetup DD = IDripDistributorSetup(dripDistributor);

        for (uint256 i = 0; i < collections.length; i++) {
            DD.setCollection(collections[i], flags[i]);
        }
    }
}
