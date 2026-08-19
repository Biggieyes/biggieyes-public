// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockCollectionMainView {
    address public ticketHub;
    mapping(uint256 => bool) private _exists;
    mapping(uint16 => uint256) private _currentBlockPrice;
    mapping(address => mapping(uint16 => bool)) private _allTenByBlock;
    mapping(address => mapping(uint16 => mapping(uint256 => bool))) private _allBgByMainInBlock;

    function setTicketHub(address ticketHub_) external {
        ticketHub = ticketHub_;
    }

    function setCurrentBlockPrice(uint16 blockIdx, uint256 price) external {
        _currentBlockPrice[blockIdx] = price;
    }

    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256) {
        return _currentBlockPrice[blockIdx];
    }

    function setExists(uint256 tokenId, bool value) external {
        _exists[tokenId] = value;
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists[tokenId];
    }

    function setHasAllTenMainIdsInBlock(address user, uint16 blk, bool value) external {
        _allTenByBlock[user][blk] = value;
    }

    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool) {
        return _allTenByBlock[owner][blk];
    }

    function setHasAllBackgroundsForMainIdInBlock(
        address user,
        uint16 blk,
        uint256 mainId,
        bool value
    ) external {
        _allBgByMainInBlock[user][blk][mainId] = value;
    }

    function hasAllBackgroundsForMainIdInBlock(
        address owner,
        uint16 blk,
        uint256 mainId
    ) external view returns (bool) {
        return _allBgByMainInBlock[owner][blk][mainId];
    }
}
