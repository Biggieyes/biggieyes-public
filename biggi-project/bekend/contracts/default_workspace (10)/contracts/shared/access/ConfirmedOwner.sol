// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfirmedOwnerWithProposal} from "contracts/ConfirmedOwnerWithProposal.sol";

/// @title The ConfirmedOwner contract
/// @notice A contract with helpers for basic contract ownership.
/// @dev Used by Chainlink VRF v2.5 consumer contracts.
contract ConfirmedOwner is ConfirmedOwnerWithProposal {
    constructor(address newOwner) ConfirmedOwnerWithProposal(newOwner, address(0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0)) {}
}
