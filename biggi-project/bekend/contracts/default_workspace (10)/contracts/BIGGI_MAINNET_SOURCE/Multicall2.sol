// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Multicall2 implementation with aggregate() only.
contract Multicall2 {
    struct Call {
        address target;
        bytes callData;
    }

    function aggregate(Call[] calldata calls)
        external
        view
        returns (uint256 blockNumber, bytes[] memory returnData)
    {
        blockNumber = block.number;
        returnData = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = calls[i].target.staticcall(
                calls[i].callData
            );
            require(ok, "Multicall2: call failed");
            returnData[i] = ret;
        }
    }
}
