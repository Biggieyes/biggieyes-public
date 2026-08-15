// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IUniswapV2PairGuard {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IBiggiSupplyControllerDex {
    function refillDex(uint256 amount) external;
}

interface IAggregatorLegacyLike {
    function latestAnswer() external view returns (int256);
}

interface IAggregatorV3Like {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract BiggiDexReserveGuard is Ownable, ReentrancyGuard, Pausable {
    error ZeroAddress();
    error CooldownActive();
    error BaselineNotSet();
    error ReserveHealthy();
    error NotKeeper();
    error OraclePriceInvalid();
    error OraclePriceStale();
    error PriceDeviationTooHigh();
    error PairTokenMismatch();

    address public pair;
    address public token;
    address public quoteToken;
    IBiggiSupplyControllerDex public supplyController;
    address public quoteOracle;

    mapping(address => bool) public keepers;

    uint256 public baselineReserve;
    uint256 public minReserveRatioBps = 5000;
    uint256 public refillAmount = 20_000_000e18;
    uint256 public cooldown = 30 minutes;
    uint256 public lastRefillAt;
    bool public autoRefreshBaselineOnRefill = true;

    bool public priceCheckEnabled;
    uint256 public maxPriceDeviationBps = 2000;
    uint256 public lastGoodDexPriceE18;
    uint256 public maxOracleStaleness = 1 days;
    bool public requireQuoteOracleForPriceCheck;

    event KeeperSet(address indexed keeper, bool allowed);
    event PairSet(address indexed pair);
    event QuoteTokenSet(address indexed quoteToken);
    event QuoteOracleSet(address indexed oracle);
    event QuoteOracleConfigSet(uint256 maxOracleStaleness, bool requireQuoteOracleForPriceCheck);
    event BaselineSnapshotted(uint256 reserve);
    event RefillTriggered(uint256 reserveNow, uint256 baselineReserve, uint256 refillAmount, uint256 timestamp);
    event PriceCheckConfigSet(bool enabled, uint256 maxDeviationBps);
    event CooldownSet(uint256 cooldownSec);
    event RefillAmountSet(uint256 amount);
    event ReserveRatioSet(uint256 ratioBps);
    event AutoRefreshBaselineSet(bool enabled);

