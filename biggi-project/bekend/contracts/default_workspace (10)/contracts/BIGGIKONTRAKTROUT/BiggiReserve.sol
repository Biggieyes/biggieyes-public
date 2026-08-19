// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiReserve
 * - Trezor pro BIGGI a native (MATIC/ETH) oddělený od Treasury.
 * - Drží 2 bucket-y: waiting (na další kolekci) a dexRefill (na doplňování DEX/LP).
 * - LiquidityPool tahá BIGGI přes transferFrom (approve z tohoto kontraktu).
 * - Role operátora, permanentní BIGGI lock, bezpečné allowance.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BiggiReserve is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ----------------------------- Errors ----------------------------- */
    error ZeroAddress();
    error AmountZero();
    error NotOperator();
    error LockEnabled();
    error UnknownBucket();

    /* ----------------------------- State ------------------------------ */
    IERC20 public immutable BIGGI;

    mapping(address => bool) public isOperator;

    bool public permanentLockBiggi;

    uint256 public waitingBucket;    // BIGGI pro další cyklus
    uint256 public dexRefillBucket;  // BIGGI pro doplňování DEX/LP

    /* ----------------------------- Events ----------------------------- */
    event OperatorSet(address indexed op, bool allowed);
    event PermanentLockEnabled();

    event DepositBiggi(address indexed from, uint256 amount, bytes32 bucket);
    event MoveBetweenBuckets(bytes32 fromBucket, bytes32 toBucket, uint256 amount);

    event ApproveOperator(address indexed spender, uint256 amount);
    event ClearApproval(address indexed spender);

    event WithdrawBiggi(address indexed to, uint256 amount);
    event WithdrawETH(address indexed to, uint256 amount);

    /* ---------------------------- Constructor ---------------------------- */
    constructor(address biggiToken, address initialOwner) Ownable(initialOwner) {
        if (biggiToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        BIGGI = IERC20(biggiToken);
    }

    /* ------------------------------ Modifiers ------------------------------ */
    modifier onlyOperator() {
        if (!isOperator[msg.sender]) revert NotOperator();
        _;
    }

    /* ------------------------------- Admin -------------------------------- */
    function setOperator(address op, bool allowed) external onlyOwner {
        if (op == address(0)) revert ZeroAddress();
        isOperator[op] = allowed;
        emit OperatorSet(op, allowed);
    }

    /// @notice Nevratně zablokuje výběr BIGGI (ownerWithdrawBiggi).
    function enablePermanentLockBiggi() external onlyOwner {
        permanentLockBiggi = true;
        emit PermanentLockEnabled();
    }

    /* ------------------------------- Deposit ------------------------------- */

    /// @notice Ulož BIGGI do bucketu: keccak256("waiting") nebo keccak256("dexRefill")
    function depositBiggi(uint256 amount, bytes32 bucket) external nonReentrant {
        if (amount == 0) revert AmountZero();
        BIGGI.safeTransferFrom(msg.sender, address(this), amount);

        if (bucket == keccak256("waiting")) {
            waitingBucket += amount;
        } else if (bucket == keccak256("dexRefill")) {
            dexRefillBucket += amount;
        } else {
            revert UnknownBucket();
        }

        emit DepositBiggi(msg.sender, amount, bucket);
    }

    /// @notice Přijímá nativní měnu pro párování LP atd.
    receive() external payable {}
    fallback() external payable {}

    /* ---------------------- Bucket přesuny (účetní) ---------------------- */

    function moveToDexRefill(uint256 amount) external onlyOperator {
        if (amount == 0) revert AmountZero();
        uint256 use = amount > waitingBucket ? waitingBucket : amount;
        waitingBucket -= use;
        dexRefillBucket += use;
        emit MoveBetweenBuckets("waiting", "dexRefill", use);
    }

    function moveToWaiting(uint256 amount) external onlyOperator {
        if (amount == 0) revert AmountZero();
        uint256 use = amount > dexRefillBucket ? dexRefillBucket : amount;
        dexRefillBucket -= use;
        waitingBucket += use;
        emit MoveBetweenBuckets("dexRefill", "waiting", use);
    }

    /* ---------------------------- Allowances ---------------------------- */

    /// @notice Schválí operátorovi (např. LiquidityPool) možnost stáhnout BIGGI (transferFrom).
    function approveOperator(address spender, uint256 amount) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        // OZ v5: forceApprove je v SafeERC20
        BIGGI.forceApprove(spender, 0);
        BIGGI.forceApprove(spender, amount);
        emit ApproveOperator(spender, amount);
    }

    function clearApproval(address spender) external onlyOwner {
        if (spender == address(0)) revert ZeroAddress();
        BIGGI.forceApprove(spender, 0);
        emit ClearApproval(spender);
    }

    /* ------------------------------ Withdraws ------------------------------ */

    function ownerWithdrawBiggi(address to, uint256 amount) external onlyOwner {
        if (permanentLockBiggi) revert LockEnabled();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();

        // účetně odečti z bucketů: nejdřív waiting, pak dexRefill
        uint256 left = amount;

        if (waitingBucket >= left) {
            waitingBucket -= left;
            left = 0;
        } else {
            left -= waitingBucket;
            waitingBucket = 0;

            if (dexRefillBucket >= left) {
                dexRefillBucket -= left;
                left = 0;
            } else {
                dexRefillBucket = 0;
                left = 0; // zbytek odečítat nemusíme; tokeny sedí zde
            }
        }

        BIGGI.safeTransfer(to, amount);
        emit WithdrawBiggi(to, amount);
    }

    function ownerWithdrawETH(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH_TRANSFER_FAIL");
        emit WithdrawETH(to, amount);
    }

    /* -------------------------------- Views -------------------------------- */

    function biggiBalance() external view returns (uint256) {
        return BIGGI.balanceOf(address(this));
    }

    function nativeBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
