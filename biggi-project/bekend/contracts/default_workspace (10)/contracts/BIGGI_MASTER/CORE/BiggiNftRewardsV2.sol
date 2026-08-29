// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBiggiRewardVrfRouterV2 {
    function requestRandomForReward(address requester, uint256 eventId)
        external
        returns (uint256 requestId);
}

/// @notice Hardened NFT reward collection for manual and VRF mystery rewards.
/// @dev Character completion NFTs remain owned and minted by each BiggiMain.
contract BiggiNFTRewardsV2 is ERC721, Ownable2Step, ReentrancyGuard {
    error ZeroAddress();
    error WinnerZero();
    error EmptyTokenUri();
    error NoTokens();
    error NoEligible();
    error NotEnoughEligible();
    error NotMystery();
    error AlreadyRequested();
    error AlreadyFinished();
    error BadRequest();
    error EmptyPool();
    error RetryTooEarly();
    error NoPendingRequest();
    error NotAssigned();
    error AlreadyClaimedError();
    error OnlyVrfRouter();
    error VrfRouterNotContract();
    error DelayZero();
    error InvalidRequestId();
    error RequestIdAlreadyUsed();
    error NativeTokenNotAccepted();
    error OwnershipRenounceDisabled();

    // Values stay compatible with the V1 reader and frontend.
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
    mapping(uint256 => mapping(address => bool)) private eventEligibleAdded;

    mapping(uint256 => uint256) public vrfRequestToEvent;
    mapping(uint256 => uint64) public vrfRequestedAt;
    mapping(uint256 => bool) public usedVrfRequestIds;

    address public immutable vrfRouter;
    uint64 public mysteryRetryDelay = 15 minutes;

    event RewardEventCreated(
        uint256 indexed eventId,
        EventKind kind,
        uint256 startRewardId,
        uint256 count,
        address indexed creator
    );
    event RewardAssigned(uint256 indexed rewardId, address indexed to);
    event RewardClaimed(uint256 indexed rewardId, address indexed claimer, uint256 tokenId);
    event MysteryRandomRequested(uint256 indexed eventId, uint256 indexed requestId);
    event MysteryRandomRetried(
        uint256 indexed eventId,
        uint256 indexed oldRequestId,
        uint256 indexed newRequestId
    );
    event MysteryRandomFulfilled(
        uint256 indexed eventId,
        uint256 indexed requestId,
        uint256 random
    );
    event MysteryRetryDelaySet(uint64 oldDelay, uint64 newDelay);
    event VrfRouterConfigured(address indexed router);

    modifier onlyVrfRouter() {
        if (msg.sender != vrfRouter) revert OnlyVrfRouter();
        _;
    }

    constructor(address owner_, address vrfRouter_)
        ERC721("Biggi Reward", "BGR")
        Ownable(owner_)
    {
        if (owner_ == address(0) || vrfRouter_ == address(0)) revert ZeroAddress();
        if (vrfRouter_.code.length == 0) revert VrfRouterNotContract();
        vrfRouter = vrfRouter_;
        emit VrfRouterConfigured(vrfRouter_);
    }

    function setMysteryRetryDelay(uint64 delaySec) external onlyOwner {
        if (delaySec == 0) revert DelayZero();
        uint64 oldDelay = mysteryRetryDelay;
        mysteryRetryDelay = delaySec;
        emit MysteryRetryDelaySet(oldDelay, delaySec);
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenounceDisabled();
    }

    function createManualReward(address winner, string calldata tokenUri)
        external
        onlyOwner
        returns (uint256 eventId, uint256 rewardId)
    {
        if (winner == address(0)) revert WinnerZero();
        if (bytes(tokenUri).length == 0) revert EmptyTokenUri();

        eventId = nextEventId++;
        rewardId = nextRewardId++;

        events[eventId] = RewardEvent({
            kind: EventKind.Manual,
            creator: msg.sender,
            rewardStartId: rewardId,
            rewardCount: 1,
            randomnessRequested: false,
            finished: true,
            vrfRequestId: 0
        });

        rewardTokenUri[rewardId] = tokenUri;
        assignedTo[rewardId] = winner;

        emit RewardEventCreated(eventId, EventKind.Manual, rewardId, 1, msg.sender);
        emit RewardAssigned(rewardId, winner);
    }

    function createMysteryEvent(string[] calldata tokenUris, address[] calldata eligible)
        external
        onlyOwner
        returns (uint256 eventId)
    {
        uint256 count = tokenUris.length;
        if (count == 0) revert NoTokens();
        if (eligible.length == 0) revert NoEligible();

        eventId = nextEventId++;
        uint256 startId = nextRewardId;

        for (uint256 i = 0; i < count; ++i) {
            if (bytes(tokenUris[i]).length == 0) revert EmptyTokenUri();
            rewardTokenUri[nextRewardId++] = tokenUris[i];
        }

        uint256 uniqueCount;
        for (uint256 i = 0; i < eligible.length; ++i) {
            address candidate = eligible[i];
            if (candidate == address(0)) revert ZeroAddress();
            if (eventEligibleAdded[eventId][candidate]) continue;

            eventEligibleAdded[eventId][candidate] = true;
            eventEligible[eventId].push(candidate);
            ++uniqueCount;
        }

        if (uniqueCount == 0) revert NoEligible();
        if (count > uniqueCount) revert NotEnoughEligible();

        events[eventId] = RewardEvent({
            kind: EventKind.Mystery,
            creator: msg.sender,
            rewardStartId: startId,
            rewardCount: count,
            randomnessRequested: false,
            finished: false,
            vrfRequestId: 0
        });

        emit RewardEventCreated(eventId, EventKind.Mystery, startId, count, msg.sender);
    }

    function requestMysteryRandom(uint256 eventId)
        external
        onlyOwner
        nonReentrant
        returns (uint256 requestId)
    {
        return _requestMysteryRandom(eventId, 0);
    }

    function retryMysteryRandom(uint256 eventId)
        external
        onlyOwner
        nonReentrant
        returns (uint256 requestId)
    {
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

    function fulfillRandom(uint256 requestId, uint256 random)
        external
        onlyVrfRouter
        nonReentrant
    {
        uint256 eventId = vrfRequestToEvent[requestId];
        if (eventId == 0) revert BadRequest();
        _finalizeMysteryEvent(eventId, requestId, random);
    }

    function claim(uint256 rewardId) external nonReentrant {
        if (assignedTo[rewardId] != msg.sender) revert NotAssigned();
        if (claimed[rewardId]) revert AlreadyClaimedError();

        claimed[rewardId] = true;
        _safeMint(msg.sender, rewardId);
        emit RewardClaimed(rewardId, msg.sender, rewardId);
    }

    function rewardInfo(uint256 rewardId)
        external
        view
        returns (address assigned, bool isClaimed, string memory uri)
    {
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

    function _requestMysteryRandom(uint256 eventId, uint256 oldRequestId)
        internal
        returns (uint256 requestId)
    {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();
        if (ev.randomnessRequested) revert AlreadyRequested();

        requestId = IBiggiRewardVrfRouterV2(vrfRouter).requestRandomForReward(
            address(this),
            eventId
        );
        if (requestId == 0) revert InvalidRequestId();
        if (usedVrfRequestIds[requestId]) revert RequestIdAlreadyUsed();

        ev.randomnessRequested = true;
        ev.vrfRequestId = requestId;
        vrfRequestToEvent[requestId] = eventId;
        vrfRequestedAt[requestId] = uint64(block.timestamp);
        usedVrfRequestIds[requestId] = true;

        if (oldRequestId == 0) {
            emit MysteryRandomRequested(eventId, requestId);
        } else {
            emit MysteryRandomRetried(eventId, oldRequestId, requestId);
            emit MysteryRandomRequested(eventId, requestId);
        }
    }

    function _finalizeMysteryEvent(uint256 eventId, uint256 requestId, uint256 random)
        internal
    {
        RewardEvent storage ev = events[eventId];
        if (ev.kind != EventKind.Mystery) revert NotMystery();
        if (ev.finished) revert AlreadyFinished();
        if (
            requestId == 0 ||
            !ev.randomnessRequested ||
            ev.vrfRequestId != requestId ||
            vrfRequestToEvent[requestId] != eventId
        ) revert NoPendingRequest();

        address[] storage pool = eventEligible[eventId];
        uint256 poolSize = pool.length;
        if (poolSize == 0) revert EmptyPool();

        uint256 winnersNeeded = ev.rewardCount;
        if (winnersNeeded > poolSize) revert NotEnoughEligible();

        address[] memory candidates = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; ++i) {
            candidates[i] = pool[i];
        }

        uint256 seed = random;
        uint256 startId = ev.rewardStartId;
        for (uint256 i = 0; i < winnersNeeded; ++i) {
            uint256 idx = seed % (poolSize - i);
            address winner = candidates[idx];
            uint256 rewardId = startId + i;

            assignedTo[rewardId] = winner;
            emit RewardAssigned(rewardId, winner);

            candidates[idx] = candidates[poolSize - 1 - i];
            seed = uint256(
                keccak256(abi.encode(seed, i, winner, eventId, rewardId))
            );
        }

        ev.finished = true;
        ev.randomnessRequested = false;
        ev.vrfRequestId = 0;
        delete vrfRequestToEvent[requestId];
        delete vrfRequestedAt[requestId];

        emit MysteryRandomFulfilled(eventId, requestId, random);
    }

    receive() external payable {
        revert NativeTokenNotAccepted();
    }
}
