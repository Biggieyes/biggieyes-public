// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/* ===== Orchestrator interface (minimal) ===== */
interface ILiquidityOrchestrator {
    function triggerPairing(uint256 requestedPol) external;
}

/* ===== Reserve interface (view only for sizing) ===== */
interface IReserveForKeeper {
    function polBalance() external view returns (uint256);
    function dexRefillBiggi() external view returns (uint256);
}

/**
 * @title BiggiLiquidityKeeperProxy
 * @dev KeeperProxy nad BiggiLiquidityOrchestrator.
 *      - Chainlink Automation kompatibilní: checkUpkeep / performUpkeep
 *      - Strategy pro amount: FIXED nebo PCT z reserve balance
 *      - Další lokální limity: minInterval, minReservePol, maxPerTx, minDexRefillBiggi
 *
+ * Pozn.: Orchestrator má vlastní pravidla (cooldown/quota/limity). KeeperProxy je nadstavba
 *        pro automatizaci a sizing amountu.
 */
contract BiggiLiquidityKeeperProxy is Ownable2Step, ReentrancyGuard, Pausable {
    error ZeroAddress();
    error NotAllowedCaller();
    error NoWork();
    error BadConfig();

    enum AmountMode {
        FIXED,      // vždy fixedAmount
        PCT_RESERVE // percentBps z reserve.polBalance()
    }

    ILiquidityOrchestrator public orchestrator;
    IReserveForKeeper public reserve;

    // Allowlist volajícího (např. Chainlink registry / executor)
    // Pokud nechceš řešit allowlist, nech "allowedCaller = address(0)" => povoleno komukoli.
    address public allowedCaller;

    // Sizing
    AmountMode public amountMode = AmountMode.PCT_RESERVE;
    uint256 public fixedAmount = 1 ether;     // když FIXED
    uint256 public percentBps = 500;          // 5.00% když PCT_RESERVE (BPS: 10000 = 100%)

    // Local safety limits (navíc k orchestrátoru)
    uint256 public minIntervalSec = 900;      // 15 min
    uint256 public lastPerformTs;

    uint256 public minReservePol = 1 ether; // minimální POL v reserve pro spuštění
    uint256 public maxPerTx = 20 ether;       // horní limit amountu z keeper proxy
    uint256 public minDexRefillBiggi = 1e18;  // minimální BIGGI v DEX_REFILL bucketu pro spuštění

    event OrchestratorSet(address indexed oldO, address indexed newO);
    event ReserveSet(address indexed oldR, address indexed newR);
    event AllowedCallerSet(address indexed oldA, address indexed newA);

    event StrategySet(AmountMode mode, uint256 fixedAmount, uint256 percentBps);
    event LimitsSet(
        uint256 minIntervalSec,
        uint256 minReservePol,
        uint256 maxPerTx,
        uint256 minDexRefillBiggi
    );

    event Performed(address indexed caller, uint256 amount);

    // DŮLEŽITÉ: base Ownable(owner_) kvůli OZ verzi, která chce initialOwner v Ownable constructoru
    constructor(address orchestrator_, address reserve_, address owner_) Ownable(owner_) {
        if (orchestrator_ == address(0) || reserve_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        orchestrator = ILiquidityOrchestrator(orchestrator_);
        reserve = IReserveForKeeper(reserve_);
    }

    /* ===================== Admin ===================== */

    function setOrchestrator(address o) external onlyOwner {
        if (o == address(0)) revert ZeroAddress();
        emit OrchestratorSet(address(orchestrator), o);
        orchestrator = ILiquidityOrchestrator(o);
    }

    function setReserve(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        emit ReserveSet(address(reserve), r);
        reserve = IReserveForKeeper(r);
    }

    /// @notice Pokud nastavíš allowedCaller != 0, pouze tato adresa smí volat performUpkeep.
    ///        Pokud je allowedCaller = 0, performUpkeep může volat kdokoli.
    function setAllowedCaller(address a) external onlyOwner {
        emit AllowedCallerSet(allowedCaller, a);
        allowedCaller = a;
    }

    function setStrategy(AmountMode mode, uint256 fixedAmount_, uint256 percentBps_) external onlyOwner {
        if (mode == AmountMode.FIXED) {
            require(fixedAmount_ > 0, "fixed=0");
        } else {
            require(percentBps_ > 0 && percentBps_ <= 10_000, "bad bps");
        }
        amountMode = mode;
        fixedAmount = fixedAmount_;
        percentBps = percentBps_;
        emit StrategySet(mode, fixedAmount_, percentBps_);
    }

    function setLimits(
        uint256 minIntervalSec_,
        uint256 minReservePol_,
        uint256 maxPerTx_,
        uint256 minDexRefillBiggi_
    ) external onlyOwner {
        if (minIntervalSec_ > 7 days) revert BadConfig();
        if (maxPerTx_ == 0) revert BadConfig();

        minIntervalSec = minIntervalSec_;
        minReservePol = minReservePol_;
        maxPerTx = maxPerTx_;
        minDexRefillBiggi = minDexRefillBiggi_;

        emit LimitsSet(minIntervalSec_, minReservePol_, maxPerTx_, minDexRefillBiggi_);
    }

    function pauseAll() external onlyOwner { _pause(); }
    function unpauseAll() external onlyOwner { _unpause(); }

    /* ===================== Chainlink Automation ===================== */

    function checkUpkeep(bytes calldata)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (paused()) return (false, bytes("paused"));

        if (block.timestamp < lastPerformTs + minIntervalSec) {
            return (false, bytes("interval"));
        }

        uint256 pol = reserve.polBalance();
        if (pol < minReservePol) {
            return (false, bytes("reserve pol low"));
        }

        uint256 biggiBucket = reserve.dexRefillBiggi();
        if (biggiBucket < minDexRefillBiggi) {
            return (false, bytes("reserve biggi bucket low"));
        }

        uint256 amount = _computeAmount(pol);
        if (amount == 0) {
            return (false, bytes("amount=0"));
        }

        return (true, abi.encode(amount));
    }

    function performUpkeep(bytes calldata performData)
        external
        nonReentrant
        whenNotPaused
    {
        if (allowedCaller != address(0) && msg.sender != allowedCaller) revert NotAllowedCaller();

        if (block.timestamp < lastPerformTs + minIntervalSec) revert NoWork();

        uint256 pol = reserve.polBalance();
        if (pol < minReservePol) revert NoWork();

        uint256 biggiBucket = reserve.dexRefillBiggi();
        if (biggiBucket < minDexRefillBiggi) revert NoWork();

        uint256 amount;
        if (performData.length == 32) {
            amount = abi.decode(performData, (uint256));
        } else {
            amount = _computeAmount(pol);
        }

        if (amount > maxPerTx) amount = maxPerTx;
        if (amount > pol) amount = pol;

        if (amount == 0) revert NoWork();

        lastPerformTs = block.timestamp;

        orchestrator.triggerPairing(amount);

        emit Performed(msg.sender, amount);
    }

    /* ===================== Admin manual trigger ===================== */

    function adminTrigger(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "amount=0");
        lastPerformTs = block.timestamp;
        orchestrator.triggerPairing(amount);
        emit Performed(msg.sender, amount);
    }

    /* ===================== Views ===================== */

    function computedAmountNow() external view returns (uint256 amount, uint256 reservePol) {
        reservePol = reserve.polBalance();
        amount = _computeAmount(reservePol);
        if (amount > maxPerTx) amount = maxPerTx;
        if (amount > reservePol) amount = reservePol;
    }

    /* ===================== Internal ===================== */

    function _computeAmount(uint256 reservePolBal) internal view returns (uint256 amount) {
        if (amountMode == AmountMode.FIXED) {
            amount = fixedAmount;
        } else {
            amount = (reservePolBal * percentBps) / 10_000;
        }
        if (amount > maxPerTx) amount = maxPerTx;
        if (amount > reservePolBal) amount = reservePolBal;
    }
}

