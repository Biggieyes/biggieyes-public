// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiErrorsLib.sol";

/* LM pull API (používá LM) */
interface IBiggiReserveV4 {
    function lmPullBiggiDexRefill(address to, uint256 amount) external;
    function lmPullPolDexRefill(address payable to, uint256 amount) external;
}

/* LM trigger interface (volá Reserve na LM) */
interface ILiquidityManagerTrigger {
    function onReserveTopUpRequest() external;
}

/* =============================================================================
 * BiggiReserveV4 - přijímá 20 % POL z Distributoru, drží BIGGI z Tokenu,
 * udržuje buckety WAITING/DEX_REFILL, volá LM a umožňuje LM stáhnout párovací
 * zůstatky k přidání LP.
 * =============================================================================*/
contract BiggiReserveV4 is Ownable2Step, ReentrancyGuard, Pausable, IBiggiReserveV4 {
    using SafeERC20 for IERC20;

    bytes32 public constant WAITING    = keccak256("WAITING");
    bytes32 public constant DEX_REFILL = keccak256("DEX_REFILL");

    IERC20 public immutable BIGGI;

    address public liquidityManager; // LM kontrakt
    address public distributor;      // povolený zdroj POL (Distributor)

    uint256 public totalPolReceived;
    uint256 public waitingBiggi;
    uint256 public dexRefillBiggi;

    event LMSet(address lm);
    event DistributorSet(address indexed oldAddr, address indexed newAddr);
    event MintShareFromDistributor(uint256 amount);
    event BiggiNotified(bytes32 bucket, uint256 amount, uint256 waitingBal, uint256 refillBal);
    event TopUpRequested();
    event PulledToLM(uint256 biggiAmt, uint256 polAmt, address to);
    event DexRefillOwnerTopUp(uint256 amount, uint256 newDexRefill);

    // DŮLEŽITÉ: voláme base Ownable(owner_) (ne Ownable2Step(owner_)),
    // protože u tebe Ownable2Step zjevně nebere argumenty, ale Ownable ano.
    constructor(address biggi, address owner_) Ownable(owner_) {
        if (biggi == address(0) || owner_ == address(0)) revert BiggiErrorsLib.ZeroAddress();
        BIGGI = IERC20(biggi);
    }

    /* ===== Admin ===== */
    function setLiquidityManager(address lm) external onlyOwner {
        if (lm == address(0)) revert BiggiErrorsLib.ZeroAddress();
        liquidityManager = lm;
        emit LMSet(lm);
    }

    function setDistributor(address d) external onlyOwner {
        if (d == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit DistributorSet(distributor, d);
        distributor = d;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ===== Distributor → 20 % POL ===== */
    /// @dev intentionally without nonReentrant: LM auto-pairing may pull from reserve in same tx
    function receiveMintShare() external payable whenNotPaused {
        if (msg.sender != distributor) revert BiggiErrorsLib.NotDistributor();
        if (msg.value == 0) revert BiggiErrorsLib.AmountZero();

        totalPolReceived += msg.value;
        emit MintShareFromDistributor(msg.value);

        _tryTriggerTopUpToLM();
    }

    /* ===== Token notify: mintToReserveForPair ===== */
    function onBiggiMintedToReserve(uint256 amount, bytes32 bucket) external whenNotPaused {
        if (msg.sender != address(BIGGI)) revert BiggiErrorsLib.OnlyToken();

        if (bucket == WAITING) {
            waitingBiggi += amount;
        } else if (bucket == DEX_REFILL) {
            dexRefillBiggi += amount;
        } else {
            revert("bad bucket");
        }

        emit BiggiNotified(bucket, amount, waitingBiggi, dexRefillBiggi);
    }

    /// @notice Compatibility hook for Main/Main2 BIGGI forwarding.
    /// @dev Any caller can notify, but accounting is capped by real token balance.
    function notifyBiggiReceived(uint256 amount) external whenNotPaused {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        uint256 bal = BIGGI.balanceOf(address(this));
        require(bal >= waitingBiggi + dexRefillBiggi + amount, "insufficient BIGGI balance");
        dexRefillBiggi += amount;
        emit BiggiNotified(DEX_REFILL, amount, waitingBiggi, dexRefillBiggi);
    }

    /// @notice Owner top-up dexRefill bucket pro manuální accounting (např. po transferu BIGGI do reserve)
    /// @dev Vyžaduje, aby fyzický BIGGI zůstatek v reserve pokryl i stávající waiting+refill+amount.
    function ownerTopUpDexRefill(uint256 amount) external onlyOwner {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        uint256 bal = BIGGI.balanceOf(address(this));
        require(bal >= waitingBiggi + dexRefillBiggi + amount, "insufficient BIGGI balance");
        dexRefillBiggi += amount;
        emit DexRefillOwnerTopUp(amount, dexRefillBiggi);
    }

    /* ===== Ping od Treasury/Buybacku → vyvolej LM akci ===== */
    function requestTopUpToLM() external {
        if (liquidityManager == address(0)) revert BiggiErrorsLib.ZeroAddress();
        ILiquidityManagerTrigger(liquidityManager).onReserveTopUpRequest();
        emit TopUpRequested();
    }

    function _tryTriggerTopUpToLM() internal {
        if (liquidityManager == address(0)) return;
        try ILiquidityManagerTrigger(liquidityManager).onReserveTopUpRequest() {
            emit TopUpRequested();
        } catch {
            // keep mint distribution path alive even if LM call fails
        }
    }

    /* ===== LM stáhne párovací prostředky k přidání LP ===== */
    function lmPullBiggiDexRefill(address to, uint256 amount) external override nonReentrant whenNotPaused {
        if (msg.sender != liquidityManager) revert BiggiErrorsLib.NotLiquidityManager();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        require(dexRefillBiggi >= amount, "insufficient BIGGI bucket");

        dexRefillBiggi -= amount;
        BIGGI.safeTransfer(to, amount);

        emit PulledToLM(amount, 0, to);
    }

    function lmPullPolDexRefill(address payable to, uint256 amount) external override nonReentrant whenNotPaused {
        if (msg.sender != liquidityManager) revert BiggiErrorsLib.NotLiquidityManager();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        require(address(this).balance >= amount, "insufficient POL");

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "POL xfer fail");

        emit PulledToLM(0, amount, to);
    }

    /* ===== View helpers ===== */
    function biggiBalance() external view returns (uint256) { return BIGGI.balanceOf(address(this)); }
    function polBalance() external view returns (uint256) { return address(this).balance; }
    function getPolAvailable() external view returns (uint256) { return address(this).balance; }
    function availableForDexRefill() external view returns (uint256) { return dexRefillBiggi; }

    receive() external payable {}
}
