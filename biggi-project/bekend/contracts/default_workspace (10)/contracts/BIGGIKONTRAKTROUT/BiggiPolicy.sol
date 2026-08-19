// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiPolicy
 * - Centrální parametry ekonomiky BIGGI.
 * - Bez fondů; jen konfigurace + denní kvóta.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // pro volání Ownable(initialOwner)

interface IBiggiPolicy {
    // Splits
    function alphaBuybackBps() external view returns (uint256);
    function betaBurnBps() external view returns (uint256);
    function gammaStakingBps() external view returns (uint256);
    function deltaReserveBps() external view returns (uint256);

    // Guards
    function swapSlippageBps() external view returns (uint256);
    function lpSlippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
    function minBuybackInterval() external view returns (uint256);
    function epsilonPriceBandBps() external view returns (uint256);
    function twapLookbackSec() external view returns (uint256);
    function maxDailyBuybackNative() external view returns (uint256);

    // Circuit breakers
    function buybacksPaused() external view returns (bool);
    function refillsPaused() external view returns (bool);
    function lpAddsPaused() external view returns (bool);
    function endOfCollectionPaused() external view returns (bool);

    // Operators
    function isOperator(address) external view returns (bool);

    // Snapshots
    function getSplits() external view returns (uint256 alpha, uint256 beta, uint256 gamma, uint256 delta);
    function getGuards() external view returns (
        uint256 swapSlip, uint256 lpSlip, uint256 deadline,
        uint256 cooldown, uint256 epsBand, uint256 twapWindow, uint256 dailyCap
    );
    function getPauses() external view returns (bool bb, bool rf, bool lp, bool eoc);
}

