// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./CORE_LIBRARY/BiggiCapsLib.sol";
import "./CORE_LIBRARY/BiggiCollectionEligibilityLib.sol";

interface IBiggiMainNFT is IERC721 {
    function blockOf(uint256 tokenId) external view returns (uint16);
}

interface IBiggiToken is IERC20, IERC20Metadata {
    function mint(address to, uint256 amount) external;
    function remainingMintable() external view returns (uint256);
}

interface IBiggiTokenRewardsEmissionController {
    function consumeReward(uint64 weekId, address user, uint256 units, uint256 defaultAmount)
        external
        returns (uint256 amount);

    function previewReward(uint64 weekId, address user, uint256 units, uint256 defaultAmount)
        external
        view
        returns (uint256 amount, uint256 weeklyBudget, uint256 weeklyPaid, uint256 unitRewardForWeek);
}

contract BiggiTokenRewards is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NoEligibleTokens();
    error CapExceeded();
    error ArrayLengthMismatch();
    error InvalidCollection();
    error RewardAmountZero();

    IBiggiMainNFT public immutable mainNFT;
    IBiggiMainNFT public immutable main2NFT;
    IBiggiToken   public immutable biggi;

    address public treasure;
    address public registry;
    address public emissionController;
    bool public emissionControllerEnabled;

    uint256 public unitReward = 1e18;
    uint8[11] public blockWeight = [0,10,20,30,40,50,60,70,80,90,100];

    uint256 public immutable rewardsCap = BiggiCapsLib.TOKEN_REWARDS_CAP;
    uint256 public rewardsMinted;

    uint256 public totalDistributed;
    uint256 public distributedThisWeek;
    uint256 public lastWeekDistributed;
    uint64  public lastRecordedWeek;

    mapping(address => uint64) public lastUserClaimWeek;
    mapping(address => mapping(uint256 => uint64)) public tokenLastClaimWeek;
    mapping(address => bool) public allowedCollections;

    event Claimed(address indexed user, uint256 units, uint256 paidFromBalance, uint256 minted);
    event UnitRewardSet(uint256 oldVal, uint256 newVal);
    event BlockWeightsSet(uint8[11] weights);
    event TreasureSet(address indexed oldTreasure, address indexed newTreasure);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event TopUpPulled(address indexed from, uint256 amount);
    event DistributedRecorded(uint256 amount, uint64 weekNow);
    event CollectionAllowedSet(address indexed coll, bool allowed);
    event EmissionControllerSet(address indexed oldController, address indexed newController);
    event EmissionControllerEnabledSet(bool enabled);

    constructor(address mainNFT_, address main2NFT_, address biggiToken_, address owner_) Ownable(owner_) {
        if (mainNFT_ == address(0) || biggiToken_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        mainNFT  = IBiggiMainNFT(mainNFT_);
        main2NFT = IBiggiMainNFT(main2NFT_);
        biggi    = IBiggiToken(biggiToken_);
        lastRecordedWeek = _week();
    }

    function pauseAll() external onlyOwner { _pause(); }
    function unpauseAll() external onlyOwner { _unpause(); }

    function setTreasure(address treasure_) external onlyOwner {
        if (treasure_ == address(0)) revert ZeroAddress();
        emit TreasureSet(treasure, treasure_);
        treasure = treasure_;
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

    function setUnitReward(uint256 newUnit) external onlyOwner {
        emit UnitRewardSet(unitReward, newUnit);
        unitReward = newUnit;
    }

    function setEmissionController(address controller, bool enabled) external onlyOwner {
        if (enabled && controller == address(0)) revert ZeroAddress();
        emit EmissionControllerSet(emissionController, controller);
        emissionController = controller;
        emissionControllerEnabled = enabled;
        emit EmissionControllerEnabledSet(enabled);
    }

    function setEmissionControllerEnabled(bool enabled) external onlyOwner {
        if (enabled && emissionController == address(0)) revert ZeroAddress();
        emissionControllerEnabled = enabled;
        emit EmissionControllerEnabledSet(enabled);
    }

    function setBlockWeights(uint8[11] calldata weights) external onlyOwner {
        blockWeight = weights;
        emit BlockWeightsSet(weights);
    }

    function setCollectionAllowed(address coll, bool allowed) external onlyOwner {
        if (coll == address(0)) revert ZeroAddress();
        allowedCollections[coll] = allowed;
        emit CollectionAllowedSet(coll, allowed);
    }

    function topUpFromTreasure(uint256 amount) external nonReentrant {
        require(msg.sender == treasure, "not treasure");
        IERC20(address(biggi)).safeTransferFrom(msg.sender, address(this), amount);
        emit TopUpPulled(msg.sender, amount);
    }

    function claim(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        _ensureWeekRoll();
        (uint256 units, ) = _calcUnitsSingle(address(mainNFT), tokenIds);
        _payout(units, msg.sender);
    }

    function claimWithCollections(address[] calldata collections, uint256[] calldata tokenIds)
        external
        nonReentrant
        whenNotPaused
    {
        _ensureWeekRoll();
        (uint256 units, ) = _calcUnitsMixed(collections, tokenIds);
        _payout(units, msg.sender);
    }

    function _payout(uint256 units, address to) internal {
        if (units == 0) revert NoEligibleTokens();

        uint64 weekNow = _week();
        uint256 amount = _consumeRewardQuote(weekNow, to, units);
        if (amount == 0) revert RewardAmountZero();

        uint256 bal = IERC20(address(biggi)).balanceOf(address(this));
        uint256 fromBalance = amount <= bal ? amount : bal;
        uint256 remaining   = amount - fromBalance;

        if (fromBalance > 0) {
            IERC20(address(biggi)).safeTransfer(to, fromBalance);
            _recordDistribution(fromBalance);
        }

        uint256 mintedOut = 0;
        if (remaining > 0) {
            if (rewardsMinted + remaining > rewardsCap) revert CapExceeded();
            biggi.mint(to, remaining);
            rewardsMinted += remaining;
            mintedOut = remaining;
            _recordDistribution(remaining);
        }

        emit Claimed(to, units, fromBalance, mintedOut);
    }

    function _consumeRewardQuote(uint64 weekNow, address to, uint256 units) internal returns (uint256 amount) {
        uint256 defaultAmount = units * unitReward;
        if (!emissionControllerEnabled || emissionController == address(0)) {
            return defaultAmount;
        }
        amount = IBiggiTokenRewardsEmissionController(emissionController).consumeReward(
            weekNow,
            to,
            units,
            defaultAmount
        );
    }

    function _calcUnitsSingle(address collection, uint256[] calldata tokenIds)
        internal
        returns (uint256 units, uint64 weekNow)
    {
        weekNow = _week();
        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                uint256 tid = tokenIds[i];

                if (!_isCollectionEligible(collection)) revert InvalidCollection();

                try IERC721(collection).ownerOf(tid) returns (address o) {
                    if (o != msg.sender) continue;
                } catch {
                    continue;
                }

                if (tokenLastClaimWeek[collection][tid] == weekNow) continue;

                uint16 blk;
                try IBiggiMainNFT(collection).blockOf(tid) returns (uint16 b) {
                    blk = b;
                } catch {
                    continue;
                }

                if (blk < 1 || blk > 10) continue;

                units += blockWeight[blk];
                tokenLastClaimWeek[collection][tid] = weekNow;
            }
        }
        if (units > 0) lastUserClaimWeek[msg.sender] = weekNow;
    }

    function _calcUnitsMixed(address[] calldata collections, uint256[] calldata tokenIds)
        internal
        returns (uint256 units, uint64 weekNow)
    {
        if (collections.length != tokenIds.length) revert ArrayLengthMismatch();
        weekNow = _week();

        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                address coll = collections[i];
                uint256 tid = tokenIds[i];

                if (!_isCollectionEligible(coll)) revert InvalidCollection();

                try IERC721(coll).ownerOf(tid) returns (address o) {
                    if (o != msg.sender) continue;
                } catch {
                    continue;
                }

                if (tokenLastClaimWeek[coll][tid] == weekNow) continue;

                uint16 blk;
                try IBiggiMainNFT(coll).blockOf(tid) returns (uint16 b) {
                    blk = b;
                } catch {
                    continue;
                }

                if (blk < 1 || blk > 10) continue;

                units += blockWeight[blk];
                tokenLastClaimWeek[coll][tid] = weekNow;
            }
        }

        if (units > 0) lastUserClaimWeek[msg.sender] = weekNow;
    }

    function tokenAddress() external view returns (address) { return address(biggi); }

    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        name_ = biggi.name();
        symbol_ = biggi.symbol();
        decimals_ = biggi.decimals();
    }

    function currentWeek() external view returns (uint64) { return _week(); }

    function nextClaimWeekFor(uint256 tokenId) external view returns (uint64) {
        uint64 last = tokenLastClaimWeek[address(mainNFT)][tokenId];
        return last == 0 ? _week() : last + 1;
    }

    function nextClaimWeekForCollection(address collection, uint256 tokenId) external view returns (uint64) {
        uint64 last = tokenLastClaimWeek[collection][tokenId];
        return last == 0 ? _week() : last + 1;
    }

    function tokenRemainingMintable() external view returns (uint256) {
        return biggi.remainingMintable();
    }

    function remainingCap() external view returns (uint256) {
        return biggi.remainingMintable();
    }

    function rewardsCapRemaining() external view returns (uint256) {
        if (rewardsMinted >= rewardsCap) return 0;
        return rewardsCap - rewardsMinted;
    }

    function getBlockWeights() external view returns (uint8[11] memory w) { w = blockWeight; }

    function rewardsStats() external view returns (uint256 minted, uint256 cap_) {
        return (rewardsMinted, rewardsCap);
    }

    function claimablePreview(uint256[] calldata tokenIds) external view returns (uint256 units, uint256 amount) {
        uint64 weekNow = _week();
        if (!_isCollectionEligible(address(mainNFT))) revert InvalidCollection();
        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                uint256 tid = tokenIds[i];
                if (tokenLastClaimWeek[address(mainNFT)][tid] == weekNow) continue;
                try IERC721(address(mainNFT)).ownerOf(tid) returns (address o) {
                    if (o != msg.sender) continue;
                } catch {
                    continue;
                }
                uint16 blk;
                try mainNFT.blockOf(tid) returns (uint16 b) {
                    blk = b;
                } catch {
                    continue;
                }
                if (blk >= 1 && blk <= 10) units += blockWeight[blk];
            }
        }
        amount = _previewRewardQuote(weekNow, msg.sender, units);
    }

    function claimablePreviewFor(address[] calldata collections, uint256[] calldata tokenIds)
        external
        view
        returns (uint256 units, uint256 amount)
    {
        if (collections.length != tokenIds.length) revert ArrayLengthMismatch();
        uint64 weekNow = _week();
        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                address coll = collections[i];
                uint256 tid = tokenIds[i];
                if (!_isCollectionEligible(coll)) revert InvalidCollection();
                if (tokenLastClaimWeek[coll][tid] == weekNow) continue;
                try IERC721(coll).ownerOf(tid) returns (address o) {
                    if (o != msg.sender) continue;
                } catch {
                    continue;
                }
                uint16 blk;
                try IBiggiMainNFT(coll).blockOf(tid) returns (uint16 b) {
                    blk = b;
                } catch {
                    continue;
                }
                if (blk >= 1 && blk <= 10) units += blockWeight[blk];
            }
        }
        amount = _previewRewardQuote(weekNow, msg.sender, units);
    }

    function rewardEmissionPreview(address user, uint256 units)
        external
        view
        returns (uint256 amount, uint256 weeklyBudget, uint256 weeklyPaid, uint256 unitRewardForWeek)
    {
        uint64 weekNow = _week();
        uint256 defaultAmount = units * unitReward;
        if (!emissionControllerEnabled || emissionController == address(0)) {
            return (defaultAmount, type(uint256).max, distributedThisWeek, unitReward);
        }
        return IBiggiTokenRewardsEmissionController(emissionController).previewReward(
            weekNow,
            user,
            units,
            defaultAmount
        );
    }

    function _previewRewardQuote(uint64 weekNow, address user, uint256 units) internal view returns (uint256 amount) {
        uint256 defaultAmount = units * unitReward;
        if (!emissionControllerEnabled || emissionController == address(0)) {
            return defaultAmount;
        }
        (amount,,,) = IBiggiTokenRewardsEmissionController(emissionController).previewReward(
            weekNow,
            user,
            units,
            defaultAmount
        );
    }

    function _week() internal view returns (uint64) { return uint64(block.timestamp / 1 weeks); }

    function _ensureWeekRoll() internal {
        uint64 w = _week();
        if (w != lastRecordedWeek) {
            lastWeekDistributed = distributedThisWeek;
            distributedThisWeek = 0;
            lastRecordedWeek = w;
            emit DistributedRecorded(0, w);
        }
    }

    function _recordDistribution(uint256 amount) internal {
        uint64 w = _week();
        if (w != lastRecordedWeek) {
            lastWeekDistributed = distributedThisWeek;
            distributedThisWeek = 0;
            lastRecordedWeek = w;
        }
        distributedThisWeek += amount;
        totalDistributed += amount;
        emit DistributedRecorded(amount, w);
    }

    function _isCollectionEligible(address coll) internal view returns (bool) {
        return BiggiCollectionEligibilityLib.isTokenRewardsEligible(
            coll,
            address(mainNFT),
            address(main2NFT),
            allowedCollections[coll],
            registry
        );
    }

    function isAllowedCollection(address coll) external view returns (bool) {
        return _isCollectionEligible(coll);
    }

    function isRegistryModeEnabled() external view returns (bool) {
        return registry != address(0);
    }

    function isLegacyCollectionAllowed(address coll) external view returns (bool) {
        if (coll == address(mainNFT)) return true;
        if (address(main2NFT) != address(0) && coll == address(main2NFT)) return true;
        return allowedCollections[coll];
    }
}
