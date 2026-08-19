// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiRewards
/// @dev Knihovna pro správu a validaci claimování odměn v projektu BiggiEyes.

library BiggiRewards {
    struct RewardsState {
        mapping(address => bool) orangeRewardClaimed;
        mapping(address => bool) blockRewardClaimed;
        mapping(address => bool) rainbowRewardClaimed;
        // V budoucnu lze rozšířit např. o blockId nebo víceúrovňové mapování.
    }

    /// @dev Claimnutí orange odměny pro adresu.
    function claimOrange(RewardsState storage self, address user) internal {
        require(!self.orangeRewardClaimed[user], "Already claimed orange reward");
        self.orangeRewardClaimed[user] = true;
    }

    /// @dev Claimnutí block odměny pro adresu.
    function claimBlock(RewardsState storage self, address user) internal {
        require(!self.blockRewardClaimed[user], "Already claimed block reward");
        self.blockRewardClaimed[user] = true;
    }

    /// @dev Claimnutí rainbow odměny pro adresu.
    function claimRainbow(RewardsState storage self, address user) internal {
        require(!self.rainbowRewardClaimed[user], "Already claimed rainbow reward");
        self.rainbowRewardClaimed[user] = true;
    }

    /// @dev Zjisti, zda uživatel už claimnul orange odměnu.
    function hasClaimedOrange(RewardsState storage self, address user) internal view returns (bool) {
        return self.orangeRewardClaimed[user];
    }

    /// @dev Zjisti, zda uživatel už claimnul block odměnu.
    function hasClaimedBlock(RewardsState storage self, address user) internal view returns (bool) {
        return self.blockRewardClaimed[user];
    }

    /// @dev Zjisti, zda uživatel už claimnul rainbow odměnu.
    function hasClaimedRainbow(RewardsState storage self, address user) internal view returns (bool) {
        return self.rainbowRewardClaimed[user];
    }
}