    constructor(address initialOwner,address pair_,address token_,address quoteToken_,address supplyController_) Ownable(initialOwner) {
        if (initialOwner == address(0) || token_ == address(0) || supplyController_ == address(0)) revert ZeroAddress();
        if (pair_ != address(0)) {
            if (quoteToken_ == address(0)) revert ZeroAddress();
            _validatePair(pair_, token_, quoteToken_);
        }
        pair = pair_;
        token = token_;
        quoteToken = quoteToken_;
        supplyController = IBiggiSupplyControllerDex(supplyController_);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner { keepers[keeper] = allowed; emit KeeperSet(keeper, allowed); }
    function setPair(address pair_) external onlyOwner {
        if (pair_ == address(0)) revert ZeroAddress();
        if (quoteToken == address(0)) revert ZeroAddress();
        _validatePair(pair_, token, quoteToken);
        pair = pair_;
        emit PairSet(pair_);
    }
    function setQuoteToken(address quoteToken_) external onlyOwner {
        if (quoteToken_ == address(0)) revert ZeroAddress();
        if (pair != address(0)) _validatePair(pair, token, quoteToken_);
        quoteToken = quoteToken_;
        emit QuoteTokenSet(quoteToken_);
    }
    function setQuoteOracle(address oracle_) external onlyOwner { quoteOracle = oracle_; emit QuoteOracleSet(oracle_); }
    function setQuoteOracleConfig(uint256 maxStalenessSec, bool requireOracle) external onlyOwner {
        maxOracleStaleness = maxStalenessSec;
        requireQuoteOracleForPriceCheck = requireOracle;
        emit QuoteOracleConfigSet(maxStalenessSec, requireOracle);
    }
    function setReserveRatioBps(uint256 ratioBps) external onlyOwner { require(ratioBps > 0 && ratioBps <= 10_000, "bad bps"); minReserveRatioBps = ratioBps; emit ReserveRatioSet(ratioBps); }
    function setRefillAmount(uint256 amount) external onlyOwner { require(amount > 0, "amount=0"); refillAmount = amount; emit RefillAmountSet(amount); }
    function setCooldown(uint256 cooldownSec) external onlyOwner { cooldown = cooldownSec; emit CooldownSet(cooldownSec); }
    function setAutoRefreshBaselineOnRefill(bool enabled) external onlyOwner { autoRefreshBaselineOnRefill = enabled; emit AutoRefreshBaselineSet(enabled); }
    function setPriceCheckConfig(bool enabled, uint256 deviationBps) external onlyOwner { require(deviationBps <= 10_000, "bad bps"); priceCheckEnabled = enabled; maxPriceDeviationBps = deviationBps; emit PriceCheckConfigSet(enabled, deviationBps); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function snapshotBaseline() public onlyOwner {
        uint256 reserve_ = currentTokenReserve();
        require(reserve_ > 0, "reserve=0");
        baselineReserve = reserve_;
        emit BaselineSnapshotted(reserve_);
    }

    function refreshPriceAnchor() external onlyOwner {
        uint256 dexPrice = currentDexPriceE18();
        if (dexPrice == 0) revert OraclePriceInvalid();
        lastGoodDexPriceE18 = dexPrice;
    }

    function currentTokenReserve() public view returns (uint256) {
        if (pair == address(0)) return 0;
        IUniswapV2PairGuard p = IUniswapV2PairGuard(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        address t0 = p.token0();
        address t1 = p.token1();
        if (t0 == token) return uint256(r0);
        if (t1 == token) return uint256(r1);
        revert PairTokenMismatch();
    }

    function currentQuoteReserve() public view returns (uint256) {
        if (pair == address(0)) return 0;
        IUniswapV2PairGuard p = IUniswapV2PairGuard(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        address t0 = p.token0();
        address t1 = p.token1();
        if (t0 == token) {
            if (quoteToken != address(0) && t1 != quoteToken) revert PairTokenMismatch();
            return uint256(r1);
        }
        if (t1 == token) {
            if (quoteToken != address(0) && t0 != quoteToken) revert PairTokenMismatch();
            return uint256(r0);
        }
        revert PairTokenMismatch();
    }

    function currentDexPriceE18() public view returns (uint256) {
        uint256 reserveToken = currentTokenReserve();
        uint256 reserveQuote = currentQuoteReserve();
        if (reserveToken == 0) return 0;
        return (reserveQuote * 1e18) / reserveToken;
    }

    function minAllowedReserve() public view returns (uint256) { return (baselineReserve * minReserveRatioBps) / 10_000; }

    function quoteOracleStatus()
        public
        view
        returns (
            bool configured,
            bool roundDataSupported,
            bool legacyAnswerSupported,
            uint256 answerE18,
            uint256 updatedAt,
            bool stale,
            bool valid
        )
    {
        address oracle = quoteOracle;
        if (oracle == address(0)) return (false, false, false, 0, 0, false, false);

        configured = true;

        try IAggregatorV3Like(oracle).latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt_,
            uint80 answeredInRound
        ) {
            roundDataSupported = true;
            updatedAt = updatedAt_;

            uint8 oracleDecimals = 18;
            try IAggregatorV3Like(oracle).decimals() returns (uint8 d) {
                oracleDecimals = d;
            } catch {}

            if (answer <= 0 || updatedAt_ == 0 || answeredInRound < roundId || oracleDecimals > 18) {
                return (configured, roundDataSupported, false, 0, updatedAt_, false, false);
            }

            stale = maxOracleStaleness > 0 && block.timestamp > updatedAt_ + maxOracleStaleness;
            if (stale) {
                return (configured, roundDataSupported, false, 0, updatedAt_, true, false);
            }

            answerE18 = _scaleOracleAnswer(answer, oracleDecimals);
            valid = answerE18 > 0;
            return (configured, roundDataSupported, false, answerE18, updatedAt_, false, valid);
        } catch {}

        try IAggregatorLegacyLike(oracle).latestAnswer() returns (int256 answer) {
            legacyAnswerSupported = true;
            if (answer <= 0) return (configured, false, legacyAnswerSupported, 0, 0, false, false);
            answerE18 = uint256(answer);
            valid = answerE18 > 0;
            return (configured, false, legacyAnswerSupported, answerE18, 0, false, valid);
        } catch {}

        return (configured, false, false, 0, 0, false, false);
    }

    function refillNeeded() public view returns (bool needed, string memory reason) {
        if (paused()) return (false, "paused");
        if (baselineReserve == 0) return (false, "baseline not set");
        if (block.timestamp < lastRefillAt + cooldown) return (false, "cooldown");
        if (currentTokenReserve() >= minAllowedReserve()) return (false, "reserve healthy");
        return (true, "reserve depleted");
    }

    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        (bool needed,) = refillNeeded();
        upkeepNeeded = needed;
        performData = abi.encode(refillAmount);
    }

    function performUpkeep(bytes calldata performData) external whenNotPaused nonReentrant {
        if (!(keepers[msg.sender] || msg.sender == owner())) revert NotKeeper();
        uint256 amount = abi.decode(performData, (uint256));
        _refillDex(amount);
    }

    function manualRefillDex() external onlyOwner whenNotPaused nonReentrant { _refillDex(refillAmount); }

    function _refillDex(uint256 amount) internal {
        if (baselineReserve == 0) revert BaselineNotSet();
        if (block.timestamp < lastRefillAt + cooldown) revert CooldownActive();
        uint256 reserveNow = currentTokenReserve();
        if (reserveNow >= minAllowedReserve()) revert ReserveHealthy();
        if (priceCheckEnabled) _enforcePriceSanity();
        supplyController.refillDex(amount);
        lastRefillAt = block.timestamp;
        if (autoRefreshBaselineOnRefill) { baselineReserve = currentTokenReserve(); emit BaselineSnapshotted(baselineReserve); }
        emit RefillTriggered(reserveNow, baselineReserve, amount, block.timestamp);
    }

    function _enforcePriceSanity() internal view {
        uint256 dexPrice = currentDexPriceE18();
        if (dexPrice == 0) revert OraclePriceInvalid();
        if (quoteOracle != address(0)) {
            (
                ,
                ,
                ,
                uint256 oracleAnswerE18,
                ,
                bool stale,
                bool valid
            ) = quoteOracleStatus();
            if (stale) revert OraclePriceStale();
            if (!valid || oracleAnswerE18 == 0) revert OraclePriceInvalid();
            if (_deviationBps(dexPrice, oracleAnswerE18) > maxPriceDeviationBps) revert PriceDeviationTooHigh();
        } else if (requireQuoteOracleForPriceCheck) {
            revert OraclePriceInvalid();
        }
        if (lastGoodDexPriceE18 == 0) return;
        if (_deviationBps(dexPrice, lastGoodDexPriceE18) > maxPriceDeviationBps) revert PriceDeviationTooHigh();
    }

    function _deviationBps(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 higher = a > b ? a : b;
        uint256 lower = a > b ? b : a;
        if (lower == 0) return type(uint256).max;
        return ((higher - lower) * 10_000) / lower;
    }

    function _scaleOracleAnswer(int256 answer, uint8 oracleDecimals) internal pure returns (uint256) {
        uint256 value = uint256(answer);
        if (oracleDecimals == 18) return value;
        return value * (10 ** uint256(18 - oracleDecimals));
    }

    function _validatePair(address pair_, address token_, address quoteToken_) internal view {
        IUniswapV2PairGuard p = IUniswapV2PairGuard(pair_);
        address t0 = p.token0();
        address t1 = p.token1();
        bool tokenOk = t0 == token_ || t1 == token_;
        bool quoteOk = t0 == quoteToken_ || t1 == quoteToken_;
        if (!tokenOk || !quoteOk || t0 == t1) revert PairTokenMismatch();
    }
}
