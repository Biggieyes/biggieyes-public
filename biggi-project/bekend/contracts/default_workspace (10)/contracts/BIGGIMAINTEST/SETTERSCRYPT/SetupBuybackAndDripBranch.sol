// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ===== Minimalní rozhraní BuybackAgenta ===== */
interface IBiggiBuybackAgent {
    function setRouter(address router_) external;
    function setTreasury(address treasury_) external;
    function setPolicy(address policy_) external;
    function setDripLM(address dripLM_) external;
    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external;
    function toggleAutoBuyback(bool enabled) external;
}

/* ===== Minimalní rozhraní Drip Liquidity Managera ===== */
interface IBiggiDripLiquidityManager {
    function setRouter(address r) external;
    function setReserve(address r) external;
    function setDripDistributor(address d) external;
    function setBuybackAgent(address a) external;
    function setSellPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
}

/* ===== Minimalní rozhraní DripDistributoru ===== */
interface IDripDistributor {
    function setDripLM(address lm) external;
}

/**
 * @title SetupBuybackAndDripBranch
 * @notice Jednorázový skript pro nastavení větve:
 *         BuybackAgent + DripLiquidityManager + DripDistributor
 */
contract SetupBuybackAndDripBranch is Ownable {
    // adresy kontraktů (jen adresy, žádné config hodnoty)
    address public immutable buybackAgent;
    address public immutable dripLM;
    address public immutable dripDistributor;
    address public immutable reserveAddr;
    address public immutable treasuryAddr;
    address public immutable routerAddr;
    address public immutable policyAddr; // může být address(0) = bez policy

    bool public executed;

    event BranchSetupExecuted(
        address indexed buybackAgent,
        address indexed dripLM,
        address indexed dripDistributor
    );

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

        buybackAgent    = buybackAgent_;
        dripLM          = dripLM_;
        dripDistributor = dripDistributor_;
        reserveAddr     = reserveAddr_;
        treasuryAddr    = treasuryAddr_;
        routerAddr      = routerAddr_;
        policyAddr      = policyAddr_;
    }

    /// @notice Spustit JEDNOU po deploy všech kontraktů.
    /// Konfig hodnoty dáš jako argumenty přímo při volání `run(...)` v Remixu.
    function run(
        uint8   dripSellPct_,
        uint256 dripSlippageBps_,
        uint256 dripDeadlineSec_,
        uint256 buybackSlipBps_,
        uint256 buybackDeadlineSec_,
        uint256 buybackIntervalSec_
    ) external onlyOwner {
        require(!executed, "already executed");
        executed = true;

        // ---- 1) Nastavení BuybackAgenta ----
        IBiggiBuybackAgent(buybackAgent).setRouter(routerAddr);
        IBiggiBuybackAgent(buybackAgent).setTreasury(treasuryAddr);
        IBiggiBuybackAgent(buybackAgent).setPolicy(policyAddr); // může být 0
        IBiggiBuybackAgent(buybackAgent).setDripLM(dripLM);
        IBiggiBuybackAgent(buybackAgent).setFallbacks(
            buybackSlipBps_,
            buybackDeadlineSec_,
            buybackIntervalSec_
        );
        // zapnout auto-buyback (pokud ho chceš hned od startu)
        IBiggiBuybackAgent(buybackAgent).toggleAutoBuyback(true);

        // ---- 2) Nastavení DripLiquidityManagera ----
        IBiggiDripLiquidityManager(dripLM).setRouter(routerAddr);
        IBiggiDripLiquidityManager(dripLM).setReserve(reserveAddr);
        IBiggiDripLiquidityManager(dripLM).setDripDistributor(dripDistributor);
        IBiggiDripLiquidityManager(dripLM).setBuybackAgent(buybackAgent);
        IBiggiDripLiquidityManager(dripLM).setSellPct(dripSellPct_);
        IBiggiDripLiquidityManager(dripLM).setSlippageBps(dripSlippageBps_);
        IBiggiDripLiquidityManager(dripLM).setTxDeadlineSec(dripDeadlineSec_);

        // ---- 3) Propojení DripDistributor -> DripLM ----
        IDripDistributor(dripDistributor).setDripLM(dripLM);

        emit BranchSetupExecuted(buybackAgent, dripLM, dripDistributor);
    }
}
