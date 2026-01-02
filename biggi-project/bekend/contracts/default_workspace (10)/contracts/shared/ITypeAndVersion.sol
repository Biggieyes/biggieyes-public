// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITypeAndVersion {
  function typeAndVersion() external pure returns (string memory);
}
