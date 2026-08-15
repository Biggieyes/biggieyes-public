// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiLiquidityHelperReader
 * View helper pro FE: router info, swap path a rychly preview parovani.
 * Cte ze stavajicich LM/Reserve/Vault kontraktu, nepise zadny stav.
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

interface IUniswapV2FactoryView {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2PairView {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
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

        address pair = IUniswapV2FactoryView(lm.factory()).getPair(path[0], path[1]);
        if (pair != address(0)) {
            (uint112 reserve0, uint112 reserve1,) = IUniswapV2PairView(pair).getReserves();
            if (reserve0 != 0 && reserve1 != 0) {
                if (IUniswapV2PairView(pair).token0() == lm.BIGGI()) {
                    tokenDesired = (requestedPolWei * uint256(reserve0)) / uint256(reserve1);
                } else if (IUniswapV2PairView(pair).token1() == lm.BIGGI()) {
                    tokenDesired = (requestedPolWei * uint256(reserve1)) / uint256(reserve0);
                }
            }
        }

        try router.getAmountsOut(requestedPolWei, path) returns (uint256[] memory amounts) {
            amountsOutPath = amounts;
            if (tokenDesired == 0 && amounts.length >= 2) {
                tokenDesired = amounts[1];
            }
        } catch {
        }
    }

    function vaultInfo(address lpPair) external view returns (bool pairWhitelisted, uint256 vaultLpBalance) {
        pairWhitelisted = vault.whitelistedPairs(lpPair);
        vaultLpBalance = vault.lpBalanceOf(lpPair);
    }
}
