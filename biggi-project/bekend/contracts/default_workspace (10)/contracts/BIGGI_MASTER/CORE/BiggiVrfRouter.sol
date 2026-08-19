// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VRFConsumerBaseV2Plus} from "../chainlink/VRFConsumerBaseV2Plus.sol";
import {VRFCoordinatorV2PlusInterface} from "../chainlink/VRFCoordinatorV2PlusInterface.sol";
import {VRFV2PlusClient} from "../chainlink/VRFV2PlusClient.sol";

interface IBiggiEyesMainCallback {
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external;
}

interface IBiggiNftRewardsCallback {
    function fulfillRandom(uint256 requestId, uint256 randomWord) external;
}

contract BiggiVRFRouter is VRFConsumerBaseV2Plus, Ownable {
    // ===== Chainlink VRF V2 Plus config =====
    VRFCoordinatorV2PlusInterface public coordinator;
    bytes32 public keyHash;
    uint256 public subId;
    uint32 public callbackGasLimit = 300_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    // ===== App state =====
    address public main;
    mapping(address => bool) public approvedMains;
    mapping(address => bool) public approvedRewardConsumers;

    // request metadata (debug/ui)
    mapping(uint256 => address) public reqMinter;
    mapping(uint256 => uint256) public reqTicket;
    mapping(uint256 => address) public reqMain;
    mapping(uint256 => bool) public reqIsReward;

    // ===== Events =====
    event MainSet(address indexed main);
    event MainApprovalSet(address indexed main, bool approved);
    event RewardConsumerApprovalSet(address indexed consumer, bool approved);
    event VrfParamsUpdated(bytes32 keyHash, uint256 subId, uint32 gasLimit, uint16 conf, uint32 numWords);
    event RandomRequested(address indexed minter, uint256 ticketId, uint256 requestId);
    event RandomRequestedForReward(address indexed requester, uint256 eventId, uint256 requestId);
    event RandomFulfilled(uint256 requestId, uint256 randomWord);
    event RandomForwardFailed(uint256 indexed requestId, address indexed target, bytes reason);

    modifier onlyMain() {
        require(msg.sender == main || approvedMains[msg.sender], "ONLY_MAIN");
        _;
    }

    modifier onlyRewardConsumer() {
        require(approvedRewardConsumers[msg.sender], "ONLY_REWARD_CONSUMER");
        _;
    }

    constructor(
        address vrfCoordinator_,
        address initialOwner,
        bytes32 keyHash_,
        uint256 subId_
    ) VRFConsumerBaseV2Plus(vrfCoordinator_) Ownable(initialOwner) {
        require(vrfCoordinator_ != address(0) && initialOwner != address(0), "zero addr");
        coordinator = VRFCoordinatorV2PlusInterface(vrfCoordinator_);
        keyHash = keyHash_;
        subId = subId_;
        emit VrfParamsUpdated(keyHash, subId, callbackGasLimit, requestConfirmations, numWords);
    }

    // ===== Wiring =====
    function setMain(address main_) external onlyOwner {
        require(main_ != address(0), "zero main");
        main = main_;
        approvedMains[main_] = true;
        emit MainSet(main_);
        emit MainApprovalSet(main_, true);
    }

    function setMainApproval(address main_, bool approved) external onlyOwner {
        require(main_ != address(0), "zero main");
        approvedMains[main_] = approved;
        emit MainApprovalSet(main_, approved);
    }

    function setRewardConsumerApproval(address consumer, bool approved) external onlyOwner {
        require(consumer != address(0), "zero consumer");
        approvedRewardConsumers[consumer] = approved;
        emit RewardConsumerApprovalSet(consumer, approved);
    }

    function setVrfParams(
        bytes32 keyHash_,
        uint256 subId_,
        uint32 gas_,
        uint16 conf_,
        uint32 numWords_
    ) external onlyOwner {
        if (keyHash_ != bytes32(0)) keyHash = keyHash_;
        if (subId_ != 0) subId = subId_;
        if (gas_ != 0) callbackGasLimit = gas_;
        if (conf_ != 0) requestConfirmations = conf_;
        if (numWords_ != 0) numWords = numWords_;
        emit VrfParamsUpdated(keyHash, subId, callbackGasLimit, requestConfirmations, numWords);
    }

    // ===== API for VRF collections =====
    function requestRandomFor(address minter, uint256 ticketId)
        external
        onlyMain
        returns (uint256 requestId)
    {
        requestId = _requestRandomWords();

        reqMinter[requestId] = minter;
        reqTicket[requestId] = ticketId;
        reqMain[requestId] = msg.sender;
        reqIsReward[requestId] = false;

        emit RandomRequested(minter, ticketId, requestId);
    }

    // ===== API for rewards contract mystery events =====
    function requestRandomForReward(address requester, uint256 eventId)
        external
        onlyRewardConsumer
        returns (uint256 requestId)
    {
        require(requester != address(0), "zero requester");

        requestId = _requestRandomWords();

        reqMinter[requestId] = requester;
        reqTicket[requestId] = eventId;
        reqMain[requestId] = requester;
        reqIsReward[requestId] = true;

        emit RandomRequestedForReward(requester, eventId, requestId);
    }

    // ===== Chainlink callback =====
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        if (randomWords.length == 0) {
            emit RandomForwardFailed(requestId, address(0), bytes("NO_WORD"));
            _clearRequest(requestId);
            return;
        }

        uint256 word = randomWords[0];
        address target = reqMain[requestId];
        if (target == address(0)) target = main;
        if (target == address(0)) {
            emit RandomForwardFailed(requestId, address(0), bytes("NO_TARGET"));
            _clearRequest(requestId);
            return;
        }

        emit RandomFulfilled(requestId, word);

        if (reqIsReward[requestId]) {
            try IBiggiNftRewardsCallback(target).fulfillRandom(requestId, word) {
            } catch (bytes memory reason) {
                emit RandomForwardFailed(requestId, target, reason);
            }
            _clearRequest(requestId);
            return;
        }

        try IBiggiEyesMainCallback(target).fulfillRandomFromRouter(requestId, word) {
        } catch (bytes memory reason) {
            emit RandomForwardFailed(requestId, target, reason);
        }
        _clearRequest(requestId);
    }

    function _requestRandomWords() internal returns (uint256 requestId) {
        requestId = coordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: true })
                )
            })
        );
    }

    function _clearRequest(uint256 requestId) internal {
        delete reqMinter[requestId];
        delete reqTicket[requestId];
        delete reqMain[requestId];
        delete reqIsReward[requestId];
    }
}
