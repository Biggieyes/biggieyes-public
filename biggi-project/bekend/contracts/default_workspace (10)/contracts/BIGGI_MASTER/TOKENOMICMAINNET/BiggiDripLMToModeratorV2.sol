// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {BiggiErrorsLib} from "./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol";
import {BiggiSwapLib, IUniswapV2Router02Biggi} from "./TOKENOMIC_LIBRARY/BiggiSwapLib.sol";

interface IBiggiDripRouterV2 {
    function WETH() external view returns (address);

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

interface IBiggiDripDistributorV2 {
    function availableTokens() external view returns (uint256);
    function claim(uint256 amountRequested) external;
    function setTokensPerMintFromOperator(uint256 value) external;
}

interface IModeratorCenterAllocationV2 {
    function notifyAllocation() external payable;
}

error DripInvalidPercentage();
error DripInvalidShares();
error DripInvalidSlippage();
error DripInvalidDeadline();
error DripPendingReserve();
error DripPendingModerator();
error DripInsufficientSurplus();
error DripUnexpectedNativeSender();
error DripWiringIncomplete();

/**
 * @title BiggiDripLMToModeratorV2
 * @notice Sells the configured share of BIGGI after a buyback and routes native proceeds
 *         between Reserve and ModeratorCenter without losing failed transfers.
 */
contract BiggiDripLMToModeratorV2 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    IERC20 public immutable BIGGI;
    IBiggiDripRouterV2 public router;
    IBiggiDripDistributorV2 public dripDistributor;

    address public reserve;
    address public buybackAgent;
    address public moderatorCenter;

    uint8 public sellPct = 70;
    uint256 public slippageBps = 200;
    uint256 public txDeadlineSec = 600;
    uint16 public reserveShareBps = 5000;
    uint16 public moderatorShareBps = 5000;

    uint256 public pendingReserveNative;
    uint256 public pendingModeratorNative;

    event RouterSet(address indexed oldRouter, address indexed newRouter);
    event ReserveSet(address indexed oldReserve, address indexed newReserve);
    event DripDistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event BuybackAgentSet(address indexed oldAgent, address indexed newAgent);
    event ModeratorCenterSet(address indexed oldModerator, address indexed newModerator);
    event SharesSet(uint16 reserveBps, uint16 moderatorBps);
    event SellPctSet(uint8 oldPct, uint8 newPct);
    event SlippageSet(uint256 oldBps, uint256 newBps);
    event DeadlineSet(uint256 oldSec, uint256 newSec);
    event TokensPerMintUpdated(uint256 newTokensPerMint);
    event DripClaimed(uint256 amountClaimed);
    event DripExecuted(uint256 soldTokens, uint256 nativeForwarded);
    event DripPartial(uint256 requested, uint256 sold, uint256 nativeForwarded, bool sent);
    event DripFailed(string reason);
    event NativeQueued(uint256 reserveAmount, uint256 moderatorAmount);
    event PendingReserveDelivery(uint256 amount, bool delivered);
    event PendingModeratorDelivery(uint256 amount, bool delivered);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event NativeSurplusRescued(address indexed to, uint256 amount);

    modifier onlyBuybackAgent() {
        if (msg.sender != buybackAgent) revert BiggiErrorsLib.NotBuybackAgent();
        _;
    }

    constructor(address token_, address router_, address initialOwner) Ownable(initialOwner) {
        if (token_ == address(0)) revert BiggiErrorsLib.TokenNotSet();
        if (router_ == address(0)) revert BiggiErrorsLib.RouterNotSet();
        if (initialOwner == address(0)) revert BiggiErrorsLib.ZeroAddress();
        BIGGI = IERC20(token_);
        router = IBiggiDripRouterV2(router_);
        _pause();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        if (!_wiringReady()) revert DripWiringIncomplete();
        _unpause();
    }

