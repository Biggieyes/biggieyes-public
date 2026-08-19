// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiSeriesRegistryTokenRewardsView {
    function isTokenRewardsCollection(address collection) external view returns (bool);
}

interface IBiggiSeriesRegistryCollectionRewardsView {
    function isCollectionRewardsCollection(address collection) external view returns (bool);
}

/// @title BiggiCollectionEligibilityLib
/// @notice Shared collection-eligibility rules for rewards contracts.
library BiggiCollectionEligibilityLib {
    function isTokenRewardsEligible(
        address collection,
        address mainCollection,
        address publicCollection,
        bool explicitlyAllowed,
        address registry
    ) internal view returns (bool) {
        if (collection == address(0)) return false;
        if (collection == mainCollection) return true;
        if (publicCollection != address(0) && collection == publicCollection) return true;
        if (explicitlyAllowed) return true;
        if (registry == address(0)) return false;
        return IBiggiSeriesRegistryTokenRewardsView(registry).isTokenRewardsCollection(collection);
    }

    function isCollectionRewardsEligible(
        address collection,
        address defaultMain,
        address registry
    ) internal view returns (bool) {
        if (collection == address(0)) return false;
        if (collection == defaultMain) return true;
        if (registry == address(0)) return false;
        return IBiggiSeriesRegistryCollectionRewardsView(registry).isCollectionRewardsCollection(collection);
    }
}
