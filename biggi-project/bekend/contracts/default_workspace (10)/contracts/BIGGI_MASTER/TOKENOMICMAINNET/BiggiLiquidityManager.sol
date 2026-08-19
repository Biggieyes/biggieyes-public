// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Router02 {
    function WETH() external view returns (address);

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
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface ILiquidityVault {
    function syncPairBalance(address lpPair) external;
}

interface IReserveV4 {
    function lmPullBiggiDexRefill(address to, uint256 amount) external;
    function lmPullPolDexRefill(address payable to, uint256 amount) external;
    function notifyBiggiReceived(uint256 amount) external;
}

contract BiggiLiquidityManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable BIGGI;

    IUniswapV2Router02 public router;
    IUniswapV2Factory public factory;

    address public reserve;
    address public liquidityVault;

    address public keeper;

    uint8   public tokenPct       = 50;
    uint256 public slippageBps    = 200;
    uint256 public txDeadlineSec  = 600;
    bool    public autoTopUpEnabled     = true;
    uint256 public autoTriggerMinPolWei = 5 ether; // spouštět pairing při >= 5 POL v Reserve
    uint256 public autoRequestPolWei    = 5 ether; // kolik POL se má žádat při auto párování

    event RouterSet(address indexed oldR, address indexed newR);
    event FactorySet(address indexed oldF, address indexed newF);
    event ReserveSet(address indexed oldR, address indexed newR);
    event LiquidityVaultSet(address indexed oldV, address indexed newV);
    event KeeperSet(address indexed oldK, address indexed newK);
    event TokenPctSet(uint8 oldPct, uint8 newPct);
    event SlippageSet(uint256 oldBps, uint256 newBps);
    event DeadlineSet(uint256 oldSec, uint256 newSec);

    event LiquidityAdded(uint256 nativeUsed, uint256 tokenUsed, uint256 liquidity);
    event LiquidityAddFailed(string reason);
    event ReserveTopUpRequested(address indexed reserve);
    event AutoTopUpConfigSet(bool enabled, uint256 triggerMinPolWei, uint256 requestPolWei);
    event AutoPairingAttempt(uint256 requestedPol, bool executed, string reason);

    modifier onlyOwnerOrKeeper() {
        require(msg.sender == owner() || msg.sender == keeper, "only owner/keeper");
        _;
    }

    modifier onlyReserve() {
        require(msg.sender == reserve, "only reserve");
        _;
    }

    constructor(
        address token_,
        address router_,
        address liquidityVault_,
        address initialOwner,
        address reserve_
    ) Ownable(initialOwner) {
        require(token_ != address(0), "token0");
        require(router_ != address(0), "router0");
        require(liquidityVault_ != address(0), "vault0");
        require(initialOwner != address(0), "owner0");
        require(reserve_ != address(0), "reserve0");

        BIGGI = IERC20(token_);
        router = IUniswapV2Router02(router_);
        liquidityVault = liquidityVault_;
        reserve = reserve_;
    }

    /* ============ owner setters ============ */

    function setRouter(address r) external onlyOwner {
        require(r != address(0), "zero");
        emit RouterSet(address(router), r);
        router = IUniswapV2Router02(r);
    }

    function setFactory(address f) external onlyOwner {
        require(f != address(0), "zero");
        emit FactorySet(address(factory), f);
        factory = IUniswapV2Factory(f);
    }

    function setReserve(address r) external onlyOwner {
        require(r != address(0), "zero");
        emit ReserveSet(reserve, r);
        reserve = r;
    }

    function setLiquidityVault(address v) external onlyOwner {
        require(v != address(0), "zero");
        emit LiquidityVaultSet(liquidityVault, v);
        liquidityVault = v;
    }

    function setKeeper(address k) external onlyOwner {
        emit KeeperSet(keeper, k);
        keeper = k;
    }

    function setTokenPct(uint8 pct) external onlyOwner {
        require(pct <= 100, "pct>100");
        emit TokenPctSet(tokenPct, pct);
        tokenPct = pct;
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 10_000, "bps>10000");
        emit SlippageSet(slippageBps, bps);
        slippageBps = bps;
    }

    function setTxDeadlineSec(uint256 sec_) external onlyOwner {
        require(sec_ > 0 && sec_ <= 1 days, "bad-deadline");
        emit DeadlineSet(txDeadlineSec, sec_);
        txDeadlineSec = sec_;
    }

    function setAutoTopUpConfig(
        bool enabled,
        uint256 triggerMinPolWei,
        uint256 requestPolWei
    ) external onlyOwner {
        require(triggerMinPolWei > 0, "trigger=0");
        require(requestPolWei > 0, "request=0");
        autoTopUpEnabled = enabled;
        autoTriggerMinPolWei = triggerMinPolWei;
        autoRequestPolWei = requestPolWei;
        emit AutoTopUpConfigSet(enabled, triggerMinPolWei, requestPolWei);
    }

    /* ============ Reserve trigger hook ============ */

    /// @notice Called by Reserve when someone requests LM action (e.g., via Reserve.requestTopUpToLM)
    /// @dev Auto-spustí pairing pokud je povoleno a Reserve drží dost POL.
    function onReserveTopUpRequest() external onlyReserve {
        emit ReserveTopUpRequested(msg.sender);
        _autoPairIfReady();
    }

    function _autoPairIfReady() internal {
        if (!autoTopUpEnabled) {
            emit AutoPairingAttempt(0, false, "auto: disabled");
            return;
        }
        if (reserve == address(0)) return;

        uint256 availablePol = address(reserve).balance;
        if (availablePol < autoTriggerMinPolWei) return;

        uint256 requestedPol = autoRequestPolWei == 0 ? autoTriggerMinPolWei : autoRequestPolWei;
        if (requestedPol > availablePol) requestedPol = availablePol;
        if (requestedPol == 0) return;

        if (address(router) == address(0) || liquidityVault == address(0)) {
            emit AutoPairingAttempt(requestedPol, false, "auto: wiring not set");
            return;
        }

        // external call so we can catch reverts
        try this.executePairingFromReserve(requestedPol) {
            emit AutoPairingAttempt(requestedPol, true, "");
        } catch Error(string memory reason) {
            emit AutoPairingAttempt(requestedPol, false, reason);
        } catch {
            emit AutoPairingAttempt(requestedPol, false, "auto: revert");
        }
    }

    /* ============ Core: executePairing ============ */

    function executePairing(uint256 requestedPol) external nonReentrant onlyOwnerOrKeeper {
        _executePairing(requestedPol);
    }

    function executePairingFromReserve(uint256 requestedPol) external nonReentrant {
        require(msg.sender == reserve || msg.sender == address(this), "only reserve/self");
        _executePairing(requestedPol);
    }

    /* ============ Internals (split to avoid stack-too-deep) ============ */

    function _executePairing(uint256 requestedPol) internal {
        require(requestedPol > 0, "native==0");
        require(address(router) != address(0), "router not set");
        require(liquidityVault != address(0), "vault not set");
        require(reserve != address(0), "reserve not set");

        // 1) quote => tokenDesired
        (uint256 tokenDesired, address weth) = _quoteTokenDesired(requestedPol);
        if (tokenDesired == 0) return; // _quoteTokenDesired už emitne error

        // 2) pull BIGGI
        try IReserveV4(reserve).lmPullBiggiDexRefill(address(this), tokenDesired) {
        } catch {
            emit LiquidityAddFailed("reserve pull tokens failed");
            return;
        }

        // 3) pull POL
        try IReserveV4(reserve).lmPullPolDexRefill(payable(address(this)), requestedPol) {
        } catch {
            uint256 balTok = BIGGI.balanceOf(address(this));
            _returnBiggiToReserve(balTok);
            emit LiquidityAddFailed("reserve pull POL failed");
            return;
        }

        // 4) addLiquidity + refund leftovers + sync
        _addLiquidityAndFinalize(requestedPol, tokenDesired, weth);
    }

    function _quoteTokenDesired(uint256 requestedPol) internal returns (uint256 tokenDesired, address weth) {
        weth = router.WETH();

        tokenDesired = _quoteTokenDesiredByPoolRatio(requestedPol, weth);
        if (tokenDesired > 0) {
            return (tokenDesired, weth);
        }

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(BIGGI);

        bytes memory payload =
            abi.encodeWithSelector(IUniswapV2Router02.getAmountsOut.selector, requestedPol, path);

        (bool ok, bytes memory ret) = address(router).call(payload);
        if (!ok) {
            emit LiquidityAddFailed("quote failed");
            return (0, weth);
        }

        uint[] memory amounts;
        try this._decodeUintArray(ret) returns (uint[] memory decoded) {
            amounts = decoded;
        } catch {
            emit LiquidityAddFailed("quote decode failed");
            return (0, weth);
        }

        if (amounts.length == 0) {
            emit LiquidityAddFailed("quote returned 0");
            return (0, weth);
        }

        uint256 expectedBiggi = amounts[amounts.length - 1];
        if (expectedBiggi == 0) {
            emit LiquidityAddFailed("expectedBiggi==0");
            return (0, weth);
        }

        tokenDesired = (expectedBiggi * uint256(tokenPct)) / 100;
        if (tokenDesired == 0) {
            emit LiquidityAddFailed("tokenDesired==0");
            return (0, weth);
        }
    }

    function _quoteTokenDesiredByPoolRatio(uint256 requestedPol, address weth) internal view returns (uint256 tokenDesired) {
        if (address(factory) == address(0)) return 0;

        address pair = factory.getPair(address(BIGGI), weth);
        if (pair == address(0)) return 0;

        (uint256 reserveBiggi, uint256 reserveNative) = _pairReserves(pair, weth);
        if (reserveBiggi == 0 || reserveNative == 0) return 0;

        uint256 idealBiggi = (requestedPol * reserveBiggi) / reserveNative;
        if (idealBiggi == 0) return 0;

        tokenDesired = (idealBiggi * uint256(tokenPct)) / 100;
    }

    function _pairReserves(address pair, address weth) internal view returns (uint256 reserveBiggi, uint256 reserveNative) {
        IUniswapV2Pair lpPair = IUniswapV2Pair(pair);
        (uint112 reserve0, uint112 reserve1,) = lpPair.getReserves();

        if (lpPair.token0() == address(BIGGI)) {
            reserveBiggi = uint256(reserve0);
            reserveNative = uint256(reserve1);
            return (reserveBiggi, reserveNative);
        }

        require(lpPair.token1() == address(BIGGI) && lpPair.token0() == weth, "pair mismatch");
        reserveBiggi = uint256(reserve1);
        reserveNative = uint256(reserve0);
    }

    function _addLiquidityAndFinalize(uint256 requestedPol, uint256 tokenDesired, address weth) internal {
        // approve router
        BIGGI.approve(address(router), 0);
        BIGGI.approve(address(router), tokenDesired);

        uint256 amountTokenMin = (tokenDesired * (10_000 - slippageBps)) / 10_000;
        uint256 amountETHMin   = (requestedPol * (10_000 - slippageBps)) / 10_000;
        uint256 deadline = block.timestamp + txDeadlineSec;

        try router.addLiquidityETH{value: requestedPol}(
            address(BIGGI),
            tokenDesired,
            amountTokenMin,
            amountETHMin,
            liquidityVault,
            deadline
        ) returns (uint amountTokenUsed, uint amountETHUsed, uint liquidity) {
            BIGGI.approve(address(router), 0);

            uint256 leftoverTok = BIGGI.balanceOf(address(this));
            _returnBiggiToReserve(leftoverTok);

            uint256 leftoverNative = address(this).balance;
            if (leftoverNative > 0) {
                (bool okSend, ) = payable(reserve).call{value: leftoverNative}("");
                require(okSend, "native refund to reserve failed");
            }

            emit LiquidityAdded(amountETHUsed, amountTokenUsed, liquidity);
            _syncVaultAccounting(weth);
        } catch {
            BIGGI.approve(address(router), 0);

            uint256 balTok = BIGGI.balanceOf(address(this));
            _returnBiggiToReserve(balTok);

            uint256 balNative = address(this).balance;
            if (balNative > 0) {
                (bool okSend, ) = payable(reserve).call{value: balNative}("");
                require(okSend, "native refund to reserve failed");
            }

            emit LiquidityAddFailed("addLiquidity failed");
        }
    }

    function _syncVaultAccounting(address weth) private {
        if (address(factory) == address(0) || liquidityVault == address(0)) return;

        try factory.getPair(address(BIGGI), weth) returns (address pair) {
            if (pair != address(0)) {
                try ILiquidityVault(liquidityVault).syncPairBalance(pair) {
                } catch {
                }
            }
        } catch {
        }
    }

    function _returnBiggiToReserve(uint256 amount) private {
        if (amount == 0) return;

        BIGGI.safeTransfer(reserve, amount);
        IReserveV4(reserve).notifyBiggiReceived(amount);
    }

    // helper for try/catch decode
    function _decodeUintArray(bytes memory b) external pure returns (uint[] memory) {
        return abi.decode(b, (uint[]));
    }

    receive() external payable {}
    fallback() external payable {}
}

