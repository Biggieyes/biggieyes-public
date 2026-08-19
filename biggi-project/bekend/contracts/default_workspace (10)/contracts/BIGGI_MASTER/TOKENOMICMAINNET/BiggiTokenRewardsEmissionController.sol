// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBiggiTreasuryEmissionView {
    function totalBiggiReceived() external view returns (uint256);
    function totalEcosystemBiggiReceived() external view returns (uint256);
}

contract BiggiTokenRewardsEmissionController is Ownable {
    error ZeroAddress();
    error OnlyTokenRewards();
    error NotKeeperOrOwner();
    error BadConfig();
    error WeeklyBudgetExceeded();

    struct WeekState {
        bool initialized;
        uint256 observedBiggiInflow;
        uint256 tokenRewardsBalance;
        uint256 budget;
        uint256 paid;
        uint256 unitReward;
    }

    IERC20 public immutable BIGGI;

    address public tokenRewards;
    address public treasury;

    uint256 public targetWeeklyUnits = 100_000;
    uint256 public minWeeklyBudget = 50_000 ether;
    uint256 public weakWeeklyBudget = 100_000 ether;
    uint256 public normalWeeklyBudget = 500_000 ether;
    uint256 public strongWeeklyBudget = 1_000_000 ether;
    uint256 public emergencyWeeklyBudget = 25_000 ether;
    uint256 public maxWeeklyBudget = 1_000_000 ether;

    uint256 public weakInflowThreshold = 10_000 ether;
    uint256 public strongInflowThreshold = 200_000 ether;
    uint256 public balanceBudgetBps = 100;

    uint256 public lastObservedTreasuryBiggi;
    uint256 public lastObservedTreasuryEcosystemBiggi;

    bool public emergencyMode;

    mapping(uint64 => WeekState) public weekState;
    mapping(address => bool) public keepers;

    event TokenRewardsSet(address indexed oldTokenRewards, address indexed newTokenRewards);
    event TreasurySet(address indexed oldTreasury, address indexed newTreasury);
    event KeeperSet(address indexed keeper, bool allowed);
    event EmergencyModeSet(bool enabled);
    event TargetWeeklyUnitsSet(uint256 units);
    event BudgetConfigSet(
        uint256 minWeeklyBudget,
        uint256 weakWeeklyBudget,
        uint256 normalWeeklyBudget,
        uint256 strongWeeklyBudget,
        uint256 emergencyWeeklyBudget,
        uint256 maxWeeklyBudget,
        uint256 balanceBudgetBps
    );
    event InflowThresholdsSet(uint256 weakInflowThreshold, uint256 strongInflowThreshold);
    event ObservedTotalsSeeded(uint256 totalBiggi, uint256 totalEcosystemBiggi);
    event WeekInitialized(
        uint64 indexed weekId,
        uint256 observedBiggiInflow,
        uint256 tokenRewardsBalance,
        uint256 budget,
        uint256 unitReward
    );
    event RewardConsumed(uint64 indexed weekId, address indexed user, uint256 units, uint256 amount, uint256 paid);

    constructor(address tokenRewards_, address treasury_, address biggi_, address owner_) Ownable(owner_) {
        if (tokenRewards_ == address(0) || biggi_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        tokenRewards = tokenRewards_;
        treasury = treasury_;
        BIGGI = IERC20(biggi_);

        (lastObservedTreasuryBiggi, lastObservedTreasuryEcosystemBiggi) = _treasuryTotals();
    }

    modifier onlyTokenRewards() {
        if (msg.sender != tokenRewards) revert OnlyTokenRewards();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != owner() && !keepers[msg.sender]) revert NotKeeperOrOwner();
        _;
    }

    function setTokenRewards(address tokenRewards_) external onlyOwner {
        if (tokenRewards_ == address(0)) revert ZeroAddress();
        emit TokenRewardsSet(tokenRewards, tokenRewards_);
        tokenRewards = tokenRewards_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        emit TreasurySet(treasury, treasury_);
        treasury = treasury_;
        (lastObservedTreasuryBiggi, lastObservedTreasuryEcosystemBiggi) = _treasuryTotals();
        emit ObservedTotalsSeeded(lastObservedTreasuryBiggi, lastObservedTreasuryEcosystemBiggi);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        if (keeper == address(0)) revert ZeroAddress();
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setEmergencyMode(bool enabled) external onlyOwner {
        emergencyMode = enabled;
        emit EmergencyModeSet(enabled);
    }

    function setTargetWeeklyUnits(uint256 units) external onlyOwner {
        if (units == 0) revert BadConfig();
        targetWeeklyUnits = units;
        emit TargetWeeklyUnitsSet(units);
    }

    function setBudgetConfig(
        uint256 minWeeklyBudget_,
        uint256 weakWeeklyBudget_,
        uint256 normalWeeklyBudget_,
        uint256 strongWeeklyBudget_,
        uint256 emergencyWeeklyBudget_,
        uint256 maxWeeklyBudget_,
        uint256 balanceBudgetBps_
    ) external onlyOwner {
        if (
            minWeeklyBudget_ == 0 ||
            weakWeeklyBudget_ == 0 ||
            normalWeeklyBudget_ == 0 ||
            strongWeeklyBudget_ == 0 ||
            emergencyWeeklyBudget_ == 0 ||
            maxWeeklyBudget_ == 0 ||
            balanceBudgetBps_ > 10_000
        ) revert BadConfig();
        if (minWeeklyBudget_ > maxWeeklyBudget_ || emergencyWeeklyBudget_ > maxWeeklyBudget_) revert BadConfig();

        minWeeklyBudget = minWeeklyBudget_;
        weakWeeklyBudget = weakWeeklyBudget_;
        normalWeeklyBudget = normalWeeklyBudget_;
        strongWeeklyBudget = strongWeeklyBudget_;
        emergencyWeeklyBudget = emergencyWeeklyBudget_;
        maxWeeklyBudget = maxWeeklyBudget_;
        balanceBudgetBps = balanceBudgetBps_;

        emit BudgetConfigSet(
            minWeeklyBudget_,
            weakWeeklyBudget_,
            normalWeeklyBudget_,
            strongWeeklyBudget_,
            emergencyWeeklyBudget_,
            maxWeeklyBudget_,
            balanceBudgetBps_
        );
    }

    function setInflowThresholds(uint256 weakInflowThreshold_, uint256 strongInflowThreshold_) external onlyOwner {
        if (weakInflowThreshold_ > strongInflowThreshold_) revert BadConfig();
        weakInflowThreshold = weakInflowThreshold_;
        strongInflowThreshold = strongInflowThreshold_;
        emit InflowThresholdsSet(weakInflowThreshold_, strongInflowThreshold_);
    }

    function seedObservedTotals(uint256 totalBiggi, uint256 totalEcosystemBiggi) external onlyOwner {
        lastObservedTreasuryBiggi = totalBiggi;
        lastObservedTreasuryEcosystemBiggi = totalEcosystemBiggi;
        emit ObservedTotalsSeeded(totalBiggi, totalEcosystemBiggi);
    }

    function currentWeek() public view returns (uint64) {
        return uint64(block.timestamp / 1 weeks);
    }

    function rollCurrentWeek() external onlyKeeperOrOwner returns (uint64 weekId) {
        weekId = currentWeek();
        _ensureWeek(weekId);
    }

    function rollWeek(uint64 weekId) external onlyKeeperOrOwner {
        _ensureWeek(weekId);
    }

    function previewWeek(uint64 weekId) external view returns (WeekState memory s) {
        return _previewWeek(weekId);
    }

    function consumeReward(uint64 weekId, address user, uint256 units, uint256 defaultAmount)
        external
        onlyTokenRewards
        returns (uint256 amount)
    {
        WeekState storage s = _ensureWeek(weekId);
        amount = _amountForClaim(s.budget, s.paid, s.unitReward, units, defaultAmount);
        if (amount == 0) revert WeeklyBudgetExceeded();

        s.paid += amount;
        emit RewardConsumed(weekId, user, units, amount, s.paid);
    }

    function previewReward(uint64 weekId, address, uint256 units, uint256 defaultAmount)
        external
        view
        returns (uint256 amount, uint256 weeklyBudget, uint256 weeklyPaid, uint256 unitRewardForWeek)
    {
        WeekState memory s = _previewWeek(weekId);
        amount = _amountForClaim(s.budget, s.paid, s.unitReward, units, defaultAmount);
        return (amount, s.budget, s.paid, s.unitReward);
    }

    function _ensureWeek(uint64 weekId) internal returns (WeekState storage s) {
        s = weekState[weekId];
        if (s.initialized) return s;

        (uint256 totalBiggi, uint256 totalEcosystemBiggi) = _treasuryTotals();
        uint256 observed = _delta(totalBiggi, lastObservedTreasuryBiggi)
            + _delta(totalEcosystemBiggi, lastObservedTreasuryEcosystemBiggi);
        uint256 balance = BIGGI.balanceOf(tokenRewards);
        uint256 budget = _calculateBudget(observed, balance);
        uint256 unit = _calculateUnitReward(budget);

        lastObservedTreasuryBiggi = totalBiggi;
        lastObservedTreasuryEcosystemBiggi = totalEcosystemBiggi;

        s.initialized = true;
        s.observedBiggiInflow = observed;
        s.tokenRewardsBalance = balance;
        s.budget = budget;
        s.unitReward = unit;

        emit WeekInitialized(weekId, observed, balance, budget, unit);
    }

    function _previewWeek(uint64 weekId) internal view returns (WeekState memory s) {
        s = weekState[weekId];
        if (s.initialized) return s;

        (uint256 totalBiggi, uint256 totalEcosystemBiggi) = _treasuryTotals();
        uint256 observed = _delta(totalBiggi, lastObservedTreasuryBiggi)
            + _delta(totalEcosystemBiggi, lastObservedTreasuryEcosystemBiggi);
        uint256 balance = BIGGI.balanceOf(tokenRewards);
        uint256 budget = _calculateBudget(observed, balance);

        s.initialized = true;
        s.observedBiggiInflow = observed;
        s.tokenRewardsBalance = balance;
        s.budget = budget;
        s.unitReward = _calculateUnitReward(budget);
    }

    function _calculateBudget(uint256 inflow, uint256 balance) internal view returns (uint256) {
        uint256 budget;
        if (emergencyMode) {
            budget = emergencyWeeklyBudget;
        } else if (inflow >= strongInflowThreshold) {
            budget = strongWeeklyBudget;
        } else if (inflow >= weakInflowThreshold) {
            budget = normalWeeklyBudget;
        } else if (inflow > 0) {
            budget = weakWeeklyBudget;
        } else {
            budget = minWeeklyBudget;
        }

        if (budget > maxWeeklyBudget) budget = maxWeeklyBudget;

        if (balanceBudgetBps > 0) {
            uint256 balanceCap = (balance * balanceBudgetBps) / 10_000;
            if (balanceCap > 0 && budget > balanceCap) budget = balanceCap;
        }

        if (budget == 0) return 1;
        return budget;
    }

    function _calculateUnitReward(uint256 budget) internal view returns (uint256) {
        uint256 reward = budget / targetWeeklyUnits;
        if (reward == 0 && budget > 0) return 1;
        return reward;
    }

    function _amountForClaim(
        uint256 budget,
        uint256 paid,
        uint256 weekUnitReward,
        uint256 units,
        uint256 defaultAmount
    ) internal pure returns (uint256) {
        if (units == 0 || weekUnitReward == 0 || paid >= budget) return 0;

        uint256 amount = units * weekUnitReward;
        if (amount > defaultAmount) amount = defaultAmount;
        if (paid + amount > budget) return 0;
        return amount;
    }

    function _treasuryTotals() internal view returns (uint256 totalBiggi, uint256 totalEcosystemBiggi) {
        if (treasury == address(0)) return (0, 0);

        try IBiggiTreasuryEmissionView(treasury).totalBiggiReceived() returns (uint256 v) {
            totalBiggi = v;
        } catch {}

        try IBiggiTreasuryEmissionView(treasury).totalEcosystemBiggiReceived() returns (uint256 v2) {
            totalEcosystemBiggi = v2;
        } catch {}
    }

    function _delta(uint256 currentValue, uint256 previousValue) internal pure returns (uint256) {
        if (currentValue <= previousValue) return 0;
        return currentValue - previousValue;
    }
}
