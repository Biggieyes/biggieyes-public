// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockBuybackPolicy {
    bool public buybacksPaused;
    uint256 public minBuybackInterval;

    function setBuybacksPaused(bool v) external {
        buybacksPaused = v;
    }

    function setMinBuybackInterval(uint256 v) external {
        minBuybackInterval = v;
    }
}
