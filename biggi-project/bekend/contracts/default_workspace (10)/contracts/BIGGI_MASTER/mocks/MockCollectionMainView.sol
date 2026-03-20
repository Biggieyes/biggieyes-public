// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockCollectionMainView {
    mapping(uint256 => bool) private _exists;
    mapping(address => mapping(uint16 => bool)) private _allTenByBlock;
    mapping(address => mapping(uint16 => mapping(uint256 => bool))) private _allBgByMainInBlock;

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
