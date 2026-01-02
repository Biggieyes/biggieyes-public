// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiPolicy {
    function setSwapSlippageBps(uint256 newBps) external;
    function setTxDeadlineSec(uint256 newDeadline) external;
    function setMinBuybackInterval(uint256 newInterval) external;
    function setBuybacksPaused(bool paused_) external;
    function setMaxDailyBuybackNative(uint256 newMax) external;
}

/// @title SetupPolicyConfig — jednorázový skript pro nastavení BiggiPolicy
contract SetupPolicyConfig is Ownable {
    IBiggiPolicy public immutable policy;

    uint256 public immutable swapSlippageBps;
    uint256 public immutable txDeadlineSec;
    uint256 public immutable minBuybackInterval;
    bool    public immutable buybacksPaused;
    uint256 public immutable maxDailyBuybackNative;

    bool public executed;

    constructor(
        address initialOwner,
        address policy_,
        uint256 swapSlippageBps_,
        uint256 txDeadlineSec_,
        uint256 minBuybackInterval_,
        bool buybacksPaused_,
        uint256 maxDailyBuybackNative_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner0");
        require(policy_ != address(0), "policy0");

        policy = IBiggiPolicy(policy_);
        swapSlippageBps = swapSlippageBps_;
        txDeadlineSec = txDeadlineSec_;
        minBuybackInterval = minBuybackInterval_;
        buybacksPaused = buybacksPaused_;
        maxDailyBuybackNative = maxDailyBuybackNative_;
    }

    /// @notice zavolej jednou po nasazení skriptu
    function run() external onlyOwner {
        require(!executed, "already");
        executed = true;

        policy.setSwapSlippageBps(swapSlippageBps);
        policy.setTxDeadlineSec(txDeadlineSec);
        policy.setMinBuybackInterval(minBuybackInterval);
        policy.setBuybacksPaused(buybacksPaused);
        policy.setMaxDailyBuybackNative(maxDailyBuybackNative);
    }
}
