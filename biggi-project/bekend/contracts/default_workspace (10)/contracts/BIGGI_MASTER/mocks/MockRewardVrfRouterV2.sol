// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMockRewardVrfConsumerV2 {
    function fulfillRandom(uint256 requestId, uint256 random) external;
}

contract MockRewardVrfRouterV2 {
    uint256 public nextRequestId = 1;
    address public lastRequester;
    uint256 public lastEventId;

    function setNextRequestId(uint256 requestId) external {
        nextRequestId = requestId;
    }

    function requestRandomForReward(address requester, uint256 eventId)
        external
        returns (uint256 requestId)
    {
        lastRequester = requester;
        lastEventId = eventId;
        return nextRequestId;
    }

    function fulfill(address consumer, uint256 requestId, uint256 random) external {
        IMockRewardVrfConsumerV2(consumer).fulfillRandom(requestId, random);
    }
}
