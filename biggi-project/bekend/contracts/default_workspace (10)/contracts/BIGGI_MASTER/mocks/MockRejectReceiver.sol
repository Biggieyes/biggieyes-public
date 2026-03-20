// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRejectReceiver {
    bool public shouldReject = true;
    uint256 public totalReceived;

    function setReject(bool reject_) external {
        shouldReject = reject_;
    }

    function receiveMintShare() external payable {
        if (shouldReject) revert("reject");
        totalReceived += msg.value;
    }

    receive() external payable {
        if (shouldReject) revert("reject");
        totalReceived += msg.value;
    }
}
