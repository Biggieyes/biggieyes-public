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
    uint256 public lastMinOut;
    uint256 public previewMinOut = 1;
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

    function setPreviewMinOut(uint256 amount) external {
        previewMinOut = amount;
    }

    function previewAutoMinOut(uint256) external view returns (uint256) {
        return previewMinOut;
    }

    function buybackAllToTreasury(uint256 minOut) external {
        require(!shouldRevert, "mock buyback revert");
        require(!policy.buybacksPaused(), "policy paused");
        require(minOut > 0, "minOut=0");
        lastMinOut = minOut;
        buybackCalls += 1;
        lastBuybackAt = block.timestamp;
        nativeBalance = 0;
    }
}
