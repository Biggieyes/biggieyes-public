// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./BiggiCapsLib.sol";

/// @notice Main NFT must implement blockOf(tokenId) -> 1..10
interface IBiggiMainNFT is IERC721 {
    function blockOf(uint256 tokenId) external view returns (uint16);
}

/// @notice Minimal BIGGI token interface we expect
interface IBiggiToken is IERC20, IERC20Metadata {
    function mint(address to, uint256 amount) external;
    function remainingMintable() external view returns (uint256);
}

contract BiggiTokenRewards is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error NoEligibleTokens();
    error CapExceeded();
    error ArrayLengthMismatch();
    error InvalidCollection();

    IBiggiMainNFT public mainNFT;   // primary main collection
    IBiggiMainNFT public main2NFT;  // optional second main (legacy support)
    IBiggiToken    public immutable biggi;

    address public treasure; // optional top-up address (allowed to transferFrom)

    // reward parameters
    uint256 public unitReward = 1e18; // 1 BIGGI (in wei units)
    uint8[11] public blockWeight = [0,10,20,30,40,50,60,70,80,90,100];

    // cap for minting from this contract (keeps reward inflation bounded)
    uint256 public immutable rewardsCap = BiggiCapsLib.TOKEN_REWARDS_CAP;
    uint256 public rewardsMinted;

    // accounting for weekly distribution (FE helpers)
    uint256 public totalDistributed;         // all-time distributed by transfers/mints
    uint256 public distributedThisWeek;      // distribution in current week
    uint256 public lastWeekDistributed;      // distribution in previous week
    uint64  public lastRecordedWeek;         // which week distributedThisWeek belongs to

    // per-user / per-token tracking
    mapping(address => uint64) public lastUserClaimWeek;
    // track per-collection & per-token -> tokenLastClaimWeek[collection][tokenId]
    mapping(address => mapping(uint256 => uint64)) public tokenLastClaimWeek;

    // allowed extra collections (besides mainNFT & main2NFT)
    mapping(address => bool) public allowedCollections;

    event Claimed(address indexed user, uint256 units, uint256 paidFromBalance, uint256 minted);
    event UnitRewardSet(uint256 oldVal, uint256 newVal);
    event BlockWeightsSet(uint8[11] weights);
    event TreasureSet(address indexed oldTreasure, address indexed newTreasure);
    event TopUpPulled(address indexed from, uint256 amount);
    event DistributedRecorded(uint256 amount, uint64 weekNow);
    event CollectionAllowedSet(address indexed coll, bool allowed);
    event MainNFTSet(address indexed oldAddr, address indexed newAddr);
    event Main2NFTSet(address indexed oldAddr, address indexed newAddr);

    constructor(address mainNFT_, address main2NFT_, address biggiToken_, address owner_) Ownable(owner_) {
        if (mainNFT_ == address(0) || main2NFT_ == address(0) || biggiToken_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        mainNFT  = IBiggiMainNFT(mainNFT_);
        main2NFT = IBiggiMainNFT(main2NFT_);
        biggi    = IBiggiToken(biggiToken_);
        lastRecordedWeek = _week();
        emit MainNFTSet(address(0), mainNFT_);
        emit Main2NFTSet(address(0), main2NFT_);
    }

    /* ===== admin ===== */
    function pauseAll() external onlyOwner { _pause(); }
    function unpauseAll() external onlyOwner { _unpause(); }

    function setTreasure(address treasure_) external onlyOwner {
        if (treasure_ == address(0)) revert ZeroAddress();
        emit TreasureSet(treasure, treasure_);
        treasure = treasure_;
    }

    function setMainNFT(address newMain) external onlyOwner {
        if (newMain == address(0)) revert ZeroAddress();
        emit MainNFTSet(address(mainNFT), newMain);
        mainNFT = IBiggiMainNFT(newMain);
    }

    function setMain2NFT(address newMain2) external onlyOwner {
        if (newMain2 == address(0)) revert ZeroAddress();
        emit Main2NFTSet(address(main2NFT), newMain2);
        main2NFT = IBiggiMainNFT(newMain2);
    }

    function setUnitReward(uint256 newUnit) external onlyOwner {
        emit UnitRewardSet(unitReward, newUnit);
        unitReward = newUnit;
    }

    function setBlockWeights(uint8[11] calldata weights) external onlyOwner {
        blockWeight = weights;
        emit BlockWeightsSet(weights);
    }

    /// @notice Register or unregister an extra collection (multicollection support).
    /// Only registered collections (or mainNFT/main2NFT) are allowed in claimWithCollections.
    function setCollectionAllowed(address coll, bool allowed) external onlyOwner {
        require(coll != address(0), "zero");
        allowedCollections[coll] = allowed;
        emit CollectionAllowedSet(coll, allowed);
    }

    /* ===== top-up from treasure (optional) ===== */
    /// @notice Treasure (external account/contract) can push BIGGI to this contract
    function topUpFromTreasure(uint256 amount) external nonReentrant {
        require(msg.sender == treasure, "not treasure");
        IERC20(address(biggi)).safeTransferFrom(msg.sender, address(this), amount);
        emit TopUpPulled(msg.sender, amount);
    }

    /* ===== claim (legacy single-collection API) ===== */
    /// @notice Claim rewards for given tokenIds (one claim per token per week) — legacy single-collection API (mainNFT)
    function claim(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        _ensureWeekRoll();
        (uint256 units, ) = _calcUnitsSingle(address(mainNFT), tokenIds);
        _payout(units, msg.sender);
    }

    /// @notice Claim rewards for tokens that may belong to multiple collections.
    /// collections.length must equal tokenIds.length; each collection must be either mainNFT, main2NFT or registered via setCollectionAllowed.
    function claimWithCollections(address[] calldata collections, uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        _ensureWeekRoll();
        (uint256 units, ) = _calcUnitsMixed(collections, tokenIds);
        _payout(units, msg.sender);
    }

    function _payout(uint256 units, address to) internal {
        if (units == 0) revert NoEligibleTokens();

        uint256 amount = units * unitReward;

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

    /* Internal: update tokenLastClaimWeek and lastUserClaimWeek, return units and week */
    function _calcUnitsSingle(address collection, uint256[] calldata tokenIds) internal returns (uint256 units, uint64 weekNow) {
        // single collection (legacy)
        weekNow = _week();
        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                uint256 tid = tokenIds[i];
                // owner must own token in that collection
                if (IERC721(collection).ownerOf(tid) != msg.sender) continue;
                if (tokenLastClaimWeek[collection][tid] == weekNow) continue;
                uint16 blk = IBiggiMainNFT(collection).blockOf(tid);
                if (blk < 1 || blk > 10) continue;
                units += blockWeight[blk];
                tokenLastClaimWeek[collection][tid] = weekNow;
            }
        }
        if (units > 0) lastUserClaimWeek[msg.sender] = weekNow;
    }

    function _calcUnitsMixed(address[] calldata collections, uint256[] calldata tokenIds) internal returns (uint256 units, uint64 weekNow) {
        if (collections.length != tokenIds.length) revert ArrayLengthMismatch();
        weekNow = _week();
        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                address coll = collections[i];
                uint256 tid = tokenIds[i];

                // allow only mainNFT, main2NFT or registered collections
                if (!(coll == address(mainNFT) || coll == address(main2NFT) || allowedCollections[coll])) revert InvalidCollection();

                if (IERC721(coll).ownerOf(tid) != msg.sender) continue;
                if (tokenLastClaimWeek[coll][tid] == weekNow) continue;
                uint16 blk = IBiggiMainNFT(coll).blockOf(tid);
                if (blk < 1 || blk > 10) continue;
                units += blockWeight[blk];
                tokenLastClaimWeek[coll][tid] = weekNow;
            }
        }
        if (units > 0) lastUserClaimWeek[msg.sender] = weekNow;
    }

    /* ===== view helpers ===== */
    function tokenAddress() external view returns (address) { return address(biggi); }
    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        name_ = biggi.name(); symbol_ = biggi.symbol(); decimals_ = biggi.decimals();
    }
    function currentWeek() external view returns (uint64) { return _week(); }

    /// @notice next claim week for a token (FE friendly) — legacy single collection (mainNFT)
    function nextClaimWeekFor(uint256 tokenId) external view returns (uint64) {
        uint64 last = tokenLastClaimWeek[address(mainNFT)][tokenId];
        return last == 0 ? _week() : last + 1;
    }

    /// @notice next claim week for a token in a specified collection (any registered collection or main)
    function nextClaimWeekForCollection(address collection, uint256 tokenId) external view returns (uint64) {
        uint64 last = tokenLastClaimWeek[collection][tokenId];
        return last == 0 ? _week() : last + 1;
    }

    function remainingCap() external view returns (uint256) { return biggi.remainingMintable(); }

    function getBlockWeights() external view returns (uint8[11] memory w) { w = blockWeight; }

    function rewardsStats() external view returns (uint256 minted, uint256 cap_) { return (rewardsMinted, rewardsCap); }

    /// @notice Preview only: how much a list of tokenIds (in legacy mainNFT) would claim this week (view, no state change)
    function claimablePreview(uint256[] calldata tokenIds) external view returns (uint256 units, uint256 amount) {
        uint64 weekNow = _week();
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 tid = tokenIds[i];
            if (tokenLastClaimWeek[address(mainNFT)][tid] == weekNow) continue;
            uint16 blk = mainNFT.blockOf(tid);
            if (blk >= 1 && blk <= 10) units += blockWeight[blk];
        }
        amount = units * unitReward;
    }

    /// @notice Preview for mixed collections
    function claimablePreviewFor(address[] calldata collections, uint256[] calldata tokenIds) external view returns (uint256 units, uint256 amount) {
        if (collections.length != tokenIds.length) revert ArrayLengthMismatch();
        uint64 weekNow = _week();
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            address coll = collections[i];
            uint256 tid = tokenIds[i];
            if (!(coll == address(mainNFT) || coll == address(main2NFT) || allowedCollections[coll])) revert InvalidCollection();
            if (tokenLastClaimWeek[coll][tid] == weekNow) continue;
            uint16 blk = IBiggiMainNFT(coll).blockOf(tid);
            if (blk >= 1 && blk <= 10) units += blockWeight[blk];
        }
        amount = units * unitReward;
    }

    /* ===== internal bookkeeping helpers ===== */
    function _week() internal view returns (uint64) { return uint64(block.timestamp / 1 weeks); }

    function _ensureWeekRoll() internal {
        uint64 w = _week();
        if (w != lastRecordedWeek) {
            // roll week counters
            lastWeekDistributed = distributedThisWeek;
            distributedThisWeek = 0;
            lastRecordedWeek = w;
            emit DistributedRecorded(0, w);
        }
    }

    function _recordDistribution(uint256 amount) internal {
        // call _ensureWeekRoll before updating to make sure weekly bucket is correct
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

    /* ===== helpers ===== */
    function isAllowedCollection(address coll) external view returns (bool) {
        return (coll == address(mainNFT) || coll == address(main2NFT) || allowedCollections[coll]);
    }
}
