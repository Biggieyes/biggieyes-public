// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {BiggiEyesMainV2} from "../CORE/BiggiMainV2.sol";

contract MockVrfRecoveryMain is BiggiEyesMainV2 {
    constructor(address owner) BiggiEyesMainV2(owner) {}
    function selectForTest(uint256 start) external view returns (uint256) { return _selectMintableIndex(start); }
}

interface IRecoveryEntry {
    function redeemFromTicketHub(address user, uint256 ticketId, uint256 price) external;
}

contract MockVrfRecoveryHub {
    address public mainCollection;
    constructor(address main_) { mainCollection = main_; }
    function chapterMainCollection(uint256) external view returns (address) { return mainCollection; }
    function redeem(address user, uint256 id, uint256 price) external {
        IRecoveryEntry(mainCollection).redeemFromTicketHub(user, id, price);
    }
}

contract MockVrfRecoveryReceiver is IERC721Receiver {
    uint256 public mode;
    address public reentryTarget;
    bytes public reentryData;
    bool public reentrySucceeded;

    function configure(uint256 mode_, address target, bytes calldata data) external {
        mode = mode_;
        reentryTarget = target;
        reentryData = data;
    }

    function execute(address target, bytes calldata data) external {
        (bool ok, bytes memory result) = target.call(data);
        if (!ok) assembly ("memory-safe") { revert(add(result, 32), mload(result)) }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (mode == 1) revert("RECEIVER_REJECTED");
        if (mode == 2) {
            assembly ("memory-safe") { for {} 1 {} {} }
        }
        if (mode == 3) {
            assembly ("memory-safe") { revert(0, 1000000) }
        }
        if (mode == 4) (reentrySucceeded,) = reentryTarget.call(reentryData);
        return IERC721Receiver.onERC721Received.selector;
    }
}

interface IRecoveryRouterRequest {
    function requestRandomFor(address user, uint256 ticketId) external returns (uint256);
}

contract MockVrfRecoveryConsumer {
    uint256 public mode;
    uint256 public deliveries;
    function vrfRecoveryVersion() external pure returns (uint256) { return 2; }
    function setMode(uint256 value) external { mode = value; }
    function request(address router, address user, uint256 id) external returns (uint256) {
        return IRecoveryRouterRequest(router).requestRandomFor(user, id);
    }
    function fulfillRandomFromRouter(uint256, uint256) external {
        if (mode == 1) assembly ("memory-safe") { for {} 1 {} {} }
        if (mode == 2) assembly ("memory-safe") { revert(0, 1000000) }
        ++deliveries;
    }
    function completePendingMint(uint256) external pure returns (uint256) { return 1001; }
}
