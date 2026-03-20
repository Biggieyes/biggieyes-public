// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapRouter {
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

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external {
        require(path.length >= 2, "path");
        require(to != address(0), "to=0");

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

        uint256 amountOut = (amountIn * quoteBps) / 10_000;
        require(amountOut >= amountOutMin, "slippage");
        require(address(this).balance >= amountOut, "insufficient native");

        (bool ok, ) = payable(to).call{value: amountOut}("");
        require(ok, "native send fail");
    }

    receive() external payable {}
}
