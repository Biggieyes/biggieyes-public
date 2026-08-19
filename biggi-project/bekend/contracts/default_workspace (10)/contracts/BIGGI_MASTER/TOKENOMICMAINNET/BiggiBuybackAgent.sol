// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TOKENOMIC_LIBRARY/BiggiErrorsLib.sol";
import "./TOKENOMIC_LIBRARY/BiggiSwapLib.sol";

interface IUniswapV2Router02 {
    function WETH() external view returns (address);
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IBiggiTreasury {
    function buybackDepositAndSplit(uint256 amount) external;
    function receiveBuybackFallback() external payable;
}

interface IBiggiPolicy {
    function swapSlippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
    function minBuybackInterval() external view returns (uint256);
    function buybacksPaused() external view returns (bool);
    function maxDailyBuybackNative() external view returns (uint256);
    function usedToday() external view returns (uint256);
    function dayIndex() external view returns (uint64);
    function consumeDailyBuybackQuota(uint256 nativeAmount) external;
}

interface IDripLM {
    function dripOnBuy(uint256 biggiBought) external;
}

contract BiggiBuybackAgent is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable BIGGI;
    IUniswapV2Router02 public router;
    address public wrappedNative;
    IBiggiTreasury public treasury;
    IBiggiPolicy   public policy;
    IDripLM        public dripLM;
    address public distributor;

    // Automation/keeper that may trigger manual buyback entrypoints (in addition to owner).
    address public keeper;

    address[] private _customPath;

    uint256 public fallbackSwapSlippageBps = 200; // 2%
    uint256 public fallbackTxDeadlineSec   = 600; // 10 min
    uint256 public fallbackMinIntervalSec  = 300; // 5 min

    uint256 public lastBuybackAt;
    uint256 public totalNativeReceived;
    uint256 public totalNativeSpent;
    uint256 public totalBiggiAcquired;

    bool public autoBuybackEnabled = true;
    bool public paused;

    event RouterSet(address router, address wrappedNative);
    event TreasurySet(address treasury);
    event PolicySet(address policy);
    event DripLMSet(address dripLM);
    event DistributorSet(address distributor);
    event PathSet(address[] path);
    event PathCleared();
    event FallbacksSet(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec);
    event MintShareReceived(uint256 amount);
    event BuybackExecuted(uint256 nativeSpent, uint256 biggiAcquired);
    event RoutedToTreasury(uint256 amountBiggi);
    event DripNotified(address dripLM, uint256 biggiReported);
    event BuybackSplitFailed(uint256 amountBiggi);
    event AutoBuybackToggled(bool enabled);
    event PausedEvent();
    event UnpausedEvent();
    event KeeperSet(address keeper);
    event RescueERC20(address token, address to, uint256 amount);
    event RescueNative(address to, uint256 amount);
    event ForwardNativeFailed(uint256 amount);

    // ponecháváme jen ty chyby, které nemáme v BiggiErrorsLib
    error RouterNotSet();
    error Cooldown();
    error NoBiggi();
    error BadPath();
    error BuybackAborted();
    error BuybacksPaused();
    error NotAuthorized();

    constructor(address biggiToken, address initialOwner) Ownable(initialOwner) {
        if (biggiToken == address(0) || initialOwner == address(0)) {
            revert BiggiErrorsLib.ZeroAddress();
        }
        BIGGI = IERC20(biggiToken);
    }

    modifier onlySelfOrOwner() {
        if (msg.sender != address(this) && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert NotAuthorized();
        _;
    }

    /* ================= Admin setters (onlyOwner) ================= */
    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert BiggiErrorsLib.ZeroAddress();
        router = IUniswapV2Router02(router_);
        wrappedNative = router.WETH();
        emit RouterSet(router_, wrappedNative);
        if (_customPath.length > 0) {
            if (_customPath[0] != wrappedNative || _customPath[_customPath.length - 1] != address(BIGGI)) {
                delete _customPath;
                emit PathCleared();
            }
        }
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert BiggiErrorsLib.ZeroAddress();
        treasury = IBiggiTreasury(treasury_);
        emit TreasurySet(treasury_);
    }

