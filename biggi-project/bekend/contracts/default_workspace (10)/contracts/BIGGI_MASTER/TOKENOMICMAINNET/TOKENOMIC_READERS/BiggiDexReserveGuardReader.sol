// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiDexReserveGuardView {
    function owner() external view returns (address);
    function paused() external view returns (bool);
    function pair() external view returns (address);
    function token() external view returns (address);
    function quoteToken() external view returns (address);
    function baselineReserve() external view returns (uint256);
    function minReserveRatioBps() external view returns (uint256);
    function refillAmount() external view returns (uint256);
    function cooldown() external view returns (uint256);
    function lastRefillAt() external view returns (uint256);
    function autoRefreshBaselineOnRefill() external view returns (bool);
    function priceCheckEnabled() external view returns (bool);
    function maxPriceDeviationBps() external view returns (uint256);
    function lastGoodDexPriceE18() external view returns (uint256);
    function quoteOracle() external view returns (address);
    function maxOracleStaleness() external view returns (uint256);
    function requireQuoteOracleForPriceCheck() external view returns (bool);
    function quoteOracleStatus()
        external
        view
        returns (
            bool configured,
            bool roundDataSupported,
            bool legacyAnswerSupported,
            uint256 answerE18,
            uint256 updatedAt,
            bool stale,
            bool valid
        );
    function currentTokenReserve() external view returns (uint256);
    function currentQuoteReserve() external view returns (uint256);
    function currentDexPriceE18() external view returns (uint256);
    function minAllowedReserve() external view returns (uint256);
    function refillNeeded() external view returns (bool needed, string memory reason);
    function keepers(address keeper) external view returns (bool);
}

contract BiggiDexReserveGuardReader {
    struct GuardStatus {
        address guard;
        address owner;
        bool paused;
        address pair;
        address token;
        address quoteToken;
        uint256 baselineReserve;
        uint256 minReserveRatioBps;
        uint256 minAllowedReserve;
        uint256 refillAmount;
        uint256 cooldown;
        uint256 lastRefillAt;
        bool autoRefreshBaselineOnRefill;
        bool priceCheckEnabled;
        uint256 maxPriceDeviationBps;
        uint256 lastGoodDexPriceE18;
        address quoteOracle;
        uint256 maxOracleStaleness;
        bool requireQuoteOracleForPriceCheck;
        bool quoteOracleConfigured;
        bool quoteOracleRoundDataSupported;
        bool quoteOracleLegacyAnswerSupported;
        uint256 quoteOracleAnswerE18;
        uint256 quoteOracleUpdatedAt;
        bool quoteOracleStale;
        bool quoteOracleValid;
        uint256 currentTokenReserve;
        uint256 currentQuoteReserve;
        uint256 currentDexPriceE18;
        bool refillNeeded;
        string refillReason;
    }

    IBiggiDexReserveGuardView public immutable guard;

    constructor(address guard_) {
        require(guard_ != address(0), "guard=0");
        guard = IBiggiDexReserveGuardView(guard_);
    }

    function getStatus() external view returns (GuardStatus memory s) {
        s.guard = address(guard);
        s.owner = guard.owner();
        s.paused = guard.paused();
        s.pair = guard.pair();
        s.token = guard.token();
        s.quoteToken = guard.quoteToken();
        s.baselineReserve = guard.baselineReserve();
        s.minReserveRatioBps = guard.minReserveRatioBps();
        s.minAllowedReserve = guard.minAllowedReserve();
        s.refillAmount = guard.refillAmount();
        s.cooldown = guard.cooldown();
        s.lastRefillAt = guard.lastRefillAt();
        s.autoRefreshBaselineOnRefill = guard.autoRefreshBaselineOnRefill();
        s.priceCheckEnabled = guard.priceCheckEnabled();
        s.maxPriceDeviationBps = guard.maxPriceDeviationBps();
        s.lastGoodDexPriceE18 = guard.lastGoodDexPriceE18();
        s.quoteOracle = guard.quoteOracle();
        s.maxOracleStaleness = guard.maxOracleStaleness();
        s.requireQuoteOracleForPriceCheck = guard.requireQuoteOracleForPriceCheck();
        (
            s.quoteOracleConfigured,
            s.quoteOracleRoundDataSupported,
            s.quoteOracleLegacyAnswerSupported,
            s.quoteOracleAnswerE18,
            s.quoteOracleUpdatedAt,
            s.quoteOracleStale,
            s.quoteOracleValid
        ) = guard.quoteOracleStatus();
        s.currentTokenReserve = guard.currentTokenReserve();
        s.currentQuoteReserve = guard.currentQuoteReserve();
        s.currentDexPriceE18 = guard.currentDexPriceE18();
        (s.refillNeeded, s.refillReason) = guard.refillNeeded();
    }

    function isKeeper(address keeper) external view returns (bool) {
        return guard.keepers(keeper);
    }
}
