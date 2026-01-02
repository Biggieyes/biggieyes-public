// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
BiggiLiquidityManager — opravená, kompilačně robustní verze

executePairing(requestedMatic) : onlyOwnerOrKeeper

volá Reserve.lmPullBiggiDexRefill / lmPullMaticDexRefill (reserve musí být nastaven)

používá low-level call pro getAmountsOut (kompatibilita)

LP tokeny mintne router přímo do liquidityVault (to param)

po úspěšném addLiquidityETH se pokusí získat pair z factory a zavolat liquidityVault.syncPairBalance(pair)

owner = Ownable(initialOwner)
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

interface IUniswapV2Router02 {
function WETH() external view returns (address);
function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
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

interface ILiquidityVault {
function syncPairBalance(address lpPair) external;
}

interface IReserveV4 {
function lmPullBiggiDexRefill(address to, uint256 amount) external;
function lmPullMaticDexRefill(address payable to, uint256 amount) external;
function getMaticAvailable() external view returns (uint256);
function availableForDexRefill() external view returns (uint256);
}

contract BiggiLiquidityManager is Ownable, ReentrancyGuard {
using SafeERC20 for IERC20;
using Address for address payable;

IERC20 public immutable BIGGI;
IUniswapV2Router02 public router;
IUniswapV2Factory public factory;
address public reserve;
address public liquidityVault;

address public keeper; // keeper (proxy) allowed to call executePairing

uint8  public tokenPct = 50;        // % of quoted token amount to use
uint256 public slippageBps = 200;   // 2% default
uint256 public txDeadlineSec = 600; // 10 minutes

event RouterSet(address indexed oldR, address indexed newR);
event FactorySet(address indexed oldF, address indexed newF);
event ReserveSet(address indexed oldR, address indexed newR);
event LiquidityVaultSet(address indexed oldV, address indexed newV);
event KeeperSet(address indexed oldK, address indexed newK);
event TokenPctSet(uint8 oldPct, uint8 newPct);
event SlippageSet(uint256 oldBps, uint256 newBps);
event DeadlineSet(uint256 oldSec, uint256 newSec);

event LiquidityAdded(uint256 nativeIn, uint256 tokenIn, uint256 liquidity);
event LiquidityAddFailed(string reason);

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
    require(bps <= 10000, "bps>10000");
    emit SlippageSet(slippageBps, bps);
    slippageBps = bps;
}

function setTxDeadlineSec(uint256 sec_) external onlyOwner {
    require(sec_ > 0 && sec_ <= 1 days, "bad-deadline");
    emit DeadlineSet(txDeadlineSec, sec_);
    txDeadlineSec = sec_;
}

modifier onlyOwnerOrKeeper() {
    require(msg.sender == owner() || msg.sender == keeper, "only owner/keeper");
    _;
}

/* ============ Core: executePairing ============ */
/// @notice Pull tokens & native from Reserve and add liquidity. Callable by owner or keeper (proxy).
function executePairing(uint256 requestedMatic) external nonReentrant onlyOwnerOrKeeper {
    require(requestedMatic > 0, "native==0");
    require(address(router) != address(0), "router not set");
    require(liquidityVault != address(0), "vault not set");
    require(reserve != address(0), "reserve not set");

    // prepare path WETH -> BIGGI
    address wethAddress = router.WETH();
    address[] memory path = new address[](2);
    path[0] = wethAddress;
    path[1] = address(BIGGI);

    // low-level call for getAmountsOut to avoid parser/version issues
    bytes memory payload = abi.encodeWithSelector(IUniswapV2Router02.getAmountsOut.selector, requestedMatic, path);
    (bool ok, bytes memory ret) = address(router).call(payload);
    if (!ok) {
        emit LiquidityAddFailed("quote failed");
        return;
    }

    uint[] memory amounts;
    // decode, if decode fails treat as failure
    try this._decodeUintArray(ret) returns (uint[] memory decoded) {
        amounts = decoded;
    } catch {
        emit LiquidityAddFailed("quote decode failed");
        return;
    }

    if (amounts.length == 0) {
        emit LiquidityAddFailed("quote returned 0");
        return;
    }

    uint256 expectedBiggi = amounts[amounts.length - 1];
    if (expectedBiggi == 0) {
        emit LiquidityAddFailed("expectedBiggi==0");
        return;
    }

    uint256 tokenDesired = (expectedBiggi * uint256(tokenPct)) / 100;
    if (tokenDesired == 0) {
        emit LiquidityAddFailed("tokenDesired==0");
        return;
    }

    // ask Reserve to send tokens -> LM
    try IReserveV4(reserve).lmPullBiggiDexRefill(address(this), tokenDesired) {
        // tokens transferred to this contract
    } catch {
        emit LiquidityAddFailed("reserve pull tokens failed");
        return;
    }

    // ask Reserve to send native -> LM
    try IReserveV4(reserve).lmPullMaticDexRefill(payable(address(this)), requestedMatic) {
        // native transferred to this contract
    } catch {
        // try to refund pulled tokens back to reserve (best-effort)
        uint256 bal = BIGGI.balanceOf(address(this));
        if (bal > 0) {
            BIGGI.safeTransfer(reserve, bal);
        }
        emit LiquidityAddFailed("reserve pull matic failed");
        return;
    }

    // Approve router (safety: reset to 0 first)
    BIGGI.approve(address(router), 0);
    BIGGI.approve(address(router), tokenDesired);

    uint256 amountTokenMin = 0;
    uint256 amountETHMin = 0;
    if (slippageBps <= 10000) {
        amountTokenMin = (tokenDesired * (10000 - slippageBps)) / 10000;
        amountETHMin   = (requestedMatic * (10000 - slippageBps)) / 10000;
    }

    uint256 deadline = block.timestamp + txDeadlineSec;

    // Call addLiquidityETH with native that is now on this contract
    try router.addLiquidityETH{value: requestedMatic}(
        address(BIGGI),
        tokenDesired,
        amountTokenMin,
        amountETHMin,
        liquidityVault,
        deadline
    ) returns (uint amountToken, uint amountETH, uint liquidity) {
        // on success: return any leftover tokens (rare) to reserve
        uint256 leftover = BIGGI.balanceOf(address(this));
        if (leftover > 0) {
            BIGGI.safeTransfer(reserve, leftover);
        }
        // reset allowance
        BIGGI.approve(address(router), 0);
        emit LiquidityAdded(amountETH, amountToken, liquidity);

        // attempt to sync vault accounting: get pair from factory and call vault.syncPairBalance(pair)
        _syncVaultAccounting(wethAddress);
    } catch {
        // on failure: reset allowance, try to return tokens to reserve, refund native to owner (best-effort)
        BIGGI.approve(address(router), 0);
        uint256 bal = BIGGI.balanceOf(address(this));
        if (bal > 0) {
            BIGGI.safeTransfer(reserve, bal);
        }
        // refund nativeIn to owner (caller was keeper/owner)
        Address.sendValue(payable(owner()), requestedMatic);
        emit LiquidityAddFailed("addLiquidity failed");
    }
}

// Helper function to sync vault accounting - extracted to reduce stack depth
function _syncVaultAccounting(address wethAddress) private {
    if (address(factory) != address(0) && liquidityVault != address(0)) {
        try factory.getPair(address(BIGGI), wethAddress) returns (address pair) {
            if (pair != address(0)) {
                try ILiquidityVault(liquidityVault).syncPairBalance(pair) {
                    // synced ok
                } catch {
                    // ignore sync failure
                }
            }
        } catch {
            // ignore factory failure
        }
    }
}

// helper used for safe decode via external call (so try/catch can be used)
function _decodeUintArray(bytes memory b) external pure returns (uint[] memory) {
    return abi.decode(b, (uint[]));
}

// fallback to receive native (if needed)
receive() external payable {}
fallback() external payable {}
}