    function setPolicy(address policy_) external onlyOwner {
        // může být i address(0) = bez policy, proto nekontrolujeme ZeroAddress
        policy = IBiggiPolicy(policy_);
        emit PolicySet(policy_);
    }

    function setDripLM(address dripLM_) external onlyOwner {
        // dripLM může být vypnutý (address(0)), proto nekontrolujeme ZeroAddress
        dripLM = IDripLM(dripLM_);
        emit DripLMSet(dripLM_);
    }

    function setDistributor(address distributor_) external onlyOwner {
        if (distributor_ == address(0)) revert BiggiErrorsLib.ZeroAddress();
        distributor = distributor_;
        emit DistributorSet(distributor_);
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    function setSwapPath(address[] calldata newPath) external onlyOwner {
        if (address(router) == address(0)) revert RouterNotSet();
        if (newPath.length < 2 || newPath.length > 5) revert BadPath();
        if (newPath[0] != wrappedNative) revert BadPath();
        if (newPath[newPath.length - 1] != address(BIGGI)) revert BadPath();
        delete _customPath;
        for (uint i = 0; i < newPath.length; ++i) _customPath.push(newPath[i]);
        emit PathSet(newPath);
    }

    function clearSwapPath() external onlyOwner {
        if (_customPath.length > 0) {
            delete _customPath;
            emit PathCleared();
        }
    }

    function setFallbacks(uint256 slipBps, uint256 deadlineSec, uint256 cooldownSec) external onlyOwner {
        require(slipBps <= 10_000, "BPS_HIGH");
        require(deadlineSec > 0 && deadlineSec <= 1 days, "DEADLINE_BAD");
        require(cooldownSec <= 1 days, "COOLDOWN_BAD");
        fallbackSwapSlippageBps = slipBps;
        fallbackTxDeadlineSec   = deadlineSec;
        fallbackMinIntervalSec  = cooldownSec;
        emit FallbacksSet(slipBps, deadlineSec, cooldownSec);
    }

    function toggleAutoBuyback(bool enabled) external onlyOwner {
        autoBuybackEnabled = enabled;
        emit AutoBuybackToggled(enabled);
    }

    function pause() external onlyOwner { paused = true; emit PausedEvent(); }
    function unpause() external onlyOwner { paused = false; emit UnpausedEvent(); }

    /* ================= Core: receiving share & auto buyback ================= */
    // Distributor -> this function payable
    function receiveMintShare() external payable {
        if (msg.sender != distributor) revert BiggiErrorsLib.NotDistributor();
        if (msg.value == 0) revert BiggiErrorsLib.AmountZero();
        totalNativeReceived += msg.value;
        emit MintShareReceived(msg.value);

        if (paused) return;

        if (autoBuybackEnabled) {
            if (address(treasury) == address(0)) revert BiggiErrorsLib.TreasuryNotSet();
            if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
            // try internal flow; if it reverts, fallback to forwarding native to treasury
            try this._autoBuyback{value: msg.value}() {
                // success
            } catch {
                _forwardNativeToTreasury(msg.value);
            }
        } else {
            // keep native here for manual buyback
        }
    }

    receive() external payable {}

    // perform buyback using sent native (must be called via this contract so msg.sender == address(this))
    function _autoBuyback() external payable nonReentrant {
        require(msg.sender == address(this), "internal only");
        uint256 nativeAmt = msg.value;
        _guardsAndQuota(nativeAmt);

        uint256 autoMinOut = _resolveAutoMinOut(nativeAmt);
        if (autoMinOut == 0) {
            _forwardNativeToTreasury(nativeAmt);
            return;
        }

        uint256 acquired = 0;
        bool swapped = false;
        try this._swapNativeForBiggi{value: nativeAmt}(nativeAmt, autoMinOut) returns (uint256 got) {
            acquired = got;
            swapped = true;
        } catch {
            swapped = false;
        }

        if (!swapped) {
            _forwardNativeToTreasury(nativeAmt);
            return;
        }

        if (acquired == 0) {
            _forwardNativeToTreasury(nativeAmt);
            return;
        }

        // ==> VARIANTA A: approve treasury (so treasury can pull tokens) THEN call buybackDepositAndSplit
        _approveTokenForTreasury(acquired);

        try treasury.buybackDepositAndSplit(acquired) {
            emit RoutedToTreasury(acquired);
        } catch {
            emit BuybackSplitFailed(acquired);
            revert BuybackAborted();
        }

        _consumePolicyQuota(nativeAmt);

        lastBuybackAt = block.timestamp;
        totalNativeSpent += nativeAmt;
        totalBiggiAcquired += acquired;
        emit BuybackExecuted(nativeAmt, acquired);

        if (address(dripLM) != address(0)) {
            try dripLM.dripOnBuy(acquired) {
                emit DripNotified(address(dripLM), acquired);
            } catch {
                // ignore drip failure
            }
        }
    }

    /* ================= internal helpers ================= */
    function _guardsAndQuota(uint256 nativeAmount) internal view {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
        if (address(treasury) == address(0)) revert BiggiErrorsLib.TreasuryNotSet();
        if (address(policy) != address(0)) {
            if (policy.buybacksPaused()) revert BuybacksPaused();
            uint256 interval = policy.minBuybackInterval();
            if (interval == 0) interval = fallbackMinIntervalSec;
            if (lastBuybackAt != 0 && block.timestamp < lastBuybackAt + interval) revert Cooldown();
            uint256 maxDaily = policy.maxDailyBuybackNative();
            if (maxDaily > 0) {
                uint64 storedDay = policy.dayIndex();
                uint64 today = uint64(block.timestamp / 1 days);
                uint256 used = today == storedDay ? policy.usedToday() : 0;
                if (used + nativeAmount > maxDaily) revert BuybackAborted();
            }
        } else {
            uint256 interval = fallbackMinIntervalSec;
            if (lastBuybackAt != 0 && block.timestamp < lastBuybackAt + interval) revert Cooldown();
        }
    }

    function _path() internal view returns (address[] memory p) {
        if (_customPath.length > 0) {
            p = new address[](_customPath.length);
            for (uint i = 0; i < _customPath.length; ++i) p[i] = _customPath[i];
        } else {
            p = new address[](2);
            p[0] = wrappedNative;
            p[1] = address(BIGGI);
        }
    }

    function _currentSlippageBps() internal view returns (uint256 slipBps) {
        slipBps = fallbackSwapSlippageBps;
        if (address(policy) != address(0)) {
            try policy.swapSlippageBps() returns (uint256 bps) {
                if (bps <= 10_000) {
                    slipBps = bps;
                }
            } catch {}
        }
    }

    function _resolveAutoMinOut(uint256 nativeAmt) internal view returns (uint256 minOut) {
        address[] memory path = _path();
        minOut = BiggiSwapLib.quoteMinOut(
            IUniswapV2Router02Biggi(address(router)),
            nativeAmt,
            path,
            _currentSlippageBps()
        );
    }

    function previewAutoMinOut(uint256 nativeAmt) external view returns (uint256 minOut) {
        if (nativeAmt == 0) return 0;
        if (address(router) == address(0) || wrappedNative == address(0)) return 0;
        return _resolveAutoMinOut(nativeAmt);
    }

    // swap native -> BIGGI, returns acquired amount (external, no nonReentrant; guarded by caller)
    function _swapNativeForBiggi(uint256 nativeAmt, uint256 minOut) external payable onlySelfOrOwner returns (uint256 acquired) {
        address[] memory path = _path();

        uint256 pre = BIGGI.balanceOf(address(this));

        uint256 deadline = block.timestamp + fallbackTxDeadlineSec;
        if (address(policy) != address(0)) {
            try policy.txDeadlineSec() returns (uint256 d) {
                deadline = block.timestamp + d;
            } catch {}
        }

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: nativeAmt}(
            minOut,
            path,
            address(this),
            deadline
        );

        uint256 post = BIGGI.balanceOf(address(this));
        acquired = post - pre;
        if (acquired == 0) revert NoBiggi();
    }

