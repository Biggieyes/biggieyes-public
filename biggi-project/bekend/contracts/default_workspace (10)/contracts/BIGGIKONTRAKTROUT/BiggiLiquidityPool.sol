// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiLiquidityPool
 * - Přijímá 18 % z mintů (native).
 * - Buyback BIGGI z DEX → pošle do Treasury (depositAndSplit).
 * - Přidání likvidity (BIGGI + native).
 * - Jednorázový end-of-collection buyback celé balance.
 * - Volitelná custom swap path a limity slippage/deadline.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";          // <-- přidáno
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniswapV2Router02 {
    function WETH() external view returns (address);

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function getAmountsOut(uint amountIn, address[] calldata path)
        external
        view
        returns (uint[] memory amounts);

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    )
        external
        payable
        returns (uint amountToken, uint amountETH, uint liquidity);
}

interface IBiggiTreasury {
    function depositAndSplit(uint256 amount) external;
}

contract BiggiLiquidityPool is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ----------------------------- Errors ----------------------------- */
    error ZeroAddress();
    error RouterNotSet();
    error TreasuryNotSet();
    error AmountZero();
    error BadPath();
    error BpsTooHigh();
    error NoBiggi();

    /* ----------------------------- State ------------------------------ */
    IERC20 public immutable BIGGI;

    IUniswapV2Router02 public router;
    address public wrappedNative;
    IBiggiTreasury public treasury;

    // slippage a deadline
    uint256 public swapSlippageBps = 200;   // 2 %
    uint256 public lpSlippageBps   = 200;   // 2 %
    uint256 public txDeadlineSec   = 600;   // 10 min

    // volitelná path WNATIVE -> ... -> BIGGI
    address[] private _customPath;

    // jednoduchý cooldown pro buyback
    uint256 public minBuybackInterval = 300; // 5 min
    uint256 public lastBuybackAt;

    /* ----------------------------- Events ----------------------------- */
    event RouterSet(address router, address wrappedNative);
    event TreasurySet(address treasury);
    event ParamsSet(uint256 swapSlippageBps, uint256 lpSlippageBps, uint256 txDeadlineSec);
    event PathSet(address[] path);
    event PathCleared();

    event MintShareReceived(uint256 amount);
    event BuybackExecuted(uint256 nativeSpent, uint256 biggiAcquired);
    event RoutedToTreasury(uint256 amountBiggi);
    event LiquidityAdded(uint256 biggiUsed, uint256 nativeUsed, uint256 lpMinted);
    event EndOfCollectionBuyback(uint256 nativeSpent, uint256 biggiAcquired);

    /* ---------------------------- Constructor ---------------------------- */
    constructor(address biggiToken, address initialOwner)
        Ownable(initialOwner)                                // <-- správné volání base konstruktoru
    {
        if (biggiToken == address(0) || initialOwner == address(0)) revert ZeroAddress();
        BIGGI = IERC20(biggiToken);
    }

    /* ----------------------------- Admin ----------------------------- */
    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        router = IUniswapV2Router02(router_);
        wrappedNative = router.WETH();
        emit RouterSet(router_, wrappedNative);

        // invaliduj custom path, pokud přestala sedět
        if (_customPath.length > 0) {
            if (_customPath[0] != wrappedNative || _customPath[_customPath.length - 1] != address(BIGGI)) {
                delete _customPath;
                emit PathCleared();
            }
        }
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = IBiggiTreasury(treasury_);
        emit TreasurySet(treasury_);
    }

    function setParams(uint256 swapSlipBps, uint256 lpSlipBps, uint256 deadlineSec) external onlyOwner {
        if (swapSlipBps > 10_000 || lpSlipBps > 10_000) revert BpsTooHigh();
        if (deadlineSec == 0 || deadlineSec > 1 days) revert BpsTooHigh();
        swapSlippageBps = swapSlipBps;
        lpSlippageBps   = lpSlipBps;
        txDeadlineSec   = deadlineSec;
        emit ParamsSet(swapSlippageBps, lpSlippageBps, deadlineSec);
    }

    function setSwapPath(address[] calldata newPath) external onlyOwner {
        if (newPath.length < 2 || newPath.length > 5) revert BadPath();
        if (newPath[0] != wrappedNative) revert BadPath();
        if (newPath[newPath.length - 1] != address(BIGGI)) revert BadPath();
        delete _customPath;
        for (uint i = 0; i < newPath.length; i++) _customPath.push(newPath[i]);
        emit PathSet(newPath);
    }

    function clearSwapPath() external onlyOwner {
        if (_customPath.length > 0) {
            delete _customPath;
            emit PathCleared();
        }
    }

    function setMinBuybackInterval(uint256 seconds_) external onlyOwner {
        minBuybackInterval = seconds_;
    }

    /* --------------------------- Inflow --------------------------- */
    /// @notice Přijme 18 % z mintu (native) z main kontraktu.
    function receiveMintShare() external payable { emit MintShareReceived(msg.value); }

    receive() external payable {}

    /* ------------------------------ Core -------------------------------- */

    /// @notice Buyback celé native balance → BIGGI do Treasury.
    function buybackAllToTreasury(uint256 minOut) external nonReentrant {
        _requireRouterTreasury();
        uint256 bal = address(this).balance;
        if (bal == 0) revert AmountZero();
        _enforceCooldown();

        uint256 acquired = _swapNativeForBiggi(bal, minOut);
        _routeBiggiToTreasury(acquired);

        lastBuybackAt = block.timestamp;
        emit BuybackExecuted(bal, acquired);
    }

    /// @notice Buyback pevné částky native → BIGGI do Treasury.
    function buybackToTreasury(uint256 nativeAmount, uint256 minOut) external nonReentrant {
        _requireRouterTreasury();
        if (nativeAmount == 0 || address(this).balance < nativeAmount) revert AmountZero();
        _enforceCooldown();

        uint256 acquired = _swapNativeForBiggi(nativeAmount, minOut);
        _routeBiggiToTreasury(acquired);

        lastBuybackAt = block.timestamp;
        emit BuybackExecuted(nativeAmount, acquired);
    }

    /// @notice Přidání LP z interního BIGGI (drženo zde) + msg.value (native).
    function addLiquidityFromBalances(uint256 biggiAmount)
        external
        payable
        nonReentrant
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
    {
        _requireRouter();
        if (biggiAmount == 0 || msg.value == 0) revert AmountZero();

        // OZ v5: forceApprove (bezpečně přepíše starý allowance)
        BIGGI.forceApprove(address(router), 0);
        BIGGI.forceApprove(address(router), biggiAmount);

        (uint tokenMin, uint ethMin) = _minPair(biggiAmount, msg.value);

        (amountToken, amountETH, liquidity) = router.addLiquidityETH{value: msg.value}(
            address(BIGGI),
            biggiAmount,
            tokenMin,
            ethMin,
            owner(), // LP tokeny → owner; případně změň na dedikovaného příjemce
            block.timestamp + txDeadlineSec
        );

        BIGGI.forceApprove(address(router), 0);

        emit LiquidityAdded(amountToken, amountETH, liquidity);
    }

    /// @notice End-of-collection: swapni CELÝ zůstatek native → BIGGI a pošli do Treasury.
    function executeEndOfCollection(uint256 minOut) external nonReentrant onlyOwner {
        _requireRouterTreasury();
        uint256 bal = address(this).balance;
        if (bal == 0) revert AmountZero();

        uint256 acquired = _swapNativeForBiggi(bal, minOut);
        _routeBiggiToTreasury(acquired);

        emit EndOfCollectionBuyback(bal, acquired);
    }

    /* ------------------------------ Internals ------------------------------ */

    function _swapNativeForBiggi(uint256 nativeAmt, uint256 minOut) internal returns (uint256 acquired) {
        address[] memory path = _path();
        uint256 pre = BIGGI.balanceOf(address(this));

        // pokud volající nedal minOut, spočti z quote a aplikuj slippage
        if (minOut == 0) {
            try router.getAmountsOut(nativeAmt, path) returns (uint[] memory amounts) {
                if (amounts.length > 0) {
                    uint q = amounts[amounts.length - 1];
                    minOut = (q * (10_000 - swapSlippageBps)) / 10_000;
                }
            } catch {}
        }

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: nativeAmt}(
            minOut,
            path,
            address(this),
            block.timestamp + txDeadlineSec
        );

        uint256 post = BIGGI.balanceOf(address(this));
        acquired = post - pre;
        if (acquired == 0) revert NoBiggi();
    }

    function _routeBiggiToTreasury(uint256 amount) internal {
        if (address(treasury) == address(0)) revert TreasuryNotSet();
        BIGGI.forceApprove(address(treasury), 0);
        BIGGI.forceApprove(address(treasury), amount);
        treasury.depositAndSplit(amount);
        emit RoutedToTreasury(amount);
    }

    function _path() internal view returns (address[] memory p) {
        if (_customPath.length > 0) {
            p = new address[](_customPath.length);
            for (uint i = 0; i < _customPath.length; i++) p[i] = _customPath[i];
        } else {
            p = new address[](2);
            p[0] = wrappedNative;
            p[1] = address(BIGGI);
        }
    }

    function _minPair(uint256 tokenAmt, uint256 ethAmt) internal view returns (uint tokenMin, uint ethMin) {
        if (lpSlippageBps == 0) return (0, 0);
        tokenMin = (tokenAmt * (10_000 - lpSlippageBps)) / 10_000;
        ethMin   = (ethAmt   * (10_000 - lpSlippageBps)) / 10_000;
    }

    function _enforceCooldown() internal view {
        if (minBuybackInterval == 0) return;
        require(block.timestamp >= lastBuybackAt + minBuybackInterval, "BUYBACK_COOLDOWN");
    }

    /* ------------------------------ Guards ------------------------------ */
    function _requireRouter() internal view {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
    }

    function _requireRouterTreasury() internal view {
        _requireRouter();
        if (address(treasury) == address(0)) revert TreasuryNotSet();
    }

    /* ------------------------------ Views ------------------------------ */
    function getSwapPath() external view returns (address[] memory p) { p = _path(); }

    function quoteOut(uint256 nativeAmt) external view returns (uint256 out) {
        if (address(router) == address(0)) return 0;
        address[] memory path = _path();
        try router.getAmountsOut(nativeAmt, path) returns (uint[] memory amounts) {
            if (amounts.length > 0) out = amounts[amounts.length - 1];
        } catch { out = 0; }
    }
}
