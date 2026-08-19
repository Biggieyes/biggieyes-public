// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface VRFCoordinatorV2PlusInterface {
    function requestRandomWords(
        bytes32 keyHash,
        uint256 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address extraArgs
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
