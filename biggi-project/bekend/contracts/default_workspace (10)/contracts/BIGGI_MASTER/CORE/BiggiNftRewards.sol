// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBiggiSeriesRegistryRewards {
    function isCollectionRewardsCollection(address collection) external view returns (bool);
}

interface IRewardVRFRouter {
    function requestRandomForReward(address requester, uint256 eventId) external returns (uint256 requestId);
}

contract BiggiNFTRewards is ERC721, Ownable, ReentrancyGuard {
    error ZeroAddress();
    error WinnerZero();
    error NoTokens();
    error NoEligible();
    error NotEnoughEligible();
    error NotMystery();
    error AlreadyRequested();
    error AlreadyFinished();
    error VrfRouterNotSet();
    error BadRequest();
    error EmptyPool();
    error RetryTooEarly();
    error NoPendingRequest();
    error NotAssigned();
    error AlreadyClaimedError();
    error OnlyApprovedMain();
    error OnlyVrfRouter();
    error DelayZero();

    enum EventKind {
        Undefined,
        Character,
        Manual,
        Mystery
    }

    struct RewardEvent {
        EventKind kind;
        address creator;
        uint256 rewardStartId;
        uint256 rewardCount;
        bool randomnessRequested;
        bool finished;
        uint256 vrfRequestId;
    }

    uint256 public nextRewardId = 1;
    uint256 public nextEventId = 1;

    mapping(uint256 => RewardEvent) public events;
    mapping(uint256 => string) public rewardTokenUri;
    mapping(uint256 => address) public assignedTo;
    mapping(uint256 => bool) public claimed;

    mapping(uint256 => address[]) private eventEligible;

    mapping(uint256 => uint256) public vrfRequestToEvent;
    mapping(uint256 => uint64) public vrfRequestedAt;

    address public mainContract;
    address public vrfRouter;
    address public registry;
    mapping(address => bool) public allowedMainCollections;
    uint64 public mysteryRetryDelay = 15 minutes;

    event RewardEventCreated(uint256 indexed eventId, EventKind kind, uint256 startRewardId, uint256 count, address indexed creator);
    event RewardAssigned(uint256 indexed rewardId, address indexed to);
    event RewardClaimed(uint256 indexed rewardId, address indexed claimer, uint256 tokenId);
    event MysteryRandomRequested(uint256 indexed eventId, uint256 indexed requestId);
    event MysteryRandomRetried(uint256 indexed eventId, uint256 indexed oldRequestId, uint256 indexed newRequestId);
    event MysteryRandomFulfilled(uint256 indexed eventId, uint256 indexed requestId, uint256 random);
    event MysteryRetryDelaySet(uint64 oldDelay, uint64 newDelay);
    event MysteryEmergencyResolved(uint256 indexed eventId, uint256 indexed requestId, uint256 random);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event MainCollectionApprovalSet(address indexed collection, bool approved);

    modifier onlyApprovedMainCollection() {
        if (!_isApprovedMainCollection(msg.sender)) revert OnlyApprovedMain();
        _;
    }

    modifier onlyVrfRouter() {
        if (msg.sender != vrfRouter) revert OnlyVrfRouter();
        _;
    }

    constructor(address owner_) ERC721("Biggi Reward", "BGR") Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
    }

    function setMainContract(address main_) external onlyOwner {
        mainContract = main_;
        if (main_ != address(0)) {
            allowedMainCollections[main_] = true;
            emit MainCollectionApprovalSet(main_, true);
        }
    }

    function setVrfRouter(address router_) external onlyOwner {
        vrfRouter = router_;
    }

    function setMysteryRetryDelay(uint64 delaySec) external onlyOwner {
        if (delaySec == 0) revert DelayZero();
        uint64 oldDelay = mysteryRetryDelay;
        mysteryRetryDelay = delaySec;
        emit MysteryRetryDelaySet(oldDelay, delaySec);
    }

    function setRegistry(address registry_) external onlyOwner {
        emit RegistrySet(registry, registry_);
        registry = registry_;
    }

    function setAllowedMainCollection(address collection, bool approved) external onlyOwner {
        if (collection == address(0)) revert ZeroAddress();
        allowedMainCollections[collection] = approved;
        emit MainCollectionApprovalSet(collection, approved);
    }

    function _isApprovedMainCollection(address collection) internal view returns (bool) {
        if (collection == mainContract && collection != address(0)) return true;
        if (allowedMainCollections[collection]) return true;
        if (registry != address(0)) {
            return IBiggiSeriesRegistryRewards(registry).isCollectionRewardsCollection(collection);
        }
        return false;
    }

    function createManualReward(address winner, string calldata tokenUri)
        external
        onlyOwner
        returns (uint256 eventId, uint256 rewardId)
    {
        if (winner == address(0)) revert WinnerZero();

        eventId = nextEventId++;
        rewardId = nextRewardId++;

        events[eventId] = RewardEvent({
            kind: EventKind.Manual,
            creator: msg.sender,
            rewardStartId: rewardId,
            rewardCount: 1,
            randomnessRequested: false,
            finished: false,
            vrfRequestId: 0
        });

        rewardTokenUri[rewardId] = tokenUri;
        assignedTo[rewardId] = winner;

        emit RewardEventCreated(eventId, EventKind.Manual, rewardId, 1, msg.sender);
        emit RewardAssigned(rewardId, winner);
    }

    function createCharacterReward(address winner, string calldata tokenUri)
        external
        onlyApprovedMainCollection
        returns (uint256 eventId, uint256 rewardId)
    {
        if (winner == address(0)) revert WinnerZero();

        eventId = nextEventId++;
        rewardId = nextRewardId++;

        events[eventId] = RewardEvent({
            kind: EventKind.Character,
            creator: msg.sender,
            rewardStartId: rewardId,
            rewardCount: 1,
            randomnessRequested: false,
            finished: false,
            vrfRequestId: 0
        });

        rewardTokenUri[rewardId] = tokenUri;
        assignedTo[rewardId] = winner;

        emit RewardEventCreated(eventId, EventKind.Character, rewardId, 1, msg.sender);
        emit RewardAssigned(rewardId, winner);
    }

    function createMysteryEvent(string[] calldata tokenUris, address[] calldata eligible)
        external
        onlyOwner
        returns (uint256 eventId)
    {
        if (tokenUris.length == 0) revert NoTokens();
        if (eligible.length == 0) revert NoEligible();

        eventId = nextEventId++;
        uint256 startId = nextRewardId;
        uint256 count = tokenUris.length;

        for (uint256 i = 0; i < count; ++i) {
            rewardTokenUri[nextRewardId] = tokenUris[i];
            nextRewardId++;
        }

        events[eventId] = RewardEvent({
            kind: EventKind.Mystery,
            creator: msg.sender,
            rewardStartId: startId,
            rewardCount: count,
            randomnessRequested: false,
            finished: false,
            vrfRequestId: 0
        });

        address[] memory unique = new address[](eligible.length);
        uint256 uniqueCount = 0;
        for (uint256 i = 0; i < eligible.length; ++i) {
            address candidate = eligible[i];
            if (candidate == address(0)) revert ZeroAddress();

            bool seen = false;
            for (uint256 j = 0; j < uniqueCount; ++j) {
                if (unique[j] == candidate) {
                    seen = true;
                    break;
                }
            }
            if (!seen) {
                unique[uniqueCount] = candidate;
                uniqueCount++;
            }
        }

        if (uniqueCount == 0) revert NoEligible();
        if (count > uniqueCount) revert NotEnoughEligible();

        for (uint256 i = 0; i < uniqueCount; ++i) {
            eventEligible[eventId].push(unique[i]);
        }

        emit RewardEventCreated(eventId, EventKind.Mystery, startId, count, msg.sender);
    }

    function requestMysteryRandom(uint256 eventId) external onlyOwner returns (uint256 requestId) {
        return _requestMysteryRandom(eventId, 0);
    }

    function retryMysteryRandom(uint256 eventId) external onlyOwner returns (uint256 requestId) {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();
        if (!ev.randomnessRequested || ev.vrfRequestId == 0) revert NoPendingRequest();

        uint256 oldRequestId = ev.vrfRequestId;
        uint64 requestedAt = vrfRequestedAt[oldRequestId];
        if (requestedAt == 0 || block.timestamp < uint256(requestedAt) + mysteryRetryDelay) {
            revert RetryTooEarly();
        }

        delete vrfRequestToEvent[oldRequestId];
        delete vrfRequestedAt[oldRequestId];
        ev.randomnessRequested = false;
        ev.vrfRequestId = 0;

        return _requestMysteryRandom(eventId, oldRequestId);
    }

    function fulfillRandom(uint256 requestId, uint256 random) external onlyVrfRouter {
        uint256 eventId = vrfRequestToEvent[requestId];
        if (eventId == 0) revert BadRequest();
        _finalizeMysteryEvent(eventId, requestId, random);
    }

    function emergencyResolveMystery(uint256 eventId, uint256 random) external onlyOwner nonReentrant {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();

        uint256 requestId = ev.vrfRequestId;
        if (requestId != 0) {
            delete vrfRequestToEvent[requestId];
            delete vrfRequestedAt[requestId];
        }

        _finalizeMysteryEvent(eventId, requestId, random);
        emit MysteryEmergencyResolved(eventId, requestId, random);
    }

    function claim(uint256 rewardId) external nonReentrant {
        if (assignedTo[rewardId] != msg.sender) revert NotAssigned();
        if (claimed[rewardId]) revert AlreadyClaimedError();

        claimed[rewardId] = true;
        _safeMint(msg.sender, rewardId);
        emit RewardClaimed(rewardId, msg.sender, rewardId);
    }

    function rewardInfo(uint256 rewardId) external view returns (address assigned, bool isClaimed, string memory uri) {
        assigned = assignedTo[rewardId];
        isClaimed = claimed[rewardId];
        uri = rewardTokenUri[rewardId];
    }

    function eventEligibleCount(uint256 eventId) external view returns (uint256) {
        return eventEligible[eventId].length;
    }

    function getEligibleAt(uint256 eventId, uint256 idx) external view returns (address) {
        return eventEligible[eventId][idx];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return rewardTokenUri[tokenId];
    }

    function _requestMysteryRandom(uint256 eventId, uint256 oldRequestId) internal returns (uint256 requestId) {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();
        if (ev.randomnessRequested) revert AlreadyRequested();
        if (vrfRouter == address(0)) revert VrfRouterNotSet();

        requestId = IRewardVRFRouter(vrfRouter).requestRandomForReward(address(this), eventId);
        ev.randomnessRequested = true;
        ev.vrfRequestId = requestId;
        vrfRequestToEvent[requestId] = eventId;
        vrfRequestedAt[requestId] = uint64(block.timestamp);

        if (oldRequestId == 0) {
            emit MysteryRandomRequested(eventId, requestId);
        } else {
            emit MysteryRandomRetried(eventId, oldRequestId, requestId);
            emit MysteryRandomRequested(eventId, requestId);
        }
    }

    function _finalizeMysteryEvent(uint256 eventId, uint256 requestId, uint256 random) internal {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();
        if (!ev.randomnessRequested && requestId != 0) revert NoPendingRequest();

        address[] storage pool = eventEligible[eventId];
        uint256 poolSize = pool.length;
        if (poolSize == 0) revert EmptyPool();

        uint256 winnersNeeded = ev.rewardCount;
        if (winnersNeeded > poolSize) revert NotEnoughEligible();

        address[] memory temp = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; ++i) {
            temp[i] = pool[i];
        }

        uint256 seed = random;
        uint256 startId = ev.rewardStartId;
        for (uint256 k = 0; k < winnersNeeded; ++k) {
            uint256 idx = seed % (poolSize - k);
            address winner = temp[idx];

            uint256 rewardId = startId + k;
            assignedTo[rewardId] = winner;
            emit RewardAssigned(rewardId, winner);

            temp[idx] = temp[poolSize - 1 - k];
            seed = uint256(keccak256(abi.encodePacked(seed, k, winner, eventId, rewardId)));
        }

        ev.finished = true;
        ev.randomnessRequested = false;
        ev.vrfRequestId = 0;

        if (requestId != 0) {
            delete vrfRequestToEvent[requestId];
            delete vrfRequestedAt[requestId];
        }

        emit MysteryRandomFulfilled(eventId, requestId, random);
    }

    receive() external payable {}
}
