// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiMainFulfill {
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external;
}

contract MockVrfRouter {
    uint256 public nextRequestId = 1;

    mapping(uint256 => address) public reqMain;
    mapping(uint256 => address) public reqMinter;
    mapping(uint256 => uint256) public reqTicket;

    function requestRandomFor(address minter, uint256 ticketId) external returns (uint256 requestId) {
        requestId = nextRequestId;
        nextRequestId = requestId + 1;
        reqMain[requestId] = msg.sender;
        reqMinter[requestId] = minter;
        reqTicket[requestId] = ticketId;
    }

    function fulfill(uint256 requestId, uint256 randomWord) external {
        address main = reqMain[requestId];
        require(main != address(0), "unknown req");
        IBiggiMainFulfill(main).fulfillRandomFromRouter(requestId, randomWord);
    }

    function keyHash() external pure returns (bytes32) { return bytes32(0); }
    function subId() external pure returns (uint256) { return 1; }
    function callbackGasLimit() external pure returns (uint32) { return 300000; }
    function requestConfirmations() external pure returns (uint16) { return 3; }
    function numWords() external pure returns (uint32) { return 1; }
}
