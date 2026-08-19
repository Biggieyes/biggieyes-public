// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiTreasury – jednoduchý „trezor“ pro BIGGI token.
 *
 * Hlavní myšlenka:
 * - Sem se posílají BIGGI tokeny z buybacků / likviditních operací.
 * - Kontrakt je umí automaticky rozdělit podle poměru (např. 70% trvale zamknout v trezoru, 30% držet
 *   pro budoucí přidání likvidity spolu s MATIC/ETH) – čísla lze měnit setterem.
 * - Umí přidat likviditu do BIGGI/WMATIC (nebo BIGGI/WETH) páru přes UniswapV2 kompatibilní router.
 * - Volitelně lze „perma-lock“ zapnout jednou provždy (pak už majitel nemůže BIGGI vybírat).
 *
 * Poznámky:
 * - BIGGI ERC20 zde nepálíme (BiggiToken v předchozím návrhu nemá burn). „Lock“ = držíme v tomto kontraktu.
 * - Přidání likvidity děláme funkcí addLiquidityETH (vyžaduje poslat nativní měnu v msg.value).
 * - Pokud chcete část BIGGI rovnou „posílat do LP“, nastavte lockBps < 10000 a volání addLiquidity... proveďte,
 *   až budete mít v trezoru i nativní měnu (MATIC/ETH).
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

