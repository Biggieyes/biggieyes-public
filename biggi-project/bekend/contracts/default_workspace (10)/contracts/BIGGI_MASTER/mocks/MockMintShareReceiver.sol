// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockMintShareReceiver {
    uint256 public totalReceived;

    function receiveMintShare() external payable {
        totalReceived += msg.value;
    }

    receive() external payable {
        totalReceived += msg.value;
    }
}
