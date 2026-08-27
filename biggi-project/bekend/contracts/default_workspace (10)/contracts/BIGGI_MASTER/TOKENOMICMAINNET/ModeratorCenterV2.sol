// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

interface IBiggiTicketHubModeratorV2 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isTicket(uint256 tokenId) external view returns (bool);
    function ticketChapterId(uint256 tokenId) external view returns (uint256);
    function chapterExists(uint256 chapterId) external view returns (bool);
    function chapterTotalCap(uint256 chapterId) external view returns (uint16);
    function chapterTotalMinted(uint256 chapterId) external view returns (uint256);
    function chapterMarketingCap(uint256 chapterId) external view returns (uint16);
    function chapterMarketingMinted(uint256 chapterId) external view returns (uint16);
    function chapterSaleCap(uint256 chapterId) external view returns (uint16);
    function chapterSaleMinted(uint256 chapterId) external view returns (uint16);
}

error ModeratorInvalidAddress();
error ModeratorInvalidSlot();
error ModeratorInvalidCoefficients();
error ModeratorDuplicateReferral();
error ModeratorLeaderAlreadyConfigured();
error ModeratorSlotIncomplete();
error ModeratorSlotReplacementRequired();
error ModeratorOperationalConfigInvalid();
error ModeratorReferralNotFound();
error ModeratorChapterInvalid();
error ModeratorChapterAlreadyRegistered();
error ModeratorChapterNotReady();
error ModeratorTicketInvalid();
error ModeratorTicketNotPaid();
error ModeratorTicketAlreadyAttributed();
error ModeratorTicketOwnerMismatch();
error ModeratorSignatureExpired();
error ModeratorSignatureInvalid();
error ModeratorWrongWeek();
error ModeratorOnlyAllocator();
error ModeratorZeroValue();
error ModeratorWeekNotOpen();
error ModeratorWeekNotClosed();
error ModeratorWeekAlreadySettled();
error ModeratorNothingToClaim();
error ModeratorMilestonesLocked();
error ModeratorMilestoneUnavailable();
error ModeratorInsufficientMilestoneBudget();
error ModeratorInsufficientSurplus();
error ModeratorDirectNativeDisabled();

/**
 * @title ModeratorCenterV2
 * @notice Verifiable referral accounting and weekly POL rewards for ten moderator slots.
 * @dev Keeps the original relative-weight model while removing trusted sale reports,
 *      mutable historical settlement and push-payment failure coupling.
 */
