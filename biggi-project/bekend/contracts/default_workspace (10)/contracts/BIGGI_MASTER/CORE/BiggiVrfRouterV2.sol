// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VRFConsumerBaseV2Plus} from "../chainlink/VRFConsumerBaseV2Plus.sol";
import {VRFCoordinatorV2PlusInterface} from "../chainlink/VRFCoordinatorV2PlusInterface.sol";
import {VRFV2PlusClient} from "../chainlink/VRFV2PlusClient.sol";

interface IBiggiRecoverableMain {
    function vrfRecoveryVersion() external pure returns (uint256);
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external;
    function completePendingMint(uint256 requestId) external returns (uint256 tokenId);
}

/// @notice CORE-only router. Legacy mystery reward consumers stay on their existing router.
contract BiggiVRFRouterV2 is VRFConsumerBaseV2Plus, Ownable, ReentrancyGuard {
    struct Request {
        address consumer;
        bool ready;
        bool delivered;
        bool completed;
        address minter;
        uint256 ticketId;
        uint256 word;
    }

    VRFCoordinatorV2PlusInterface public immutable coordinator;
    bytes32 public keyHash;
    uint256 public subId;
    uint32 public callbackGasLimit = 750_000;
    uint16 public requestConfirmations = 3;
    uint32 public constant numWords = 1;
    uint256 private constant RESERVE_GAS = 60_000;
    uint256 private constant ASSIGN_GAS = 150_000;
    uint256 private constant MINT_GAS = 450_000;

    address public main;
    mapping(address => bool) public approvedMains;
    mapping(uint256 => Request) private requests;

    event MainSet(address indexed main);
    event MainApprovalSet(address indexed main, bool approved);
    event VrfParamsUpdated(bytes32 keyHash, uint256 subId, uint32 gasLimit, uint16 conf, uint32 numWords);
    event RandomRequested(address indexed minter, uint256 ticketId, uint256 requestId);
    event RandomFulfilled(uint256 requestId, uint256 randomWord);
    event RandomForwardFailed(uint256 indexed requestId, address indexed target, bytes reason);
    event RandomDelivered(uint256 indexed requestId, address indexed target);
    event MintCompletionDeferred(uint256 indexed requestId, address indexed target);
    event MintCompletionConfirmed(uint256 indexed requestId, address indexed target);

    constructor(address coordinator_, address initialOwner, bytes32 keyHash_, uint256 subId_)
        VRFConsumerBaseV2Plus(coordinator_) Ownable(initialOwner)
    {
        require(coordinator_.code.length != 0, "INVALID_COORDINATOR");
        require(keyHash_ != bytes32(0) && subId_ != 0, "INVALID_VRF_CONFIG");
        coordinator = VRFCoordinatorV2PlusInterface(coordinator_);
        keyHash = keyHash_;
        subId = subId_;
    }

    function vrfRecoveryVersion() external pure returns (uint256) { return 2; }

    function setMain(address main_) external onlyOwner {
        _approveMain(main_, true);
        main = main_;
        emit MainSet(main_);
    }

    function setMainApproval(address main_, bool approved) external onlyOwner {
        _approveMain(main_, approved);
    }

    function _approveMain(address main_, bool approved) private {
        require(main_ != address(0), "ZERO_MAIN");
        if (approved) require(IBiggiRecoverableMain(main_).vrfRecoveryVersion() == 2, "V2_REQUIRED");
        approvedMains[main_] = approved;
        emit MainApprovalSet(main_, approved);
    }

    function setVrfParams(bytes32 keyHash_, uint256 subId_, uint32 gas_, uint16 conf_, uint32 words_)
        external onlyOwner
    {
        require(words_ == 0 || words_ == 1, "ONE_WORD_REQUIRED");
        require(gas_ == 0 || (gas_ >= 300_000 && gas_ <= 2_500_000), "INVALID_CALLBACK_GAS");
        require(conf_ == 0 || (conf_ >= 3 && conf_ <= 200), "INVALID_CONFIRMATIONS");
        if (keyHash_ != bytes32(0)) keyHash = keyHash_;
        if (subId_ != 0) subId = subId_;
        if (gas_ != 0) callbackGasLimit = gas_;
        if (conf_ != 0) requestConfirmations = conf_;
        emit VrfParamsUpdated(keyHash, subId, callbackGasLimit, requestConfirmations, numWords);
    }

    function requestRandomFor(address minter, uint256 ticketId) external nonReentrant returns (uint256 requestId) {
        require(approvedMains[msg.sender], "ONLY_MAIN");
        require(minter != address(0), "ZERO_MINTER");
        requestId = coordinator.requestRandomWords(VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))
        }));
        require(requestId != 0 && requests[requestId].consumer == address(0), "INVALID_REQUEST_ID");
        requests[requestId] = Request(msg.sender, false, false, false, minter, ticketId, 0);
        emit RandomRequested(minter, ticketId, requestId);
    }

    function getRequestResult(uint256 requestId) external view returns (address consumer, bool ready, uint256 word) {
        Request storage req = requests[requestId];
        return (req.consumer, req.ready, req.word);
    }

    function reqMain(uint256 id) external view returns (address) { return requests[id].consumer; }
    function reqMinter(uint256 id) external view returns (address) { return requests[id].minter; }
    function reqTicket(uint256 id) external view returns (uint256) { return requests[id].ticketId; }

    // Randomness is immutable, including a valid zero word. Unknown/duplicate deliveries do nothing.
    function fulfillRandomWords(uint256 requestId, uint256[] memory words) internal override nonReentrant {
        Request storage req = requests[requestId];
        if (req.consumer == address(0) || req.ready) return;
        if (words.length != 1) {
            emit RandomForwardFailed(requestId, req.consumer, bytes("INVALID_WORD_COUNT"));
            return;
        }
        req.word = words[0];
        req.ready = true;
        emit RandomFulfilled(requestId, words[0]);
        _deliver(requestId, req);
    }

    /// @notice Anyone can finish the original draw; this never asks Chainlink for another word.
    function deliverRandomness(uint256 requestId) external nonReentrant {
        Request storage req = requests[requestId];
        require(req.ready, "RANDOMNESS_NOT_READY");
        _deliver(requestId, req);
    }

    function _deliver(uint256 id, Request storage req) private {
        if (req.completed) return;
        if (!req.delivered) {
            bool assigned = _boundedCall(req.consumer,
                abi.encodeCall(IBiggiRecoverableMain.fulfillRandomFromRouter, (id, req.word)), ASSIGN_GAS);
            if (!assigned) {
                emit RandomForwardFailed(id, req.consumer, bytes("ASSIGNMENT_DEFERRED"));
                return;
            }
            req.delivered = true;
            emit RandomDelivered(id, req.consumer);
        }
        // Separate call frames keep the saved word and reserved NFT even if safeMint reverts or exhausts gas.
        if (_boundedCall(req.consumer, abi.encodeCall(IBiggiRecoverableMain.completePendingMint, (id)), MINT_GAS)) {
            req.completed = true;
            emit MintCompletionConfirmed(id, req.consumer);
        } else {
            emit MintCompletionDeferred(id, req.consumer);
        }
    }

    function _boundedCall(address target, bytes memory data, uint256 cap) private returns (bool ok) {
        uint256 available = gasleft();
        if (available <= RESERVE_GAS + 10_000) return false;
        uint256 forwarded = available - RESERVE_GAS;
        if (forwarded > cap) forwarded = cap;
        // Do not copy receiver-controlled revert data into the router's memory.
        assembly ("memory-safe") {
            ok := call(forwarded, target, 0, add(data, 32), mload(data), 0, 0)
        }
    }
}
