// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BiggiCREAutomationReceiver
 * @notice CRE bridge for existing BIGGI keeper/upkeep contracts.
 *
 * CRE writes state through KeystoneForwarder -> onReport(metadata, report).
 * This receiver decodes `report` as `(address target, bytes callData)` and
 * forwards only owner-allowlisted target/function-selector calls.
 *
 * Intended target calls:
 * - BiggiSupplyController.performUpkeep(bytes)
 * - BiggiBuybackUpkeepProxy.performUpkeep(bytes)
 * - BiggiLiquidityKeeperProxy.performUpkeep(bytes)
 * - BiggiDexReserveGuard.performUpkeep(bytes)
 * - BiggiTokenRewardsEmissionController.rollCurrentWeek()
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface ICREReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract BiggiCREAutomationReceiver is ICREReceiver, Ownable, ReentrancyGuard, Pausable {
    error ZeroAddress();
    error ZeroSelector();
    error OnlyKeystoneForwarder(address caller);
    error ReportTooLarge(uint256 size, uint256 maxSize);
    error CallDataTooLarge(uint256 size, uint256 maxSize);
    error EmptyCallData();
    error CallNotAllowed(address target, bytes4 selector);
    error MetadataNotAllowed(bytes32 metadataHash);
    error MetadataTooShort(uint256 size);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidWorkflowOwner(address received, address expected);
    error TargetCallFailed(address target, bytes4 selector, bytes returnData);

    bytes4 public constant PERFORM_UPKEEP_SELECTOR = bytes4(keccak256("performUpkeep(bytes)"));

    address public keystoneForwarder;
    uint256 public maxReportBytes = 4096;
    uint256 public maxCallDataBytes = 2048;
    bytes32 public expectedWorkflowId;
    address public expectedWorkflowOwner;

    mapping(address => mapping(bytes4 => bool)) public callAllowed;
    mapping(bytes32 => bool) public metadataHashAllowed;
    uint256 public metadataHashAllowlistCount;

    event KeystoneForwarderSet(address indexed oldForwarder, address indexed newForwarder);
    event CallAllowedSet(address indexed target, bytes4 indexed selector, bool allowed);
    event MetadataHashAllowedSet(bytes32 indexed metadataHash, bool allowed);
    event ExpectedWorkflowIdentitySet(bytes32 indexed workflowId, address indexed workflowOwner);
    event MaxBytesSet(uint256 maxReportBytes, uint256 maxCallDataBytes);
    event ReportForwarded(
        bytes32 indexed metadataHash,
        address indexed target,
        bytes4 indexed selector,
        bytes32 reportHash,
        bytes32 callDataHash
    );

    constructor(address initialOwner, address forwarder_) Ownable(initialOwner) {
        if (initialOwner == address(0) || forwarder_ == address(0)) revert ZeroAddress();
        keystoneForwarder = forwarder_;
        _pause();
        emit KeystoneForwarderSet(address(0), forwarder_);
    }

    function setKeystoneForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert ZeroAddress();
        emit KeystoneForwarderSet(keystoneForwarder, forwarder_);
        keystoneForwarder = forwarder_;
    }

    function setCallAllowed(address target, bytes4 selector, bool allowed) public onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (selector == bytes4(0)) revert ZeroSelector();
        callAllowed[target][selector] = allowed;
        emit CallAllowedSet(target, selector, allowed);
    }

    function setCallsAllowed(
        address[] calldata targets,
        bytes4[] calldata selectors,
        bool allowed
    ) external onlyOwner {
        require(targets.length == selectors.length, "LENGTH_MISMATCH");
        for (uint256 i = 0; i < targets.length; i++) {
            setCallAllowed(targets[i], selectors[i], allowed);
        }
    }

    function setMetadataHashAllowed(bytes32 metadataHash, bool allowed) external onlyOwner {
        if (metadataHash == bytes32(0)) revert MetadataNotAllowed(metadataHash);

        bool current = metadataHashAllowed[metadataHash];
        if (current == allowed) {
            emit MetadataHashAllowedSet(metadataHash, allowed);
            return;
        }

        metadataHashAllowed[metadataHash] = allowed;
        if (allowed) {
            metadataHashAllowlistCount += 1;
        } else {
            metadataHashAllowlistCount -= 1;
        }
        emit MetadataHashAllowedSet(metadataHash, allowed);
    }

    function setExpectedWorkflowIdentity(bytes32 workflowId, address workflowOwner) external onlyOwner {
        expectedWorkflowId = workflowId;
        expectedWorkflowOwner = workflowOwner;
        emit ExpectedWorkflowIdentitySet(workflowId, workflowOwner);
    }

    function setMaxBytes(uint256 maxReportBytes_, uint256 maxCallDataBytes_) external onlyOwner {
        require(maxReportBytes_ >= 96 && maxCallDataBytes_ >= 4, "BAD_LIMITS");
        maxReportBytes = maxReportBytes_;
        maxCallDataBytes = maxCallDataBytes_;
        emit MaxBytesSet(maxReportBytes_, maxCallDataBytes_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function onReport(bytes calldata metadata, bytes calldata report)
        external
        override
        nonReentrant
        whenNotPaused
    {
        if (msg.sender != keystoneForwarder) revert OnlyKeystoneForwarder(msg.sender);
        if (report.length > maxReportBytes) revert ReportTooLarge(report.length, maxReportBytes);

        bytes32 metadataHash = keccak256(metadata);
        if (metadataHashAllowlistCount != 0 && !metadataHashAllowed[metadataHash]) {
            revert MetadataNotAllowed(metadataHash);
        }
        _validateWorkflowIdentity(metadata);

        (address target, bytes memory callData) = abi.decode(report, (address, bytes));
        if (target == address(0)) revert ZeroAddress();
        if (callData.length < 4) revert EmptyCallData();
        if (callData.length > maxCallDataBytes) revert CallDataTooLarge(callData.length, maxCallDataBytes);

        bytes4 selector = _selector(callData);
        if (!callAllowed[target][selector]) revert CallNotAllowed(target, selector);

        (bool ok, bytes memory returnData) = target.call(callData);
        if (!ok) revert TargetCallFailed(target, selector, returnData);

        emit ReportForwarded(metadataHash, target, selector, keccak256(report), keccak256(callData));
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(ICREReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function isCallAllowed(address target, bytes4 selector) external view returns (bool) {
        return callAllowed[target][selector];
    }

    function _selector(bytes memory data) internal pure returns (bytes4 selector) {
        assembly {
            selector := mload(add(data, 32))
        }
    }

    function _validateWorkflowIdentity(bytes calldata metadata) internal view {
        if (expectedWorkflowId == bytes32(0) && expectedWorkflowOwner == address(0)) return;
        if (metadata.length < 62) revert MetadataTooShort(metadata.length);

        bytes32 workflowId;
        address workflowOwner;
        assembly {
            workflowId := calldataload(metadata.offset)
            workflowOwner := shr(96, calldataload(add(metadata.offset, 42)))
        }

        if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) {
            revert InvalidWorkflowId(workflowId, expectedWorkflowId);
        }
        if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
            revert InvalidWorkflowOwner(workflowOwner, expectedWorkflowOwner);
        }
    }
}
