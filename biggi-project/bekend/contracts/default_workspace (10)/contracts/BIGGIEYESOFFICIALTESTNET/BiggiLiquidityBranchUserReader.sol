// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* ========== Minimal view interfaces (only what we need) ========== */

interface IReserveUserView {
    function liquidityManager() external view returns (address);
    function waitingBiggi() external view returns (uint256);
    function dexRefillBiggi() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function polBalance() external view returns (uint256);
}

interface ILMUserView {
    function reserve() external view returns (address);
    function liquidityVault() external view returns (address);

    function tokenPct() external view returns (uint8);
    function slippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);

    function keeper() external view returns (address); // optional UI signal "automation set?"
    function router() external view returns (address); // optional debug
    function factory() external view returns (address); // optional debug
}

interface IVaultUserView {
    function liquidityManager() external view returns (address);
    function whitelistedPairs(address lpPair) external view returns (bool);
    function lpBalanceOf(address lpPair) external view returns (uint256);
}

/**
 * @title BiggiLiquidityBranchUserReader
 * @dev Read-only agregátor pro FE (users). Žádné settery, žádné admin funkce.
 *      Cíl: minimalizovat počet RPC callů a dát "health + readiness" v jednom.
 */
contract BiggiLiquidityBranchUserReader {
    IReserveUserView public immutable reserve;
    ILMUserView      public immutable lm;
    IVaultUserView   public immutable vault;

    // reason codes pro FE (krátké, snadno mapovatelné na text)
    uint8 public constant OK = 0;
    uint8 public constant ERR_WIRING = 1;
    uint8 public constant ERR_PAIR_NOT_WHITELISTED = 2;
    uint8 public constant ERR_REQUESTED_POL_ZERO = 3;
    uint8 public constant ERR_RESERVE_POL_LOW = 4;
    uint8 public constant ERR_RESERVE_BIGGI_LOW = 5;

    constructor(address reserve_, address lm_, address vault_) {
        require(reserve_ != address(0) && lm_ != address(0) && vault_ != address(0), "zero addr");
        reserve = IReserveUserView(reserve_);
        lm      = ILMUserView(lm_);
        vault   = IVaultUserView(vault_);
    }

    /* ========== Primary FE call: one-shot snapshot ========== */

    function branchSnapshot(address lpPair) external view returns (
        // Reserve
        uint256 reservePol,
        uint256 reserveBiggi,
        uint256 waitingBiggi,
        uint256 dexRefillBiggi,

        // LM settings
        uint8   tokenPct,
        uint256 slippageBps,
        uint256 deadlineSec,

        // Vault
        bool    pairWhitelisted,
        uint256 vaultLpBalance,

        // Wiring/health
        bool    wiredOk,

        // Optional wiring/debug signals
        address lmKeeper,
        address lmRouter,
        address lmFactory
    ) {
        reservePol    = reserve.polBalance();
        reserveBiggi  = reserve.biggiBalance();
        waitingBiggi   = reserve.waitingBiggi();
        dexRefillBiggi = reserve.dexRefillBiggi();

        tokenPct     = lm.tokenPct();
        slippageBps  = lm.slippageBps();
        deadlineSec  = lm.txDeadlineSec();

        pairWhitelisted = vault.whitelistedPairs(lpPair);
        vaultLpBalance  = vault.lpBalanceOf(lpPair);

        wiredOk = _wiredOk();

        lmKeeper  = lm.keeper();
        lmRouter  = lm.router();
        lmFactory = lm.factory();
    }

    /* ========== Health: wiring checks ========== */

    function wiringSnapshot() external view returns (
        bool wiredOk,
        address reserveLM,
        address vaultLM,
        address lmReserve,
        address lmVault
    ) {
        reserveLM = reserve.liquidityManager();
        vaultLM   = vault.liquidityManager();
        lmReserve = lm.reserve();
        lmVault   = lm.liquidityVault();

        wiredOk = (reserveLM == address(lm)) && (vaultLM == address(lm)) && (lmReserve == address(reserve)) && (lmVault == address(vault));
    }

    /* ========== Readiness: canPair with reason codes ========== */

    /// @notice Uživatelský check „dá se teď párovat?“ bez spouštění transakce.
    /// @param requestedPol kolik POL by pairing chtěl (UI input)
    /// @param lpPair LP pair adresa (kvůli whitelistu a LP balance)
    /// @param minDexRefillBiggi minimální BIGGI v dexRefill bucketu (UI může poslat 1e18 nebo svoje číslo)
    function canPair(
        uint256 requestedPol,
        address lpPair,
        uint256 minDexRefillBiggi
    ) external view returns (
        bool ok,
        uint8 reasonCode,
        uint256 reservePol,
        uint256 reserveDexRefillBiggi,
        bool pairWhitelisted,
        bool wiredOk
    ) {
        reservePol = reserve.polBalance();
        reserveDexRefillBiggi = reserve.dexRefillBiggi();
        pairWhitelisted = vault.whitelistedPairs(lpPair);
        wiredOk = _wiredOk();

        if (!wiredOk) return (false, ERR_WIRING, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);
        if (!pairWhitelisted) return (false, ERR_PAIR_NOT_WHITELISTED, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);
        if (requestedPol == 0) return (false, ERR_REQUESTED_POL_ZERO, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);
        if (reservePol < requestedPol) return (false, ERR_RESERVE_POL_LOW, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);

        // Bucket readiness (dexRefillBiggi)
        if (reserveDexRefillBiggi < minDexRefillBiggi) return (false, ERR_RESERVE_BIGGI_LOW, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);

        return (true, OK, reservePol, reserveDexRefillBiggi, pairWhitelisted, wiredOk);
    }

    /* ========== Internal ========== */

    function _wiredOk() internal view returns (bool) {
        return (reserve.liquidityManager() == address(lm))
            && (vault.liquidityManager() == address(lm))
            && (lm.reserve() == address(reserve))
            && (lm.liquidityVault() == address(vault));
    }
}

