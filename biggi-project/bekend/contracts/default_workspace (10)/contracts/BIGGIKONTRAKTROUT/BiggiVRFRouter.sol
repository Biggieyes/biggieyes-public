// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ⚠️ Uprav si cesty importů podle tvého projektu
import {VRFConsumerBaseV2Plus} from "contracts/chainlink/VRFConsumerBaseV2Plus.sol";
import {VRFCoordinatorV2PlusInterface} from "contracts/chainlink/VRFCoordinatorV2PlusInterface.sol";
import {VRFV2PlusClient} from "contracts/chainlink/VRFV2PlusClient.sol";

/* Hlavní kontrakt – minimální rozhraní pro callback */
interface IBiggiEyesMainCallback {
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external;
}

/* Router volaný z BiggiEyesMain */
contract BiggiVRFRouter is VRFConsumerBaseV2Plus, Ownable {
    // ====== Chainlink VRF V2 Plus config ======
    VRFCoordinatorV2PlusInterface public coordinator; // typovaná instance koordinátora
    bytes32 public keyHash;
    uint256 public subId;
    uint32  public callbackGasLimit = 300_000;
    uint16  public requestConfirmations = 3;
    uint32  public numWords = 1;

    // ====== App state ======
    address public main; // BiggiEyesMain (mozek)
    mapping(uint256 => address) public reqMinter; // volitelné pro UI/debug
    mapping(uint256 => uint256) public reqTicket; // volitelné pro UI/debug

    // ====== Events ======
    event MainSet(address indexed main);
    event VrfParamsUpdated(bytes32 keyHash, uint256 subId, uint32 gasLimit, uint16 conf, uint32 numWords);
    event RandomRequested(address indexed minter, uint256 ticketId, uint256 requestId);
    event RandomFulfilled(uint256 requestId, uint256 randomWord);

    modifier onlyMain() {
        require(msg.sender == main, "ONLY_MAIN");
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

    // ====== Wiring ======
    function setMain(address main_) external onlyOwner {
        require(main_ != address(0), "zero main");
        main = main_;
        emit MainSet(main_);
    }

    function setVrfParams(
        bytes32 keyHash_,
        uint256 subId_,
        uint32 gas_,
        uint16 conf_,
        uint32 numWords_
    ) external onlyOwner {
        if (keyHash_ != bytes32(0)) keyHash = keyHash_;
        if (subId_ != 0)            subId = subId_;
        if (gas_ != 0)              callbackGasLimit = gas_;
        if (conf_ != 0)             requestConfirmations = conf_;
        if (numWords_ != 0)         numWords = numWords_;
        emit VrfParamsUpdated(keyHash, subId, callbackGasLimit, requestConfirmations, numWords);
    }

    // ====== API pro hlavní kontrakt ======
    function requestRandomFor(address minter, uint256 ticketId)
        external
        onlyMain
        returns (uint256 requestId)
    {
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

        reqMinter[requestId] = minter;
        reqTicket[requestId] = ticketId;

        emit RandomRequested(minter, ticketId, requestId);
    }

    // ====== Chainlink callback ======
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        uint256 word = randomWords[0];
        emit RandomFulfilled(requestId, word);
        IBiggiEyesMainCallback(main).fulfillRandomFromRouter(requestId, word);
    }

    // ⚠️ Žádné duplicity getterů – public proměnné už poskytují:
    // keyHash(), subId(), callbackGasLimit(), requestConfirmations(), numWords()
}
