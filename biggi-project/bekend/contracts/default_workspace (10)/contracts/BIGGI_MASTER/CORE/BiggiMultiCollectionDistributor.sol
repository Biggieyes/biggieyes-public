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

import "./CORE_LIBRARY/BiggiBpsLib.sol";

interface IBiggiSeriesRegistryDistributor {
    function chapterByCollection(address collection) external view returns (uint256);
    function getChapterMeta(uint256 chapterId) external view returns (uint256 seriesId, uint256 chapterNumber);
    function getChapterCollections(uint256 chapterId) external view returns (address vrfCollection, address publicCollection, address ticketHub);
}

contract BiggiMultiCollectionDistributor is Ownable, ReentrancyGuard, Pausable {
    error CallerNotWhitelisted();
    error ZeroAddress();
    error NoValue();
    error RecipientsNotSet();
    error NoPendingAmount();
    error PendingAmountTooHigh();
    error InsufficientFreeBalance();
    error WithdrawFailed();
    error InvalidChapterAttribution();

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
    event SuccessTransfer(address indexed recipient, uint256 amount);
    event FailedTransfer(address indexed recipient, uint256 amount);
    event PendingRetried(address indexed recipient, uint256 amount, bool success);
    event PendingPartiallyRetried(address indexed recipient, uint256 amount, bool success);
    event PendingWithdrawn(address indexed to, uint256 amount);
    event TreasuryRemainderHandled(uint256 remainder);
    event ChapterAttributionFailed(address indexed source, address indexed registry, uint256 amount);

    modifier onlyWhitelisted() {
        if (!collections[msg.sender]) revert CallerNotWhitelisted();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function addCollection(address coll) external onlyOwner {
        if (coll == address(0)) revert ZeroAddress();
        collections[coll] = true;
        emit CollectionAdded(coll);
    }

    function removeCollection(address coll) external onlyOwner {
        if (coll == address(0)) revert ZeroAddress();
        collections[coll] = false;
        emit CollectionRemoved(coll);
    }

    function setRegistry(address registry_) external onlyOwner {
        if (registry_ == address(0)) revert ZeroAddress();
        emit RegistrySet(registry, registry_);
        registry = registry_;
    }

    function clearRegistry() external onlyOwner {
        emit RegistrySet(registry, address(0));
        registry = address(0);
    }

    function setCollectionRewards(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        emit RecipientSet("collectionRewards", collectionRewards, addr);
        collectionRewards = addr;
    }
    function setReserve(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        emit RecipientSet("reserve", reserve, addr);
        reserve = addr;
    }
    function setBuybackAgent(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        emit RecipientSet("buybackAgent", buybackAgent, addr);
        buybackAgent = addr;
    }
    function setTreasury(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        emit RecipientSet("treasury", treasury, addr);
        treasury = addr;
    }
    function setCommunityCenter(address addr) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        emit RecipientSet("communityCenter", communityCenter, addr);
        communityCenter = addr;
    }

    function distribute() external payable nonReentrant whenNotPaused onlyWhitelisted {
        _distributeFrom(msg.sender, msg.value);
    }

    function receiveMintShare() external payable nonReentrant whenNotPaused {
        if (!collections[msg.sender]) revert CallerNotWhitelisted();
        _distributeFrom(msg.sender, msg.value);
    }

    function supportsChapterMintShare() external pure returns (bool) {
        return true;
    }

    function receiveMintShareForChapter(uint256 chapterId) external payable nonReentrant whenNotPaused {
        if (!collections[msg.sender]) revert CallerNotWhitelisted();
        if (!_isValidChapterSource(msg.sender, chapterId)) revert InvalidChapterAttribution();
        _distributeFromChapter(msg.sender, msg.value, chapterId);
    }

    function _distributeFrom(address collection, uint256 value) internal {
        _distributeFromChapter(collection, value, 0);
    }

    function _distributeFromChapter(address collection, uint256 value, uint256 explicitChapterId) internal {
        if (value == 0) revert NoValue();
        if (
            collectionRewards == address(0) ||
            reserve == address(0) ||
            buybackAgent == address(0) ||
            treasury == address(0) ||
            communityCenter == address(0)
        ) revert RecipientsNotSet();

        totalReceived += value;
        receivedByCollection[collection] += value;
        _recordChapterAttribution(collection, value, explicitChapterId);
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

    function _recordChapterAttribution(address source, uint256 amount, uint256 explicitChapterId) internal {
        if (registry == address(0)) return;
        uint256 chapterId;
        if (explicitChapterId != 0) {
            chapterId = explicitChapterId;
        } else {
            try IBiggiSeriesRegistryDistributor(registry).chapterByCollection(source) returns (uint256 resolvedChapterId) {
                chapterId = resolvedChapterId;
            } catch {
                emit ChapterAttributionFailed(source, registry, amount);
                return;
            }
        }
        if (chapterId == 0) return;

        uint256 seriesId;
        try IBiggiSeriesRegistryDistributor(registry).getChapterMeta(chapterId) returns (uint256 resolvedSeriesId, uint256) {
            seriesId = resolvedSeriesId;
        } catch {
            emit ChapterAttributionFailed(source, registry, amount);
            return;
        }

        receivedByChapter[chapterId] += amount;
        receivedBySeries[seriesId] += amount;
        emit ChapterAttributed(source, seriesId, chapterId, amount);
    }

    function _isValidChapterSource(address source, uint256 chapterId) internal view returns (bool) {
        if (registry == address(0) || chapterId == 0) return false;
        try IBiggiSeriesRegistryDistributor(registry).getChapterCollections(chapterId) returns (
            address vrfCollection,
            address publicCollection,
            address ticketHub
        ) {
            return source == vrfCollection || source == publicCollection || source == ticketHub;
        } catch {
            return false;
        }
    }

    function _tryForwardWithFunc(address recipient, uint256 amt) internal {
        if (amt == 0) return;
        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amt}(payload);
        if (ok) {
            emit ForwardSucceeded(recipient, amt);
            emit SuccessTransfer(recipient, amt);
        } else {
            pending[recipient] += amt;
            totalPending += amt;
            emit ForwardFailed(recipient, amt);
            emit FailedTransfer(recipient, amt);
        }
    }

    function retryPending(address recipient) external onlyOwner nonReentrant {
        uint256 amt = pending[recipient];
        if (amt == 0) revert NoPendingAmount();

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
        if (amount == 0) revert NoValue();
        uint256 available = pending[recipient];
        if (available < amount) revert PendingAmountTooHigh();

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
        if (to == address(0)) revert ZeroAddress();
        uint256 freeBal = address(this).balance - totalPending;
        if (amount > freeBal) revert InsufficientFreeBalance();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit PendingWithdrawn(to, amount);
    }

    function pendingOf(address recipient) external view returns (uint256) {
        return pending[recipient];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
