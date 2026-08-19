// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockOracle {
    int256 public latestAnswer;

    constructor(int256 initialAnswer) {
        latestAnswer = initialAnswer;
    }

    function setLatestAnswer(int256 value) external {
        latestAnswer = value;
    }
}