contract ModeratorCenterV2 is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using Address for address payable;

    uint8 public constant TOTAL_SLOTS = 10;
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant WEEK = 1 weeks;
    uint256 public constant SETTLEMENT_DELAY = 1 days;

    bytes32 public constant TICKET_REFERRAL_TYPEHASH = keccak256(
        "TicketReferral(uint256 ticketId,address buyer,bytes32 referralHash,uint256 week,uint256 deadline)"
    );

    struct SlotConfig {
        bool enabled;
        bool isLeader;
        address payout;
        bytes32 referralHash;
        uint64 generation;
    }

    struct WeightConfig {
        uint256 leaderCoef;
        uint256 moderatorCoef;
        uint256 saleBoost;
        bool globalUnique;
    }

    struct RegisteredChapter {
        bool registered;
        uint256 firstPaidTicketId;
        uint256 lastPaidTicketId;
        uint16 saleCap;
        uint16 marketingCap;
    }

    struct TicketAttribution {
        uint256 week;
        uint256 chapterId;
        address buyer;
        uint8 slotId;
    }

    struct MilestoneAward {
        address beneficiary;
        uint256 amount;
        bool achieved;
        bool funded;
    }

    IBiggiTicketHubModeratorV2 public immutable ticketHub;

    uint64 public currentConfigVersion = 1;
    mapping(uint64 => WeightConfig) private _weightConfigs;
    mapping(uint64 => mapping(uint8 => SlotConfig)) private _slotConfigs;

    mapping(uint256 => RegisteredChapter) public registeredChapters;
    uint256 public registeredChapterCount;
    mapping(uint256 => TicketAttribution) public ticketAttributions;
    mapping(uint256 => bool) public usedTicket;

    mapping(uint256 => mapping(uint8 => uint256)) public weekUniqueCount;
    mapping(uint256 => mapping(uint8 => uint256)) public weekTicketCount;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public usedThisWeekForSlot;
    mapping(uint256 => mapping(address => bool)) public usedThisWeekGlobally;

    mapping(uint8 => mapping(uint64 => uint256)) public generationTicketSales;
    uint256 public totalAttributedTickets;

    address public multiCollection;
    mapping(uint256 => uint64) public weekConfigVersion;
    mapping(uint256 => uint256) public weekAllocated;
    mapping(uint256 => uint256) public weekDistributed;
    mapping(uint256 => uint256) public weekRolledOver;
    mapping(uint256 => bool) public weekSettled;
    uint256 public pendingRollover;
    uint256 public totalAllocatedOutstanding;

    mapping(address => uint256) public claimable;
    uint256 public totalClaimable;

    uint256 public milestone100;
    uint256 public milestone500;
    uint256 public milestone1000;
    bool public milestoneConfigLocked;
    uint256 public milestoneBudget;
    mapping(uint8 => mapping(uint64 => mapping(uint256 => MilestoneAward))) public milestoneAwards;

    event ConfigVersionCreated(uint64 indexed version, uint256 indexed earliestEffectiveWeek);
    event SlotConfigured(uint8 indexed slotId, address payout, bool isLeader);
    event SlotStatusConfigured(
        uint8 indexed slotId,
        uint64 indexed generation,
        bool enabled,
        bool isLeader,
        address payout,
        bytes32 referralHash,
        uint64 configVersion
    );
    event ReferralSet(uint8 indexed slotId, bytes32 referralHash);
    event CoefsUpdated(uint256 leaderBps, uint256 moderatorBps, uint256 saleBoostBps);
    event GlobalUniquePerWeekSet(bool enabled);
    event MultiCollectionSet(address indexed oldAddr, address indexed newAddr);
    event ChapterRegistered(
        uint256 indexed chapterId,
        uint256 firstPaidTicketId,
        uint256 lastPaidTicketId,
        uint16 saleCap,
        uint16 marketingCap
    );
    event EpochOpened(uint256 indexed week, uint64 indexed configVersion, uint256 rolloverApplied);
    event ReferralRegistered(uint8 indexed slotId, address indexed referee, uint256 week);
    event TicketRecorded(
        uint8 indexed slotId,
        address indexed buyer,
        uint256 indexed ticketId,
        uint256 chapterId,
        uint256 week
    );
    event AllocationReceived(uint256 indexed week, uint256 amount);
    event WeekAllocationConsumed(
        uint256 indexed week,
        uint256 amount,
        uint256 totalWeekDistributed,
        uint256 totalOutstanding
    );
    event WeekRolledOver(uint256 indexed week, uint256 amount, uint256 pendingRollover);
    event WeeklyDistributed(uint256 indexed week, uint256 totalDistributed);
    event RewardCredited(uint256 indexed week, uint8 indexed slotId, address indexed payout, uint256 amount);
    event RewardClaimed(address indexed beneficiary, address indexed to, uint256 amount);
    event MilestoneSet(uint256 m100, uint256 m500, uint256 m1000);
    event MilestoneConfigLocked();
    event MilestoneBudgetFunded(address indexed from, uint256 amount, uint256 budget);
    event MilestoneAchieved(
        uint8 indexed slotId,
        uint64 indexed generation,
        uint256 indexed threshold,
        address beneficiary,
        uint256 amount
    );
    event MilestonePaid(uint8 indexed slotId, uint256 threshold, uint256 amount);
    event MilestoneCredited(
        uint8 indexed slotId,
        uint64 indexed generation,
        uint256 indexed threshold,
        address beneficiary,
        uint256 amount
    );
    event SurplusWithdrawn(address indexed to, uint256 amount);

    modifier validSlot(uint8 slotId) {
        if (slotId >= TOTAL_SLOTS) revert ModeratorInvalidSlot();
        _;
    }

    modifier onlyMultiCollection() {
        if (msg.sender != multiCollection) revert ModeratorOnlyAllocator();
        _;
    }

    constructor(address initialOwner, address ticketHub_)
        Ownable(initialOwner)
        EIP712("Biggi Moderator Center", "2")
    {
        if (initialOwner == address(0) || ticketHub_ == address(0)) {
            revert ModeratorInvalidAddress();
        }
        ticketHub = IBiggiTicketHubModeratorV2(ticketHub_);
        _weightConfigs[1] = WeightConfig({
            leaderCoef: 100,
            moderatorCoef: 30,
            saleBoost: 10,
            globalUnique: true
        });
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            _slotConfigs[1][i].generation = 1;
        }
        _pause();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        if (!_isOperationalConfigurationValid(currentConfigVersion)) {
            revert ModeratorOperationalConfigInvalid();
        }
        _unpause();
    }

    function configureSlot(
        uint8 slotId,
        bool enabled,
        bool isLeader,
        address payout
    ) external onlyOwner validSlot(slotId) {
        SlotConfig storage previous = _slotConfigs[currentConfigVersion][slotId];
        if (previous.payout != address(0) && payout != previous.payout) {
            revert ModeratorSlotReplacementRequired();
        }
        uint64 version = _forkConfig();
        SlotConfig storage config = _slotConfigs[version][slotId];
        config.enabled = enabled;
        config.isLeader = isLeader;
        config.payout = payout;
        _validateSlotConfiguration(version, slotId);
        _validateRunningConfiguration(version);
        _emitSlotConfigured(version, slotId);
    }

    function setReferralHash(uint8 slotId, bytes32 referralHash) external onlyOwner validSlot(slotId) {
        if (referralHash == bytes32(0)) revert ModeratorSlotIncomplete();
        bytes32 previousReferral = _slotConfigs[currentConfigVersion][slotId].referralHash;
        if (previousReferral != bytes32(0) && previousReferral != referralHash) {
            revert ModeratorSlotReplacementRequired();
        }
        uint64 version = _forkConfig();
        _requireUniqueReferral(version, slotId, referralHash);
        _slotConfigs[version][slotId].referralHash = referralHash;
        _validateSlotConfiguration(version, slotId);
        _validateRunningConfiguration(version);
        emit ReferralSet(slotId, referralHash);
        _emitSlotConfigured(version, slotId);
    }

    function setPayoutAddress(uint8 slotId, address payout) external onlyOwner validSlot(slotId) {
        if (payout == address(0)) revert ModeratorInvalidAddress();
        address previousPayout = _slotConfigs[currentConfigVersion][slotId].payout;
        if (previousPayout != address(0) && previousPayout != payout) {
            revert ModeratorSlotReplacementRequired();
        }
        uint64 version = _forkConfig();
        _slotConfigs[version][slotId].payout = payout;
        _validateSlotConfiguration(version, slotId);
        _validateRunningConfiguration(version);
        _emitSlotConfigured(version, slotId);
    }

    function replaceSlot(
        uint8 slotId,
        bool enabled,
        bool isLeader,
        address payout,
        bytes32 referralHash
    ) external onlyOwner validSlot(slotId) {
        SlotConfig storage oldConfig = _slotConfigs[currentConfigVersion][slotId];
        if (oldConfig.enabled) revert ModeratorSlotIncomplete();

        uint64 version = _forkConfig();
        SlotConfig storage config = _slotConfigs[version][slotId];
        config.generation += 1;
        config.enabled = enabled;
        config.isLeader = isLeader;
        config.payout = payout;
        config.referralHash = referralHash;
        if (referralHash != bytes32(0)) _requireUniqueReferral(version, slotId, referralHash);
        _validateSlotConfiguration(version, slotId);
        _validateRunningConfiguration(version);
        _emitSlotConfigured(version, slotId);
    }

    function setCoefs(
        uint256 leaderBps,
        uint256 moderatorBps,
        uint256 saleBoostBpsPerTicket_
    ) external onlyOwner {
        if (
            leaderBps > BPS_DENOM ||
            moderatorBps > BPS_DENOM ||
            saleBoostBpsPerTicket_ > BPS_DENOM ||
            (leaderBps == 0 && moderatorBps == 0 && saleBoostBpsPerTicket_ == 0)
        ) revert ModeratorInvalidCoefficients();

        uint64 version = _forkConfig();
        _weightConfigs[version].leaderCoef = leaderBps;
        _weightConfigs[version].moderatorCoef = moderatorBps;
        _weightConfigs[version].saleBoost = saleBoostBpsPerTicket_;
        emit CoefsUpdated(leaderBps, moderatorBps, saleBoostBpsPerTicket_);
    }

    function setGlobalUniquePerWeek(bool enabled) external onlyOwner {
        uint64 version = _forkConfig();
        _weightConfigs[version].globalUnique = enabled;
        emit GlobalUniquePerWeekSet(enabled);
    }

    function setMilestones(uint256 m100, uint256 m500, uint256 m1000) external onlyOwner {
        if (milestoneConfigLocked) revert ModeratorMilestonesLocked();
        milestone100 = m100;
        milestone500 = m500;
        milestone1000 = m1000;
        emit MilestoneSet(m100, m500, m1000);
    }

    function lockMilestoneConfig() external onlyOwner {
        _lockMilestoneConfig();
    }

    function setMultiCollection(address allocator) external onlyOwner whenPaused {
        if (allocator == address(0)) revert ModeratorInvalidAddress();
        emit MultiCollectionSet(multiCollection, allocator);
        multiCollection = allocator;
    }

    function registerChapter(uint256 chapterId) external onlyOwner {
        if (chapterId == 0 || !ticketHub.chapterExists(chapterId)) revert ModeratorChapterInvalid();
        if (registeredChapters[chapterId].registered) revert ModeratorChapterAlreadyRegistered();

        uint16 totalCap = ticketHub.chapterTotalCap(chapterId);
        uint16 marketingCap = ticketHub.chapterMarketingCap(chapterId);
        uint16 marketingMinted = ticketHub.chapterMarketingMinted(chapterId);
        uint16 saleCap = ticketHub.chapterSaleCap(chapterId);
        uint16 saleMinted = ticketHub.chapterSaleMinted(chapterId);
        uint256 totalMinted = ticketHub.chapterTotalMinted(chapterId);

        if (
            totalCap == 0 ||
            saleCap == 0 ||
            uint256(marketingCap) + uint256(saleCap) != uint256(totalCap) ||
            marketingMinted != marketingCap ||
            saleMinted != 0 ||
            totalMinted != uint256(marketingMinted)
        ) revert ModeratorChapterNotReady();

        uint256 chapterBase = ((chapterId - 1) * uint256(totalCap)) + 1;
        uint256 firstPaidTicketId = chapterBase + uint256(marketingCap);
        uint256 lastPaidTicketId = firstPaidTicketId + uint256(saleCap) - 1;

        registeredChapters[chapterId] = RegisteredChapter({
            registered: true,
            firstPaidTicketId: firstPaidTicketId,
            lastPaidTicketId: lastPaidTicketId,
            saleCap: saleCap,
            marketingCap: marketingCap
        });
        registeredChapterCount += 1;

        emit ChapterRegistered(chapterId, firstPaidTicketId, lastPaidTicketId, saleCap, marketingCap);
    }

    function attributeTicket(uint256 ticketId, bytes32 referralHash)
        external
        nonReentrant
        whenNotPaused
    {
        _attributeTicket(ticketId, msg.sender, referralHash, _currentWeek());
    }

    function attributeTicketBySig(
        uint256 ticketId,
        address buyer,
        bytes32 referralHash,
        uint256 week,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert ModeratorSignatureExpired();
        if (week != _currentWeek()) revert ModeratorWrongWeek();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(TICKET_REFERRAL_TYPEHASH, ticketId, buyer, referralHash, week, deadline))
        );
        if (!SignatureChecker.isValidSignatureNow(buyer, digest, signature)) {
            revert ModeratorSignatureInvalid();
        }
        _attributeTicket(ticketId, buyer, referralHash, week);
    }

    function referralDigest(
        uint256 ticketId,
        address buyer,
        bytes32 referralHash,
        uint256 week,
        uint256 deadline
    ) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(TICKET_REFERRAL_TYPEHASH, ticketId, buyer, referralHash, week, deadline))
        );
    }

    function notifyAllocation() external payable onlyMultiCollection whenNotPaused {
        if (msg.value == 0) revert ModeratorZeroValue();
        uint256 week = _currentWeek();
        _openEpoch(week);
        weekAllocated[week] += msg.value;
        totalAllocatedOutstanding += msg.value;
        emit AllocationReceived(week, msg.value);
    }

    function settleWeek(uint256 week) external nonReentrant {
        _settleWeek(week);
    }

    function distributeWeekRewards() external nonReentrant {
        uint256 current = _currentWeek();
        if (current == 0) revert ModeratorWeekNotClosed();
        _settleWeek(current - 1);
    }

    function distributeWeekRewardsForWeek(uint256 week) external nonReentrant {
        _settleWeek(week);
    }

    function claim() external nonReentrant {
        _claim(msg.sender, payable(msg.sender));
    }

    function claimTo(address payable to) external nonReentrant {
        if (to == address(0)) revert ModeratorInvalidAddress();
        _claim(msg.sender, to);
    }

    function claimFor(address beneficiary) external nonReentrant {
        if (beneficiary == address(0)) revert ModeratorInvalidAddress();
        _claim(beneficiary, payable(beneficiary));
    }

    function fundMilestones() external payable {
        if (msg.value == 0) revert ModeratorZeroValue();
        milestoneBudget += msg.value;
        emit MilestoneBudgetFunded(msg.sender, msg.value, milestoneBudget);
    }

    function settleMilestone(uint8 slotId, uint64 generation, uint256 threshold)
        external
        validSlot(slotId)
    {
        MilestoneAward storage award = milestoneAwards[slotId][generation][threshold];
        if (!award.achieved || award.funded || award.amount == 0) {
            revert ModeratorMilestoneUnavailable();
        }
        if (milestoneBudget < award.amount) revert ModeratorInsufficientMilestoneBudget();
        _creditMilestone(slotId, generation, threshold, award);
    }

    function withdrawSurplus(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ModeratorInvalidAddress();
        if (amount > surplusBalance()) revert ModeratorInsufficientSurplus();
        to.sendValue(amount);
        emit SurplusWithdrawn(to, amount);
    }

    function currentWeek() external view returns (uint256) {
        return _currentWeek();
    }

    function leaderCoefBps() external view returns (uint256) {
        return _weightConfigs[currentConfigVersion].leaderCoef;
    }

    function moderatorCoefBps() external view returns (uint256) {
        return _weightConfigs[currentConfigVersion].moderatorCoef;
    }

    function saleBoostBpsPerTicket() external view returns (uint256) {
        return _weightConfigs[currentConfigVersion].saleBoost;
    }

    function globalUniquePerWeek() external view returns (bool) {
        return _weightConfigs[currentConfigVersion].globalUnique;
    }

    function reporters(address) external pure returns (bool) {
        return false;
    }

    function slots(uint256 slotId)
        external
        view
        returns (
            bool enabled,
            bool isLeader,
            address payout,
            bytes32 passwordHash,
            bytes32 referralHash,
            uint256 cumulativeTicketSales
        )
    {
        if (slotId >= TOTAL_SLOTS) revert ModeratorInvalidSlot();
        SlotConfig storage config = _slotConfigs[currentConfigVersion][uint8(slotId)];
        return (
            config.enabled,
            config.isLeader,
            config.payout,
            bytes32(0),
            config.referralHash,
            generationTicketSales[uint8(slotId)][config.generation]
        );
    }

    function getSlotInfo(uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (bool enabled, bool isLeader, address payout, bytes32 referralHash, uint256 cumulativeSales)
    {
        SlotConfig storage config = _slotConfigs[currentConfigVersion][slotId];
        return (
            config.enabled,
            config.isLeader,
            config.payout,
            config.referralHash,
            generationTicketSales[slotId][config.generation]
        );
    }

    function getSlotGeneration(uint8 slotId) external view validSlot(slotId) returns (uint64) {
        return _slotConfigs[currentConfigVersion][slotId].generation;
    }

    function getWeekSlotConfig(uint256 week, uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (SlotConfig memory)
    {
        uint64 version = weekConfigVersion[week];
        if (version == 0) revert ModeratorWeekNotOpen();
        return _slotConfigs[version][slotId];
    }

    function getWeekStats(uint256 week, uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (uint256 uniqueRefs, uint256 ticketSales, uint256 allocatedWei)
    {
        return (weekUniqueCount[week][slotId], weekTicketCount[week][slotId], weekAllocated[week]);
    }

    function getWeekWeight(uint256 week, uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (uint256)
    {
        uint64 version = weekConfigVersion[week];
        if (version == 0) return 0;
        return _weightForSlot(week, slotId, version);
    }

    function allocatedBalanceForWeek(uint256 week)
        external
        view
        returns (uint256 allocated, uint256 distributed, uint256 remaining)
    {
        allocated = weekAllocated[week];
        distributed = weekDistributed[week];
        remaining = weekSettled[week] ? 0 : allocated;
    }

    function milestonePaid(uint8 slotId, uint256 threshold)
        external
        view
        validSlot(slotId)
        returns (bool)
    {
        uint64 generation = _slotConfigs[currentConfigVersion][slotId].generation;
        return milestoneAwards[slotId][generation][threshold].funded;
    }

    function totalLiabilities() public view returns (uint256) {
        return totalAllocatedOutstanding + totalClaimable + milestoneBudget;
    }

    function operationallyReady() external view returns (bool) {
        return _isOperationalConfigurationValid(currentConfigVersion);
    }

    function surplusBalance() public view returns (uint256) {
        uint256 liabilities = totalLiabilities();
        uint256 balance = address(this).balance;
        return balance > liabilities ? balance - liabilities : 0;
    }

    function unallocatedBalance() external view returns (uint256) {
        return surplusBalance();
    }

    function _attributeTicket(
        uint256 ticketId,
        address buyer,
        bytes32 referralHash,
        uint256 week
    ) internal {
        if (buyer == address(0) || referralHash == bytes32(0)) revert ModeratorInvalidAddress();
        if (usedTicket[ticketId]) revert ModeratorTicketAlreadyAttributed();

        _openEpoch(week);
        uint64 version = weekConfigVersion[week];
        uint8 slotId = _slotForReferral(version, referralHash);

        if (!ticketHub.isTicket(ticketId)) revert ModeratorTicketInvalid();
        uint256 chapterId = ticketHub.ticketChapterId(ticketId);
        RegisteredChapter storage chapter = registeredChapters[chapterId];
        if (!chapter.registered) revert ModeratorChapterInvalid();
        if (ticketId < chapter.firstPaidTicketId || ticketId > chapter.lastPaidTicketId) {
            revert ModeratorTicketNotPaid();
        }
        if (ticketHub.ownerOf(ticketId) != buyer) revert ModeratorTicketOwnerMismatch();

        usedTicket[ticketId] = true;
        ticketAttributions[ticketId] = TicketAttribution({
            week: week,
            chapterId: chapterId,
            buyer: buyer,
            slotId: slotId
        });

        weekTicketCount[week][slotId] += 1;
        SlotConfig storage slotConfig = _slotConfigs[version][slotId];
        uint64 generation = slotConfig.generation;
        generationTicketSales[slotId][generation] += 1;
        totalAttributedTickets += 1;

        bool canCountUnique = !usedThisWeekForSlot[week][slotId][buyer];
        if (canCountUnique && _weightConfigs[version].globalUnique && usedThisWeekGlobally[week][buyer]) {
            canCountUnique = false;
        }

        if (canCountUnique) {
            usedThisWeekForSlot[week][slotId][buyer] = true;
            weekUniqueCount[week][slotId] += 1;
            if (_weightConfigs[version].globalUnique) usedThisWeekGlobally[week][buyer] = true;
            emit ReferralRegistered(slotId, buyer, week);
        }

        if (!milestoneConfigLocked) _lockMilestoneConfig();
        emit TicketRecorded(slotId, buyer, ticketId, chapterId, week);
        _tryMilestones(slotId, generation, slotConfig.payout);
    }

    function _settleWeek(uint256 week) internal {
        uint64 version = weekConfigVersion[week];
        if (version == 0) revert ModeratorWeekNotOpen();
        if (block.timestamp < ((week + 1) * WEEK) + SETTLEMENT_DELAY) {
            revert ModeratorWeekNotClosed();
        }
        if (weekSettled[week]) revert ModeratorWeekAlreadySettled();

        weekSettled[week] = true;
        uint256 pool = weekAllocated[week];
        uint256[TOTAL_SLOTS] memory weights;
        uint256 totalWeight;
        uint8 remainderSlot;
        uint256 largestWeight;

        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            uint256 weight = _weightForSlot(week, i, version);
            weights[i] = weight;
            totalWeight += weight;
            if (weight > largestWeight) {
                largestWeight = weight;
                remainderSlot = i;
            }
        }

        if (pool == 0) {
            emit WeeklyDistributed(week, 0);
            return;
        }

        if (totalWeight == 0) {
            weekRolledOver[week] = pool;
            pendingRollover += pool;
            emit WeekRolledOver(week, pool, pendingRollover);
            return;
        }

        uint256 credited;
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            if (weights[i] == 0) continue;
            uint256 share = (pool * weights[i]) / totalWeight;
            if (share == 0) continue;
            _creditWeekReward(week, i, version, share);
            credited += share;
        }

        uint256 remainder = pool - credited;
        if (remainder > 0) {
            _creditWeekReward(week, remainderSlot, version, remainder);
            credited += remainder;
        }

        weekDistributed[week] = credited;
        totalAllocatedOutstanding -= credited;
        totalClaimable += credited;
        emit WeekAllocationConsumed(week, credited, credited, totalAllocatedOutstanding);
        emit WeeklyDistributed(week, credited);
    }

    function _creditWeekReward(
        uint256 week,
        uint8 slotId,
        uint64 version,
        uint256 amount
    ) internal {
        address payout = _slotConfigs[version][slotId].payout;
        claimable[payout] += amount;
        emit RewardCredited(week, slotId, payout, amount);
    }

    function _claim(address beneficiary, address payable to) internal {
        uint256 amount = claimable[beneficiary];
        if (amount == 0) revert ModeratorNothingToClaim();
        claimable[beneficiary] = 0;
        totalClaimable -= amount;
        to.sendValue(amount);
        emit RewardClaimed(beneficiary, to, amount);
    }

    function _tryMilestones(uint8 slotId, uint64 generation, address beneficiary) internal {
        uint256 sales = generationTicketSales[slotId][generation];
        _tryMilestone(slotId, generation, 100, milestone100, sales, beneficiary);
        _tryMilestone(slotId, generation, 500, milestone500, sales, beneficiary);
        _tryMilestone(slotId, generation, 1000, milestone1000, sales, beneficiary);
    }

    function _tryMilestone(
        uint8 slotId,
        uint64 generation,
        uint256 threshold,
        uint256 amount,
        uint256 sales,
        address beneficiary
    ) internal {
        if (amount == 0 || sales < threshold) return;
        MilestoneAward storage award = milestoneAwards[slotId][generation][threshold];
        if (!award.achieved) {
            award.achieved = true;
            award.beneficiary = beneficiary;
            award.amount = amount;
            emit MilestoneAchieved(slotId, generation, threshold, beneficiary, amount);
        }
        if (!award.funded && milestoneBudget >= award.amount) {
            _creditMilestone(slotId, generation, threshold, award);
        }
    }

    function _creditMilestone(
        uint8 slotId,
        uint64 generation,
        uint256 threshold,
        MilestoneAward storage award
    ) internal {
        award.funded = true;
        milestoneBudget -= award.amount;
        claimable[award.beneficiary] += award.amount;
        totalClaimable += award.amount;
        emit MilestonePaid(slotId, threshold, award.amount);
        emit MilestoneCredited(slotId, generation, threshold, award.beneficiary, award.amount);
    }

    function _lockMilestoneConfig() internal {
        if (milestoneConfigLocked) return;
        milestoneConfigLocked = true;
        emit MilestoneConfigLocked();
    }

    function _openEpoch(uint256 week) internal {
        if (weekConfigVersion[week] != 0) return;
        uint64 version = currentConfigVersion;
        weekConfigVersion[week] = version;
        uint256 rollover = pendingRollover;
        if (rollover > 0) {
            pendingRollover = 0;
            weekAllocated[week] += rollover;
        }
        emit EpochOpened(week, version, rollover);
    }

    function _weightForSlot(uint256 week, uint8 slotId, uint64 version)
        internal
        view
        returns (uint256)
    {
        SlotConfig storage config = _slotConfigs[version][slotId];
        if (!config.enabled) return 0;
        uint256 uniqueCount = weekUniqueCount[week][slotId];
        if (uniqueCount == 0) return 0;
        WeightConfig storage weights = _weightConfigs[version];
        uint256 baseCoef = config.isLeader ? weights.leaderCoef : weights.moderatorCoef;
        uint256 effectiveCoef = baseCoef + (weights.saleBoost * weekTicketCount[week][slotId]);
        return uniqueCount * effectiveCoef;
    }

    function _slotForReferral(uint64 version, bytes32 referralHash) internal view returns (uint8) {
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            SlotConfig storage config = _slotConfigs[version][i];
            if (config.referralHash == referralHash) {
                if (!config.enabled) revert ModeratorSlotIncomplete();
                return i;
            }
        }
        revert ModeratorReferralNotFound();
    }

    function _forkConfig() internal returns (uint64 version) {
        uint64 previous = currentConfigVersion;
        version = previous + 1;
        currentConfigVersion = version;
        _weightConfigs[version] = _weightConfigs[previous];
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            _slotConfigs[version][i] = _slotConfigs[previous][i];
        }
        uint256 current = _currentWeek();
        uint256 earliest = weekConfigVersion[current] == 0 ? current : current + 1;
        emit ConfigVersionCreated(version, earliest);
    }

    function _validateSlotConfiguration(uint64 version, uint8 slotId) internal view {
        SlotConfig storage config = _slotConfigs[version][slotId];
        if (config.enabled && (config.payout == address(0) || config.referralHash == bytes32(0))) {
            revert ModeratorSlotIncomplete();
        }
        if (config.referralHash != bytes32(0)) {
            _requireUniqueReferral(version, slotId, config.referralHash);
        }
        if (config.enabled && config.isLeader) {
            for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
                if (i == slotId) continue;
                SlotConfig storage other = _slotConfigs[version][i];
                if (other.enabled && other.isLeader) revert ModeratorLeaderAlreadyConfigured();
            }
        }
    }

    function _validateRunningConfiguration(uint64 version) internal view {
        if (!paused() && !_isOperationalConfigurationValid(version)) {
            revert ModeratorOperationalConfigInvalid();
        }
    }

    function _isOperationalConfigurationValid(uint64 version) internal view returns (bool) {
        if (
            multiCollection == address(0) ||
            !milestoneConfigLocked ||
            registeredChapterCount == 0
        ) return false;

        uint8 enabledCount;
        uint8 leaderCount;
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            SlotConfig storage config = _slotConfigs[version][i];
            if (!config.enabled) continue;
            if (config.payout == address(0) || config.referralHash == bytes32(0)) return false;
            enabledCount += 1;
            if (config.isLeader) leaderCount += 1;
        }
        return enabledCount > 0 && leaderCount == 1;
    }

    function _requireUniqueReferral(uint64 version, uint8 slotId, bytes32 referralHash) internal view {
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            if (i != slotId && _slotConfigs[version][i].referralHash == referralHash) {
                revert ModeratorDuplicateReferral();
            }
        }
    }

    function _emitSlotConfigured(uint64 version, uint8 slotId) internal {
        SlotConfig storage config = _slotConfigs[version][slotId];
        emit SlotConfigured(slotId, config.payout, config.isLeader);
        emit SlotStatusConfigured(
            slotId,
            config.generation,
            config.enabled,
            config.isLeader,
            config.payout,
            config.referralHash,
            version
        );
    }

    function _currentWeek() internal view returns (uint256) {
        return block.timestamp / WEEK;
    }

    receive() external payable {
        revert ModeratorDirectNativeDisabled();
    }

    fallback() external payable {
        revert ModeratorDirectNativeDisabled();
    }
}
