// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol";

interface IBiggiReserveV4 {
    function lmPullBiggiDexRefill(address to, uint256 amount) external;
    function lmPullPolDexRefill(address payable to, uint256 amount) external;
}

interface ILiquidityManagerTrigger {
    function onReserveTopUpRequest() external;
}

contract BiggiReserveV4 is Ownable2Step, ReentrancyGuard, Pausable, IBiggiReserveV4 {
    using SafeERC20 for IERC20;

    bytes32 public constant WAITING = keccak256("WAITING");
    bytes32 public constant DEX_REFILL = keccak256("DEX_REFILL");

    IERC20 public immutable BIGGI;

    address public liquidityManager;
    address public distributor;

    bool public notifyCallerCheckEnabled = true;
    mapping(address => bool) public notifyCallers;

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
    event NotifyCallerSet(address indexed caller, bool allowed);
    event NotifyCallerCheckSet(bool enabled);
    event ReserveNotifyReceived(address indexed caller, bytes32 indexed bucket, uint256 amount, uint256 bucketBalance, uint256 totalBucketed, uint256 realBalance);

    constructor(address biggi, address owner_) Ownable(owner_) {
        if (biggi == address(0) || owner_ == address(0)) revert BiggiErrorsLib.ZeroAddress();
        BIGGI = IERC20(biggi);
    }

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

    function setNotifyCaller(address caller, bool allowed) external onlyOwner {
        if (caller == address(0)) revert BiggiErrorsLib.ZeroAddress();
        notifyCallers[caller] = allowed;
        emit NotifyCallerSet(caller, allowed);
    }

    function setNotifyCallerCheck(bool enabled) external onlyOwner {
        if (!enabled) revert BiggiErrorsLib.NotAllowedCaller();
        notifyCallerCheckEnabled = enabled;
        emit NotifyCallerCheckSet(enabled);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Distributor -> 35% native/POL reserve share.
    // Intentionally without nonReentrant: LM auto pairing may pull in same tx.
    function receiveMintShare() external payable whenNotPaused {
        if (msg.sender != distributor) revert BiggiErrorsLib.NotDistributor();
        if (msg.value == 0) revert BiggiErrorsLib.AmountZero();

        totalPolReceived += msg.value;
        emit MintShareFromDistributor(msg.value);

        _tryTriggerTopUpToLM();
    }

    // Token notify for minted BIGGI buckets.
    function onBiggiMintedToReserve(uint256 amount, bytes32 bucket) external whenNotPaused {
        _requireAuthorizedNotifyCaller();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
       if (bucket == WAITING) {
            waitingBiggi += amount;
            _enforceBucketConsistency();
            emit ReserveNotifyReceived(msg.sender, bucket, amount, waitingBiggi, bucketedTotal(), BIGGI.balanceOf(address(this)));
        } else if (bucket == DEX_REFILL) {
            dexRefillBiggi += amount;
            _enforceBucketConsistency();
            emit ReserveNotifyReceived(msg.sender, bucket, amount, dexRefillBiggi, bucketedTotal(), BIGGI.balanceOf(address(this)));
            _tryTriggerTopUpToLM();
        } else {
            revert("bad bucket");
        }

        emit BiggiNotified(bucket, amount, waitingBiggi, dexRefillBiggi);
    }

    // Compatibility hook for BIGGI forwarding from other branches.
    // Optional strict caller check can be enabled for mainnet hardening.
    function notifyBiggiReceived(uint256 amount) external whenNotPaused {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        _requireAuthorizedNotifyCaller();

        dexRefillBiggi += amount;
        _enforceBucketConsistency();
        emit ReserveNotifyReceived(msg.sender, DEX_REFILL, amount, dexRefillBiggi, bucketedTotal(), BIGGI.balanceOf(address(this)));
        emit BiggiNotified(DEX_REFILL, amount, waitingBiggi, dexRefillBiggi);
        if (msg.sender != liquidityManager) {
            _tryTriggerTopUpToLM();
        }
    }

    function ownerTopUpDexRefill(uint256 amount) external onlyOwner {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        dexRefillBiggi += amount;
        _enforceBucketConsistency();
        emit DexRefillOwnerTopUp(amount, dexRefillBiggi);
    }

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
            // Keep mint distribution path alive even if LM call fails.
        }
    }

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

    function biggiBalance() external view returns (uint256) {
        return BIGGI.balanceOf(address(this));
    }

    function polBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPolAvailable() external view returns (uint256) {
        return address(this).balance;
    }

    function availableForDexRefill() external view returns (uint256) {
        return dexRefillBiggi;
    }

    function bucketedTotal() public view returns (uint256) {
        return waitingBiggi + dexRefillBiggi;
    }

    function realBiggiBalance() public view returns (uint256) {
        return BIGGI.balanceOf(address(this));
    }

    function bucketDifference() public view returns (uint256) {
        uint256 realBalance = realBiggiBalance();
        uint256 bucketed = bucketedTotal();
        return realBalance > bucketed ? realBalance - bucketed : 0;
    }

    function isBucketConsistent() external view returns (bool) {
        return bucketedTotal() <= realBiggiBalance();
    }

    function reserveConsistency()
        external
        view
        returns (uint256 waitingBucket, uint256 dexRefillBucket, uint256 bucketed, uint256 realBalance, uint256 difference)
    {
        waitingBucket = waitingBiggi;
        dexRefillBucket = dexRefillBiggi;
        bucketed = bucketedTotal();
        realBalance = realBiggiBalance();
        difference = realBalance > bucketed ? realBalance - bucketed : 0;
    }

    function _requireAuthorizedNotifyCaller() internal view {
        if (msg.sender != address(BIGGI) && !notifyCallers[msg.sender]) {
            revert BiggiErrorsLib.NotAllowedCaller();
        }
    }

    function _enforceBucketConsistency() internal view {
        require(bucketedTotal() <= BIGGI.balanceOf(address(this)), "insufficient BIGGI balance");
    }

    receive() external payable {}
}
