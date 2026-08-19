// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface IRouter {
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

interface IBiggiTokenWithReserve is IERC20 {
    function transferFromReserveTo(address to, uint256 amount) external;
}

interface ILiquidityManager {
    function setRouter(address r) external;
    function setFactory(address f) external;
    function setReserve(address r) external;
    function setLiquidityVault(address v) external;
    function setKeeper(address k) external;
    function setTokenPct(uint8 pct) external;
    function setSlippageBps(uint256 bps) external;
    function setTxDeadlineSec(uint256 sec_) external;
    function setAutoTopUpConfig(bool enabled, uint256 triggerMinPolWei, uint256 requestPolWei) external;
}

interface IVault {
    function addWhitelistedPair(address lpPair) external;
    function whitelistPair(address pair, bool allowed) external;
}

interface IReserveSetup {
    function setLiquidityManager(address lm) external;
}

/**
 * @title LiquiditySetup
 * @notice Propojí Reserve / LiquidityManager / Vault a udělá initial liquidity (one-shot).
 *         Upraveno pro aktuální LM API (router/factory/reserve/vault/keeper/autoTopUp).
 */
contract LiquiditySetup is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IBiggiTokenWithReserve public immutable BIGGI;
    IRouter public immutable router;
    address public immutable vault;
    address public immutable liquidityManager;
    address public immutable reserve;
    address public immutable wNative;

    uint256 public slippageBps = 300; // default 3 %
    uint256 public deadlineSec = 900; // 15 min

    bool public executedInitial;

    event InitialLiquidityAdded(uint256 amountTokenUsed, uint256 amountNativeUsed, uint256 liquidity);
    event ReserveLiquidityWired(address reserve, address lm, address vault);

    constructor(
        address initialOwner,
        address biggiToken_,
        address router_,
        address vault_,
        address liquidityManager_,
        address reserve_,
        address wNative_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(biggiToken_ != address(0), "token=0");
        require(router_ != address(0), "router=0");
        require(vault_ != address(0), "vault=0");
        require(liquidityManager_ != address(0), "lm=0");
        require(reserve_ != address(0), "reserve=0");
        require(wNative_ != address(0), "wnative=0");

        BIGGI = IBiggiTokenWithReserve(biggiToken_);
        router = IRouter(router_);
        vault = vault_;
        liquidityManager = liquidityManager_;
        reserve = reserve_;
        wNative = wNative_;
    }

    // --- admin tuning ---
    function setSlippageBps(uint256 newBps) external onlyOwner {
        require(newBps <= 1000, "slip>10%");
        slippageBps = newBps;
    }
    function setDeadlineSec(uint256 newDeadline) external onlyOwner {
        require(newDeadline > 0 && newDeadline <= 3600, "bad deadline");
        deadlineSec = newDeadline;
    }

    /// Propojí Reserve -> LM -> Vault a nastaví LM parametry (factory/keeper/tokenPct/slippage/deadline/autoTopUp).
    function setupReserveLMVault(
        address factory,
        address keeper,
        uint8 tokenPct,
        uint256 slippageBps_,
        uint256 deadlineSec_,
        bool autoEnabled,
        uint256 autoTriggerPolWei,
        uint256 autoRequestPolWei
    ) external onlyOwner {
        IReserveSetup(reserve).setLiquidityManager(liquidityManager);

        ILiquidityManager lm = ILiquidityManager(liquidityManager);
        lm.setRouter(address(router));
        if (factory != address(0)) lm.setFactory(factory);
        lm.setReserve(reserve);
        lm.setLiquidityVault(vault);
        if (keeper != address(0)) lm.setKeeper(keeper);
        lm.setTokenPct(tokenPct);
        lm.setSlippageBps(slippageBps_);
        lm.setTxDeadlineSec(deadlineSec_);
        lm.setAutoTopUpConfig(autoEnabled, autoTriggerPolWei, autoRequestPolWei);

        emit ReserveLiquidityWired(reserve, liquidityManager, vault);
    }

    /// Zjistí pair přes factory a whitelistne ho ve vaultu
    function runDexConnections(address factory) external onlyOwner {
        require(factory != address(0), "factory=0");
        address pair = IFactory(factory).getPair(address(BIGGI), wNative);
        require(pair != address(0), "pair not created yet");
        IVault(vault).addWhitelistedPair(pair);
    }

    /// One-shot initial liquidity: stáhne token z reserve a udělá addLiquidityETH do routeru (LP -> vault)
    /// Volat jako owner BiggiTokenu nebo after transferOwnership
    function runInitialLiquidity(uint256 tokenAmount) external payable nonReentrant onlyOwner {
        require(!executedInitial, "already executed");
        require(tokenAmount > 0, "tokenAmount=0");
        require(msg.value > 0, "need native");

        executedInitial = true;

        BIGGI.transferFromReserveTo(address(this), tokenAmount);

        IERC20 token = IERC20(address(BIGGI));

        // approve router
        uint256 curAllow = token.allowance(address(this), address(router));
        if (curAllow != 0) {
            require(token.approve(address(router), 0), "approve0");
        }
        require(token.approve(address(router), tokenAmount), "approve");

        uint256 tokenMin = (tokenAmount * (10_000 - slippageBps)) / 10_000;
        uint256 nativeMin = (msg.value * (10_000 - slippageBps)) / 10_000;
        uint256 dl = block.timestamp + deadlineSec;

        (uint256 usedToken, uint256 usedNative, uint256 liq) = router.addLiquidityETH{value: msg.value}(
            address(BIGGI),
            tokenAmount,
            tokenMin,
            nativeMin,
            vault,
            dl
        );

        emit InitialLiquidityAdded(usedToken, usedNative, liq);

        uint256 leftoverToken = token.balanceOf(address(this));
        if (leftoverToken > 0) {
            token.safeTransfer(owner(), leftoverToken);
        }
        uint256 leftoverNative = address(this).balance;
        if (leftoverNative > 0) {
            (bool ok, ) = payable(owner()).call{value: leftoverNative}("");
            require(ok, "refund failed");
        }

        token.approve(address(router), 0);
    }

    receive() external payable {}
}