    // approve treasury safely (0 -> amount pattern)
    function _approveTokenForTreasury(uint256 amount) internal {
        // first try to set allowance to 0
        (bool ok0, bytes memory d0) = address(BIGGI).call(
            abi.encodeWithSelector(IERC20.approve.selector, address(treasury), 0)
        );
        require(ok0 && (d0.length == 0 || abi.decode(d0, (bool))), "approve0 failed");

        (bool ok1, bytes memory d1) = address(BIGGI).call(
            abi.encodeWithSelector(IERC20.approve.selector, address(treasury), amount)
        );
        require(ok1 && (d1.length == 0 || abi.decode(d1, (bool))), "approve failed");
    }

    function _forwardNativeToTreasury(uint256 amount) internal {
        if (address(treasury) == address(0)) revert BiggiErrorsLib.TreasuryNotSet();
        (bool ok, ) = payable(address(treasury)).call{
            value: amount
        }(abi.encodeWithSelector(IBiggiTreasury.receiveBuybackFallback.selector));
        if (!ok) {
            emit ForwardNativeFailed(amount);
            revert BuybackAborted();
        }
    }

    function _consumePolicyQuota(uint256 nativeAmount) internal {
        if (address(policy) == address(0)) return;
        try policy.consumeDailyBuybackQuota(nativeAmount) {
        } catch {
            revert BuybackAborted();
        }
    }

