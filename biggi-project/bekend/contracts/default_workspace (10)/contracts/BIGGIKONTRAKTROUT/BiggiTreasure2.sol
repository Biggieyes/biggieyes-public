// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiTreasury – trezor pro BIGGI token s řízením z Policy.
 *
 * Příjem BIGGI (z buybacků) se dělí:
 *   - burn  = betaBurnBps
 *   - stake = gammaStakingBps → poslat na stakingSink
 *   - reserve = deltaReserveBps → poslat na reserveSink
 *   - zbytek zůstává „locknut“ zde
 *
 * Přidání LP: používá BIGGI z tohoto kontraktu + msg.value (native).
 * Slippage a deadline se berou z Policy, pokud je nastavena; jinak lokální defaulty.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
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

interface IBiggiPolicy {
    // splits
    function betaBurnBps() external view returns (uint256);
    function gammaStakingBps() external view returns (uint256);
    function deltaReserveBps() external view returns (uint256);
    // guards
    function lpSlippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
}

contract BiggiTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ------------------------------- ERRORS -------------------------------- */
    error ZeroAddress();
    error RouterNotSet();
    error LockEnabled();
    error InsufficientBiggi();
    error AmountZero();

    /* -------------------------------- STATE -------------------------------- */
    IERC20 public immutable BIGGI;

    // externí moduly
    IUniswapV2Router02 public router;
    address public wrappedNative;
    IBiggiPolicy public policy;       // volitelné – pokud není, použijí se lokální defaulty

    // cílové adresy
    address public lpRecipient;       // příjemce LP tokenů
    address public stakingSink;       // kam posíláme „staking“ část
    address public reserveSink;       // kam posíláme „reserve“ část

    // trvalý lock BIGGI – vypíná ownerWithdrawBiggi()
    bool public permanentLock;

    // operátoři (např. LiquidityPool), kteří smějí volat depositAndSplit()
    mapping(address => bool) public isOperator;

    // fallback guard defaults, pokud policy není nastavena
    uint256 public fallbackLpSlippageBps = 0;     // 0 = bez min amountů
    uint256 public fallbackTxDeadlineSec = 600;   // 10 min

    /* -------------------------------- EVENTS -------------------------------- */
    event RouterSet(address indexed router, address indexed wrappedNative);
    event PolicySet(address indexed policy);
    event LpRecipientSet(address indexed recipient);
    event StakingSinkSet(address indexed sink);
    event ReserveSinkSet(address indexed sink);
    event OperatorSet(address indexed operator, bool allowed);
    event TxDeadlineFallbackSet(uint256 seconds_);
    event LpSlipFallbackSet(uint256 bps);
    event PermanentLockEnabled();

    event BuybackReceived(
        address indexed from,
        uint256 amount,
        uint256 burned,
        uint256 toStaking,
        uint256 toReserve,
        uint256 keptLocked
    );
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
        wrappedNative = router.WETH();
        emit RouterSet(router_, wrappedNative);
    }

    function setPolicy(address policy_) external onlyOwner {
        policy = IBiggiPolicy(policy_);
        emit PolicySet(policy_);
    }

    function setLpRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        lpRecipient = recipient;
        emit LpRecipientSet(recipient);
    }

    function setStakingSink(address sink) external onlyOwner {
        if (sink == address(0)) revert ZeroAddress();
        stakingSink = sink;
        emit StakingSinkSet(sink);
    }

    function setReserveSink(address sink) external onlyOwner {
        if (sink == address(0)) revert ZeroAddress();
        reserveSink = sink;
        emit ReserveSinkSet(sink);
    }

    function setOperator(address op, bool allowed) external onlyOwner {
        if (op == address(0)) revert ZeroAddress();
        isOperator[op] = allowed;
        emit OperatorSet(op, allowed);
    }

    /// fallback guard hodnoty pokud není policy
    function setFallbackGuards(uint256 lpSlipBps, uint256 deadlineSec) external onlyOwner {
        require(lpSlipBps <= 10_000, "BPS_HIGH");
        require(deadlineSec > 0 && deadlineSec <= 1 days, "DEADLINE_BAD");
        fallbackLpSlippageBps = lpSlipBps;
        fallbackTxDeadlineSec = deadlineSec;
        emit LpSlipFallbackSet(lpSlipBps);
        emit TxDeadlineFallbackSet(deadlineSec);
    }

    /// @notice Nevratně zapne trvalý lock – nelze pak vybrat BIGGI z trezoru.
    function enablePermanentLock() external onlyOwner {
        permanentLock = true;
        emit PermanentLockEnabled();
    }

    /* ----------------------------- CORE LOGIKA ------------------------------ */

    /**
     * @notice Operátor (např. LiquidityPool) sem pošle BIGGI a nechá je rozdělit.
     * @dev vyžaduje allowance na tento kontrakt.
     */
    function depositAndSplit(uint256 amount) external nonReentrant {
        if (!isOperator[msg.sender]) revert ZeroAddress();
        if (amount == 0) revert AmountZero();

        // 1) stáhni BIGGI do trezoru
        BIGGI.safeTransferFrom(msg.sender, address(this), amount);

        // 2) načti BPS z policy nebo použij defaulty (burn=40%, stake=30%, reserve=30%)
        uint256 b = address(policy) == address(0) ? 4000 : policy.betaBurnBps();
        uint256 g = address(policy) == address(0) ? 3000 : policy.gammaStakingBps();
        uint256 d = address(policy) == address(0) ? 3000 : policy.deltaReserveBps();

        // 3) spočti částky
        uint256 burnAmt    = (amount * b) / 10000;
        uint256 stakingAmt = (amount * g) / 10000;
        uint256 reserveAmt = (amount * d) / 10000;

        // 4) burn
        if (burnAmt > 0) {
            ERC20Burnable(address(BIGGI)).burn(burnAmt);
        }

        // 5) staking sink
        uint256 stSent = 0;
        if (stakingAmt > 0 && stakingSink != address(0)) {
            BIGGI.safeTransfer(stakingSink, stakingAmt);
            stSent = stakingAmt;
        }

        // 6) reserve sink
        uint256 rvSent = 0;
        if (reserveAmt > 0 && reserveSink != address(0)) {
            BIGGI.safeTransfer(reserveSink, reserveAmt);
            rvSent = reserveAmt;
        }

        // 7) zbytek zůstává locknut v trezoru
        uint256 kept = amount - burnAmt - stSent - rvSent;

        emit BuybackReceived(msg.sender, amount, burnAmt, stSent, rvSent, kept);
    }

    /**
     * @notice Přidání likvidity pomocí BIGGI, které sedí v trezoru, + msg.value (native).
     * @dev lpRecipient obdrží LP tokeny.
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

        // schval routeru (bezpečně)
        BIGGI.forceApprove(address(router), 0);
        BIGGI.forceApprove(address(router), amountBiggi);

        // min amounty dle slippage
        (uint256 tokenMin, uint256 ethMin, uint256 deadline) = _lpGuards(amountBiggi, msg.value);

        (, , uint256 liquidity) = router.addLiquidityETH{value: msg.value}(
            address(BIGGI),
            amountBiggi,
            tokenMin,
            ethMin,
            lpRecipient,
            deadline
        );

        // vynuluj allowance
        BIGGI.forceApprove(address(router), 0);

        emit LiquidityAdded(amountBiggi, msg.value, liquidity);
    }

    /* ------------------------------ WITHDRAWS ------------------------------- */

    /// @notice Nouzové vybrání jiných ERC20 (ne BIGGI) – např. omylem poslané tokeny.
    function rescueERC20(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(BIGGI)) revert LockEnabled();
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Nouzové vybrání nativní měny (ETH/MATIC).
    function rescueETH(uint256 amount, address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "rescue ETH failed");
    }

    /// @notice Vybrání BIGGI je blokováno po zapnutí permanentLock().
    function ownerWithdrawBiggi(address to, uint256 amount) external onlyOwner {
        if (permanentLock) revert LockEnabled();
        if (to == address(0)) revert ZeroAddress();
        BIGGI.safeTransfer(to, amount);
    }

    /* --------------------------------- VIEWS -------------------------------- */

    /// Náhled rozdělení při příjmu `amount` (používá policy nebo defaulty).
    function previewPolicySplit(uint256 amount)
        external
        view
        returns (uint256 burnAmt, uint256 stakingAmt, uint256 reserveAmt, uint256 keptLocked)
    {
        uint256 b = address(policy) == address(0) ? 4000 : policy.betaBurnBps();
        uint256 g = address(policy) == address(0) ? 3000 : policy.gammaStakingBps();
        uint256 d = address(policy) == address(0) ? 3000 : policy.deltaReserveBps();

        burnAmt    = (amount * b) / 10000;
        stakingAmt = (amount * g) / 10000;
        reserveAmt = (amount * d) / 10000;
        keptLocked = amount - burnAmt - stakingAmt - reserveAmt;
    }

    /* --------------------------------- UTILS -------------------------------- */

    function _requireRouter() internal view {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
    }

    function _lpGuards(uint256 tokenAmt, uint256 ethAmt)
        internal
        view
        returns (uint256 tokenMin, uint256 ethMin, uint256 deadline)
    {
        uint256 slip = address(policy) == address(0) ? fallbackLpSlippageBps : policy.lpSlippageBps();
        deadline = address(policy) == address(0) ? (block.timestamp + fallbackTxDeadlineSec)
                                                : (block.timestamp + policy.txDeadlineSec());

        if (slip == 0) {
            tokenMin = 0;
            ethMin   = 0;
        } else {
            tokenMin = (tokenAmt * (10_000 - slip)) / 10_000;
            ethMin   = (ethAmt   * (10_000 - slip)) / 10_000;
        }
    }

    /* ---------------------------- RECEIVE/FALLBACK -------------------------- */
    receive() external payable {}
    fallback() external payable {}
}
