// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiVrfRouterRequest {
    function requestRandomFor(address minter, uint256 ticketId) external returns (uint256 requestId);
}

contract MockVrfMainConsumer {
    address public router;

    uint256 public lastRequestId;
    address public lastMinter;
    uint256 public lastTicketId;

    uint256 public fulfilledRequestId;
    uint256 public fulfilledRandomWord;

    event RouterSet(address indexed oldRouter, address indexed newRouter);
    event RequestForwarded(address indexed minter, uint256 indexed ticketId, uint256 indexed requestId);
    event RandomFulfilled(uint256 indexed requestId, uint256 randomWord);

    function setRouter(address router_) external {
        emit RouterSet(router, router_);
        router = router_;
    }

    function requestViaRouter(address minter, uint256 ticketId) external returns (uint256 requestId) {
        require(router != address(0), "router=0");
        requestId = IBiggiVrfRouterRequest(router).requestRandomFor(minter, ticketId);
        lastRequestId = requestId;
        lastMinter = minter;
        lastTicketId = ticketId;
        emit RequestForwarded(minter, ticketId, requestId);
    }

    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external {
        require(msg.sender == router, "only router");
        fulfilledRequestId = requestId;
        fulfilledRandomWord = randomWord;
        emit RandomFulfilled(requestId, randomWord);
    }
}
