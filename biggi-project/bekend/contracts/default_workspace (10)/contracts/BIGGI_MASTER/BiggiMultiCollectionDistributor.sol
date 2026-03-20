// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 MultiCollectionDistributor - chapter-aware refactor

 Zachováno:
 - pevné split BPS
 - whitelist callerů
 - forwarding přes receiveMintShare()
 - pending retry mechanismus

 Přidáno:
 - optional registry-based chapter attribution
 - accounting per series/chapter/source collection
*/

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./Library/BiggiBpsLib.sol";

interface IBiggiSeriesRegistryDistributor {
    function chapterByCollection(address collection) external view returns (uint256);
    function getChapterMeta(uint256 chapterId) external view returns (uint256 seriesId, uint256 chapterNumber);
}

contract BiggiMultiCollectionDistributor is Ownable, ReentrancyGuard, Pausable {
    address public collectionRewards;
    address public reserve;
    address public buybackAgent;
    address public treasury;
    address public communityCenter;
    address public registry;

    mapping(address => bool) public collections;

    mapping(address => uint256) public pending;
    uint256 public totalPending;

    uint256 public totalReceived;
    mapping(address => uint256) public receivedByCollection;
    mapping(uint256 => uint256) public receivedBySeries;
    mapping(uint256 => uint256) public receivedByChapter;

    bytes4 private constant RECV_SELECTOR = bytes4(keccak256("receiveMintShare()"));

    event CollectionAdded(address indexed coll);
    event CollectionRemoved(address indexed coll);
    event RecipientSet(string indexed name, address indexed oldAddr, address indexed newAddr);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event MintShareReceived(address indexed collection, uint256 amount);
    event ChapterAttributed(address indexed source, uint256 indexed seriesId, uint256 indexed chapterId, uint256 amount);
    event ForwardSucceeded(address indexed recipient, uint256 amount);
    event ForwardFailed(address indexed recipient, uint256 amount);
    event PendingRetried(address indexed recipient, uint256 amount, bool success);
    event PendingPartiallyRetried(address indexed recipient, uint256 amount, bool success);
    event PendingWithdrawn(address indexed to, uint256 amount);
    event TreasuryRemainderHandled(uint256 remainder);

    modifier onlyWhitelisted() {
        require(collections[msg.sender], "Distributor: caller not whitelisted");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function addCollection(address coll) external onlyOwner {
        require(coll != address(0), "zero");
        collections[coll] = true;
        emit CollectionAdded(coll);
    }

    function removeCollection(address coll) external onlyOwner {
        require(coll != address(0), "zero");
        collections[coll] = false;
        emit CollectionRemoved(coll);
    }

    function setRegistry(address registry_) external onlyOwner {
        emit RegistrySet(registry, registry_);
        registry = registry_;
    }

    function setCollectionRewards(address addr) external onlyOwner {
        emit RecipientSet("collectionRewards", collectionRewards, addr);
        collectionRewards = addr;
    }
    function setReserve(address addr) external onlyOwner {
        emit RecipientSet("reserve", reserve, addr);
        reserve = addr;
    }
    function setBuybackAgent(address addr) external onlyOwner {
        emit RecipientSet("buybackAgent", buybackAgent, addr);
        buybackAgent = addr;
    }
    function setTreasury(address addr) external onlyOwner {
        emit RecipientSet("treasury", treasury, addr);
        treasury = addr;
    }
    function setCommunityCenter(address addr) external onlyOwner {
        emit RecipientSet("communityCenter", communityCenter, addr);
        communityCenter = addr;
    }

    function distribute() external payable nonReentrant whenNotPaused onlyWhitelisted {
        _distributeFrom(msg.sender, msg.value);
    }

    function receiveMintShare() external payable nonReentrant whenNotPaused {
        require(collections[msg.sender], "Distributor: caller not whitelisted");
        _distributeFrom(msg.sender, msg.value);
    }

    function _distributeFrom(address collection, uint256 value) internal {
        require(value > 0, "no value");
        require(
            collectionRewards != address(0) &&
            reserve != address(0) &&
            buybackAgent != address(0) &&
            treasury != address(0) &&
            communityCenter != address(0),
            "recips not set"
        );

        totalReceived += value;
        receivedByCollection[collection] += value;
        _recordChapterAttribution(collection, value);
        emit MintShareReceived(collection, value);

        uint256 shareCollection = BiggiBpsLib.part(value, BiggiBpsLib.DIST_COLLECTION_BPS);
        uint256 shareReserve    = BiggiBpsLib.part(value, BiggiBpsLib.DIST_RESERVE_BPS);
        uint256 shareBuyback    = BiggiBpsLib.part(value, BiggiBpsLib.DIST_BUYBACK_BPS);
        uint256 shareTreasury   = BiggiBpsLib.part(value, BiggiBpsLib.DIST_TREASURY_BPS);
        uint256 shareCommunity  = BiggiBpsLib.part(value, BiggiBpsLib.DIST_COMMUNITY_BPS);

        uint256 sumShares = shareCollection + shareReserve + shareBuyback + shareTreasury + shareCommunity;
        if (value > sumShares) {
            uint256 remainder = value - sumShares;
            shareTreasury += remainder;
            emit TreasuryRemainderHandled(remainder);
        }

        _tryForwardWithFunc(collectionRewards, shareCollection);
        _tryForwardWithFunc(reserve, shareReserve);
        _tryForwardWithFunc(buybackAgent, shareBuyback);
        _tryForwardWithFunc(treasury, shareTreasury);
        _tryForwardWithFunc(communityCenter, shareCommunity);
    }

    function _recordChapterAttribution(address source, uint256 amount) internal {
        if (registry == address(0)) return;
        uint256 chapterId = IBiggiSeriesRegistryDistributor(registry).chapterByCollection(source);
        if (chapterId == 0) return;
        (uint256 seriesId, ) = IBiggiSeriesRegistryDistributor(registry).getChapterMeta(chapterId);
        receivedByChapter[chapterId] += amount;
        receivedBySeries[seriesId] += amount;
        emit ChapterAttributed(source, seriesId, chapterId, amount);
    }

    function _tryForwardWithFunc(address recipient, uint256 amt) internal {
        if (amt == 0) return;
        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amt}(payload);
        if (ok) {
            emit ForwardSucceeded(recipient, amt);
        } else {
            pending[recipient] += amt;
            totalPending += amt;
            emit ForwardFailed(recipient, amt);
        }
    }

    function retryPending(address recipient) external onlyOwner nonReentrant {
        uint256 amt = pending[recipient];
        require(amt > 0, "no pending");

        pending[recipient] = 0;
        totalPending -= amt;

        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amt}(payload);

        if (ok) {
            emit PendingRetried(recipient, amt, true);
        } else {
            pending[recipient] = amt;
            totalPending += amt;
            emit PendingRetried(recipient, amt, false);
        }
    }

    function retryPendingAmount(address recipient, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "zero amount");
        uint256 available = pending[recipient];
        require(available >= amount, "not enough pending");

        pending[recipient] = available - amount;
        totalPending -= amount;

        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amount}(payload);

        if (ok) {
            emit PendingPartiallyRetried(recipient, amount, true);
        } else {
            pending[recipient] = available;
            totalPending += amount;
            emit PendingPartiallyRetried(recipient, amount, false);
        }
    }

    function withdrawEther(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to0");
        uint256 freeBal = address(this).balance - totalPending;
        require(amount <= freeBal, "insufficient free balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit PendingWithdrawn(to, amount);
    }

    function pendingOf(address recipient) external view returns (uint256) {
        return pending[recipient];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
