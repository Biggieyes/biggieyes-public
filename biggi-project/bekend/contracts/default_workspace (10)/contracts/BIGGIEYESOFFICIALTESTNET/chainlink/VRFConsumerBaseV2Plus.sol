// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VRFCoordinatorV2PlusInterface.sol";

/**
 * @title VRFConsumerBaseV2Plus
 * @notice Base contract to integrate with Chainlink VRF v2.5 (Plus)
 * @dev Compatible se systémem Amoy testnet
 */
abstract contract VRFConsumerBaseV2Plus {
    error OnlyCoordinatorCanFulfill(address have, address want);

    VRFCoordinatorV2PlusInterface internal COORDINATOR;

    event CoordinatorSet(address indexed coordinator); // Musí být mimo constructor

    constructor(address _vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2PlusInterface(_vrfCoordinator);
        emit CoordinatorSet(_vrfCoordinator);
    }

    /**
     * @notice Fulfill function musí být implementována v kontraktu dědice
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal virtual;

    /**
     * @dev Callback od Chainlink VRF
     */
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external {
        if (msg.sender != address(COORDINATOR)) {
            revert OnlyCoordinatorCanFulfill(msg.sender, address(COORDINATOR));
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
