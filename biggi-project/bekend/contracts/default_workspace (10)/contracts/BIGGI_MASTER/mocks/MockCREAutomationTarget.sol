// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockCREAutomationTarget {
    uint256 public calls;
    address public lastCaller;
    bytes public lastPerformData;

    event UpkeepPerformed(address indexed caller, bytes performData);

    function performUpkeep(bytes calldata performData) external {
        calls += 1;
        lastCaller = msg.sender;
        lastPerformData = performData;
        emit UpkeepPerformed(msg.sender, performData);
    }

    function forbidden(bytes calldata) external {
        calls = type(uint256).max;
        lastCaller = msg.sender;
    }

    function revertingUpkeep(bytes calldata) external pure {
        revert("MOCK_TARGET_REVERT");
    }
}
