// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockNftRewardsV2 {
    struct RewardInfo {
        address assigned;
        bool isClaimed;
        string uri;
    }

    struct EventInfo {
        uint8 kind;
        address creator;
        uint256 rewardStartId;
        uint256 rewardCount;
        bool randomnessRequested;
        bool finished;
        uint256 vrfRequestId;
    }

    string public name = "Mock NFT Rewards";
    string public symbol = "MNFR";

    address public owner;
    address public mainContract;
    address public vrfRouter;
    address public registry;

    uint256 public nextRewardId = 1;
    uint256 public nextEventId = 1;

    mapping(uint256 => RewardInfo) private _rewards;
    mapping(uint256 => EventInfo) private _events;
    mapping(uint256 => address[]) private _eligible;
    mapping(address => bool) public allowedMainCollections;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "owner=0");
        owner = initialOwner;
    }

    function setCore(address main_, address vrf_, address registry_) external onlyOwner {
        mainContract = main_;
        vrfRouter = vrf_;
        registry = registry_;
    }

    function setAllowedMainCollection(address collection, bool allowed) external onlyOwner {
        allowedMainCollections[collection] = allowed;
    }

    function setEvent(
        uint256 eventId,
        uint8 kind,
        address creator,
        uint256 rewardStartId,
        uint256 rewardCount,
        bool randomnessRequested,
        bool finished,
        uint256 vrfRequestId
    ) external onlyOwner {
        _events[eventId] = EventInfo(
            kind,
            creator,
            rewardStartId,
            rewardCount,
            randomnessRequested,
            finished,
            vrfRequestId
        );
        if (eventId >= nextEventId) nextEventId = eventId + 1;
    }

    function addEligible(uint256 eventId, address user) external onlyOwner {
        _eligible[eventId].push(user);
    }

    function setReward(
        uint256 rewardId,
        address assigned,
        bool isClaimed,
        string calldata uri
    ) external onlyOwner {
        _rewards[rewardId] = RewardInfo(assigned, isClaimed, uri);
        if (rewardId >= nextRewardId) nextRewardId = rewardId + 1;
    }

    function rewardInfo(uint256 rewardId) external view returns (address assigned, bool isClaimed, string memory uri) {
        RewardInfo storage r = _rewards[rewardId];
        return (r.assigned, r.isClaimed, r.uri);
    }

    function eventEligibleCount(uint256 eventId) external view returns (uint256) {
        return _eligible[eventId].length;
    }

    function getEligibleAt(uint256 eventId, uint256 idx) external view returns (address) {
        return _eligible[eventId][idx];
    }

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
        )
    {
        EventInfo storage e = _events[eventId];
        return (
            e.kind,
            e.creator,
            e.rewardStartId,
            e.rewardCount,
            e.randomnessRequested,
            e.finished,
            e.vrfRequestId
        );
    }
}
