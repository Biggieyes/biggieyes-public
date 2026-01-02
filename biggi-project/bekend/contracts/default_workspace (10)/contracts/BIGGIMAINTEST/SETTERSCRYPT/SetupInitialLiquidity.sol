// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniswapV2Router02 {
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

/// @notice BiggiToken interface – používáme transferFromReserveTo
interface IBiggiTokenWithReserve is IERC20 {
    function transferFromReserveTo(address to, uint256 amount) external;
}

/**
 * @title SetupInitialLiquidity
 * @notice Jednorázový helper pro vytvoření počáteční liquidity:
 *         - zavolá BiggiToken.transferFromReserveTo(address(this), 20M BIGGI)
 *           (musí ho volat owner BiggiTokenu nebo skript musí být owner)
 *         - použije msg.value jako nativní část (MATIC)
 *         - zavolá router.addLiquidityETH a pošle LP tokeny do vaultu
 */
contract SetupInitialLiquidity is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IBiggiTokenWithReserve public immutable BIGGI;
    IUniswapV2Router02 public immutable router;
    address public immutable vault;

    uint256 public constant TOKEN_AMOUNT = 20_000_000 * 1e18; // 20M BIGGI
    uint256 public slippageBps = 300; // 3 % default
    uint256 public deadlineSec = 900; // 15 min default

    bool public executed;

    event InitialLiquidityAdded(
        uint256 amountTokenUsed,
        uint256 amountNativeUsed,
        uint256 liquidity
    );
    event SlippageUpdated(uint256 oldBps, uint256 newBps);
    event DeadlineUpdated(uint256 oldSec, uint256 newSec);

    constructor(
        address initialOwner,
        address biggiToken,
        address router_,
        address vault_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(biggiToken != address(0), "token=0");
        require(router_ != address(0), "router=0");
        require(vault_ != address(0), "vault=0");

        BIGGI = IBiggiTokenWithReserve(biggiToken);
        router = IUniswapV2Router02(router_);
        vault = vault_;
    }

    /* === admin tuning (optional) === */

    function setSlippageBps(uint256 newBps) external onlyOwner {
        require(newBps <= 1_000, "slip>10%"); // max 10 %
        emit SlippageUpdated(slippageBps, newBps);
        slippageBps = newBps;
    }

    function setDeadlineSec(uint256 newDeadline) external onlyOwner {
        require(newDeadline > 0 && newDeadline <= 1 hours, "bad deadline");
        emit DeadlineUpdated(deadlineSec, newDeadline);
        deadlineSec = newDeadline;
    }

    /**
     * @notice Spustíš JEDNOU z Remixu s přiloženým MATICem (msg.value).
     * Podmínky před spuštěním:
     *  - BiggiToken.reserveAddr drží >= 20M BIGGI
     *  - volající `run()` musí být owner BiggiTokenu (protože transferFromReserveTo je onlyOwner)
     */
    function run() external payable nonReentrant onlyOwner {
        require(!executed, "already executed");
        executed = true;

        require(msg.value > 0, "no native");

        // 1) stáhnout 20M BIGGI z reserveAddr přes BiggiToken.transferFromReserveTo
        BIGGI.transferFromReserveTo(address(this), TOKEN_AMOUNT);

        // 2) approve routeru – klasický approve pattern (0 -> amount)
        IERC20 token = IERC20(address(BIGGI));

        uint256 curAllowance = token.allowance(address(this), address(router));
        if (curAllowance != 0) {
            require(token.approve(address(router), 0), "approve0 failed");
        }
        require(token.approve(address(router), TOKEN_AMOUNT), "approve failed");

        // 3) spočítat min hodnoty podle slippage
        uint256 tokenMin = (TOKEN_AMOUNT * (10_000 - slippageBps)) / 10_000;
        uint256 nativeMin = (msg.value * (10_000 - slippageBps)) / 10_000;

        uint256 dl = block.timestamp + deadlineSec;

        // 4) addLiquidityETH – LP tokeny jdou přímo do vaultu
        (uint256 usedToken, uint256 usedNative, uint256 liq) = router.addLiquidityETH{value: msg.value}(
            address(BIGGI),
            TOKEN_AMOUNT,
            tokenMin,
            nativeMin,
            vault,
            dl
        );

        emit InitialLiquidityAdded(usedToken, usedNative, liq);

        // 5) případné zbytky tokenů/nativ vrátit ownerovi
        uint256 leftoverToken = token.balanceOf(address(this));
        if (leftoverToken > 0) {
            token.safeTransfer(owner(), leftoverToken);
        }

        uint256 leftoverNative = address(this).balance;
        if (leftoverNative > 0) {
            (bool ok, ) = payable(owner()).call{value: leftoverNative}("");
            require(ok, "refund failed");
        }

        // 6) best-effort vynulování approve (bez revertu)
        token.approve(address(router), 0);
    }

    receive() external payable {}
}
