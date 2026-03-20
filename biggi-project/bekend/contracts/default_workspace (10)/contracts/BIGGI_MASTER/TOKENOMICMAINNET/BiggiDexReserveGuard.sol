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

interface IAggregatorLike {
    function latestAnswer() external view returns (int256);
}

contract BiggiDexReserveGuard is Ownable, ReentrancyGuard, Pausable {
    error ZeroAddress();
    error CooldownActive();
    error BaselineNotSet();
    error ReserveHealthy();
    error NotKeeper();
    error OraclePriceInvalid();
    error PriceDeviationTooHigh();

    address public pair;
    address public token;
    address public quoteToken;
    IBiggiSupplyControllerDex public supplyController;
    IAggregatorLike public quoteOracle;

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

    event KeeperSet(address indexed keeper, bool allowed);
    event PairSet(address indexed pair);
    event QuoteOracleSet(address indexed oracle);
    event BaselineSnapshotted(uint256 reserve);
    event RefillTriggered(uint256 reserveNow, uint256 baselineReserve, uint256 refillAmount, uint256 timestamp);
    event PriceCheckConfigSet(bool enabled, uint256 maxDeviationBps);
    event CooldownSet(uint256 cooldownSec);
    event RefillAmountSet(uint256 amount);
    event ReserveRatioSet(uint256 ratioBps);
    event AutoRefreshBaselineSet(bool enabled);

    constructor(address initialOwner,address pair_,address token_,address quoteToken_,address supplyController_) Ownable(initialOwner) {
        if (initialOwner == address(0) || pair_ == address(0) || token_ == address(0) || quoteToken_ == address(0) || supplyController_ == address(0)) revert ZeroAddress();
        pair = pair_;
        token = token_;
        quoteToken = quoteToken_;
        supplyController = IBiggiSupplyControllerDex(supplyController_);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner { keepers[keeper] = allowed; emit KeeperSet(keeper, allowed); }
    function setPair(address pair_) external onlyOwner { if (pair_ == address(0)) revert ZeroAddress(); pair = pair_; emit PairSet(pair_); }
    function setQuoteOracle(address oracle_) external onlyOwner { quoteOracle = IAggregatorLike(oracle_); emit QuoteOracleSet(oracle_); }
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
        IUniswapV2PairGuard p = IUniswapV2PairGuard(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        return p.token0() == token ? uint256(r0) : uint256(r1);
    }

    function currentQuoteReserve() public view returns (uint256) {
        IUniswapV2PairGuard p = IUniswapV2PairGuard(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        return p.token0() == token ? uint256(r1) : uint256(r0);
    }

    function currentDexPriceE18() public view returns (uint256) {
        uint256 reserveToken = currentTokenReserve();
        uint256 reserveQuote = currentQuoteReserve();
        if (reserveToken == 0) return 0;
        return (reserveQuote * 1e18) / reserveToken;
    }

    function minAllowedReserve() public view returns (uint256) { return (baselineReserve * minReserveRatioBps) / 10_000; }

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
        if (address(quoteOracle) != address(0)) { int256 quoteAnswer = quoteOracle.latestAnswer(); if (quoteAnswer <= 0) revert OraclePriceInvalid(); }
        if (lastGoodDexPriceE18 == 0) return;
        uint256 higher = dexPrice > lastGoodDexPriceE18 ? dexPrice : lastGoodDexPriceE18;
        uint256 lower = dexPrice > lastGoodDexPriceE18 ? lastGoodDexPriceE18 : dexPrice;
        uint256 deviationBps = ((higher - lower) * 10_000) / lower;
        if (deviationBps > maxPriceDeviationBps) revert PriceDeviationTooHigh();
    }
}
