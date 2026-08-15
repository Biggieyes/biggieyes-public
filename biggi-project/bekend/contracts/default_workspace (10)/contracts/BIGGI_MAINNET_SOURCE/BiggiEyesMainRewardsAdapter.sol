// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiEyesMainRewardsSource {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function nftInfo(uint256 index)
        external
        view
        returns (
            bool minted,
            uint16 background,
            uint16 blockIdx,
            uint256 mainId,
            uint256 ticketPrice,
            uint256 blockPrice,
            uint256 finalPrice
        );
}

/// @dev Compatibility adapter for CollectionRewards -> Main view checks.
contract BiggiEyesMainRewardsAdapter {
    error ZeroAddress();

    uint256 public constant BIGGI_OFFSET = 1001;
    uint256 public constant MAX_SUPPLY = 550;

    IBiggiEyesMainRewardsSource public immutable main;

    constructor(address main_) {
        if (main_ == address(0)) revert ZeroAddress();
        main = IBiggiEyesMainRewardsSource(main_);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    function hasAllTenMainIdsInBlock(address owner, uint16 blk)
        external
        view
        returns (bool)
    {
        if (owner == address(0) || blk < 1 || blk > 10) return false;

        bool[11] memory seen;
        uint8 found = 0;

        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            (bool ok, uint16 blockIdx, uint256 mainId, ) = _readInfo(idx);
            if (!ok || blockIdx != blk || mainId < 1 || mainId > 10 || seen[mainId]) {
                continue;
            }
            if (_ownerMatches(owner, idx)) {
                seen[mainId] = true;
                unchecked {
                    found++;
                }
                if (found == 10) return true;
            }
        }
        return false;
    }

    function hasAllBackgroundsForMainIdInBlock(
        address owner,
        uint16 blk,
        uint256 mainId
    ) external view returns (bool) {
        if (
            owner == address(0) || blk < 1 || blk > 10 || mainId < 1 || mainId > 10
        ) {
            return false;
        }

        bool[11] memory seen;
        uint8 found = 0;

        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            (bool ok, uint16 blockIdx, uint256 itemMainId, uint16 background) =
                _readInfo(idx);
            if (
                !ok ||
                blockIdx != blk ||
                itemMainId != mainId ||
                background < 1 ||
                background > 10 ||
                seen[background]
            ) {
                continue;
            }
            if (_ownerMatches(owner, idx)) {
                seen[background] = true;
                unchecked {
                    found++;
                }
                if (found == 10) return true;
            }
        }
        return false;
    }

    function _ownerMatches(address expectedOwner, uint256 idx)
        internal
        view
        returns (bool)
    {
        uint256 tokenId = BIGGI_OFFSET + idx - 1;
        if (!_exists(tokenId)) return false;
        try main.ownerOf(tokenId) returns (address tokenOwner) {
            return tokenOwner == expectedOwner;
        } catch {
            return false;
        }
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        try main.exists(tokenId) returns (bool present) {
            return present;
        } catch {
            return false;
        }
    }

    function _readInfo(uint256 idx)
        internal
        view
        returns (bool ok, uint16 blockIdx, uint256 mainId, uint16 background)
    {
        try main.nftInfo(idx) returns (
            bool minted,
            uint16 infoBackground,
            uint16 infoBlockIdx,
            uint256 infoMainId,
            uint256,
            uint256,
            uint256
        ) {
            if (!minted) return (false, 0, 0, 0);
            return (true, infoBlockIdx, infoMainId, infoBackground);
        } catch {
            return (false, 0, 0, 0);
        }
    }
}
