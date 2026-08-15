// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// solhint-disable-next-line interface-starts-with-i
interface BlockhashStoreInterface {
  function getBlockhash(uint256 number) external view returns (bytes32);
}
