// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IUniswapV2PairLite {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IBiggiSupplyToken {
    function mintToDripDistributor(uint256 amount) external;
    function mintToTokenRewards(uint256 amount) external;
}

interface IERC20Lite {
    function balanceOf(address account) external view returns (uint256);
}

contract BiggiSupplyController is Ownable, ReentrancyGuard, Pausable {
    bytes32 public constant CIRCUIT_DEX = keccak256("DEX_CRITICAL");
    bytes32 public constant CIRCUIT_REWARDS = keccak256("REWARDS_CRITICAL");

    address public immutable token;
    address public immutable dripDistributor;
    address public immutable tokenRewards;
    address public pair;

    uint256 public baselineReserve;
    uint256 public minimumReserveFloor;      // hard floor under which refill is always allowed if cooldown passed
    uint256 public reserveDropBps = 5000;    // trigger if reserve drops below 50% of baseline
    bool public autoRefreshBaselineOnDexRefill;

    uint256 public dexRefillAmount = 20_000_000e18;
    uint256 public dexCooldown = 30 minutes;
    uint256 public lastDexRefill;

    uint256 public rewardsThreshold = 5_000_000e18;
    uint256 public rewardsRefillAmount = 200_000_000e18;
    uint256 public rewardsCooldown = 12 hours;
    uint256 public lastRewardsRefill;

    bool public circuitBreakerEnabled = true;
    uint256 public dexCriticalFloor = 500e18;
    uint256 public rewardsCriticalFloor = 500e18;

    mapping(address => bool) public keepers;
    mapping(address => bool) public allowedCallers;

    event PairSet(address indexed oldPair, address indexed newPair);
    event BaselineSnapshotted(uint256 reserve);
    event DexConfigSet(uint256 reserveDropBps, uint256 dexRefillAmount, uint256 dexCooldown, uint256 minimumReserveFloor, bool autoRefreshBaselineOnDexRefill);
    event RewardsConfigSet(uint256 rewardsThreshold, uint256 rewardsRefillAmount, uint256 rewardsCooldown);
    event KeeperSet(address indexed keeper, bool allowed);
    event AllowedCallerSet(address indexed caller, bool allowed);
    event DexRefill(uint256 reserveBefore, uint256 baselineReserve, uint256 amount, bool floorTriggered);
    event RewardsRefill(uint256 balanceBefore, uint256 threshold, uint256 amount);
    event MaintenancePerformed(address indexed caller, bool dexTriggered, bool rewardsTriggered);
    event PausedController();
    event UnpausedController();
    event CircuitBreakerConfigSet(bool enabled, uint256 dexCriticalFloor, uint256 rewardsCriticalFloor);
    event CircuitBreakerTripped(bytes32 indexed reason, uint256 observed, uint256 floor);

    modifier onlyKeeperOrOwner() {
        require(msg.sender == owner() || keepers[msg.sender] || allowedCallers[msg.sender], "not keeper/owner");
        _;
    }

    constructor(address initialOwner,address token_,address dripDistributor_,address tokenRewards_,address pair_) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(token_ != address(0), "token=0");
        require(dripDistributor_ != address(0), "drip=0");
        require(tokenRewards_ != address(0), "rewards=0");
        token = token_;
        dripDistributor = dripDistributor_;
        tokenRewards = tokenRewards_;
        pair = pair_;
    }

    function pause() external onlyOwner { _pause(); emit PausedController(); }
    function unpause() external onlyOwner { _unpause(); emit UnpausedController(); }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setAllowedCaller(address caller, bool allowed) external onlyOwner {
        allowedCallers[caller] = allowed;
        emit AllowedCallerSet(caller, allowed);
    }

    function setPair(address pair_) external onlyOwner {
        require(pair_ != address(0), "pair=0");
        emit PairSet(pair, pair_);
        pair = pair_;
    }

    function setDexConfig(uint256 reserveDropBps_, uint256 dexRefillAmount_, uint256 dexCooldown_, uint256 minimumReserveFloor_, bool autoRefreshBaseline_) external onlyOwner {
        require(reserveDropBps_ > 0 && reserveDropBps_ <= 10000, "bad bps");
        reserveDropBps = reserveDropBps_;
        dexRefillAmount = dexRefillAmount_;
        dexCooldown = dexCooldown_;
        minimumReserveFloor = minimumReserveFloor_;
        autoRefreshBaselineOnDexRefill = autoRefreshBaseline_;
        emit DexConfigSet(reserveDropBps_, dexRefillAmount_, dexCooldown_, minimumReserveFloor_, autoRefreshBaseline_);
    }

    function setRewardsConfig(uint256 rewardsThreshold_, uint256 rewardsRefillAmount_, uint256 rewardsCooldown_) external onlyOwner {
        rewardsThreshold = rewardsThreshold_;
        rewardsRefillAmount = rewardsRefillAmount_;
        rewardsCooldown = rewardsCooldown_;
        emit RewardsConfigSet(rewardsThreshold_, rewardsRefillAmount_, rewardsCooldown_);
    }

    function setCircuitBreakerConfig(bool enabled, uint256 dexCriticalFloor_, uint256 rewardsCriticalFloor_) external onlyOwner {
        circuitBreakerEnabled = enabled;
        dexCriticalFloor = dexCriticalFloor_;
        rewardsCriticalFloor = rewardsCriticalFloor_;
        emit CircuitBreakerConfigSet(enabled, dexCriticalFloor_, rewardsCriticalFloor_);
    }

    function snapshotBaseline() external onlyOwner {
        uint256 reserve = _getTokenReserve();
        require(reserve > 0, "reserve=0");
        baselineReserve = reserve;
        emit BaselineSnapshotted(reserve);
    }

    function previewMaintenance() public view returns (bool dexNeeded, bool rewardsNeeded, uint256 currentReserve, uint256 rewardsBalance) {
        currentReserve = pair == address(0) ? 0 : _tryGetReserve();
        rewardsBalance = IERC20Lite(token).balanceOf(tokenRewards);
        dexNeeded = _isDexRefillNeeded(currentReserve);
        rewardsNeeded = _isRewardsRefillNeeded(rewardsBalance);
    }

    function previewCriticalStatus()
        external
        view
        returns (bool dexCritical, bool rewardsCritical, uint256 currentReserve, uint256 rewardsBalance)
    {
        currentReserve = pair == address(0) ? 0 : _tryGetReserve();
        rewardsBalance = IERC20Lite(token).balanceOf(tokenRewards);
        dexCritical = pair != address(0) && dexCriticalFloor > 0 && currentReserve < dexCriticalFloor;
        rewardsCritical = rewardsCriticalFloor > 0 && rewardsBalance < rewardsCriticalFloor;
    }

    function performMaintenance() public nonReentrant whenNotPaused onlyKeeperOrOwner returns (bool dexTriggered, bool rewardsTriggered) {
        uint256 reserve = pair == address(0) ? 0 : _getTokenReserve();
        uint256 bal = IERC20Lite(token).balanceOf(tokenRewards);
        (dexTriggered, rewardsTriggered) = _applyMaintenance(true, true, reserve, bal);
        emit MaintenancePerformed(msg.sender, dexTriggered, rewardsTriggered);
    }

    function performMaintenanceWithFlags(bool allowDex, bool allowRewards)
        public
        nonReentrant
        whenNotPaused
        onlyKeeperOrOwner
        returns (bool dexTriggered, bool rewardsTriggered)
    {
        uint256 reserve = pair == address(0) ? 0 : _getTokenReserve();
        uint256 bal = IERC20Lite(token).balanceOf(tokenRewards);
        (dexTriggered, rewardsTriggered) = _applyMaintenance(allowDex, allowRewards, reserve, bal);
        emit MaintenancePerformed(msg.sender, dexTriggered, rewardsTriggered);
    }

    function checkDexDepletion() external returns (bool) {
        (bool d,,, ) = _single(true, false);
        return d;
    }

    function checkRewardsThreshold() external returns (bool) {
        (, bool r,, ) = _single(false, true);
        return r;
    }

    function _single(bool allowDex, bool allowRewards)
        internal
        nonReentrant
        whenNotPaused
        onlyKeeperOrOwner
        returns (bool dexTriggered, bool rewardsTriggered, uint256 reserve, uint256 bal)
    {
        reserve = pair == address(0) ? 0 : _getTokenReserve();
        bal = IERC20Lite(token).balanceOf(tokenRewards);
        (dexTriggered, rewardsTriggered) = _applyMaintenance(allowDex, allowRewards, reserve, bal);
    }

    // Chainlink/Gelato-friendly hooks
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        (bool dexNeeded, bool rewardsNeeded,,) = previewMaintenance();
        upkeepNeeded = dexNeeded || rewardsNeeded;
        performData = abi.encode(dexNeeded, rewardsNeeded);
    }

    function performUpkeep(bytes calldata performData) external {
        if (performData.length == 0) {
            performMaintenance();
            return;
        }

        (bool dexAllowed, bool rewardsAllowed) = abi.decode(performData, (bool, bool));
        performMaintenanceWithFlags(dexAllowed, rewardsAllowed);
    }

    function refillDex(uint256 amount) external nonReentrant whenNotPaused onlyKeeperOrOwner {
        require(amount > 0, "amount=0");
        IBiggiSupplyToken(token).mintToDripDistributor(amount);
        lastDexRefill = block.timestamp;
        emit DexRefill(pair == address(0) ? 0 : _tryGetReserve(), baselineReserve, amount, minimumReserveFloor > 0 && (pair == address(0) ? 0 : _tryGetReserve()) < minimumReserveFloor);
    }

    function refillRewards(uint256 amount) external nonReentrant whenNotPaused onlyKeeperOrOwner {
        require(amount > 0, "amount=0");
        uint256 bal = IERC20Lite(token).balanceOf(tokenRewards);
        IBiggiSupplyToken(token).mintToTokenRewards(amount);
        lastRewardsRefill = block.timestamp;
        emit RewardsRefill(bal, rewardsThreshold, amount);
    }

    function currentPairReserve() external view returns (uint256) { return _getTokenReserve(); }

    function _isDexRefillNeeded(uint256 reserve) internal view returns (bool) {
        if (paused()) return false;
        if (pair == address(0)) return false;
        if (block.timestamp < lastDexRefill + dexCooldown) return false;
        if (minimumReserveFloor > 0 && reserve < minimumReserveFloor) return true;
        if (baselineReserve == 0) return false;
        return reserve * 10000 < baselineReserve * reserveDropBps;
    }

    function _isRewardsRefillNeeded(uint256 bal) internal view returns (bool) {
        if (paused()) return false;
        if (block.timestamp < lastRewardsRefill + rewardsCooldown) return false;
        return bal < rewardsThreshold;
    }

    function _tryGetReserve() internal view returns (uint256) {
        IUniswapV2PairLite p = IUniswapV2PairLite(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        if (p.token0() == token) return uint256(r0);
        if (p.token1() == token) return uint256(r1);
        return 0;
    }

    function _getTokenReserve() internal view returns (uint256) {
        require(pair != address(0), "pair not set");
        IUniswapV2PairLite p = IUniswapV2PairLite(pair);
        (uint112 r0, uint112 r1,) = p.getReserves();
        if (p.token0() == token) return uint256(r0);
        if (p.token1() == token) return uint256(r1);
        revert("token not in pair");
    }

    function _applyMaintenance(bool allowDex, bool allowRewards, uint256 reserve, uint256 bal)
        internal
        returns (bool dexTriggered, bool rewardsTriggered)
    {
        if (allowDex && _isDexRefillNeeded(reserve)) {
            bool floorTriggered = minimumReserveFloor > 0 && reserve < minimumReserveFloor;
            IBiggiSupplyToken(token).mintToDripDistributor(dexRefillAmount);
            lastDexRefill = block.timestamp;
            if (autoRefreshBaselineOnDexRefill && reserve > 0) {
                baselineReserve = reserve + dexRefillAmount;
            }
            emit DexRefill(reserve, baselineReserve, dexRefillAmount, floorTriggered);
            dexTriggered = true;
        }

        if (allowRewards && _isRewardsRefillNeeded(bal)) {
            IBiggiSupplyToken(token).mintToTokenRewards(rewardsRefillAmount);
            lastRewardsRefill = block.timestamp;
            emit RewardsRefill(bal, rewardsThreshold, rewardsRefillAmount);
            rewardsTriggered = true;
        }

        _enforceCircuitBreakerAfterMaintenance();
    }

    function _enforceCircuitBreakerAfterMaintenance() internal {
        if (!circuitBreakerEnabled || paused()) return;

        uint256 reserveNow = pair == address(0) ? 0 : _tryGetReserve();
        if (pair != address(0) && dexCriticalFloor > 0 && reserveNow < dexCriticalFloor) {
            _pause();
            emit PausedController();
            emit CircuitBreakerTripped(CIRCUIT_DEX, reserveNow, dexCriticalFloor);
            return;
        }

        uint256 rewardsBalance = IERC20Lite(token).balanceOf(tokenRewards);
        if (rewardsCriticalFloor > 0 && rewardsBalance < rewardsCriticalFloor) {
            _pause();
            emit PausedController();
            emit CircuitBreakerTripped(CIRCUIT_REWARDS, rewardsBalance, rewardsCriticalFloor);
        }
    }
}
