// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockTicketHubProgress {
    address public mainCollection;
    uint16 public saleMinted;
    uint16 public marketingMinted;
    uint16 public saleCap;
    uint16 public marketingCap;
    uint16 public totalCap;

    function setCaps(uint16 saleCap_, uint16 marketingCap_, uint16 totalCap_) external {
        saleCap = saleCap_;
        marketingCap = marketingCap_;
        totalCap = totalCap_;
    }

    function setProgress(uint16 saleMinted_, uint16 marketingMinted_, uint16 totalMinted_) external {
        saleMinted = saleMinted_;
        marketingMinted = marketingMinted_;
        _totalMinted = totalMinted_;
    }

    uint16 internal _totalMinted;

    function setMainCollection(address mainCollection_) external {
        mainCollection = mainCollection_;
    }

    function totalMintedValue() external view returns (uint16) {
        return _totalMinted;
    }

    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }
}
