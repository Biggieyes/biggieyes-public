// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVRFMigratableConsumerV2Plus {
    function onMigration(
        address newCoordinator,
        uint256 oldSubId
    ) external;
}