contract BiggiTreasury is Ownable, ReentrancyGuard {
    /* ------------------------------- ERRORS -------------------------------- */
    error ZeroAddress();
    error BpsTooHigh();
    error RouterNotSet();
    error LockEnabled();
    error InsufficientBiggi();
    error AmountZero();

    /* -------------------------------- STATE -------------------------------- */
    IERC20 public immutable BIGGI;

    // UniswapV2 kompatibilní router (Quickswap, Sushi apod.)
    IUniswapV2Router02 public router;
    address public wrappedNative;       // WETH/WMATIC dle routeru
    address public lpRecipient;         // kdo obdrží LP tokeny (default owner())

    // Poměr rozdělení (v basis points, 10000 = 100 %)
    // lockBps = kolik % se „zamkne“ (zůstane v trezoru)
    // zbytek (10000 - lockBps) se eviduje jako „na likviditu“
    uint256 public lockBps = 7000;      // defaultně 70 %
    uint256 public lpBps   = 3000;      // defaultně 30 %

    // Jednorázový přepínač – po zapnutí už majitel NIKDY nevybere BIGGI z trezoru
    bool public permanentLock;

    // Operátoři (např. Rewards/Liquidity kontrakt), kteří smějí poslat BIGGI a rovnou spustit split
    mapping(address => bool) public isOperator;

    // Mírná ochrana proti „tvrdým“ limitům: slippage BPS pro addLiquidity (min-amounty)
    uint256 public lpAddSlippageBps = 0;   // 0 = žádné min

    // Deadline pro router operace
    uint256 public txDeadlineSeconds = 600;

    /* -------------------------------- EVENTS -------------------------------- */
    event RouterSet(address indexed router, address indexed wrappedNative);
    event LpRecipientSet(address indexed recipient);
    event OperatorSet(address indexed operator, bool allowed);
    event SplitBpsSet(uint256 lockBps, uint256 lpBps);
    event LpAddSlippageBpsSet(uint256 bps);
    event TxDeadlineSet(uint256 seconds_);
    event PermanentLockEnabled();

    event ReceivedAndSplit(address indexed from, uint256 amount, uint256 locked, uint256 forLp);
    event LiquidityAdded(uint256 biggiUsed, uint256 nativeUsed, uint256 lpMinted);

    /* ------------------------------ CONSTRUCTOR ----------------------------- */
    constructor(address biggiToken, address owner_) Ownable(owner_) {
        if (biggiToken == address(0) || owner_ == address(0)) revert ZeroAddress();
        BIGGI = IERC20(biggiToken);
        lpRecipient = owner_;
        emit LpRecipientSet(owner_);
    }

    /* --------------------------------- ADMIN -------------------------------- */

    function setRouter(address router_) external onlyOwner {
        if (router_ == address(0)) revert ZeroAddress();
        router = IUniswapV2Router02(router_);
        wrappedNative = IUniswapV2Router02(router_).WETH();
        emit RouterSet(router_, wrappedNative);
    }

    function setLpRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        lpRecipient = recipient;
        emit LpRecipientSet(recipient);
    }

    function setOperator(address op, bool allowed) external onlyOwner {
        if (op == address(0)) revert ZeroAddress();
        isOperator[op] = allowed;
        emit OperatorSet(op, allowed);
    }

    /// @notice Nastaví poměr rozdělení mezi „trezorový lock“ a „na likviditu“ (součet = 10000).
    function setSplitBps(uint256 lockBps_) external onlyOwner {
        if (lockBps_ > 10000) revert BpsTooHigh();
        lockBps = lockBps_;
        lpBps = 10000 - lockBps_;
        emit SplitBpsSet(lockBps, lpBps);
    }

    function setLpAddSlippageBps(uint256 bps) external onlyOwner {
        if (bps > 10000) revert BpsTooHigh();
        lpAddSlippageBps = bps;
        emit LpAddSlippageBpsSet(bps);
    }

    function setTxDeadlineSeconds(uint256 seconds_) external onlyOwner {
        if (seconds_ == 0 || seconds_ > 1 days) revert BpsTooHigh();
        txDeadlineSeconds = seconds_;
        emit TxDeadlineSet(seconds_);
    }

    /// @notice Nevratně zapne trvalý lock – nelze pak vybrat BIGGI z trezoru.
    function enablePermanentLock() external onlyOwner {
        permanentLock = true;
        emit PermanentLockEnabled();
    }

    /* ----------------------------- CORE LOGIKA ------------------------------ */

    /**
     * @notice Operátor (např. Rewards/Liquidity kontrakt) sem pošle BIGGI a nechá je rozdělit.
     * @dev vyžaduje allowance na tento kontrakt.
     */
    function depositAndSplit(uint256 amount) external nonReentrant {
        if (!isOperator[msg.sender]) revert ZeroAddress();
        if (amount == 0) revert AmountZero();

        // 1) přetáhni BIGGI z operátora do trezoru
        bool ok = BIGGI.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");

        // 2) spočti rozdělení
        uint256 toLock = (amount * lockBps) / 10000;
        uint256 toLp   = amount - toLock;

        // „Lock“ = nic dalšího neděláme; tokeny zůstaly v kontraktu
        // „Na LP“ = také zůstane v kontraktu, později použijeme pro addLiquidityETH.

        emit ReceivedAndSplit(msg.sender, amount, toLock, toLp);
    }

    /**
     * @notice Přidání likvidity pomocí BIGGI, které už „sedí“ v trezoru, a nativní měny v msg.value.
     * @dev
     *  - amountBiggi je množství BIGGI, které chcete použít.
     *  - msg.value musí obsahovat množství nativní měny, které chcete párovat (poměr nastavíte vy).
     *  - lpRecipient obdrží LP tokeny.
     */
    function addLiquidityUsingStored(uint256 amountBiggi)
        external
        payable
        onlyOwner
        nonReentrant
    {
        _requireRouter();

        if (amountBiggi == 0) revert AmountZero();
        if (msg.value == 0) revert AmountZero();

        // Dostupnost BIGGI v trezoru
        uint256 bal = BIGGI.balanceOf(address(this));
        if (bal < amountBiggi) revert InsufficientBiggi();

        // schval routeru
        BIGGI.approve(address(router), amountBiggi);

        // min amounty dle slippage
        uint256 tokenMin = _minOut(amountBiggi, lpAddSlippageBps);
        uint256 ethMin   = _minOut(msg.value,  lpAddSlippageBps);

        (, , uint256 liquidity) = router.addLiquidityETH{value: msg.value}(
            address(BIGGI),
            amountBiggi,
            tokenMin,
            ethMin,
            lpRecipient,
            block.timestamp + txDeadlineSeconds
        );

        emit LiquidityAdded(amountBiggi, msg.value, liquidity);
    }

    /* ------------------------------ WITHDRAWS ------------------------------- */

    /// @notice Nouzové vybrání jiných ERC20 (ne BIGGI) – např. airdropy chybou.
    function rescueERC20(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(BIGGI)) revert LockEnabled();
        if (to == address(0)) revert ZeroAddress();
        bool ok = IERC20(token).transfer(to, amount);
        require(ok, "rescue ERC20 failed");
    }

    /// @notice Nouzové vybrání nativní měny (ETH/MATIC).
    function rescueETH(uint256 amount, address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "rescue ETH failed");
    }

    /// @notice Vybrání BIGGI je blokováno po zapnutí permanentLock().
    ///         Neaktivujte, pokud chcete mít možnost tokens z trezoru někdy převést.
    function ownerWithdrawBiggi(address to, uint256 amount) external onlyOwner {
        if (permanentLock) revert LockEnabled();
        if (to == address(0)) revert ZeroAddress();
        bool ok = BIGGI.transfer(to, amount);
        require(ok, "BIGGI transfer failed");
    }

    /* --------------------------------- VIEWS -------------------------------- */

    function previewSplit(uint256 amount) external view returns (uint256 toLock, uint256 toLp) {
        toLock = (amount * lockBps) / 10000;
        toLp   = amount - toLock;
    }

    function _requireRouter() internal view {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
    }

    function _minOut(uint256 amount, uint256 bps) internal pure returns (uint256) {
        if (bps == 0) return 0; // 0 = bez omezení (typický vzor u UniswapV2 addLiquidity)
        return (amount * (10000 - bps)) / 10000;
    }

    /* ---------------------------- RECEIVE/FALLBACK -------------------------- */
    receive() external payable {}
    fallback() external payable {}
}
