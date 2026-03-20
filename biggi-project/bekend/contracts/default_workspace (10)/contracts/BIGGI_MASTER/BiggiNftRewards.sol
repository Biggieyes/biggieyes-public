// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  BiggiNFTRewards.sol
  - ERC721 reward contract that mints reward NFTs on claim.
  - Supports: Character(last-mint) rewards (onlyMainContract), Manual admin rewards (owner),
    Mystery events (eligible address list + Chainlink VRF via vrfRouter).
  - Metadata (tokenURI) are provided by owner on event creation (IPFS URIs).
*/

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBiggiSeriesRegistryRewards {
    function isCollectionRewardsCollection(address collection) external view returns (bool);
}

interface IRewardVRFRouter {
    // Minimal expected router API — must return requestId which will be forwarded back
    function requestRandomForReward(address requester, uint256 eventId) external returns (uint256 requestId);
}

contract BiggiNFTRewards is ERC721, Ownable, ReentrancyGuard {
    /* ===== Types ===== */
    enum EventKind { Undefined, Character, Manual, Mystery }

    struct RewardEvent {
        EventKind kind;
        address creator;        // who created the event (owner or main)
        uint256 rewardStartId;  // first rewardId for this event
        uint256 rewardCount;    // how many reward entries
        bool randomnessRequested;
        bool finished;
        uint256 vrfRequestId;   // if randomness requested
    }

    /* ===== State ===== */
    uint256 public nextRewardId = 1; // rewardId == tokenId when minted
    uint256 public nextEventId = 1;

    mapping(uint256 => RewardEvent) public events; // eventId => event
    mapping(uint256 => string) public rewardTokenUri; // rewardId => tokenUri (IPFS)
    mapping(uint256 => address) public assignedTo;    // rewardId => assigned address (0 = unassigned)
    mapping(uint256 => bool) public claimed;          // rewardId => claimed

    // Mystery event eligible lists
    mapping(uint256 => address[]) private eventEligible; // eventId => list of eligible addresses

    // Map vrfRequestId => eventId
    mapping(uint256 => uint256) public vrfRequestToEvent;

    // Access-controlled roles
    address public mainContract; // primární / legacy VRF collection
    address public vrfRouter;
    address public registry;
    mapping(address => bool) public allowedMainCollections;

    /* ===== Events ===== */
    event RewardEventCreated(uint256 indexed eventId, EventKind kind, uint256 startRewardId, uint256 count, address indexed creator);
    event RewardAssigned(uint256 indexed rewardId, address indexed to);
    event RewardClaimed(uint256 indexed rewardId, address indexed claimer, uint256 tokenId);
    event MysteryRandomRequested(uint256 indexed eventId, uint256 indexed requestId);
    event MysteryRandomFulfilled(uint256 indexed eventId, uint256 indexed requestId, uint256 random);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event MainCollectionApprovalSet(address indexed collection, bool approved);

    /* ===== Modifiers ===== */
    modifier onlyApprovedMainCollection() {
        require(_isApprovedMainCollection(msg.sender), "only approved main");
        _;
    }
    modifier onlyVrfRouter() {
        require(msg.sender == vrfRouter, "only vrf router");
        _;
    }

    constructor(address _owner) 
        ERC721("Biggi Reward", "BGR")
        Ownable(_owner)
    {
        require(_owner != address(0), "owner0");
        // _transferOwnership(_owner) se již volá v Ownable konstruktoru
    }

    /* ===== Admin: set external contracts ===== */
    function setMainContract(address m) external onlyOwner {
        mainContract = m;
        if (m != address(0)) {
            allowedMainCollections[m] = true;
            emit MainCollectionApprovalSet(m, true);
        }
    }
    function setVrfRouter(address r) external onlyOwner {
        vrfRouter = r;
    }
    function setRegistry(address registry_) external onlyOwner {
        emit RegistrySet(registry, registry_);
        registry = registry_;
    }
    function setAllowedMainCollection(address collection, bool approved) external onlyOwner {
        require(collection != address(0), "collection0");
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

    /* ===== Event creation helpers =====
       - tokenUris: array of IPFS URIs (length = rewardCount).
       - eligible: for Mystery events, array of eligible addresses (may contain duplicates — deduped on selection).
       - For Character / Manual: supply tokenUris length == 1 and either eligible = [winner] (or assigned by call).
    */

    // Owner creates manual reward and directly assigns winner (creator can be owner)
    function createManualReward(address winner, string calldata tokenUri) external onlyOwner returns (uint256 eventId, uint256 rewardId) {
        require(winner != address(0), "winner0");
        // create event with single reward
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

    // Main contract notifies of last-mint in block; only mainContract can call
    // Supply the IPFS tokenUri for the reward (owner/main must prepare it)
    function createCharacterReward(address winner, string calldata tokenUri) external onlyApprovedMainCollection returns (uint256 eventId, uint256 rewardId) {
        require(winner != address(0), "winner0");
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

    // Owner creates a mystery event: provide tokenUris[] (length = winnersCount) and eligible addresses.
    function createMysteryEvent(string[] calldata tokenUris, address[] calldata eligible) external onlyOwner returns (uint256 eventId) {
        require(tokenUris.length > 0, "no tokens");
        require(eligible.length > 0, "no eligible");

        eventId = nextEventId++;
        uint256 startId = nextRewardId;
        uint256 cnt = tokenUris.length;
        // reserve rewardIds
        for (uint256 i = 0; i < cnt; ++i) {
            rewardTokenUri[nextRewardId] = tokenUris[i];
            nextRewardId++;
        }

        events[eventId] = RewardEvent({
            kind: EventKind.Mystery,
            creator: msg.sender,
            rewardStartId: startId,
            rewardCount: cnt,
            randomnessRequested: false,
            finished: false,
            vrfRequestId: 0
        });

        // store eligible list
        for (uint256 i = 0; i < eligible.length; ++i) {
            eventEligible[eventId].push(eligible[i]);
        }

        emit RewardEventCreated(eventId, EventKind.Mystery, startId, cnt, msg.sender);
    }

    // Owner (or later we could allow main) requests randomness for mystery event
    // This forwards to vrfRouter; vrfRouter must call back fulfillRandom.
    function requestMysteryRandom(uint256 eventId) external onlyOwner returns (uint256 requestId) {
        RewardEvent storage ev = events[eventId];
        require(ev.kind == EventKind.Mystery, "not mystery");
        require(!ev.randomnessRequested, "already requested");
        require(vrfRouter != address(0), "vrf router not set");

        // call vrfRouter
        requestId = IRewardVRFRouter(vrfRouter).requestRandomForReward(address(this), eventId);
        ev.randomnessRequested = true;
        ev.vrfRequestId = requestId;
        vrfRequestToEvent[requestId] = eventId;

        emit MysteryRandomRequested(eventId, requestId);
    }

    // VRF router (trusted) calls this to deliver randomness.
    // We pick unique winners from eligible list and assign them to reserved rewardIds (in order).
    function fulfillRandom(uint256 requestId, uint256 random) external onlyVrfRouter {
        uint256 eventId = vrfRequestToEvent[requestId];
        require(eventId != 0, "bad request");

        RewardEvent storage ev = events[eventId];
        require(ev.kind == EventKind.Mystery, "not mystery");
        require(ev.randomnessRequested, "not requested");
        require(!ev.finished, "already finished");

        address[] storage pool = eventEligible[eventId];
        uint256 poolSize = pool.length;
        require(poolSize > 0, "empty pool");

        uint256 winnersNeeded = ev.rewardCount;
        require(winnersNeeded <= poolSize, "not enough eligible");

        // pick unique winners using Fisher-Yates-ish deterministic selection based on random seed
        // selectedIndices mapping not stored, we simply mark picked via swapping in a temp array copy
        address[] memory temp = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; ++i) temp[i] = pool[i];

        uint256 seed = random;
        uint256 startId = ev.rewardStartId;
        uint256 assignedCount = 0;
        for (uint256 k = 0; k < winnersNeeded; ++k) {
            // pick index
            uint256 idx = seed % (poolSize - k);
            address winner = temp[idx];

            // assign rewardId
            uint256 rid = startId + k;
            assignedTo[rid] = winner;
            emit RewardAssigned(rid, winner);
            assignedCount++;

            // swap chosen with last unchosen
            temp[idx] = temp[poolSize - 1 - k];

            // update seed for next pick
            seed = uint256(keccak256(abi.encodePacked(seed, k, winner, block.timestamp)));
        }

        ev.finished = true;

        emit MysteryRandomFulfilled(eventId, requestId, random);
    }

    /* ===== Claim function =====
       - claimer must match assignedTo[rewardId]
       - mints ERC721 tokenId == rewardId to claimer with tokenURI as stored
    */
    function claim(uint256 rewardId) external nonReentrant {
        require(assignedTo[rewardId] == msg.sender, "not assigned");
        require(!claimed[rewardId], "already claimed");

        claimed[rewardId] = true;
        _safeMint(msg.sender, rewardId);
        // we override tokenURI via tokenURI() below using rewardTokenUri mapping
        emit RewardClaimed(rewardId, msg.sender, rewardId);
    }

    /* ===== Views & helpers ===== */

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

    /* ===== tokenURI override to read from mapping ===== */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        string memory uri = rewardTokenUri[tokenId];
        return uri;
    }

    /* ===== Admin rescue (owner only) ===== */
    // In case some tokenUri was set in error, owner cannot reassign reward assignedTo — we keep immutability as requested.
    // Admin can burn unclaimed rewards by marking them finished/unassigned if needed (not implemented — you said non-revokable).

    /* ===== Misc ===== */
    receive() external payable { } // allow receiving fee-less ETH (not used here)
}
