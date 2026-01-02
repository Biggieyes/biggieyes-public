// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UniswapV2Router02.sol";

contract RouterWrapper is UniswapV2Router02 {
    constructor(address _factory, address _weth) UniswapV2Router02(_factory, _weth) {}
}