    /* ================= manual buyback (owner) ================= */
    function buybackAllToTreasury(uint256 minOut) external onlyOwnerOrKeeper nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "no native");
        _guardsAndQuota(bal);

        uint256 acquired = 0;
        bool swapped = false;
        try this._swapNativeForBiggi{value: bal}(bal, minOut) returns (uint256 got) {
            acquired = got;
            swapped = true;
        } catch {
            swapped = false;
        }

        if (!swapped) {
            _forwardNativeToTreasury(bal);
            return;
        }

        _approveTokenForTreasury(acquired);

        try treasury.buybackDepositAndSplit(acquired) {
            emit RoutedToTreasury(acquired);
        } catch {
            emit BuybackSplitFailed(acquired);
            revert BuybackAborted();
        }

        _consumePolicyQuota(bal);

        lastBuybackAt = block.timestamp;
        totalNativeSpent += bal;
        totalBiggiAcquired += acquired;
        emit BuybackExecuted(bal, acquired);

        if (address(dripLM) != address(0)) {
            try dripLM.dripOnBuy(acquired) {
                emit DripNotified(address(dripLM), acquired);
            } catch {}
        }
    }

    function buybackAmountToTreasury(uint256 nativeAmount, uint256 minOut) external onlyOwnerOrKeeper nonReentrant {
        require(nativeAmount > 0 && address(this).balance >= nativeAmount, "bad amount");
        _guardsAndQuota(nativeAmount);

        uint256 acquired = 0;
        bool swapped = false;
        try this._swapNativeForBiggi{value: nativeAmount}(nativeAmount, minOut) returns (uint256 got) {
            acquired = got;
            swapped = true;
        } catch {
            swapped = false;
        }

        if (!swapped) {
            _forwardNativeToTreasury(nativeAmount);
            return;
        }

        _approveTokenForTreasury(acquired);

        try treasury.buybackDepositAndSplit(acquired) {
            emit RoutedToTreasury(acquired);
        } catch {
            emit BuybackSplitFailed(acquired);
            revert BuybackAborted();
        }

        _consumePolicyQuota(nativeAmount);

        lastBuybackAt = block.timestamp;
        totalNativeSpent += nativeAmount;
        totalBiggiAcquired += acquired;
        emit BuybackExecuted(nativeAmount, acquired);

        if (address(dripLM) != address(0)) {
            try dripLM.dripOnBuy(acquired) {
                emit DripNotified(address(dripLM), acquired);
            } catch {}
        }
    }

    /* ================= rescue ================= */
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native xfer fail");
        emit RescueNative(address(to), amount);
    }

    /* ================= view helpers ================= */
    function pathCustom() external view returns (address[] memory) { return _customPath; }
    function nativeBalance() external view returns (uint256) { return address(this).balance; }
    function biggiBalance() external view returns (uint256) { return BIGGI.balanceOf(address(this)); }
}
