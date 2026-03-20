// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockDripLM {
    uint256 public totalBought;
    uint256 public calls;
    bool public shouldRevert;

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function dripOnBuy(uint256 biggiBought) external {
        require(!shouldRevert, "mock drip revert");
        totalBought += biggiBought;
        calls += 1;
    }
}
