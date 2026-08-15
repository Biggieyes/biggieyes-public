// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract ModeratorCenter is Ownable, ReentrancyGuard {
    using Address for address payable;

    uint8 public constant TOTAL_SLOTS = 10;
    uint256 public constant BPS_DENOM = 10000;

    struct Slot {
        bool enabled;
        bool isLeader;
        address payout;
        bytes32 passwordHash;
        bytes32 referralHash;
        uint256 cumulativeTicketSales;
    }

    Slot[TOTAL_SLOTS] public slots;

    mapping(address => bool) public reporters;

    uint256 public leaderCoefBps = 100;
    uint256 public moderatorCoefBps = 30;
    uint256 public saleBoostBpsPerTicket = 10;

    uint256 public milestone100 = 0;
    uint256 public milestone500 = 0;
    uint256 public milestone1000 = 0;

    mapping(uint256 => mapping(uint8 => uint256)) public weekUniqueCount;
    mapping(uint256 => mapping(uint8 => uint256)) public weekTicketCount;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public usedThisWeekForSlot;
    bool public globalUniquePerWeek = true;
    mapping(uint256 => mapping(address => bool)) public usedThisWeekGlobally;
    mapping(uint8 => mapping(uint256 => bool)) public milestonePaid;

    address public multiCollection;
    mapping(uint256 => uint256) public weekAllocated;
    mapping(uint256 => uint256) public weekDistributed;
    uint256 public totalAllocatedOutstanding;

    event SlotConfigured(uint8 indexed slotId, address payout, bool isLeader);
    event PasswordSet(uint8 indexed slotId);
    event ReferralSet(uint8 indexed slotId, bytes32 referralHash);
    event ReporterSet(address indexed reporter, bool enabled);
    event ReferralRegistered(uint8 indexed slotId, address indexed referee, uint256 week);
    event TicketRecorded(uint8 indexed slotId, address indexed buyer, uint256 week);
    event WeeklyDistributed(uint256 indexed week, uint256 totalDistributed);
    event MilestonePaid(uint8 indexed slotId, uint256 threshold, uint256 amount);
    event CoefsUpdated(uint256 leaderBps, uint256 moderatorBps, uint256 saleBoostBps);
    event MilestoneSet(uint256 m100, uint256 m500, uint256 m1000);
    event GlobalUniquePerWeekSet(bool enabled);
    event PayoutWithdrawn(address indexed to, uint256 amount);
    event MultiCollectionSet(address indexed oldAddr, address indexed newAddr);
    event AllocationReceived(uint256 indexed week, uint256 amount);
    event WeekAllocationConsumed(uint256 indexed week, uint256 amount, uint256 totalWeekDistributed, uint256 totalOutstanding);

    modifier validSlot(uint8 slotId) {
        require(slotId < TOTAL_SLOTS, "bad slot");
        _;
    }

    modifier onlyMultiCollection() {
        require(msg.sender == multiCollection, "only multicollection");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function configureSlot(uint8 slotId, bool enabled, bool isLeader, address payout) external onlyOwner validSlot(slotId) {
        slots[slotId].enabled = enabled;
        slots[slotId].isLeader = isLeader;
        slots[slotId].payout = payout;
        emit SlotConfigured(slotId, payout, isLeader);
    }

    function setPasswordHash(uint8 slotId, bytes32 passwordHash) external onlyOwner validSlot(slotId) {
        slots[slotId].passwordHash = passwordHash;
        emit PasswordSet(slotId);
    }

    function setReferralHash(uint8 slotId, bytes32 referralHash) external onlyOwner validSlot(slotId) {
        require(referralHash != bytes32(0), "zero referral");
        slots[slotId].referralHash = referralHash;
        emit ReferralSet(slotId, referralHash);
    }

    function setPayoutAddress(uint8 slotId, address payout) external onlyOwner validSlot(slotId) {
        slots[slotId].payout = payout;
        emit SlotConfigured(slotId, payout, slots[slotId].isLeader);
    }

    function setReporter(address reporter, bool enabled) external onlyOwner {
        reporters[reporter] = enabled;
        emit ReporterSet(reporter, enabled);
    }

    function setCoefs(uint256 leaderBps, uint256 moderatorBps, uint256 saleBoostBpsPerTicket_) external onlyOwner {
        require(
            leaderBps <= BPS_DENOM &&
            moderatorBps <= BPS_DENOM &&
            saleBoostBpsPerTicket_ <= BPS_DENOM,
            "bad coefs"
        );
        leaderCoefBps = leaderBps;
        moderatorCoefBps = moderatorBps;
        saleBoostBpsPerTicket = saleBoostBpsPerTicket_;
        emit CoefsUpdated(leaderBps, moderatorBps, saleBoostBpsPerTicket_);
    }

    function setMilestones(uint256 m100, uint256 m500, uint256 m1000) external onlyOwner {
        milestone100 = m100;
        milestone500 = m500;
        milestone1000 = m1000;
        emit MilestoneSet(m100, m500, m1000);
    }

    function setGlobalUniquePerWeek(bool enabled) external onlyOwner {
        globalUniquePerWeek = enabled;
        emit GlobalUniquePerWeekSet(enabled);
    }

    function setMultiCollection(address mc) external onlyOwner {
        require(mc != address(0), "mc=0");
        emit MultiCollectionSet(multiCollection, mc);
        multiCollection = mc;
    }

    function registerReferral(bytes32 referralHash) external nonReentrant {
        require(referralHash != bytes32(0), "zero referral");
        uint8 slotId = _slotForReferral(referralHash);
        require(slots[slotId].enabled, "slot disabled");

        uint256 week = _currentWeek();

        if (globalUniquePerWeek) {
            require(!usedThisWeekGlobally[week][msg.sender], "addr used globally this week");
            usedThisWeekGlobally[week][msg.sender] = true;
        }

        require(!usedThisWeekForSlot[week][slotId][msg.sender], "addr used for slot this week");
        usedThisWeekForSlot[week][slotId][msg.sender] = true;

        weekUniqueCount[week][slotId] += 1;
        emit ReferralRegistered(slotId, msg.sender, week);
    }

    function recordTicketSale(bytes32 referralHash, address buyer) external nonReentrant {
        require(reporters[msg.sender], "not reporter");
        require(referralHash != bytes32(0), "zero referral");
        require(buyer != address(0), "buyer=0");
        uint8 slotId = _slotForReferral(referralHash);
        require(slots[slotId].enabled, "slot disabled");

        uint256 week = _currentWeek();

        weekTicketCount[week][slotId] += 1;
        slots[slotId].cumulativeTicketSales += 1;

        bool canCountUnique = !usedThisWeekForSlot[week][slotId][buyer];
        if (canCountUnique && globalUniquePerWeek && usedThisWeekGlobally[week][buyer]) {
            canCountUnique = false;
        }

        if (canCountUnique) {
            usedThisWeekForSlot[week][slotId][buyer] = true;
            weekUniqueCount[week][slotId] += 1;
            if (globalUniquePerWeek) usedThisWeekGlobally[week][buyer] = true;
            emit ReferralRegistered(slotId, buyer, week);
        }

        emit TicketRecorded(slotId, buyer, week);
        _tryPayMilestones(slotId);
    }

    function notifyAllocation() external payable onlyMultiCollection {
        require(msg.value > 0, "zero value");
        uint256 week = _currentWeek();
        weekAllocated[week] += msg.value;
        totalAllocatedOutstanding += msg.value;
        emit AllocationReceived(week, msg.value);
    }

    function distributeWeekRewards() external nonReentrant onlyOwner {
        _distributeWeekRewards(_currentWeek());
    }

    function distributeWeekRewardsForWeek(uint256 week) external nonReentrant onlyOwner {
        _distributeWeekRewards(week);
    }

    function _distributeWeekRewards(uint256 week) internal {
        uint256 allocated = weekAllocated[week];
        uint256 alreadyDistributed = weekDistributed[week];
        require(allocated > alreadyDistributed, "no funds to distribute");
        require(address(this).balance >= totalAllocatedOutstanding, "allocated imbalance");

        uint256 pool = allocated - alreadyDistributed;
        require(pool > 0, "no funds to distribute");

        uint256 totalWeight = 0;
        uint256[TOTAL_SLOTS] memory weights;
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            if (!slots[i].enabled) {
                weights[i] = 0;
                continue;
            }
            uint256 uniqueCount = weekUniqueCount[week][i];
            uint256 ticketCount = weekTicketCount[week][i];
            if (uniqueCount == 0) {
                weights[i] = 0;
                continue;
            }

            uint256 baseCoef = slots[i].isLeader ? leaderCoefBps : moderatorCoefBps;
            uint256 effectiveCoef = baseCoef + (saleBoostBpsPerTicket * ticketCount);
            weights[i] = uniqueCount * effectiveCoef;
            totalWeight += weights[i];
        }

        require(totalWeight > 0, "no eligible moderators this week");

        uint256 distributed = 0;
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            if (weights[i] == 0) continue;
            uint256 share = (pool * weights[i]) / totalWeight;
            distributed += share;
            address payable to = payable(slots[i].payout == address(0) ? owner() : slots[i].payout);
            to.sendValue(share);
        }

        weekDistributed[week] += distributed;
        totalAllocatedOutstanding -= distributed;
        emit WeekAllocationConsumed(week, distributed, weekDistributed[week], totalAllocatedOutstanding);
        emit WeeklyDistributed(week, distributed);

        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            _tryPayMilestones(i);
        }
    }

    function _slotForReferral(bytes32 referralHash) internal view returns (uint8) {
        for (uint8 i = 0; i < TOTAL_SLOTS; i++) {
            if (slots[i].referralHash == referralHash) return i;
        }
        revert("referral not found");
    }

    function _tryPayMilestones(uint8 slotId) internal {
        uint256 sales = slots[slotId].cumulativeTicketSales;
        if (milestone100 > 0 && sales >= 100 && !milestonePaid[slotId][100]) {
            milestonePaid[slotId][100] = true;
            _payToSlot(slotId, milestone100);
            emit MilestonePaid(slotId, 100, milestone100);
        }
        if (milestone500 > 0 && sales >= 500 && !milestonePaid[slotId][500]) {
            milestonePaid[slotId][500] = true;
            _payToSlot(slotId, milestone500);
            emit MilestonePaid(slotId, 500, milestone500);
        }
        if (milestone1000 > 0 && sales >= 1000 && !milestonePaid[slotId][1000]) {
            milestonePaid[slotId][1000] = true;
            _payToSlot(slotId, milestone1000);
            emit MilestonePaid(slotId, 1000, milestone1000);
        }
    }

    function _payToSlot(uint8 slotId, uint256 amount) internal {
        uint256 freeBalance = unallocatedBalance();
        if (amount == 0 || freeBalance == 0) return;
        uint256 toSend = amount <= freeBalance ? amount : freeBalance;
        address payable to = payable(slots[slotId].payout == address(0) ? owner() : slots[slotId].payout);
        to.sendValue(toSend);
    }

    function _currentWeek() internal view returns (uint256) {
        return block.timestamp / 1 weeks;
    }

    function allocatedBalanceForWeek(uint256 week) external view returns (uint256 allocated, uint256 distributed, uint256 remaining) {
        allocated = weekAllocated[week];
        distributed = weekDistributed[week];
        remaining = allocated > distributed ? allocated - distributed : 0;
    }

    function unallocatedBalance() public view returns (uint256) {
        uint256 balance = address(this).balance;
        return balance > totalAllocatedOutstanding ? balance - totalAllocatedOutstanding : 0;
    }

    function getSlotInfo(uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (bool enabled, bool isLeader, address payout, bytes32 referralHash, uint256 cumulativeSales)
    {
        Slot storage s = slots[slotId];
        return (s.enabled, s.isLeader, s.payout, s.referralHash, s.cumulativeTicketSales);
    }

    function getWeekStats(uint256 week, uint8 slotId)
        external
        view
        validSlot(slotId)
        returns (uint256 uniqueRefs, uint256 ticketSales, uint256 allocatedWei)
    {
        uniqueRefs = weekUniqueCount[week][slotId];
        ticketSales = weekTicketCount[week][slotId];
        allocatedWei = weekAllocated[week];
    }

    function withdrawToOwner(uint256 amount) external onlyOwner {
        uint256 freeBalance = unallocatedBalance();
        require(amount <= freeBalance, "insufficient");
        payable(owner()).sendValue(amount);
        emit PayoutWithdrawn(owner(), amount);
    }

    receive() external payable {}
    fallback() external payable {}
}
