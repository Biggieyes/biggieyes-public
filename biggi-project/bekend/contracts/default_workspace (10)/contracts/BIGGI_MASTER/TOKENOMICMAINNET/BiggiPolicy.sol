// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol";

/// @title BiggiPolicy
/// @notice Central policy config for buyback limits and swap parameters.
contract BiggiPolicy is Ownable {
    /// @notice Raised when daily buyback quota would be exceeded.
    error DailyQuotaExceeded();

    // ===== DEX swap parameters =====
    uint256 public swapSlippageBps;
    uint256 public txDeadlineSec;

    // ===== Buyback throttling =====
    uint256 public minBuybackInterval;
    bool public buybacksPaused;
    uint256 public maxDailyBuybackNative;
    uint256 public usedToday;
    uint64 public dayIndex;

    /// @notice Authorized caller for consumeDailyBuybackQuota (typically BiggiBuybackAgent).
    address public buybackAgent;

    // ===== Events =====
    event SwapSlippageBpsSet(uint256 oldVal, uint256 newVal);
    event TxDeadlineSecSet(uint256 oldVal, uint256 newVal);
    event MinBuybackIntervalSet(uint256 oldVal, uint256 newVal);
    event BuybacksPausedSet(bool oldVal, bool newVal);
    event MaxDailyBuybackNativeSet(uint256 oldVal, uint256 newVal);
    event DailyQuotaConsumed(uint256 dayIndex, uint256 usedToday, uint256 added);
    event BuybackAgentSet(address indexed oldAgent, address indexed newAgent);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert BiggiErrorsLib.ZeroAddress();

        swapSlippageBps = 500;      // 5%
        txDeadlineSec = 600;        // 10 min
        minBuybackInterval = 300;   // 5 min
        buybacksPaused = false;
        maxDailyBuybackNative = 0;  // 0 = unlimited
        dayIndex = uint64(block.timestamp / 1 days);

        // Safe default until explicit wiring is done.
        buybackAgent = initialOwner;
    }

    // ===== Setters (onlyOwner) =====
    function setSwapSlippageBps(uint256 newBps) external onlyOwner {
        if (newBps > 10_000) revert BiggiErrorsLib.AmountZero();
        emit SwapSlippageBpsSet(swapSlippageBps, newBps);
        swapSlippageBps = newBps;
    }

    function setTxDeadlineSec(uint256 newDeadline) external onlyOwner {
        if (newDeadline == 0 || newDeadline > 1 days) revert BiggiErrorsLib.AmountZero();
        emit TxDeadlineSecSet(txDeadlineSec, newDeadline);
        txDeadlineSec = newDeadline;
    }

    function setMinBuybackInterval(uint256 newInterval) external onlyOwner {
        if (newInterval > 1 days) revert BiggiErrorsLib.AmountZero();
        emit MinBuybackIntervalSet(minBuybackInterval, newInterval);
        minBuybackInterval = newInterval;
    }

    function setBuybacksPaused(bool paused_) external onlyOwner {
        emit BuybacksPausedSet(buybacksPaused, paused_);
        buybacksPaused = paused_;
    }

    function setMaxDailyBuybackNative(uint256 newMax) external onlyOwner {
        emit MaxDailyBuybackNativeSet(maxDailyBuybackNative, newMax);
        maxDailyBuybackNative = newMax;
    }

    function setBuybackAgent(address agent) external onlyOwner {
        if (agent == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit BuybackAgentSet(buybackAgent, agent);
        buybackAgent = agent;
    }

    // ===== Quota consumption =====
    /// @notice Consumes portion of daily buyback quota.
    /// @dev If maxDailyBuybackNative == 0, quota is unlimited but accounting is still tracked.
    function consumeDailyBuybackQuota(uint256 nativeAmount) external {
        if (nativeAmount == 0) revert BiggiErrorsLib.AmountZero();
        if (msg.sender != buybackAgent && msg.sender != owner()) revert BiggiErrorsLib.NotBuybackAgent();

        uint64 today = uint64(block.timestamp / 1 days);
        if (today != dayIndex) {
            dayIndex = today;
            usedToday = 0;
        }

        if (maxDailyBuybackNative == 0) {
            usedToday += nativeAmount;
            emit DailyQuotaConsumed(today, usedToday, nativeAmount);
            return;
        }

        if (usedToday + nativeAmount > maxDailyBuybackNative) {
            revert DailyQuotaExceeded();
        }

        usedToday += nativeAmount;
        emit DailyQuotaConsumed(today, usedToday, nativeAmount);
    }
}
