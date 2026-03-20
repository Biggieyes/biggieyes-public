// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockBlockNft {
    mapping(uint256 => address) private _ownerOf;
    mapping(uint256 => uint16) private _blockByToken;

    function mint(address to, uint256 tokenId, uint16 blockIdx) external {
        require(to != address(0), "to=0");
        require(_ownerOf[tokenId] == address(0), "minted");
        _ownerOf[tokenId] = to;
        _blockByToken[tokenId] = blockIdx;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner_ = _ownerOf[tokenId];
        require(owner_ != address(0), "not minted");
        return owner_;
    }

    function blockOf(uint256 tokenId) external view returns (uint16) {
        return _blockByToken[tokenId];
    }
}