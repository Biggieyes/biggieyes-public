// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ Minimalní rozhraní BiggiReserve (ReserveV4) ============ */
interface IBiggiReserveSetup {
    function setToken(address token) external;
    function setLiquidityManager(address lm) external;
    function setVault(address vault) external;
    function setRouter(address router) external;
}

/* ============ Minimalní rozhraní BiggiLiquidityManager ============ */
interface IBiggiLiquidityManagerSetup {
    function setReserve(address reserve) external;
    function setVault(address vault) external;
    function setToken(address token) external;
    function setRouter(address router) external;
}

/* ============ Minimalní rozhraní LiquidityVault ============ */
interface ILiquidityVaultSetup {
    function setReserve(address reserve) external;
    function setLiquidityManager(address lm) external;
    function setWhitelistedPair(address pair, bool allowed) external;
}

/**
 * @title SetupReserveLiquidityBranch
 * @notice Jednorázový nastavovací skript pro větev:
 *  - Reserve (BiggiReserveV4)
 *  - LiquidityManager
 *  - LiquidityVault
 *
 * Použití (Remix):
 *  1) Nasadíš kontrakt s `initialOwner = tvoje EOA`.
 *  2) Zavoláš:
 *     - `setupReserveCore(...)`
 *     - `setupLiquidityManagerCore(...)`
 *     - `setupLiquidityVaultCore(...)`
 */
contract SetupReserveLiquidityBranch is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Napojí Reserve na token, LM, vault a router.
     *
     * @param reserve  adresa BiggiReserveV4
     * @param token    adresa BIGGI tokenu
     * @param lm       adresa BiggiLiquidityManager
     * @param vault    adresa LiquidityVault
     * @param router   adresa UniswapV2 routeru (např. QuickSwap)
     */
    function setupReserveCore(
        address reserve,
        address token,
        address lm,
        address vault,
        address router
    ) external onlyOwner {
        require(reserve != address(0), "reserve=0");
        require(token != address(0), "token=0");
        require(lm != address(0), "lm=0");
        require(vault != address(0), "vault=0");
        require(router != address(0), "router=0");

        IBiggiReserveSetup r = IBiggiReserveSetup(reserve);

        r.setToken(token);
        r.setLiquidityManager(lm);
        r.setVault(vault);
        r.setRouter(router);
    }

    /**
     * @notice Napojí LiquidityManager na reserve, vault, token a router.
     *
     * @param lm      adresa BiggiLiquidityManager
     * @param reserve adresa BiggiReserveV4
     * @param vault   adresa LiquidityVault
     * @param token   adresa BIGGI tokenu
     * @param router  adresa UniswapV2 routeru (QuickSwap)
     */
    function setupLiquidityManagerCore(
        address lm,
        address reserve,
        address vault,
        address token,
        address router
    ) external onlyOwner {
        require(lm != address(0), "lm=0");
        require(reserve != address(0), "reserve=0");
        require(vault != address(0), "vault=0");
        require(token != address(0), "token=0");
        require(router != address(0), "router=0");

        IBiggiLiquidityManagerSetup L = IBiggiLiquidityManagerSetup(lm);

        L.setReserve(reserve);
        L.setVault(vault);
        L.setToken(token);
        L.setRouter(router);
    }

    /**
     * @notice Nastaví LiquidityVault:
     *  - reserve
     *  - liquidity manager
     *  - whitelisted LP pair (LP token z DEXu)
     *
     * @param vault   adresa LiquidityVault kontraktu
     * @param reserve adresa BiggiReserveV4
     * @param lm      adresa BiggiLiquidityManager
     * @param lpPair  adresa LP páru BIGGI/WMATIC (z routeru / factory)
     */
    function setupLiquidityVaultCore(
        address vault,
        address reserve,
        address lm,
        address lpPair
    ) external onlyOwner {
        require(vault != address(0), "vault=0");
        require(reserve != address(0), "reserve=0");
        require(lm != address(0), "lm=0");
        require(lpPair != address(0), "pair=0");

        ILiquidityVaultSetup V = ILiquidityVaultSetup(vault);

        V.setReserve(reserve);
        V.setLiquidityManager(lm);
        V.setWhitelistedPair(lpPair, true);
    }
}
