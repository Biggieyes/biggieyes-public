// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  Minimal Uniswap V2-like Router (test)
  - addLiquidity / addLiquidityETH
  - removeLiquidity
  - swapExactTokensForTokens
  - swapExactETHForTokens
  - getAmountsOut (bez fee)
  - kompatibilní s jednoduchým Factory/Pair implementovaným v repo
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IUniswapV2Factory {
    function getPair(address a, address b) external view returns (address);
    function createPair(address a, address b) external returns (address);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function mint(address to) external returns (uint liquidity);
    function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to) external;
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint) external;
    function transfer(address, uint) external returns (bool);
    function approve(address, uint) external returns (bool);
}

contract UniswapV2Router02 {
    using Address for address payable;

    address public immutable factory;
    address public immutable WETH;

    constructor(address _factory, address _weth) {
        require(_factory != address(0) && _weth != address(0), "ZERO_ADDR");
        factory = _factory;
        WETH = _weth;
    }

    /* ============ Helper: pair creation / lookup ============ */

    function _pairFor(address tokenA, address tokenB) internal returns (address pair) {
        pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        if (pair == address(0)) {
            pair = IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }
    }

    /* ============ Add liquidity ============ */

    /// @notice Add liquidity by transferring tokens to pair then calling mint
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountA,
        uint amountB,
        address to
    ) external returns (uint liquidity) {
        require(amountA > 0 && amountB > 0, "ZERO_AMOUNTS");
        address pair = _pairFor(tokenA, tokenB);

        // transfer tokens from sender to pair
        require(IERC20(tokenA).transferFrom(msg.sender, pair, amountA), "TF_A");
        require(IERC20(tokenB).transferFrom(msg.sender, pair, amountB), "TF_B");

        // mint LP to 'to'
        liquidity = IUniswapV2Pair(pair).mint(to);
    }

    /// @notice Wrap native (ETH/POL) into WETH and add liquidity token<>WETH
    /// @dev signature kept compatible with common routers. Unused params are commented to silence compiler warnings.
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint /* amountTokenMin */,
        uint /* amountETHMin */,
        address to,
        uint /* deadline */
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        require(msg.value > 0, "ZERO_VALUE");
        require(amountTokenDesired > 0, "ZERO_TOKEN");

        // wrap native -> WETH and transfer to pair
        IWETH(WETH).deposit{value: msg.value}();
        address pair = _pairFor(token, WETH);
        require(IWETH(WETH).transfer(pair, msg.value), "WETH_TF");

        // pull token from caller (router must have allowance)
        require(IERC20(token).transferFrom(msg.sender, pair, amountTokenDesired), "TF_TOKEN");

        // mint LP to 'to'
        liquidity = IUniswapV2Pair(pair).mint(to);

        // return the amounts used (simple router: used = desired / msg.value)
        amountToken = amountTokenDesired;
        amountETH = msg.value;
    }

    /* ============ Remove liquidity ============ */

    /// @notice Remove liquidity: transfer LP tokens to pair then call burn
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        address to
    ) external returns (uint amountA, uint amountB) {
        require(liquidity > 0, "ZERO_LIQ");
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "NO_PAIR");

        // transfer LP tokens from sender to pair (pair is ERC20 LP)
        require(IERC20(pair).transferFrom(msg.sender, pair, liquidity), "LP_TF");

        // call burn -> transfers underlying to 'to' via pair implementation
        (amountA, amountB) = IUniswapV2Pair(pair).burn(to);
    }

    /* ============ Swaps (exact in) ============ */

    // Compute output amount without fee: amountOut = amountIn * reserveOut / (reserveIn + amountIn)
    function _getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint) {
        require(amountIn > 0, "ZERO_IN");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQ");
        uint amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
        return amountOut;
    }

    // Get reserves in the order of tokenA, tokenB
    function _getReserves(address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "NO_PAIR");
        (uint112 r0, uint112 r1, ) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();
        if (tokenA == token0) {
            reserveA = uint(r0);
            reserveB = uint(r1);
        } else {
            reserveA = uint(r1);
            reserveB = uint(r0);
        }
    }

    /// @notice getAmountsOut for a path (no fee model)
    function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i = 0; i < path.length - 1; i++) {
            (uint reserveIn, uint reserveOut) = _getReserves(path[i], path[i+1]);
            amounts[i+1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /// @notice Swap exact tokens for tokens along path. Caller must approve router for input token.
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external returns (uint[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");

        // transfer input from sender to first pair
        address firstPair = _pairFor(path[0], path[1]);
        require(IERC20(path[0]).transferFrom(msg.sender, firstPair, amounts[0]), "TF_IN");

        // iterate and perform swaps
        for (uint i = 0; i < path.length - 1; i++) {
            address input = path[i];
            address output = path[i+1];
            address pair = IUniswapV2Factory(factory).getPair(input, output);
            require(pair != address(0), "NO_PAIR_STEP");

            // determine amounts out for this step
            uint amountOut = amounts[i+1];

            address token0 = IUniswapV2Pair(pair).token0();
            uint amount0Out;
            uint amount1Out;
            if (input == token0) {
                amount0Out = 0;
                amount1Out = amountOut;
            } else {
                amount0Out = amountOut;
                amount1Out = 0;
            }

            address toAddress = (i < path.length - 2) ? _pairFor(output, path[i+2]) : to;

            IUniswapV2Pair(pair).swap(amount0Out, amount1Out, toAddress);
        }
    }

    /// @notice Swap exact ETH for tokens (path[0] must be WETH)
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external payable returns (uint[] memory amounts) {
        require(path.length >= 2 && path[0] == WETH, "INVALID_PATH");
        require(msg.value > 0, "ZERO_ETH");

        // wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        // transfer WETH to first pair
        address firstPair = _pairFor(path[0], path[1]);
        require(IWETH(WETH).transfer(firstPair, msg.value), "WETH_TF");

        amounts = getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");

        // perform swaps (first swap already has WETH in pair)
        for (uint i = 0; i < path.length - 1; i++) {
            address input = path[i];
            address output = path[i+1];
            address pair = IUniswapV2Factory(factory).getPair(input, output);
            require(pair != address(0), "NO_PAIR_STEP");

            uint amountOut = amounts[i+1];

            address token0 = IUniswapV2Pair(pair).token0();
            uint amount0Out;
            uint amount1Out;
            if (input == token0) {
                amount0Out = 0;
                amount1Out = amountOut;
            } else {
                amount0Out = amountOut;
                amount1Out = 0;
            }

            address toAddress = (i < path.length - 2) ? _pairFor(output, path[i+2]) : to;

            IUniswapV2Pair(pair).swap(amount0Out, amount1Out, toAddress);
        }
    }

    /* ============ Utilities ============ */

    // fallback to receive ETH when needed (e.g. unwrap)
    receive() external payable {}
}
