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
    error ClaimsBudgetLocked();
    error CollectionBudgetNotConfigured();
    error FundingCollectionNotSet();
    error RewardScheduleLocked();
    error InsufficientCollectionBudget();

    struct CollectionBudgetState {
        bool configured;
        bool claimsEnabled;
        uint256 required;
        uint256 funded;
        uint256 spent;
    }

    address public distributor;
    address public registry;
    address public defaultMain;

    uint256 public orangeReward  = 1000 ether;
    uint256 public blockReward   = 3000 ether;
    uint256 public rainbowReward = 10000 ether;

    address public fundingCollection;
    bool public rewardScheduleLocked;
    uint256 public configuredCollectionCount;

    mapping(address => CollectionBudgetState) public collectionBudgets;

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
    event MintShareFromDistributor(address indexed collection, uint256 amount);
    event CollectionBudgetConfigured(address indexed collection, uint256 requiredBudget);
    event CollectionBudgetFunded(
        address indexed collection,
        address indexed funder,
        uint256 amount,
        uint256 fundedBudget,
        uint256 requiredBudget
    );
    event CollectionClaimsEnabled(address indexed collection, uint256 fundedBudget, uint256 requiredBudget);
    event FundingCollectionSet(address indexed oldCollection, address indexed newCollection);

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
        if (rewardScheduleLocked) revert RewardScheduleLocked();
        orangeReward = orange;
        blockReward = blockAmt;
        rainbowReward = rainbow;
    }

    function maximumCollectionLiability() public view returns (uint256) {
        return (orangeReward * 10) + (blockReward * 9) + rainbowReward;
    }

    function configureCollectionBudget(address collection) external onlyOwner {
        _configureCollectionBudget(collection);
    }

    function setFundingCollection(address collection) external onlyOwner {
        if (collection == address(0)) revert ZeroAddress();
        _configureCollectionBudget(collection);
        address oldCollection = fundingCollection;
        fundingCollection = collection;
        emit FundingCollectionSet(oldCollection, collection);
    }

    function clearFundingCollection() external onlyOwner {
        address oldCollection = fundingCollection;
        fundingCollection = address(0);
        emit FundingCollectionSet(oldCollection, address(0));
    }

    function fundCollectionBudget(address collection) external payable nonReentrant {
        if (msg.value == 0) revert AmountZero();
        _creditCollectionBudget(collection, msg.value, msg.sender);
    }

    function collectionBudgetSnapshot(address collection) external view returns (
        bool configured,
        bool claimsEnabled,
        uint256 requiredBudget,
        uint256 fundedBudget,
        uint256 spentBudget,
        uint256 availableBudget,
        uint256 remainingLiability,
        uint256 surplusBudget
    ) {
        CollectionBudgetState storage budget = collectionBudgets[collection];
        configured = budget.configured;
        claimsEnabled = budget.claimsEnabled;
        requiredBudget = budget.required;
        fundedBudget = budget.funded;
        spentBudget = budget.spent;
        availableBudget = budget.funded >= budget.spent ? budget.funded - budget.spent : 0;
        remainingLiability = _remainingCollectionLiability(collection);
        surplusBudget = availableBudget > remainingLiability ? availableBudget - remainingLiability : 0;
    }

    function claimOrangeReward(uint256 mainId) external nonReentrant {
        _claimOrange(defaultMain, mainId);
    }

    function claimOrangeRewardFor(address collection, uint256 mainId) external nonReentrant {
        _claimOrange(collection, mainId);
    }

    function _claimOrange(address collection, uint256 mainId) internal {
        _requireCollection(collection);
        CollectionBudgetState storage budget = _requireClaimsBudget(collection);
        if (orangeReward == 0) revert InvalidIndex();
        if (orangeWinnersCount[collection] >= 10) revert AlreadyClaimed();
        if (mainId < 1 || mainId > 10) revert InvalidIndex();
        if (orangeMainIdPaid[collection][mainId]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllBackgroundsForMainIdInBlock(collection, msg.sender, 1, mainId);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        _requireBudgetPayment(budget, orangeReward);

        orangeMainIdPaid[collection][mainId] = true;
        unchecked { orangeWinnersCount[collection]++; }
        budget.spent += orangeReward;

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
        CollectionBudgetState storage budget = _requireClaimsBudget(collection);
        if (blockReward == 0) revert InvalidIndex();
        if (blockWinnersCount[collection] >= 9) revert AlreadyClaimed();
        if (blockIdx < 1 || blockIdx > 9) revert InvalidIndex();
        if (blockPaid[collection][blockIdx]) revert AlreadyClaimed();
        if (userClaimedBlock[msg.sender][collection][blockIdx]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllTenMainIdsInBlock(collection, msg.sender, blockIdx);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        _requireBudgetPayment(budget, blockReward);

        blockPaid[collection][blockIdx] = true;
        userClaimedBlock[msg.sender][collection][blockIdx] = true;
        unchecked { blockWinnersCount[collection]++; }
        budget.spent += blockReward;

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
        CollectionBudgetState storage budget = _requireClaimsBudget(collection);
        if (rainbowReward == 0) revert InvalidIndex();
        if (rainbowRewardClaimedGlobal[collection]) revert AlreadyClaimed();

        (bool ok, bool supported) = _tryHasAllTenMainIdsInBlock(collection, msg.sender, 10);
        if (!supported) revert InvalidCollection();
        if (!ok) revert NotEligible();
        _requireBudgetPayment(budget, rainbowReward);

        rainbowRewardClaimedGlobal[collection] = true;
        budget.spent += rainbowReward;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        if (!sent) revert PaymentFailed();
        emit RainbowRewardClaimed(collection, msg.sender, rainbowReward);
    }

    function depositMintShareFromDistributor() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        address collection = fundingCollection;
        if (collection == address(0)) revert FundingCollectionNotSet();
        _creditCollectionBudget(collection, msg.value, msg.sender);
        emit MintShareFromDistributor(collection, msg.value);
    }

    function receiveMintShare() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        address collection = fundingCollection;
        if (collection == address(0)) revert FundingCollectionNotSet();
        _creditCollectionBudget(collection, msg.value, msg.sender);
        emit MintShareFromDistributor(collection, msg.value);
    }

    receive() external payable nonReentrant {
        if (msg.value == 0) revert AmountZero();
        address collection = fundingCollection;
        if (collection == address(0)) revert FundingCollectionNotSet();
        _creditCollectionBudget(collection, msg.value, msg.sender);
    }

    function canClaimOrange(address user, uint256 mainId) external view returns (bool ok, uint8 reason) {
        return canClaimOrangeFor(defaultMain, user, mainId);
    }

    function canClaimOrangeFor(address collection, address user, uint256 mainId) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 8);
        if (orangeReward == 0) return (false, 1);
        if (!collectionBudgets[collection].claimsEnabled) return (false, 9);
        if (orangeWinnersCount[collection] >= 10) return (false, 2);
        if (mainId < 1 || mainId > 10) return (false, 3);
        if (orangeMainIdPaid[collection][mainId]) return (false, 4);
        (bool eligible, bool supported) = _tryHasAllBackgroundsForMainIdInBlock(collection, user, 1, mainId);
        if (!supported) return (false, 8);
        if (!eligible) return (false, 5);
        if (_availableCollectionBudget(collection) < orangeReward || address(this).balance < orangeReward) return (false, 6);
        return (true, 0);
    }

    function canClaimBlock(address user, uint16 blockIdx) external view returns (bool ok, uint8 reason) {
        return canClaimBlockFor(defaultMain, user, blockIdx);
    }

    function canClaimBlockFor(address collection, address user, uint16 blockIdx) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 8);
        if (blockReward == 0) return (false, 1);
        if (!collectionBudgets[collection].claimsEnabled) return (false, 9);
        if (blockWinnersCount[collection] >= 9) return (false, 2);
        if (blockIdx < 1 || blockIdx > 9) return (false, 3);
        if (blockPaid[collection][blockIdx]) return (false, 4);
        if (userClaimedBlock[user][collection][blockIdx]) return (false, 5);
        (bool eligible, bool supported) = _tryHasAllTenMainIdsInBlock(collection, user, blockIdx);
        if (!supported) return (false, 8);
        if (!eligible) return (false, 6);
        if (_availableCollectionBudget(collection) < blockReward || address(this).balance < blockReward) return (false, 7);
        return (true, 0);
    }

    function canClaimRainbow(address user) external view returns (bool ok, uint8 reason) {
        return canClaimRainbowFor(defaultMain, user);
    }

    function canClaimRainbowFor(address collection, address user) public view returns (bool ok, uint8 reason) {
        if (!_isCollectionEligible(collection)) return (false, 5);
        if (rainbowReward == 0) return (false, 1);
        if (!collectionBudgets[collection].claimsEnabled) return (false, 9);
        if (rainbowRewardClaimedGlobal[collection]) return (false, 2);
        (bool eligible, bool supported) = _tryHasAllTenMainIdsInBlock(collection, user, 10);
        if (!supported) return (false, 5);
        if (!eligible) return (false, 3);
        if (_availableCollectionBudget(collection) < rainbowReward || address(this).balance < rainbowReward) return (false, 4);
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

    function _configureCollectionBudget(address collection) internal {
        _requireCollection(collection);
        CollectionBudgetState storage budget = collectionBudgets[collection];
        if (budget.configured) return;

        uint256 requiredBudget = maximumCollectionLiability();
        if (requiredBudget == 0) revert AmountZero();

        budget.configured = true;
        budget.required = requiredBudget;
        rewardScheduleLocked = true;
        unchecked { configuredCollectionCount++; }

        emit CollectionBudgetConfigured(collection, requiredBudget);
    }

    function _creditCollectionBudget(address collection, uint256 amount, address funder) internal {
        CollectionBudgetState storage budget = collectionBudgets[collection];
        if (!budget.configured) revert CollectionBudgetNotConfigured();

        budget.funded += amount;
        emit CollectionBudgetFunded(collection, funder, amount, budget.funded, budget.required);

        if (!budget.claimsEnabled && budget.funded >= budget.required) {
            budget.claimsEnabled = true;
            emit CollectionClaimsEnabled(collection, budget.funded, budget.required);
        }
    }

    function _requireClaimsBudget(address collection) internal view returns (CollectionBudgetState storage budget) {
        budget = collectionBudgets[collection];
        if (!budget.configured || !budget.claimsEnabled) revert ClaimsBudgetLocked();
    }

    function _requireBudgetPayment(CollectionBudgetState storage budget, uint256 amount) internal view {
        if (budget.funded < budget.spent || budget.funded - budget.spent < amount) {
            revert InsufficientCollectionBudget();
        }
        if (address(this).balance < amount) revert NotEnoughBalance();
    }

    function _availableCollectionBudget(address collection) internal view returns (uint256) {
        CollectionBudgetState storage budget = collectionBudgets[collection];
        return budget.funded >= budget.spent ? budget.funded - budget.spent : 0;
    }

    function _remainingCollectionLiability(address collection) internal view returns (uint256) {
        uint256 orangeRemaining = orangeWinnersCount[collection] < 10
            ? (10 - orangeWinnersCount[collection]) * orangeReward
            : 0;
        uint256 blockRemaining = blockWinnersCount[collection] < 9
            ? (9 - blockWinnersCount[collection]) * blockReward
            : 0;
        uint256 rainbowRemaining = rainbowRewardClaimedGlobal[collection] ? 0 : rainbowReward;
        return orangeRemaining + blockRemaining + rainbowRemaining;
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
