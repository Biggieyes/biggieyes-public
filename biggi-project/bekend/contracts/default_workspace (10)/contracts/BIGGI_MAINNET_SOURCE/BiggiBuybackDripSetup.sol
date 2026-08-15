// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// Minimalní rozhraní BuybackAgenta (setup)
interface IBiggiBuybackAgent {
    function setRouter(address router_) external;
    function setTreasury(address treasury_) external;
    function setPolicy(address policy_) external;
    function setDripLM(address dripLM_) external;
    function setSwapPath(address[] calldata newPath) external;
    function clearSwapPath() external;
    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external;
    function toggleAutoBuyback(bool enabled) external;
}

/// Minimalní rozhraní DripLiquidityManager (setup)
interface IBiggiDripLiquidityManager {
    function setRouter(address r) external;
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

/// Minimalní rozhraní DripDistributoru (setup)
interface IDripDistributor {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setTokensPerMint(uint256 v) external;
    function setCollection(address coll, bool allowed) external;
}

/**
 * @title BiggiBuybackDripSetup
 * @notice Jednorázový nastavovací orchestrator pro větev:
 *  - BiggiBuybackAgent
 *  - BiggiDripLiquidityManager
 *  - DripDistributor
 *
 * Konstruktor: inicializační adresy (owner + cílové kontrakty).
 * Po deployi voláš jednotlivé setup funkce, nebo `runAll(...)` pro batch.
 *
 * Poznámka: žádná obchodní logika nebyla změněna — pouze pořadí deklarací.
 */
contract BiggiBuybackDripSetup is Ownable {
    address public immutable buybackAgent;
    address public immutable dripLM;
    address public immutable dripDistributor;
    address public immutable reserveAddr;
    address public immutable treasuryAddr;
    address public immutable routerAddr;
    address public immutable policyAddr;

    bool public executed;

    event BranchSetupExecuted(address indexed buybackAgent, address indexed dripLM, address indexed dripDistributor);

    constructor(
        address initialOwner,
        address buybackAgent_,
        address dripLM_,
        address dripDistributor_,
        address reserveAddr_,
        address treasuryAddr_,
        address routerAddr_,
        address policyAddr_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(buybackAgent_ != address(0), "buyback=0");
        require(dripLM_ != address(0), "dripLM=0");
        require(dripDistributor_ != address(0), "dripD=0");
        require(reserveAddr_ != address(0), "reserve=0");
        require(treasuryAddr_ != address(0), "treasury=0");
        require(routerAddr_ != address(0), "router=0");

        buybackAgent = buybackAgent_;
        dripLM = dripLM_;
        dripDistributor = dripDistributor_;
        reserveAddr = reserveAddr_;
        treasuryAddr = treasuryAddr_;
        routerAddr = routerAddr_;
        policyAddr = policyAddr_;
    }

    /* =========================================================
     * 1) BUYBACK AGENT - core wiring
     * =======================================================*/

    /// Nastaví základní wiring pro BuybackAgenta (router, treasury, policy, dripLM)
    function setupBuybackCore() public onlyOwner {
        IBiggiBuybackAgent(buybackAgent).setRouter(routerAddr);
        IBiggiBuybackAgent(buybackAgent).setTreasury(treasuryAddr);
        IBiggiBuybackAgent(buybackAgent).setPolicy(policyAddr); // může být address(0)
        IBiggiBuybackAgent(buybackAgent).setDripLM(dripLM);
    }

    /// Nastaví swap path / fallbacky / autoBuyback pro BuybackAgenta
    function configureBuybackSwapAndFallbacks(
        address[] calldata path,
        uint256 slipBps,
        uint256 deadline,
        uint256 cooldown,
        bool autoEnable
    ) public onlyOwner {
        require(buybackAgent != address(0), "buyback=0");

        IBiggiBuybackAgent B = IBiggiBuybackAgent(buybackAgent);

        if (path.length == 0) {
            B.clearSwapPath();
        } else {
            B.setSwapPath(path);
        }

        B.setFallbacks(slipBps, deadline, cooldown);
        B.toggleAutoBuyback(autoEnable);
    }

    /* =========================================================
     * 2) DRIP LIQUIDITY MANAGER - core wiring
     * =======================================================*/

    /// Základní wiring pro DripLM (router, reserve, dripDistributor, buybackAgent)
    function setupDripLMCore() public onlyOwner {
        IBiggiDripLiquidityManager D = IBiggiDripLiquidityManager(dripLM);

        D.setRouter(routerAddr);
        D.setReserve(reserveAddr);
        D.setDripDistributor(dripDistributor);
        D.setBuybackAgent(buybackAgent);
    }

    /// Jemné parametry pro DripLM (sellPct, slippage, deadline)
    function configureDripLMParams(
        uint8 sellPct,
        uint256 slipBps,
        uint256 deadline
    ) public onlyOwner {
        require(dripLM != address(0), "dripLM=0");
        IBiggiDripLiquidityManager D = IBiggiDripLiquidityManager(dripLM);

        D.setSellPct(sellPct);
        D.setSlippageBps(slipBps);
        D.setTxDeadlineSec(deadline);
    }

    /* =========================================================
     * 3) DRIP DISTRIBUTOR - core wiring
     * =======================================================*/

    /// Nastaví DripDistributor -> treasury + dripLM + tokensPerMint
    function setupDripDistributorCore(
        address treasury,
        uint256 tokensPerMint
    ) public onlyOwner {
        require(dripDistributor != address(0), "dripD=0");
        require(treasury != address(0), "treasury=0");

        IDripDistributor DD = IDripDistributor(dripDistributor);
        DD.setTreasury(treasury);
        DD.setDripLM(dripLM);
        DD.setTokensPerMint(tokensPerMint);
    }

    /* =========================================================
     * 4) RUN ALL (volitelně) - MUSÍ být až po deklaraci všech výše
     * =======================================================*/

    /**
     * @notice Orchestrace všeho jedním voláním.
     * Volat opatrně — runAll zavolá ostatní setupy a označí executed=true.
     *
     * @param buybackPath        swap path pro buyback (např. [WMATIC, BIGGI]) nebo prázdné pole pro clear
     * @param buybackSlipBps     fallback slippage (BPS)
     * @param buybackDeadline    fallback deadline (sekundy)
     * @param buybackCooldown    fallback cooldown mezi buybacky (sekundy)
     * @param autoEnable         zapnout auto-buyback
     * @param dripSellPct        kolik % DripLM prodá z nahlášeného množství (60/70 typicky)
     * @param dripSlippage       slippage BPS pro DripLM
     * @param dripDeadline       deadline pro DripLM swap
     * @param treasuryForDrip    treasury adresa pro DripDistributor (top-up source)
     * @param tokensPerMint      účetní tokenyPerMint (raw units)
     */
    function runAll(
        address[] calldata buybackPath,
        uint256 buybackSlipBps,
        uint256 buybackDeadline,
        uint256 buybackCooldown,
        bool autoEnable,
        uint8 dripSellPct,
        uint256 dripSlippage,
        uint256 dripDeadline,
        address treasuryForDrip,
        uint256 tokensPerMint
    ) external onlyOwner {
        require(!executed, "already executed");

        // 1) Buyback core + swap/fallbacks
        setupBuybackCore();
        configureBuybackSwapAndFallbacks(buybackPath, buybackSlipBps, buybackDeadline, buybackCooldown, autoEnable);

        // 2) DripLM core + params
        setupDripLMCore();
        configureDripLMParams(dripSellPct, dripSlippage, dripDeadline);

        // 3) DripDistributor wiring
        setupDripDistributorCore(treasuryForDrip, tokensPerMint);

        executed = true;
        emit BranchSetupExecuted(buybackAgent, dripLM, dripDistributor);
    }
}
