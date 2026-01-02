// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiRewardsAndLiquidity.sol (frontend-friendly, with post-deploy liquidity setters)
 *
 * Rozšíření:
 * - BiggiToken nyní podporuje ERC20Burnable + ERC20Permit.
 * - Bezpečné allowance (SafeERC20.forceApprove).
 * - receiveMintShare(): kontrakt umí přímo přijmout nativní příjem z mintu.
 *
 * Obsah:
 * - ERC20 BIGGI s CAP 100,000,000 BIGGI (18 dec.)
 * - Weekly rewards: claim dle blockIdx (1..10); každý tokenId max 1× týdně (respektuje cap).
 * - Likvidita:
 *     1) bootstrapLiquidity() – první založení LP páru (bez swapu).
 *     2) addLiquidityFromBalance() – doplňování LP (swap půlky nativní měny → BIGGI + přidání LP).
 * - Treasury hooky:
 *     - setTreasury(address)
 *     - routeBiggiToTreasury(uint256)
 *     - buyBiggiAndSendToTreasury(uint256 amountOutMin) payable
 *
 * Frontend helpery:
 *  - tokenAddress(), tokenMeta(), routerInfo(), getSwapPath()
 *  - currentWeek(), nextClaimWeekFor(tokenId), remainingCap()
 *  - getBlockWeights()
 *  - liquidityPreview()
 *  - claimablePreview(tokenIds), claimStatus(tokenIds)
 *
 * Po nasazení nastavitelné parametry:
 *  - setRouter(address)
 *  - setLiquidityRecipient(address)
 *  - setLpUseBalanceBps(uint256)
 *  - setSwapPath(address[])
 *  - clearSwapPath()
 *  - setSwapSlippageBps(uint256)
 *  - setLpAddSlippageBps(uint256)
 *  - setTxDeadlineSeconds(uint256)
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/* ----------------------------- NFT INTERFACE ------------------------------- */
interface IBiggiMainNFT is IERC721 {
    function blockOf(uint256 tokenId) external view returns (uint16);
}

/* --------------------------- Treasury interface ---------------------------- */
interface IBiggiTreasury {
    function depositAndSplit(uint256 amount) external;
}

