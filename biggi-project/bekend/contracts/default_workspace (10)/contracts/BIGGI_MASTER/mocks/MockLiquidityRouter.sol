// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMockLpToken {
    function mint(address to, uint256 amount) external;
}

contract MockLiquidityRouter {
    address public immutable weth;
    address public lpToken;
    uint256 public quoteBps = 10_000;

    constructor(address weth_, address lpToken_) {
        require(weth_ != address(0), "weth=0");
        weth = weth_;
        lpToken = lpToken_;
    }

    function WETH() external view returns (address) {
        return weth;
    }

    function setQuoteBps(uint256 bps) external {
        require(bps > 0, "bps=0");
        quoteBps = bps;
    }

    function setLpToken(address lpToken_) external {
        lpToken = lpToken_;
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

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
    {
        require(token != address(0), "token=0");
        require(to != address(0), "to=0");

        amountToken = amountTokenDesired;
        amountETH = msg.value;

        if (amountToken > 0) {
            require(IERC20(token).transferFrom(msg.sender, address(this), amountToken), "token transfer fail");
        }

        liquidity = amountToken + amountETH;
        if (lpToken != address(0) && liquidity > 0) {
            IMockLpToken(lpToken).mint(to, liquidity);
        }
    }

    receive() external payable {}
}
