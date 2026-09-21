// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFCoordinatorV2PlusInterface} from "../chainlink/VRFCoordinatorV2PlusInterface.sol";
import {VRFV2PlusClient} from "../chainlink/VRFV2PlusClient.sol";

interface IVrfRawConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

contract MockVrfCoordinatorV2Plus is VRFCoordinatorV2PlusInterface {
    uint256 public nextRequestId = 1;

    mapping(uint256 => address) public requester;
    mapping(uint256 => uint32) public requestedNumWords;
    mapping(uint256 => uint32) public requestedGasLimit;
    mapping(uint256 => bool) public callbackAttempted;
    event GasLimitedCallback(uint256 indexed requestId, bool success, uint256 gasUsed);

    event MockRandomWordsRequested(
        uint256 indexed requestId,
        address indexed requester,
        bytes32 keyHash,
        uint256 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs
    );
    event MockRandomWordsFulfilled(address indexed consumer, uint256 indexed requestId, uint256 randomWord);

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req)
        external
        override
        returns (uint256 requestId)
    {
        requestId = nextRequestId++;
        requester[requestId] = msg.sender;
        requestedNumWords[requestId] = req.numWords;
        requestedGasLimit[requestId] = req.callbackGasLimit;

        emit MockRandomWordsRequested(
            requestId,
            msg.sender,
            req.keyHash,
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            req.extraArgs
        );
    }

    function fulfill(address consumer, uint256 requestId, uint256 randomWord) external {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        IVrfRawConsumer(consumer).rawFulfillRandomWords(requestId, words);
        emit MockRandomWordsFulfilled(consumer, requestId, randomWord);
    }

    // The legacy fulfill helper intentionally stays unbounded for existing unit tests.
    // Recovery regressions must use this one-shot helper with the requested callback gas.
    function fulfillGasLimited(uint256 requestId, uint256 randomWord) external {
        require(!callbackAttempted[requestId] && requester[requestId] != address(0), "INVALID_CALLBACK");
        callbackAttempted[requestId] = true;
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        bytes memory data = abi.encodeCall(IVrfRawConsumer.rawFulfillRandomWords, (requestId, words));
        uint256 cap = requestedGasLimit[requestId];
        require(gasleft() > cap + cap / 63 + 50_000, "INSUFFICIENT_OUTER_GAS");
        uint256 beforeGas = gasleft();
        (bool success,) = requester[requestId].call{gas: cap}(data);
        emit GasLimitedCallback(requestId, success, beforeGas - gasleft());
    }

    function getConfig()
        external
        pure
        override
        returns (
            uint16 minimumRequestConfirmations,
            uint32 maxGasLimit,
            uint32 stalenessSeconds,
            uint256 gasAfterPaymentCalculation,
            int256 fallbackWeiPerUnitLink,
            int256 fallbackWeiPerUnitNative,
            uint96 feeConfig
        )
    {
        minimumRequestConfirmations = 3;
        maxGasLimit = 3_000_000;
        stalenessSeconds = 3600;
        gasAfterPaymentCalculation = 0;
        fallbackWeiPerUnitLink = 0;
        fallbackWeiPerUnitNative = 0;
        feeConfig = 0;
    }
}
