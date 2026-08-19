// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV2Router02Biggi {
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

library BiggiSwapLib {
    uint256 internal constant BPS_DENOM = 10_000;

    function pathNativeToToken(address wrappedNative, address token) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = wrappedNative;
        p[1] = token;
    }

    function pathTokenToNative(address token, address wrappedNative) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = token;
        p[1] = wrappedNative;
    }

    function quoteMinOut(
        IUniswapV2Router02Biggi router,
        uint256 amountIn,
        address[] memory path,
        uint256 slippageBps
    ) internal view returns (uint256 minOut) {
        if (amountIn == 0) return 0;
        if (slippageBps > BPS_DENOM) slippageBps = BPS_DENOM;

        try router.getAmountsOut(amountIn, path) returns (uint[] memory amounts) {
            if (amounts.length == 0) return 0;
            uint256 quote = amounts[amounts.length - 1];
            uint256 keepBps = BPS_DENOM - slippageBps;
            minOut = (quote * keepBps) / BPS_DENOM;
        } catch {
            minOut = 0;
        }
    }
}
