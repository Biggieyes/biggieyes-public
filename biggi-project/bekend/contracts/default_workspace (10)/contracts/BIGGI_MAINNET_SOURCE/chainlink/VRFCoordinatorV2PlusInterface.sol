// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { VRFV2PlusClient } from "./VRFV2PlusClient.sol";

interface VRFCoordinatorV2PlusInterface {
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId);

    function getConfig()
        external
        view
        returns (
            uint16 minimumRequestConfirmations,
            uint32 maxGasLimit,
            uint32 stalenessSeconds,
            uint256 gasAfterPaymentCalculation,
            int256 fallbackWeiPerUnitLink,
            int256 fallbackWeiPerUnitNative,
            uint96 feeConfig
        );
}
