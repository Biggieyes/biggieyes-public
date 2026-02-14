// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BiggiErrorsLib.sol";

/// @title BiggiPolicy — centrální nastavení pro buyback / limity
/// @notice Používá ho BiggiBuybackAgent přes IBiggiPolicy rozhraní.
contract BiggiPolicy is Ownable {
    /// @notice chyba pro překročení denního limitu buybacku
    error DailyQuotaExceeded();

    // ===== Parametry pro DEX swapy =====

    /// @notice povolený slippage v BPS (1% = 100 bps, max 10000)
    uint256 public swapSlippageBps;

    /// @notice platnost transakce v sekundách (deadline pro router)
    uint256 public txDeadlineSec;

    // ===== Throttling buybacku =====

    /// @notice minimální čas mezi dvěma buybacky (v sekundách)
    uint256 public minBuybackInterval;

    /// @notice globální pauza buybacků (pokud true, buybacky se nemají provádět)
    bool public buybacksPaused;

    /// @notice maximální denní objem buybacku v nativním tokenu (0 = bez limitu)
    uint256 public maxDailyBuybackNative;

    /// @notice kolik nativu už bylo „spotřebováno“ daný den
    uint256 public usedToday;

    /// @notice index dne (block.timestamp / 1 days), ke kterému se vztahuje usedToday
    uint64 public dayIndex;

    // ===== Události =====

    event SwapSlippageBpsSet(uint256 oldVal, uint256 newVal);
    event TxDeadlineSecSet(uint256 oldVal, uint256 newVal);
    event MinBuybackIntervalSet(uint256 oldVal, uint256 newVal);
    event BuybacksPausedSet(bool oldVal, bool newVal);
    event MaxDailyBuybackNativeSet(uint256 oldVal, uint256 newVal);
    event DailyQuotaConsumed(uint256 dayIndex, uint256 usedToday, uint256 added);

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert BiggiErrorsLib.ZeroAddress();

        // rozumné defaulty pro testnet (můžeš kdykoliv přepsat setterem)
        swapSlippageBps = 500;          // 5 %
        txDeadlineSec   = 600;          // 10 min
        minBuybackInterval = 300;       // 5 min
        buybacksPaused  = false;
        maxDailyBuybackNative = 0;      // 0 = bez denního limitu
        dayIndex = uint64(block.timestamp / 1 days);
    }

    // ===== Settery (onlyOwner) =====

    function setSwapSlippageBps(uint256 newBps) external onlyOwner {
        if (newBps > 10_000) revert BiggiErrorsLib.AmountZero(); // reuse, nebo si případně uděláš vlastní error
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

    /// @notice Nastavení denního limitu pro buyback v nativním tokenu (0 = bez limitu)
    function setMaxDailyBuybackNative(uint256 newMax) external onlyOwner {
        emit MaxDailyBuybackNativeSet(maxDailyBuybackNative, newMax);
        maxDailyBuybackNative = newMax;
    }

    // ===== Kvóta pro buyback (volá BiggiBuybackAgent) =====

    /// @notice Zkonzumuje část denního limitu. Pokud by byl limit překročen, revertuje.
    /// @dev Pokud je maxDailyBuybackNative == 0, funguje jako no-op (bez limitu).
    function consumeDailyBuybackQuota(uint256 nativeAmount) external {
        if (nativeAmount == 0) revert BiggiErrorsLib.AmountZero();

        // roll den, pokud je nový den
        uint64 today = uint64(block.timestamp / 1 days);
        if (today != dayIndex) {
            dayIndex = today;
            usedToday = 0;
        }

        // pokud není nastaven žádný limit, jen trackujeme (volitelné)
        if (maxDailyBuybackNative == 0) {
            usedToday += nativeAmount;
            emit DailyQuotaConsumed(today, usedToday, nativeAmount);
            return;
        }

        // hlídání limitu
        if (usedToday + nativeAmount > maxDailyBuybackNative) {
            revert DailyQuotaExceeded();
        }

        usedToday += nativeAmount;
        emit DailyQuotaConsumed(today, usedToday, nativeAmount);
    }
}