/* --------------------------- UniswapV2 Router ------------------------------ */
interface IUniswapV2Router02 {
    function WETH() external view returns (address);

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

/* -------------------------------- BIGGI ERC20 ------------------------------ */
contract BiggiToken is ERC20, ERC20Capped, ERC20Burnable, ERC20Permit, Ownable {
    // CAP: 100,000,000 BIGGI (18 decimals)
    constructor(address owner_)
        ERC20("Biggi Token", "BIGGI")
        ERC20Capped(100_000_000 * 1e18)
        ERC20Permit("Biggi Token")
        Ownable(owner_)
    {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function remainingMintable() external view returns (uint256) {
        return cap() - totalSupply();
    }

    // OZ v5 sjednocuje háčky do _update; nutné multi-override
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}

/* ------------------------- REWARDS & LIQUIDITY LOGIC ----------------------- */
contract BiggiRewardsAndLiquidity is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ------------------------------- ERRORS -------------------------------- */
    error ZeroAddress();
    error NoEligibleTokens();
    error NoNativeBalance();
    error UseAmountTooSmall();
    error BpsTooHigh();
    error TransferFailed();
    error CapExceeded();
    error BadPath();
    error BadDeadline();
    error RouterNotSet();
    error TreasuryNotSet();

    /* --------------------------------- STATE -------------------------------- */
    IBiggiMainNFT public immutable mainNFT;
    BiggiToken     public immutable biggi;

    IUniswapV2Router02 public router;
    address public wrappedNative; // WETH / WMATIC podle řetězce

    // Treasury (volitelný)
    IBiggiTreasury public treasury;

    uint256 public constant UNIT_REWARD = 1e18; // 1 BIGGI na jednotku váhy

    // váhy podle blockIdx (1..10); index 0 se nepoužívá
    uint8[11] public blockWeight = [0,1,2,3,4,5,6,7,8,9,10];

    mapping(address => uint64) public lastUserClaimWeek;
    mapping(uint256 => uint64) public tokenLastClaimWeek;

    // === Multi-collection rozšíření ===
    mapping(address => bool) public isCollection; // registrované kolekce
    mapping(address => mapping(uint256 => uint64)) public tokenLastClaimWeekByCollection; // per-kolekce claim
    mapping(address => bool) private hasCustomWeights; // per-kolekce váhy
    mapping(address => uint8[11]) private collectionWeights;

    // kolik % nativního zůstatku použít při addLiquidityFromBalance
    uint256 public lpUseBalanceBps = 5000; // 50%

    // === Nastavitelné likviditní parametry ===
    address public liquidityRecipient;        // kdo obdrží LP tokeny (default: owner())
    address[] private _customSwapPath;        // volitelná vícekroková path (WNATIVE -> ... -> BIGGI)
    uint256 public swapSlippageBps = 0;       // tolerovaná slippage pro swapExactETH... (0–10000)
    uint256 public lpAddSlippageBps = 0;      // min tolerance pro addLiquidityETH (0–10000)
    uint256 public txDeadlineSeconds = 600;   // deadline pro router tx (sekundy)

    /* -------------------------------- EVENTS -------------------------------- */
    event Claimed(address indexed user, uint256 units, uint256 amount);
    event RouterSet(address indexed router, address indexed wrappedNative);
    event LpUseBalanceBpsSet(uint256 bps);
    event LiquidityAdded(uint256 nativeUsed, uint256 tokensUsed, uint256 lpMinted);
    event LiquidityRecipientSet(address indexed recipient);
    event SwapPathSet(address[] path);
    event SwapPathCleared();
    event SwapSlippageBpsSet(uint256 bps);
    event LpAddSlippageBpsSet(uint256 bps);
    event TxDeadlineSet(uint256 seconds_);

    // Multi-collection
    event CollectionAdded(address indexed collection);
    event CollectionRemoved(address indexed collection);
    event CollectionWeightsSet(address indexed collection, uint8[11] weights);

    // Treasury
    event TreasurySet(address indexed treasury);
    event BiggiRoutedToTreasury(uint256 amount);
    event BiggiBoughtAndRouted(uint256 nativeSpent, uint256 biggiAmount);

    // Inflow z mintu
    event MintShareReceived(uint256 amount);

    /* ------------------------------ CONSTRUCTOR ----------------------------- */
    constructor(address mainNFT_, address router_, address owner_)
        Ownable(owner_)
    {
        if (mainNFT_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        mainNFT = IBiggiMainNFT(mainNFT_);
        BiggiToken token = new BiggiToken(address(this)); // owner = tento kontrakt
        biggi = token;

        if (router_ != address(0)) {
            _setRouter(router_);
        }

        liquidityRecipient = owner_; // defaultně owner
        emit LiquidityRecipientSet(owner_);
    }

    /* ------------------------------ INFLOW (18%) ---------------------------- */

    /// @notice Umožní main kontraktu posílat sem přímo nativní podíl z mintu.
    function receiveMintShare() external payable {
        emit MintShareReceived(msg.value);
    }

    /* ------------------------------- TREZOR HOOKS --------------------------- */

    /// @notice Nastaví adresu treasury kontraktu (BiggiTreasury).
    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = IBiggiTreasury(treasury_);
        emit TreasurySet(treasury_);
    }

    /// @notice Pošli část/veškeré BIGGI, které tento kontrakt drží, do Treasury.
    /// @dev Treasury očekává transferFrom – zde schválíme a zavoláme depositAndSplit.
    function routeBiggiToTreasury(uint256 amount) external onlyOwner nonReentrant {
        if (address(treasury) == address(0)) revert TreasuryNotSet();
        if (amount == 0) revert UseAmountTooSmall();

        IERC20(address(biggi)).forceApprove(address(treasury), 0);
        IERC20(address(biggi)).forceApprove(address(treasury), amount);
        treasury.depositAndSplit(amount);
        emit BiggiRoutedToTreasury(amount);
    }

    /// @notice Nakoupí BIGGI za poslaný native a vše odešle do Treasury.
    /// @param amountOutMin Minimální očekávané množství BIGGI (ochrana proti MEV/slippage).
    function buyBiggiAndSendToTreasury(uint256 amountOutMin)
        external
        payable
        onlyOwner
        nonReentrant
    {
        if (address(treasury) == address(0)) revert TreasuryNotSet();
        _requireRouter();
        if (msg.value == 0) revert NoNativeBalance();

        // path: WNATIVE -> BIGGI (případně custom s _customSwapPath)
        address[] memory path = _swapPath();

        uint256 balBefore = IERC20(address(biggi)).balanceOf(address(this));

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(
            amountOutMin,
            path,
            address(this),
            block.timestamp + txDeadlineSeconds
        );

        uint256 balAfter = IERC20(address(biggi)).balanceOf(address(this));
        uint256 acquired = balAfter - balBefore;
        if (acquired == 0) revert TransferFailed();

        IERC20(address(biggi)).forceApprove(address(treasury), 0);
        IERC20(address(biggi)).forceApprove(address(treasury), acquired);
        treasury.depositAndSplit(acquired);

        emit BiggiBoughtAndRouted(msg.value, acquired);
    }

    /* -------------------------------- REWARDS ------------------------------- */

    function claim(uint256[] calldata tokenIds) external nonReentrant {
        uint64 weekNow = _week();
        uint256 units;

        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                uint256 tid = tokenIds[i];
                if (mainNFT.ownerOf(tid) != msg.sender) continue;
                if (tokenLastClaimWeek[tid] == weekNow) continue;

                uint16 blk = mainNFT.blockOf(tid);
                if (blk < 1 || blk > 10) continue;

                units += blockWeight[blk];
                tokenLastClaimWeek[tid] = weekNow;
            }
        }