    function setRouter(address newRouter) external onlyOwner whenPaused {
        if (newRouter == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit RouterSet(address(router), newRouter);
        router = IBiggiDripRouterV2(newRouter);
    }

    function setDripDistributor(address newDistributor) external onlyOwner whenPaused {
        if (newDistributor == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit DripDistributorSet(address(dripDistributor), newDistributor);
        dripDistributor = IBiggiDripDistributorV2(newDistributor);
    }

    function setReserve(address newReserve) external onlyOwner whenPaused {
        if (newReserve == address(0)) revert BiggiErrorsLib.ZeroAddress();
        if (pendingReserveNative != 0) revert DripPendingReserve();
        emit ReserveSet(reserve, newReserve);
        reserve = newReserve;
    }

    function setBuybackAgent(address newAgent) external onlyOwner whenPaused {
        if (newAgent == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit BuybackAgentSet(buybackAgent, newAgent);
        buybackAgent = newAgent;
    }

    function setModeratorCenter(address newModerator) external onlyOwner whenPaused {
        if (newModerator == address(0)) revert BiggiErrorsLib.ZeroAddress();
        if (pendingModeratorNative != 0) revert DripPendingModerator();
        emit ModeratorCenterSet(moderatorCenter, newModerator);
        moderatorCenter = newModerator;
    }

    function setSellPct(uint8 pct) external onlyOwner whenPaused {
        if (pct == 0 || pct > 100) revert DripInvalidPercentage();
        emit SellPctSet(sellPct, pct);
        sellPct = pct;
    }

    function setShares(uint16 reserveBps_, uint16 moderatorBps_) external onlyOwner whenPaused {
        if (uint256(reserveBps_) + uint256(moderatorBps_) != 10_000) {
            revert DripInvalidShares();
        }
        reserveShareBps = reserveBps_;
        moderatorShareBps = moderatorBps_;
        emit SharesSet(reserveBps_, moderatorBps_);
    }

    function setSlippageBps(uint256 bps) external onlyOwner whenPaused {
        if (bps >= 10_000) revert DripInvalidSlippage();
        emit SlippageSet(slippageBps, bps);
        slippageBps = bps;
    }

    function setTxDeadlineSec(uint256 seconds_) external onlyOwner whenPaused {
        if (seconds_ == 0 || seconds_ > 1 days) revert DripInvalidDeadline();
        emit DeadlineSet(txDeadlineSec, seconds_);
        txDeadlineSec = seconds_;
    }

    function dripOnBuy(uint256 biggiBought) external nonReentrant whenNotPaused onlyBuybackAgent {
        if (biggiBought == 0) {
            emit DripFailed("zero reported");
            return;
        }
        if (reserve == address(0)) {
            emit DripFailed("reserve not set");
            return;
        }
        if (moderatorCenter == address(0)) {
            emit DripFailed("moderatorCenter not set");
            return;
        }

        uint256 toSell = (biggiBought * uint256(sellPct)) / 100;
        if (toSell == 0) {
            emit DripFailed("toSell==0");
            return;
        }

        if (address(dripDistributor) != address(0)) {
            try dripDistributor.setTokensPerMintFromOperator(toSell) {
                emit TokensPerMintUpdated(toSell);
            } catch {}
        }

        uint256 currentBalance = BIGGI.balanceOf(address(this));
        uint256 claimTarget;
        if (currentBalance < toSell && address(dripDistributor) != address(0)) {
            uint256 missing = toSell - currentBalance;
            try dripDistributor.availableTokens() returns (uint256 available) {
                claimTarget = available < missing ? available : missing;
            } catch {
                claimTarget = 0;
            }
        }

        uint256 projectedSell = currentBalance + claimTarget;
        if (projectedSell > toSell) projectedSell = toSell;
        if (projectedSell == 0) {
            emit DripFailed("nothing to sell");
            return;
        }

        address[] memory path = BiggiSwapLib.pathTokenToNative(address(BIGGI), router.WETH());
        uint256 projectedMinOut = BiggiSwapLib.quoteMinOut(
            IUniswapV2Router02Biggi(address(router)),
            projectedSell,
            path,
            slippageBps
        );
        if (projectedMinOut == 0) {
            emit DripFailed("minOut==0");
            return;
        }

        if (claimTarget > 0) {
            uint256 beforeClaim = BIGGI.balanceOf(address(this));
            try dripDistributor.claim(claimTarget) {} catch {
                emit DripFailed("claim failed");
            }
            uint256 afterClaim = BIGGI.balanceOf(address(this));
            if (afterClaim > beforeClaim) emit DripClaimed(afterClaim - beforeClaim);
        }

        uint256 sellAmount = BIGGI.balanceOf(address(this));
        if (sellAmount > toSell) sellAmount = toSell;
        if (sellAmount == 0) {
            emit DripFailed("nothing to sell");
            return;
        }

        uint256 minOut = BiggiSwapLib.quoteMinOut(
            IUniswapV2Router02Biggi(address(router)),
            sellAmount,
            path,
            slippageBps
        );
        if (minOut == 0) {
            emit DripFailed("minOut==0");
            return;
        }

        BIGGI.forceApprove(address(router), sellAmount);
        uint256 nativeBefore = address(this).balance;
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmount,
            minOut,
            path,
            address(this),
            block.timestamp + txDeadlineSec
        ) {} catch {
            BIGGI.forceApprove(address(router), 0);
            emit DripFailed("swap failed");
            return;
        }
        BIGGI.forceApprove(address(router), 0);

        uint256 nativeAfter = address(this).balance;
        if (nativeAfter <= nativeBefore) {
            emit DripFailed("no native after swap");
            return;
        }

        uint256 nativeReceived = nativeAfter - nativeBefore;
        uint256 toReserve = (nativeReceived * uint256(reserveShareBps)) / 10_000;
        uint256 toModerator = nativeReceived - toReserve;
        pendingReserveNative += toReserve;
        pendingModeratorNative += toModerator;
        emit NativeQueued(toReserve, toModerator);

        bool reserveDelivered = _flushReserve();
        bool moderatorDelivered = _flushModerator();
        if (reserveDelivered && moderatorDelivered) {
            emit DripExecuted(sellAmount, nativeReceived);
        } else {
            emit DripPartial(toSell, sellAmount, nativeReceived, false);
        }
    }

    function retryPending() external nonReentrant returns (bool reserveDelivered, bool moderatorDelivered) {
        reserveDelivered = _flushReserve();
        moderatorDelivered = _flushModerator();
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner whenPaused {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        IERC20(token).safeTransfer(to, amount);
        emit TokenRescued(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount)
        external
        onlyOwner
        whenPaused
        nonReentrant
    {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        if (amount > surplusNative()) revert DripInsufficientSurplus();
        to.sendValue(amount);
        emit NativeSurplusRescued(to, amount);
    }

    function surplusNative() public view returns (uint256) {
        uint256 pending = pendingReserveNative + pendingModeratorNative;
        uint256 balance = address(this).balance;
        return balance > pending ? balance - pending : 0;
    }

    function wiringReady() external view returns (bool) {
        return _wiringReady();
    }

    function _wiringReady() internal view returns (bool) {
        return
            address(router) != address(0) &&
            address(dripDistributor) != address(0) &&
            reserve != address(0) &&
            buybackAgent != address(0) &&
            moderatorCenter != address(0) &&
            uint256(reserveShareBps) + uint256(moderatorShareBps) == 10_000;
    }

    function _flushReserve() internal returns (bool) {
        uint256 amount = pendingReserveNative;
        if (amount == 0) return true;
        if (reserve == address(0)) return false;

        pendingReserveNative = 0;
        (bool delivered, ) = payable(reserve).call{value: amount}("");
        if (!delivered) pendingReserveNative = amount;
        emit PendingReserveDelivery(amount, delivered);
        return delivered;
    }

    function _flushModerator() internal returns (bool) {
        uint256 amount = pendingModeratorNative;
        if (amount == 0) return true;
        if (moderatorCenter == address(0)) return false;

        pendingModeratorNative = 0;
        try IModeratorCenterAllocationV2(moderatorCenter).notifyAllocation{value: amount}() {
            emit PendingModeratorDelivery(amount, true);
            return true;
        } catch {
            pendingModeratorNative = amount;
            emit PendingModeratorDelivery(amount, false);
            return false;
        }
    }

    receive() external payable {
        if (msg.sender != address(router)) revert DripUnexpectedNativeSender();
    }

    fallback() external payable {
        revert DripUnexpectedNativeSender();
    }
}
