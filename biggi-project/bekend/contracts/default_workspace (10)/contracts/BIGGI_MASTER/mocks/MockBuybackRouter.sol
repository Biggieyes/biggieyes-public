// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockBuybackRouter {
    address public immutable weth;
    uint256 public quoteBps = 10_000;

    constructor(address weth_) {
        require(weth_ != address(0), "weth=0");
        weth = weth_;
    }

    function WETH() external view returns (address) {
        return weth;
    }

    function setQuoteBps(uint256 bps) external {
        require(bps > 0, "bps=0");
        quoteBps = bps;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "path");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            amounts[i] = (amounts[i - 1] * quoteBps) / 10_000;
        }
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        uint256 amountOut = _swap(msg.value, amountOutMin, path, to);
        amounts = new uint256[](path.length);
        amounts[0] = msg.value;
        for (uint256 i = 1; i < path.length - 1; i++) {
            amounts[i] = (amounts[i - 1] * quoteBps) / 10_000;
        }
        amounts[path.length - 1] = amountOut;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external payable {
        _swap(msg.value, amountOutMin, path, to);
    }

    function _swap(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to)
        internal
        returns (uint256 amountOut)
    {
        require(path.length >= 2, "path");
        require(path[0] == weth, "path0");
        require(to != address(0), "to=0");

        amountOut = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            amountOut = (amountOut * quoteBps) / 10_000;
        }

        require(amountOut >= amountOutMin, "slippage");
        require(IERC20(path[path.length - 1]).balanceOf(address(this)) >= amountOut, "insufficient token");
        require(IERC20(path[path.length - 1]).transfer(to, amountOut), "transfer fail");
    }

    receive() external payable {}
}
