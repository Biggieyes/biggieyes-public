// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiErrorsLib.sol";

/* LM pull API (používá LM) */
interface IBiggiReserveV4 {
    function lmPullBiggiDexRefill(address to, uint256 amount) external;
    function lmPullMaticDexRefill(address payable to, uint256 amount) external;
}

/* LM trigger interface (volá Reserve na LM) */
interface ILiquidityManagerTrigger {
    function onReserveTopUpRequest() external;
}

/* =============================================================================
 * BiggiReserveV4 — přijímá 20 % MATIC z Distributoru, drží BIGGI z Tokenu,
 * udržuje buckety WAITING/DEX_REFILL, volá LM a umožňuje LM stáhnout párové
 * částky k přidání LP.
 * =============================================================================*/
contract BiggiReserveV4 is Ownable2Step, ReentrancyGuard, Pausable, IBiggiReserveV4 {
    using SafeERC20 for IERC20;

    // veřejné konstantní bucket klíče (pro token notify)
    bytes32 public constant WAITING   = keccak256("WAITING");
    bytes32 public constant DEX_REFILL= keccak256("DEX_REFILL");

    IERC20  public immutable BIGGI;
    address public liquidityManager;   // LM kontrakt

    uint256 public totalMaticReceived;
    uint256 public waitingBiggi;       // BIGGI v bucketu WAITING
    uint256 public dexRefillBiggi;     // BIGGI v bucketu DEX_REFILL

    event LMSet(address lm);
    event MintShareFromDistributor(uint256 amount);
    event BiggiNotified(bytes32 bucket, uint256 amount, uint256 waitingBal, uint256 refillBal);
    event TopUpRequested();
    event PulledToLM(uint256 biggiAmt, uint256 maticAmt, address to);

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
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ===== Distributor → 20 % MATIC ===== */
    function receiveMintShare() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert BiggiErrorsLib.AmountZero();
        totalMaticReceived += msg.value;
        emit MintShareFromDistributor(msg.value);
        // MATIC zůstává zde pro párování
    }

    /* ===== Token notify: mintToReserveForPair ===== */
    function onBiggiMintedToReserve(uint256 amount, bytes32 bucket) external whenNotPaused {
        // Token poslal _mint(reserve, amount), takže BIGGI už leží zde.
        // Jen zaúčtujeme bucket.
        if (bucket == WAITING) {
            waitingBiggi += amount;
        } else if (bucket == DEX_REFILL) {
            dexRefillBiggi += amount;
        } else {
            revert("bad bucket");
        }
        emit BiggiNotified(bucket, amount, waitingBiggi, dexRefillBiggi);
    }

    /* ===== Ping od Treasury/Buybacku → vyvolej LM akci ===== */
    function requestTopUpToLM() external {
        if (liquidityManager == address(0)) revert BiggiErrorsLib.ZeroAddress();
        ILiquidityManagerTrigger(liquidityManager).onReserveTopUpRequest();
        emit TopUpRequested();
    }

    /* ===== LM stáhne párové prostředky k přidání LP ===== */
    function lmPullBiggiDexRefill(address to, uint256 amount) external override nonReentrant whenNotPaused {
        if (msg.sender != liquidityManager) revert BiggiErrorsLib.NotLiquidityManager();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        require(dexRefillBiggi >= amount, "insufficient BIGGI bucket");
        dexRefillBiggi -= amount;
        BIGGI.safeTransfer(to, amount);
        emit PulledToLM(amount, 0, to);
    }

    function lmPullMaticDexRefill(address payable to, uint256 amount) external override nonReentrant whenNotPaused {
        if (msg.sender != liquidityManager) revert BiggiErrorsLib.NotLiquidityManager();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        require(address(this).balance >= amount, "insufficient MATIC");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "matic xfer fail");
        emit PulledToLM(0, amount, to);
    }

    /* ===== View helpers ===== */
    function biggiBalance() external view returns (uint256) { return BIGGI.balanceOf(address(this)); }
    function maticBalance() external view returns (uint256) { return address(this).balance; }

    receive() external payable {}
}
