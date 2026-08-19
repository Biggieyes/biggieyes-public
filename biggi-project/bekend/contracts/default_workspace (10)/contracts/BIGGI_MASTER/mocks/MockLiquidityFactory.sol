// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockLiquidityFactory {
    address public pair;

    function setPair(address pair_) external {
        pair = pair_;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}
