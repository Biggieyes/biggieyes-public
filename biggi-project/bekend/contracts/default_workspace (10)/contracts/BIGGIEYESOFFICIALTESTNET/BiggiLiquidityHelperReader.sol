// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiLiquidityHelperReader
 * View helper pro FE: router info, swap path a rychlý preview párování.
 * Čte ze stávajících LM/Reserve/Vault kontraktů, nepíše žádný stav.
 */

interface ILiquidityManagerView {
    function BIGGI() external view returns (address);
    function router() external view returns (address);
    function factory() external view returns (address);
}

interface IReserveView {
    function dexRefillBiggi() external view returns (uint256);
    function polBalance() external view returns (uint256);
}

interface IVaultView {
    function whitelistedPairs(address lpPair) external view returns (bool);
    function lpBalanceOf(address lpPair) external view returns (uint256);
}

interface IUniswapV2RouterView {
    function WETH() external view returns (address);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract BiggiLiquidityHelperReader {
    ILiquidityManagerView public immutable lm;
    IReserveView public immutable reserve;
    IVaultView public immutable vault;
    IUniswapV2RouterView public immutable router;

    constructor(address reserve_, address lm_, address vault_, address router_) {
        require(reserve_ != address(0) && lm_ != address(0) && vault_ != address(0) && router_ != address(0), "zero addr");
        reserve = IReserveView(reserve_);
        lm = ILiquidityManagerView(lm_);
        vault = IVaultView(vault_);
        router = IUniswapV2RouterView(router_);
    }

    function routerInfo() external view returns (address routerAddr, address factory, address weth) {
        routerAddr = address(router);
        factory = lm.factory();
        weth = router.WETH();
    }

    function getSwapPath() external view returns (address[] memory p) {
        p = new address[](2);
        p[0] = router.WETH();
        p[1] = lm.BIGGI();
    }

    /// @notice Náhled kolik BIGGI bude potřeba pro požadované POL (bez slippage úprav)
    function liquidityPreview(uint256 requestedPolWei) external view returns (
        uint256 tokenDesired,
        uint256[] memory amountsOutPath,
        uint256 reservePol,
        uint256 dexRefillBiggi
    ) {
        reservePol = reserve.polBalance();
        dexRefillBiggi = reserve.dexRefillBiggi();

        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = lm.BIGGI();

        try router.getAmountsOut(requestedPolWei, path) returns (uint256[] memory amounts) {
            amountsOutPath = amounts;
            if (amounts.length >= 2) {
                tokenDesired = amounts[1];
            }
        } catch {
            // necháme defaultní nuly
        }
    }

    function vaultInfo(address lpPair) external view returns (bool pairWhitelisted, uint256 vaultLpBalance) {
        pairWhitelisted = vault.whitelistedPairs(lpPair);
        vaultLpBalance = vault.lpBalanceOf(lpPair);
    }
}
