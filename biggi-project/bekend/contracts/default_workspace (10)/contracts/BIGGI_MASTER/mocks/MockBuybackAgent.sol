// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMockBuybackPolicyView {
    function buybacksPaused() external view returns (bool);
}

contract MockBuybackAgent {
    IMockBuybackPolicyView public policy;
    uint256 public lastBuybackAt;
    uint256 public nativeBalance;
    uint256 public buybackCalls;
    bool public shouldRevert;

    constructor(address policy_) {
        policy = IMockBuybackPolicyView(policy_);
    }

    function setPolicy(address policy_) external {
        policy = IMockBuybackPolicyView(policy_);
    }

    function setNativeBalance(uint256 amount) external {
        nativeBalance = amount;
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function buybackAllToTreasury(uint256) external {
        require(!shouldRevert, "mock buyback revert");
        require(!policy.buybacksPaused(), "policy paused");
        buybackCalls += 1;
        lastBuybackAt = block.timestamp;
        nativeBalance = 0;
    }
}
