// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Rozšířený reader pro MultiCollectionDistributor.
 * Přidává snapshot a aliasy pendingů, které UI postrádalo.
 */

interface IMultiCollectionDistributorMinimal {
    function collectionRewards() external view returns (address);
    function reserve() external view returns (address);
    function buybackAgent() external view returns (address);
    function treasury() external view returns (address);
    function communityCenter() external view returns (address);

    function totalPending() external view returns (uint256);
    function pending(address who) external view returns (uint256);
    function totalReceived() external view returns (uint256);
    function receivedByCollection(address coll) external view returns (uint256);
    function collections(address coll) external view returns (bool);
}

contract BiggiMultiCollectionDistributorReaderV2 {
    IMultiCollectionDistributorMinimal public immutable distributor;

    struct Snapshot {
        address collectionRewards;
        address reserve;
        address buybackAgent;
        address treasury;
        address communityCenter;
        uint256 totalPending;
        uint256 totalReceived;
    }

    constructor(address distributor_) {
        require(distributor_ != address(0), "zero distributor");
        distributor = IMultiCollectionDistributorMinimal(distributor_);
    }

    function globalSnapshot() external view returns (Snapshot memory s) {
        s.collectionRewards = distributor.collectionRewards();
        s.reserve = distributor.reserve();
        s.buybackAgent = distributor.buybackAgent();
        s.treasury = distributor.treasury();
        s.communityCenter = distributor.communityCenter();
        s.totalPending = distributor.totalPending();
        s.totalReceived = distributor.totalReceived();
    }

    function pendingCommunity() external view returns (uint256) {
        return distributor.pending(distributor.communityCenter());
    }

    function pendingOf(address[] calldata who) external view returns (uint256[] memory out) {
        uint256 n = who.length;
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = distributor.pending(who[i]);
        }
    }

    function receivedOfCollections(address[] calldata colls) external view returns (uint256[] memory out) {
        uint256 n = colls.length;
        out = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = distributor.receivedByCollection(colls[i]);
        }
    }

    function whitelisted(address[] calldata colls) external view returns (bool[] memory out) {
        uint256 n = colls.length;
        out = new bool[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = distributor.collections(colls[i]);
        }
    }
}
