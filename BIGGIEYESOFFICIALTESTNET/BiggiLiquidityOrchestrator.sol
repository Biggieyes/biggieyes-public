// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/* ===== Minimal view/exec interfaces ===== */

interface IBiggiReserveOrch {
    function polBalance() external view returns (uint256);
    function dexRefillBiggi() external view returns (uint256);
    function requestTopUpToLM() external;
    function liquidityManager() external view returns (address);
}

interface IBiggiLiquidityManagerOrch {
    function executePairing(uint256 requestedPol) external;

    function tokenPct() external view returns (uint8);
    function slippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
    function keeper() external view returns (address);

    function reserve() external view returns (address);
    function liquidityVault() external view returns (address);
    function router() external view returns (address);
}

interface ILiquidityVaultOrch {
    function liquidityManager() external view returns (address);
}

contract BiggiLiquidityOrchestrator is Ownable2Step, ReentrancyGuard, Pausable {
    error ZeroAddress();
    error OnlyOwnerOrKeeper();
    error Cooldown();
    error DailyQuotaExceeded();
    error RequestedZero();
    error BelowMinPerTx();
    error AboveMaxPerTx();
    error ReservePolLow();
    error ReserveBiggiLow();
    error WiringMismatch();

    IBiggiReserveOrch public reserve;
    IBiggiLiquidityManagerOrch public lm;

    address public keeper;

    uint256 public minPolPerTx = 0.5 ether;
    uint256 public maxPolPerTx = 50 ether;
    uint256 public minDexRefillBiggi = 1e18;
    uint256 public cooldownSec = 3600;
    uint256 public dailyQuotaPol = 0;

    uint256 public lastRunTimestamp;
    uint256 public usedToday;
    uint256 public dayMarker;

    event KeeperSet(address indexed oldK, address indexed newK);
    event ReserveSet(address indexed oldR, address indexed newR);
    event LMSet(address indexed oldLM, address indexed newLM);

    event LimitsUpdated(
        uint256 minPolPerTx,
        uint256 maxPolPerTx,
        uint256 minDexRefillBiggi,
        uint256 cooldownSec,
        uint256 dailyQuotaPol
    );

    event PairingTriggered(address indexed by, uint256 requestedPol);
    event ReserveTopUpRequested(address indexed by);

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert OnlyOwnerOrKeeper();
        _;
    }

    // OZ v5: Ownable má constructor(address initialOwner)
    constructor(address reserve_, address lm_, address owner_)
        Ownable(owner_)
    {
        if (reserve_ == address(0) || lm_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        reserve = IBiggiReserveOrch(reserve_);
        lm = IBiggiLiquidityManagerOrch(lm_);
        dayMarker = block.timestamp / 1 days;
    }

    /* ===================== Admin wiring ===================== */

    function setKeeper(address k) external onlyOwner {
        emit KeeperSet(keeper, k);
        keeper = k;
    }

    function setReserve(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        emit ReserveSet(address(reserve), r);
        reserve = IBiggiReserveOrch(r);
    }

    function setLM(address l) external onlyOwner {
        if (l == address(0)) revert ZeroAddress();
        emit LMSet(address(lm), l);
        lm = IBiggiLiquidityManagerOrch(l);
    }

    /* ===================== Admin params ===================== */

    function setLimits(
        uint256 minPolPerTx_,
        uint256 maxPolPerTx_,
        uint256 minDexRefillBiggi_,
        uint256 cooldownSec_,
        uint256 dailyQuotaPol_
    ) external onlyOwner {
        require(minPolPerTx_ <= maxPolPerTx_, "min>max");
        require(cooldownSec_ <= 7 days, "cooldown too big");

        minPolPerTx = minPolPerTx_;
        maxPolPerTx = maxPolPerTx_;
        minDexRefillBiggi = minDexRefillBiggi_;
        cooldownSec = cooldownSec_;
        dailyQuotaPol = dailyQuotaPol_;

        emit LimitsUpdated(minPolPerTx, maxPolPerTx, minDexRefillBiggi, cooldownSec, dailyQuotaPol);
    }

    function pauseAll() external onlyOwner { _pause(); }
    function unpauseAll() external onlyOwner { _unpause(); }

    /* ===================== Core orchestration ===================== */

    function triggerPairing(uint256 requestedPol)
        external
        nonReentrant
        whenNotPaused
        onlyOwnerOrKeeper
    {
        if (requestedPol == 0) revert RequestedZero();
        if (requestedPol < minPolPerTx) revert BelowMinPerTx();
        if (requestedPol > maxPolPerTx) revert AboveMaxPerTx();

        if (reserve.liquidityManager() != address(lm)) revert WiringMismatch();
        if (lm.reserve() != address(reserve)) revert WiringMismatch();
        address vault = lm.liquidityVault();
        if (vault == address(0)) revert WiringMismatch();
        if (ILiquidityVaultOrch(vault).liquidityManager() != address(lm)) revert WiringMismatch();

        if (block.timestamp < lastRunTimestamp + cooldownSec) revert Cooldown();

        _resetDayIfNeeded();
        if (dailyQuotaPol != 0 && usedToday + requestedPol > dailyQuotaPol) revert DailyQuotaExceeded();

        if (reserve.polBalance() < requestedPol) revert ReservePolLow();
        if (reserve.dexRefillBiggi() < minDexRefillBiggi) revert ReserveBiggiLow();

        usedToday += requestedPol;
        lastRunTimestamp = block.timestamp;

        lm.executePairing(requestedPol);

        emit PairingTriggered(msg.sender, requestedPol);
    }

    function requestReserveTopUp() external onlyOwnerOrKeeper whenNotPaused {
        reserve.requestTopUpToLM();
        emit ReserveTopUpRequested(msg.sender);
    }

    /* ===================== Views for Admin panel (split to avoid stack-too-deep) ===================== */

    function adminSnapshotCore() external view returns (
        // balances
        uint256 reservePol,
        uint256 reserveDexRefillBiggi,

        // orchestrator state
        uint256 _minPolPerTx,
        uint256 _maxPolPerTx,
        uint256 _minDexRefillBiggi,
        uint256 _cooldownSec,
        uint256 _dailyQuotaPol,
        uint256 _lastRun,
        uint256 _usedToday,
        uint256 _dayMarker,

        // wiring
        address reserveAddr,
        address lmAddr,
        address keeperAddr,
        bool wiredOk
    ) {
        reservePol = reserve.polBalance();
        reserveDexRefillBiggi = reserve.dexRefillBiggi();

        _minPolPerTx = minPolPerTx;
        _maxPolPerTx = maxPolPerTx;
        _minDexRefillBiggi = minDexRefillBiggi;
        _cooldownSec = cooldownSec;
        _dailyQuotaPol = dailyQuotaPol;
        _lastRun = lastRunTimestamp;
        _usedToday = usedToday;
        _dayMarker = dayMarker;

        reserveAddr = address(reserve);
        lmAddr = address(lm);
        keeperAddr = keeper;

        wiredOk = (reserve.liquidityManager() == address(lm)) && (lm.reserve() == address(reserve));
        if (wiredOk) {
            address vaultAddr = lm.liquidityVault();
            if (vaultAddr == address(0)) {
                wiredOk = false;
            } else {
                try ILiquidityVaultOrch(vaultAddr).liquidityManager() returns (address lmInVault) {
                    wiredOk = lmInVault == address(lm);
                } catch {
                    wiredOk = false;
                }
            }
        }
    }

    function adminSnapshotLM() external view returns (
        uint8 lmTokenPct,
        uint256 lmSlippageBps,
        uint256 lmDeadlineSec,
        address lmKeeper,
        address lmRouter,
        address lmVault,
        address lmReserve
    ) {
        lmTokenPct = lm.tokenPct();
        lmSlippageBps = lm.slippageBps();
        lmDeadlineSec = lm.txDeadlineSec();
        lmKeeper = lm.keeper();
        lmRouter = lm.router();
        lmVault = lm.liquidityVault();
        lmReserve = lm.reserve();
    }

    function _resetDayIfNeeded() internal {
        uint256 today = block.timestamp / 1 days;
        if (today != dayMarker) {
            dayMarker = today;
            usedToday = 0;
        }
    }
}