        if (units == 0) revert NoEligibleTokens();
        uint256 amount = units * UNIT_REWARD;

        if (biggi.remainingMintable() < amount) revert CapExceeded();

        biggi.mint(msg.sender, amount);
        lastUserClaimWeek[msg.sender] = weekNow;

        emit Claimed(msg.sender, units, amount);
    }

    function claim(address collection, uint256[] calldata tokenIds) external nonReentrant {
        if (!isCollection[collection]) revert NoEligibleTokens();

        uint64 weekNow = _week();
        uint256 units;

        unchecked {
            for (uint256 i = 0; i < tokenIds.length; ++i) {
                uint256 tid = tokenIds[i];

                if (IBiggiMainNFT(collection).ownerOf(tid) != msg.sender) continue;
                if (tokenLastClaimWeekByCollection[collection][tid] == weekNow) continue;

                uint16 blk = IBiggiMainNFT(collection).blockOf(tid);
                uint8 w = _weightFor(collection, blk);
                if (w == 0) continue;

                units += w;
                tokenLastClaimWeekByCollection[collection][tid] = weekNow;
            }
        }

        if (units == 0) revert NoEligibleTokens();

        uint256 amount = units * UNIT_REWARD;
        if (biggi.remainingMintable() < amount) revert CapExceeded();

        biggi.mint(msg.sender, amount);
        lastUserClaimWeek[msg.sender] = weekNow;

        emit Claimed(msg.sender, units, amount);
    }

    /* ------------------------------- LIQUIDITY ------------------------------ */

    modifier whenRouterSet() {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
        _;
    }

    function setRouter(address router_) external onlyOwner { _setRouter(router_); }

    function setLpUseBalanceBps(uint256 bps) external onlyOwner {
        if (bps > 10000) revert BpsTooHigh();
        lpUseBalanceBps = bps;
        emit LpUseBalanceBpsSet(bps);
    }

    function setLiquidityRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        liquidityRecipient = recipient;
        emit LiquidityRecipientSet(recipient);
    }

    function setTxDeadlineSeconds(uint256 seconds_) external onlyOwner {
        if (seconds_ == 0 || seconds_ > 1 days) revert BadDeadline();
        txDeadlineSeconds = seconds_;
        emit TxDeadlineSet(seconds_);
    }

    function setSwapSlippageBps(uint256 bps) external onlyOwner {
        if (bps > 10000) revert BpsTooHigh();
        swapSlippageBps = bps;
        emit SwapSlippageBpsSet(bps);
    }

    function setLpAddSlippageBps(uint256 bps) external onlyOwner {
        if (bps > 10000) revert BpsTooHigh();
        lpAddSlippageBps = bps;
        emit LpAddSlippageBpsSet(bps);
    }

    function setSwapPath(address[] calldata newPath) external onlyOwner whenRouterSet {
        if (newPath.length < 2 || newPath.length > 5) revert BadPath();
        if (newPath[0] != wrappedNative) revert BadPath();
        if (newPath[newPath.length - 1] != address(biggi)) revert BadPath();
        delete _customSwapPath;
        for (uint i = 0; i < newPath.length; i++) {
            _customSwapPath.push(newPath[i]);
        }
        emit SwapPathSet(newPath);
    }

    function clearSwapPath() external onlyOwner {
        if (_customSwapPath.length > 0) {
            delete _customSwapPath;
            emit SwapPathCleared();
        }
    }

    function bootstrapLiquidity(uint256 tokenAmount) external payable onlyOwner nonReentrant whenRouterSet {
        if (msg.value == 0) revert NoNativeBalance();
        if (tokenAmount == 0) revert UseAmountTooSmall();

        biggi.mint(address(this), tokenAmount);

        IERC20(address(biggi)).forceApprove(address(router), 0);
        IERC20(address(biggi)).forceApprove(address(router), tokenAmount);

        uint tokenMin = _applyBps(tokenAmount, lpAddSlippageBps);
        uint ethMin   = _applyBps(msg.value,   lpAddSlippageBps);

        (, , uint256 lp) = router.addLiquidityETH{value: msg.value}(
            address(biggi),
            tokenAmount,
            tokenMin,
            ethMin,
            liquidityRecipient,
            block.timestamp + txDeadlineSeconds
        );

        // allowance clear (good hygiene)
        IERC20(address(biggi)).forceApprove(address(router), 0);

        emit LiquidityAdded(msg.value, tokenAmount, lp);
    }

    function addLiquidityFromBalance() external onlyOwner nonReentrant whenRouterSet {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NoNativeBalance();

        uint256 useAmount = (bal * lpUseBalanceBps) / 10000;
        if (useAmount < 2) revert UseAmountTooSmall();

        uint256 half = useAmount / 2;
        uint256 otherHalf = useAmount - half;

        address[] memory path = _swapPath();

        uint amountOutMin = 0;
        try router.getAmountsOut(half, path) returns (uint[] memory amounts) {
            if (amounts.length > 0) {
                uint quoted = amounts[amounts.length - 1];
                amountOutMin = (quoted * (10000 - swapSlippageBps)) / 10000;
            }
        } catch {}

        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: half}(
            amountOutMin,
            path,
            address(this),
            block.timestamp + txDeadlineSeconds
        );

        uint256 tokenBal = IERC20(address(biggi)).balanceOf(address(this));
        if (tokenBal == 0) revert TransferFailed();

        IERC20(address(biggi)).forceApprove(address(router), 0);
        IERC20(address(biggi)).forceApprove(address(router), tokenBal);

        uint tokenMin = _applyBps(tokenBal,  lpAddSlippageBps);
        uint ethMin   = _applyBps(otherHalf, lpAddSlippageBps);

        (, , uint256 lp) = router.addLiquidityETH{value: otherHalf}(
            address(biggi),
            tokenBal,
            tokenMin,
            ethMin,
            liquidityRecipient,
            block.timestamp + txDeadlineSeconds
        );

        IERC20(address(biggi)).forceApprove(address(router), 0);

        emit LiquidityAdded(otherHalf, tokenBal, lp);
    }

    /* ---------------------------- RECEIVE/FALLBACK -------------------------- */
    receive() external payable {}
    fallback() external payable {}

    /* ------------------------------- FRONTEND HELPERS ----------------------- */

    function tokenAddress() external view returns (address) {
        return address(biggi);
    }

    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        name_ = biggi.name();
        symbol_ = biggi.symbol();
        decimals_ = biggi.decimals();
    }

    function routerInfo() external view returns (address router_, address wrapped_) {
        router_ = address(router);
        wrapped_ = wrappedNative;
    }

    function getSwapPath() external view returns (address[] memory p) {
        p = _swapPath();
    }

    function currentWeek() external view returns (uint64) {
        return _week();
    }

    function nextClaimWeekFor(uint256 tokenId) external view returns (uint64) {
        uint64 last = tokenLastClaimWeek[tokenId];
        return last == 0 ? _week() : last + 1;
    }

    function remainingCap() external view returns (uint256) {
        return biggi.remainingMintable();
    }

    function getBlockWeights() external view returns (uint8[11] memory w) {
        w = blockWeight;
    }

    function liquidityPreview()
        external
        view
        returns (
            uint256 contractEthBalance,
            uint256 lpBps,
            uint256 useAmount,
            uint256 half,
            uint256 otherHalf
        )
    {
        contractEthBalance = address(this).balance;
        lpBps = lpUseBalanceBps;
        useAmount = (contractEthBalance * lpBps) / 10000;
        half = useAmount / 2;
        otherHalf = useAmount - half;
    }

    function claimablePreview(uint256[] calldata tokenIds)
        external
        view
        returns (uint256 units, uint256 amount)
    {
        uint64 weekNow = _week();
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 tid = tokenIds[i];
            if (tokenLastClaimWeek[tid] == weekNow) continue;
            uint16 blk = mainNFT.blockOf(tid);
            if (blk >= 1 && blk <= 10) {
                units += blockWeight[blk];
            }
        }
        amount = units * UNIT_REWARD;
    }

    function claimStatus(uint256[] calldata tokenIds)
        external
        view
        returns (
            bool[] memory claimableNow,
            uint8[] memory weights,
            uint16[] memory blockIdxs
        )
    {
        uint64 weekNow = _week();
        uint256 len = tokenIds.length;

        claimableNow = new bool[](len);
        weights = new uint8[](len);
        blockIdxs = new uint16[](len);

        for (uint256 i = 0; i < len; ++i) {
            uint256 tid = tokenIds[i];
            uint16 blk = mainNFT.blockOf(tid);
            blockIdxs[i] = blk;
            weights[i] = (blk >= 1 && blk <= 10) ? blockWeight[blk] : 0;
            claimableNow[i] = (blk >= 1 && blk <= 10) && (tokenLastClaimWeek[tid] != weekNow);
        }
    }

    /* ------------------------- MULTI-COLLECTION SETTERY --------------------- */

    function addCollection(address collection) external onlyOwner {
        if (collection == address(0)) revert ZeroAddress();
        isCollection[collection] = true;
        emit CollectionAdded(collection);
    }

    function removeCollection(address collection) external onlyOwner {
        isCollection[collection] = false;
        emit CollectionRemoved(collection);
    }

    function setCollectionWeights(address collection, uint8[11] calldata weights) external onlyOwner {
        if (!isCollection[collection]) revert NoEligibleTokens();
        collectionWeights[collection] = weights;
        hasCustomWeights[collection] = true;
        emit CollectionWeightsSet(collection, weights);
    }

    /* --------------------------------- UTILS -------------------------------- */

    function _swapPath() internal view returns (address[] memory p) {
        if (_customSwapPath.length > 0) {
            p = new address[](_customSwapPath.length);
            for (uint i = 0; i < _customSwapPath.length; i++) p[i] = _customSwapPath[i];
        } else {
            p = new address[](2);
            p[0] = wrappedNative;
            p[1] = address(biggi);
        }
    }

    function _setRouter(address router_) internal {
        if (router_ == address(0)) revert ZeroAddress();
        router = IUniswapV2Router02(router_);
        wrappedNative = IUniswapV2Router02(router_).WETH();
        emit RouterSet(router_, wrappedNative);
        if (_customSwapPath.length > 0) {
            if (_customSwapPath[0] != wrappedNative || _customSwapPath[_customSwapPath.length - 1] != address(biggi)) {
                delete _customSwapPath;
                emit SwapPathCleared();
            }
        }
    }

    function _week() internal view returns (uint64) {
        return uint64(block.timestamp / 1 weeks);
    }

    function _applyBps(uint amount, uint bps) internal pure returns (uint minOut) {
        if (bps == 0) return 0;
        minOut = (amount * (10000 - bps)) / 10000;
    }

    function _weightFor(address collection, uint16 blk) internal view returns (uint8) {
        if (blk < 1 || blk > 10) return 0;
        if (hasCustomWeights[collection]) {
            return collectionWeights[collection][blk];
        }
        return blockWeight[blk];
    }

    function _requireRouter() internal view {
        if (address(router) == address(0) || wrappedNative == address(0)) revert RouterNotSet();
    }

    /* -------------------------------- RESCUE -------------------------------- */
    function rescueERC20(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueETH(uint256 amount, address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
