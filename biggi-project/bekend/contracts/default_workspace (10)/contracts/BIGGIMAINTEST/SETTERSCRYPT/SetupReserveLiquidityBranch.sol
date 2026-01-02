// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ===== Minimalní rozhraní Reserve kontraktu ===== */
interface IBiggiReserve {
    function setLiquidityManager(address lm) external;
}

/* ===== Minimalní rozhraní Liquidity Manageru ===== */
interface IBiggiLiquidityManager {
    function setRouter(address r) external;
    function setToken(address token) external;
    function setWNative(address w) external;
    function setReserve(address r) external;
    function setVault(address v) external;
    function setPolicy(address p) external;
}

/* ===== Minimalní rozhraní Liquidity Vaultu ===== */
interface IBiggiLiquidityVault {
    function setLiquidityManager(address lm) external;
    function whitelistPair(address pair, bool allowed) external;
}

/**
 * @title SetupReserveLiquidityBranch
 * @notice Jednorázový skript pro nastavení větve:
 *         Reserve + LiquidityManager + LiquidityVault
 *
 * POZOR: tenhle skript NEDĚLÁ initial liquidity ani addLiquidity.
 * Slouží čistě k propojení kontraktů a základní konfiguraci.
 */
contract SetupReserveLiquidityBranch is Ownable {
    // --- pevné adresy kontraktů (immutable) ---
    address public immutable reserve;
    address public immutable liquidityManager;
    address public immutable vault;
    address public immutable biggiToken;
    address public immutable router;
    address public immutable wNative;
    address public immutable policy; // může být address(0), pokud policy zatím nemáš

    bool public executed;

    event ReserveLiquidityBranchSetup(
        address indexed reserve,
        address indexed liquidityManager,
        address indexed vault,
        address lpPair
    );

    constructor(
        address initialOwner,
        address reserve_,
        address liquidityManager_,
        address vault_,
        address biggiToken_,
        address router_,
        address wNative_,
        address policy_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(reserve_ != address(0), "reserve=0");
        require(liquidityManager_ != address(0), "lm=0");
        require(vault_ != address(0), "vault=0");
        require(biggiToken_ != address(0), "token=0");
        require(router_ != address(0), "router=0");
        require(wNative_ != address(0), "wnative=0");

        reserve          = reserve_;
        liquidityManager = liquidityManager_;
        vault            = vault_;
        biggiToken       = biggiToken_;
        router           = router_;
        wNative          = wNative_;
        policy           = policy_;
    }

    /**
     * @notice Spustíš JEDNOU v Remixu po deploy všech kontraktů.
     * @param lpPair adresa LP pairu (např. BIGGI/WMATIC), kterou má Vault whitelisternout.
     */
    function run(address lpPair) external onlyOwner {
        require(!executed, "already executed");
        executed = true;

        require(lpPair != address(0), "pair=0");

        // 1) Reserve -> LiquidityManager
        IBiggiReserve(reserve).setLiquidityManager(liquidityManager);

        // 2) LiquidityManager wiring
        IBiggiLiquidityManager(liquidityManager).setRouter(router);
        IBiggiLiquidityManager(liquidityManager).setToken(biggiToken);
        IBiggiLiquidityManager(liquidityManager).setWNative(wNative);
        IBiggiLiquidityManager(liquidityManager).setReserve(reserve);
        IBiggiLiquidityManager(liquidityManager).setVault(vault);
        IBiggiLiquidityManager(liquidityManager).setPolicy(policy); // může být 0

        // 3) Vault -> LM + whitelist pair
        IBiggiLiquidityVault(vault).setLiquidityManager(liquidityManager);
        IBiggiLiquidityVault(vault).whitelistPair(lpPair, true);

        emit ReserveLiquidityBranchSetup(reserve, liquidityManager, vault, lpPair);
    }
}
