// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

interface IBiggiNftRewards is IERC721Metadata {
    function nextRewardId() external view returns (uint256);
    function nextEventId() external view returns (uint256);
    function mainContract() external view returns (address);
    function vrfRouter() external view returns (address);
    function owner() external view returns (address);

    function rewardInfo(uint256 rewardId) external view returns (address assigned, bool isClaimed, string memory uri);
    function eventEligibleCount(uint256 eventId) external view returns (uint256);
    function getEligibleAt(uint256 eventId, uint256 idx) external view returns (address);

    function events(uint256 eventId)
        external
        view
        returns (
            uint8 kind,
            address creator,
            uint256 rewardStartId,
            uint256 rewardCount,
            bool randomnessRequested,
            bool finished,
            uint256 vrfRequestId
        );
}

contract BiggiNftRewardsReader {
    struct RewardEvent {
        uint8 kind;
        address creator;
        uint256 rewardStartId;
        uint256 rewardCount;
        bool randomnessRequested;
        bool finished;
        uint256 vrfRequestId;
    }

    struct RewardsStatus {
        address nftRewards;
        address main;
        address vrfRouter;
        address owner;
        uint256 nextEventId;
        uint256 nextRewardId;
        uint256 totalRewardsCreated;
        string name;
        string symbol;
    }

    IBiggiNftRewards public immutable nftRewards;

    constructor(address nftRewards_) {
        require(nftRewards_ != address(0), "zero");
        nftRewards = IBiggiNftRewards(nftRewards_);
    }

    function getStatus() external view returns (RewardsStatus memory s) {
        s.nftRewards = address(nftRewards);
        s.main = nftRewards.mainContract();
        s.vrfRouter = nftRewards.vrfRouter();
        s.owner = nftRewards.owner();
        s.nextEventId = nftRewards.nextEventId();
        s.nextRewardId = nftRewards.nextRewardId();
        s.totalRewardsCreated = s.nextRewardId > 0 ? s.nextRewardId - 1 : 0;
        s.name = nftRewards.name();
        s.symbol = nftRewards.symbol();
    }

    function getEvent(uint256 eventId) external view returns (RewardEvent memory ev) {
        (
            ev.kind,
            ev.creator,
            ev.rewardStartId,
            ev.rewardCount,
            ev.randomnessRequested,
            ev.finished,
            ev.vrfRequestId
        ) = nftRewards.events(eventId);
    }

    function rewardInfo(uint256 rewardId) external view returns (address assigned, bool isClaimed, string memory uri) {
        return nftRewards.rewardInfo(rewardId);
    }

    function eventEligibleCount(uint256 eventId) external view returns (uint256) {
        return nftRewards.eventEligibleCount(eventId);
    }

    function getEligibleAt(uint256 eventId, uint256 idx) external view returns (address) {
        return nftRewards.getEligibleAt(eventId, idx);
    }
}
