// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./CORE_LIBRARY/BiggiCollectionEligibilityLib.sol";

interface IBiggiEyesMainView {
    function exists(uint256 tokenId) external view returns (bool);
    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool);
    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool);
}

contract BiggiCollectionRewards is Ownable, ReentrancyGuard {
    error NotEnoughBalance();
    error AlreadyClaimed();
    error InvalidIndex();
    error PaymentFailed();
    error ZeroAddress();
    error NotDistributor();
    error AmountZero();
    error NotEligible();
    error InvalidCollection();

    address public distributor;
    address public registry;
    address public defaultMain;

    uint256 public orangeReward  = 1000 ether;
    uint256 public blockReward   = 3000 ether;
    uint256 public rainbowReward = 10000 ether;

    mapping(address => uint8) public orangeWinnersCount;
    mapping(address => uint8) public blockWinnersCount;
    mapping(address => bool)  public rainbowRewardClaimedGlobal;

    mapping(address => mapping(address => mapping(uint16 => bool))) public userClaimedBlock;
    mapping(address => mapping(uint256 => bool)) public orangeMainIdPaid;
    mapping(address => mapping(uint16 => bool))  public blockPaid;

    event OrangeRewardClaimed(address indexed collection, address indexed user, uint256 mainId, uint256 amount);
    event BlockRewardClaimed(address indexed collection, address indexed user, uint16 blockIdx, uint256 amount);
    event RainbowRewardClaimed(address indexed collection, address indexed user, uint256 amount);
    event DistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event DefaultMainSet(address indexed oldMain, address indexed newMain);
    event MintShareFromDistributor(uint256 amount);

    constructor(address main_, address owner_) Ownable(owner_) {
        if (main_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        defaultMain = main_;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        transferOwnership(newOwner);
    }

    function setMain(address main_) external onlyOwner {
        if (main_ == address(0)) revert ZeroAddress();
        emit DefaultMainSet(defaultMain, main_);
        defaultMain = main_;
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

    function setDistributor(address d) external onlyOwner {
        if (d == address(0)) revert ZeroAddress();
        emit DistributorSet(distributor, d);
        distributor = d;
    }

    function setRewardsAmounts(uint256 orange, uint256 blockAmt, uint256 rainbow) external onlyOwner {
        orangeReward = orange;
        blockReward = blockAmt;
        rainbowReward = rainbow;
    }

    function claimOrangeReward(uint256 mainId) external nonReentrant {
        _claimOrange(defaultMain, mainId);
    }

    function claimOrangeRewardFor(address collection, uint256 mainId) external nonReentrant {
        _claimOrange(collection, mainId);
    }

    function _claimOrange(address collection, uint256 mainId) internal {
        _requireCollection(collection);
        if (orangeReward == 0) revert InvalidIndex();
        if (orangeWinnersCount[collection] >= 10) revert AlreadyClaimed();
        if (mainId < 1 || mainId > 10) revert InvalidIndex();
        if (orangeMainIdPaid[collection][mainId]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllBackgroundsForMainIdInBlock(collection, msg.sender, 1, mainId);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        if (address(this).balance < orangeReward) revert NotEnoughBalance();

        orangeMainIdPaid[collection][mainId] = true;
        unchecked { orangeWinnersCount[collection]++; }

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        if (!sent) revert PaymentFailed();
        emit OrangeRewardClaimed(collection, msg.sender, mainId, orangeReward);
    }

    function claimBlockReward(uint16 blockIdx) external nonReentrant {
        _claimBlock(defaultMain, blockIdx);
    }

    function claimBlockRewardFor(address collection, uint16 blockIdx) external nonReentrant {
        _claimBlock(collection, blockIdx);
    }

    function _claimBlock(address collection, uint16 blockIdx) internal {
        _requireCollection(collection);
        if (blockReward == 0) revert InvalidIndex();
        if (blockWinnersCount[collection] >= 9) revert AlreadyClaimed();
        if (blockIdx < 1 || blockIdx > 9) revert InvalidIndex();
        if (blockPaid[collection][blockIdx]) revert AlreadyClaimed();
        if (userClaimedBlock[msg.sender][collection][blockIdx]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllTenMainIdsInBlock(collection, msg.sender, blockIdx);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        if (address(this).balance < blockReward) revert NotEnoughBalance();

        blockPaid[collection][blockIdx] = true;
        userClaimedBlock[msg.sender][collection][blockIdx] = true;
        unchecked { blockWinnersCount[collection]++; }

        (bool sent, ) = msg.sender.call{value: blockReward}("");
        if (!sent) revert PaymentFailed();
        emit BlockRewardClaimed(collection, msg.sender, blockIdx, blockReward);
    }

    function claimRainbowReward() external nonReentrant {
        _claimRainbow(defaultMain);
    }

    function claimRainbowRewardFor(address collection) external nonReentrant {
        _claimRainbow(collection);
    }

    function _claimRainbow(address collection) internal {
        _requireCollection(collection);
        if (rainbowReward == 0) revert InvalidIndex();
        if (rainbowRewardClaimedGlobal[collection]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllTenMainIdsInBlock(collection, msg.sender, 10);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        if (address(this).balance < rainbowReward) revert NotEnoughBalance();

        rainbowRewardClaimedGlobal[collection] = true;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        if (!sent) revert PaymentFailed();
        emit RainbowRewardClaimed(collection, msg.sender, rainbowReward);
    }

    function depositMintShareFromDistributor() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        emit MintShareFromDistributor(msg.value);
    }

    function receiveMintShare() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        emit MintShareFromDistributor(msg.value);
    }

    receive() external payable {}

    function canClaimOrange(address user, uint256 mainId) external view returns (bool ok, uint8 reason) {
        return canClaimOrangeFor(defaultMain, user, mainId);
    }

    function canClaimOrangeFor(address collection, address user, uint256 mainId) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 8);
        if (orangeReward == 0) return (false, 1);
        if (orangeWinnersCount[collection] >= 10) return (false, 2);
        if (mainId < 1 || mainId > 10) return (false, 3);
        if (orangeMainIdPaid[collection][mainId]) return (false, 4);
        (bool eligible, bool supported) = _tryHasAllBackgroundsForMainIdInBlock(collection, user, 1, mainId);
        if (!supported) return (false, 8);
        if (!eligible) return (false, 5);
        if (address(this).balance < orangeReward) return (false, 6);
        return (true, 0);
    }

    function canClaimBlock(address user, uint16 blockIdx) external view returns (bool ok, uint8 reason) {
        return canClaimBlockFor(defaultMain, user, blockIdx);
    }

    function canClaimBlockFor(address collection, address user, uint16 blockIdx) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 8);
        if (blockReward == 0) return (false, 1);
        if (blockWinnersCount[collection] >= 9) return (false, 2);
        if (blockIdx < 1 || blockIdx > 9) return (false, 3);
        if (blockPaid[collection][blockIdx]) return (false, 4);
        if (userClaimedBlock[user][collection][blockIdx]) return (false, 5);
        (bool eligible, bool supported) = _tryHasAllTenMainIdsInBlock(collection, user, blockIdx);
        if (!supported) return (false, 8);
        if (!eligible) return (false, 6);
        if (address(this).balance < blockReward) return (false, 7);
        return (true, 0);
    }

    function canClaimRainbow(address user) external view returns (bool ok, uint8 reason) {
        return canClaimRainbowFor(defaultMain, user);
    }

    function canClaimRainbowFor(address collection, address user) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 5);
        if (rainbowReward == 0) return (false, 1);
        if (rainbowRewardClaimedGlobal[collection]) return (false, 2);
        (bool eligible, bool supported) = _tryHasAllTenMainIdsInBlock(collection, user, 10);
        if (!supported) return (false, 5);
        if (!eligible) return (false, 3);
        if (address(this).balance < rainbowReward) return (false, 4);
        return (true, 0);
    }

    function rewardsSnapshot(address user) external view returns (
        address owner_,
        address main_,
        address distributor_,
        uint256 contractBalance,
        uint256 orangeReward_,
        uint256 blockReward_,
        uint256 rainbowReward_,
        uint8 orangeWinners,
        uint8 blockWinners,
        bool rainbowClaimedGlobal,
        bool canRainbow,
        uint8 canRainbowReason
    ) {
        owner_ = owner();
        main_ = defaultMain;
        distributor_ = distributor;
        contractBalance = address(this).balance;
        orangeReward_ = orangeReward;
        blockReward_ = blockReward;
        rainbowReward_ = rainbowReward;
        orangeWinners = orangeWinnersCount[defaultMain];
        blockWinners = blockWinnersCount[defaultMain];
        rainbowClaimedGlobal = rainbowRewardClaimedGlobal[defaultMain];
        (canRainbow, canRainbowReason) = this.canClaimRainbowFor(defaultMain, user);
    }

    function isRegistryModeEnabled() external view returns (bool) {
        return registry != address(0);
    }

    function isEligibleCollection(address collection) external view returns (bool) {
        return _isCollectionEligible(collection);
    }

    function _requireCollection(address collection) internal view {
        if (!_isCollectionEligible(collection)) revert InvalidCollection();
    }

    function _isCollectionEligible(address collection) internal view returns (bool) {
        return BiggiCollectionEligibilityLib.isCollectionRewardsEligible(collection, defaultMain, registry);
    }

    function _tryHasAllTenMainIdsInBlock(address collection, address user, uint16 blk)
        internal
        view
        returns (bool eligible, bool supported)
    {
        try IBiggiEyesMainView(collection).hasAllTenMainIdsInBlock(user, blk) returns (bool ok) {
            return (ok, true);
        } catch {
            return (false, false);
        }
    }

    function _tryHasAllBackgroundsForMainIdInBlock(address collection, address user, uint16 blk, uint256 mainId)
        internal
        view
        returns (bool eligible, bool supported)
    {
        try IBiggiEyesMainView(collection).hasAllBackgroundsForMainIdInBlock(user, blk, mainId) returns (bool ok) {
            return (ok, true);
        } catch {
            return (false, false);
        }
    }
}