contract BiggiPolicy is IBiggiPolicy, Ownable2Step {
    /* Errors */
    error BpsTooHigh();
    error SumTooHigh();
    error ZeroAddress();
    error NotOperator();
    error OverDailyCap();

    /* State */
    // Splits
    uint256 public override alphaBuybackBps = 3000; // 30%
    uint256 public override betaBurnBps     = 4000; // 40%
    uint256 public override gammaStakingBps = 3000; // 30%
    // delta = 10000 - beta - gamma

    // Guards
    uint256 public override swapSlippageBps       = 200;   // 2%
    uint256 public override lpSlippageBps         = 200;   // 2%
    uint256 public override txDeadlineSec         = 600;   // 10m
    uint256 public override minBuybackInterval    = 300;   // 5m
    uint256 public override epsilonPriceBandBps   = 1000;  // ±10%
    uint256 public override twapLookbackSec       = 3600;  // 1h
    uint256 public override maxDailyBuybackNative = 0;     // 0 = no cap

    // Circuit breakers
    bool public override buybacksPaused        = false;
    bool public override refillsPaused         = false;
    bool public override lpAddsPaused          = false;
    bool public override endOfCollectionPaused = false;

    // Operators
    mapping(address => bool) public override isOperator;

    // Daily quota tracking (native units)
    uint256 public dailyWindowStart;
    uint256 public dailyBuybackConsumed;

    /* Events */
    event SplitsUpdated(uint256 alphaBuybackBps, uint256 betaBurnBps, uint256 gammaStakingBps, uint256 deltaReserveBps);
    event GuardsUpdated(
        uint256 swapSlipBps, uint256 lpSlipBps, uint256 deadlineSec,
        uint256 cooldownSec, uint256 epsBandBps, uint256 twapWindowSec, uint256 maxDailyBuybackNative
    );
    event PausesUpdated(bool buybacksPaused, bool refillsPaused, bool lpAddsPaused, bool endOfCollectionPaused);
    event OperatorSet(address indexed op, bool allowed);
    event DailyCounterReset(uint256 at, uint256 oldConsumed);
    event DailyQuotaConsumed(address indexed op, uint256 amount, uint256 consumedTotal);

    /* Constructor */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    /* Modifiers */
    modifier onlyOperator() {
        if (!isOperator[msg.sender]) revert NotOperator();
        _;
    }

    /* Admin: Splits */
    function setSplits(uint256 alphaBuybackBps_, uint256 betaBurnBps_, uint256 gammaStakingBps_) external onlyOwner {
        if (alphaBuybackBps_ > 10000 || betaBurnBps_ > 10000 || gammaStakingBps_ > 10000) revert BpsTooHigh();
        if (betaBurnBps_ + gammaStakingBps_ > 10000) revert SumTooHigh();

        alphaBuybackBps = alphaBuybackBps_;
        betaBurnBps     = betaBurnBps_;
        gammaStakingBps = gammaStakingBps_;

        emit SplitsUpdated(alphaBuybackBps, betaBurnBps, gammaStakingBps, deltaReserveBps());
    }

    /* Admin: Guards */
    function setGuards(
        uint256 swapSlipBps,
        uint256 lpSlipBps,
        uint256 deadlineSec,
        uint256 cooldownSec,
        uint256 epsBandBps,
        uint256 twapWindowSec,
        uint256 dailyCapNative
    ) external onlyOwner {
        if (swapSlipBps > 10000 || lpSlipBps > 10000) revert BpsTooHigh();
        if (deadlineSec == 0 || deadlineSec > 1 days) revert BpsTooHigh();
        if (epsBandBps > 5000) revert BpsTooHigh();

        swapSlippageBps       = swapSlipBps;
        lpSlippageBps         = lpSlipBps;
        txDeadlineSec         = deadlineSec;
        minBuybackInterval    = cooldownSec;
        epsilonPriceBandBps   = epsBandBps;
        twapLookbackSec       = twapWindowSec;
        maxDailyBuybackNative = dailyCapNative;

        emit GuardsUpdated(
            swapSlippageBps, lpSlippageBps, txDeadlineSec,
            minBuybackInterval, epsilonPriceBandBps, twapLookbackSec, maxDailyBuybackNative
        );
    }

    /* Admin: Pauses */
    function setPauses(bool pauseBuybacks, bool pauseRefills, bool pauseLpAdds, bool pauseEoc) external onlyOwner {
        buybacksPaused        = pauseBuybacks;
        refillsPaused         = pauseRefills;
        lpAddsPaused          = pauseLpAdds;
        endOfCollectionPaused = pauseEoc;
        emit PausesUpdated(buybacksPaused, refillsPaused, lpAddsPaused, endOfCollectionPaused);
    }

    /* Admin: Operators */
    function setOperator(address op, bool allowed) external onlyOwner {
        if (op == address(0)) revert ZeroAddress();
        isOperator[op] = allowed;
        emit OperatorSet(op, allowed);
    }

    /* Daily quota */
    function consumeDailyBuybackQuota(uint256 nativeAmount) external onlyOperator {
        if (maxDailyBuybackNative == 0) return;
        _rollDailyWindowIfNeeded();
        uint256 afterUse = dailyBuybackConsumed + nativeAmount;
        if (afterUse > maxDailyBuybackNative) revert OverDailyCap();
        dailyBuybackConsumed = afterUse;
        emit DailyQuotaConsumed(msg.sender, nativeAmount, dailyBuybackConsumed);
    }

    function resetDailyCounter() external onlyOwner {
        emit DailyCounterReset(block.timestamp, dailyBuybackConsumed);
        dailyBuybackConsumed = 0;
        dailyWindowStart = block.timestamp;
    }

    function _rollDailyWindowIfNeeded() internal {
        if (dailyWindowStart == 0) {
            dailyWindowStart = block.timestamp;
            return;
        }
        if (block.timestamp >= dailyWindowStart + 1 days) {
            emit DailyCounterReset(block.timestamp, dailyBuybackConsumed);
            dailyWindowStart = block.timestamp;
            dailyBuybackConsumed = 0;
        }
    }

    /* Derived views */
    function deltaReserveBps() public view override returns (uint256) {
        return 10000 - betaBurnBps - gammaStakingBps;
    }

    function getSplits() external view override returns (uint256 a, uint256 b, uint256 g, uint256 d) {
        a = alphaBuybackBps; b = betaBurnBps; g = gammaStakingBps; d = deltaReserveBps();
    }

    function getGuards()
        external
        view
        override
        returns (
            uint256 swapSlip, uint256 lpSlip, uint256 deadline,
            uint256 cooldown, uint256 epsBand, uint256 twapWindow, uint256 dailyCap
        )
    {
        swapSlip   = swapSlippageBps;
        lpSlip     = lpSlippageBps;
        deadline   = txDeadlineSec;
        cooldown   = minBuybackInterval;
        epsBand    = epsilonPriceBandBps;
        twapWindow = twapLookbackSec;
        dailyCap   = maxDailyBuybackNative;
    }

    function getPauses() external view override returns (bool bb, bool rf, bool lp, bool eoc) {
        bb  = buybacksPaused;
        rf  = refillsPaused;
        lp  = lpAddsPaused;
        eoc = endOfCollectionPaused;
    }

    /* Advisory helper */
    function advise(uint256 priceNow, uint256 twap)
        external
        view
        returns (bool shouldBB, bool shouldRef)
    {
        if (twap == 0) return (false, false);
        uint256 lower = (twap * (10000 - epsilonPriceBandBps)) / 10000;
        uint256 upper = (twap * (10000 + epsilonPriceBandBps)) / 10000;
        shouldBB  = priceNow < lower && !buybacksPaused;
        shouldRef = priceNow > upper && !refillsPaused;
    }
}
