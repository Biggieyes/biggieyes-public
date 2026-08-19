// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiTicketHub - central chapter-aware ticket layer
 * - Keeps legacy chapter 1 ABI used by existing readers/scripts.
 * - Adds per-chapter ticket caps, metadata URI, mint progress, and VRF target.
 * - Keeps every marketing ticket redeemable as part of its chapter's 550 supply.
 * - Gates paid minting and redemption behind explicit per-chapter activation.
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CORE_LIBRARY/BiggiPriceMathLib.sol";
import "./CORE_LIBRARY/BiggiIdIndexLib.sol";
import "./CORE_LIBRARY/BiggiMetaRedeemLib.sol";

interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

interface IBiggiChapterMintShareDistributor {
    function supportsChapterMintShare() external view returns (bool);
    function receiveMintShareForChapter(uint256 chapterId) external payable;
}

interface IBiggiReserve {
    function notifyBiggiReceived(uint256 amount) external;
}

interface IBiggiEcosystemTokenSink {
    function receiveEcosystemBiggi(uint256 amount) external;
}

interface IBiggiMainTicketHubView {
    function ticketHub() external view returns (address);
}

interface IBiggiMainRedeem {
    function redeemFromTicketHub(address user, uint256 ticketId, uint256 ticketPriceSnapshot) external;
}

error OwnerZero();
error MainZero();
error AllTicketsMinted();
error MaxPerWallet();
error InsufficientPayment();
error DevPaymentFailed();
error NotTicket();
error NotTicketOwner();
error NoTicketToRedeem();
error BiggiTokenNotSet();
error TokenSinkBpsTooHigh();
error InvalidReserve();
error NoDirectETH();
error InvalidAddress();
error SaleCapReached();
error MarketingCapReached();
error InvalidCaps();
error CapsBelowMinted();
error InvalidPriceIncrease();
error InvalidBiggiRate();
error ZeroTokenPayment();
error DistributorNotSet();
error DistributorForwardFailed();
error MainBindingMismatch();
error RefundFailed();
error InvalidChapter();
error ChapterInactive();
error InvalidMintAmount();

contract BiggiTicketHub is ERC721, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_CHAPTER_ID = 1;
    uint16 public constant MAX_TICKETS = 550;
    uint16 public constant MAX_PER_WALLET = 10;

    struct ChapterTicketState {
        bool exists;
        bool active;
        address mainCollection;
        uint16 ticketMinted;
        uint16 marketingMinted;
        uint16 saleMinted;
        uint16 saleCap;
        uint16 marketingCap;
        string ticketBaseURI;
    }

    IBiggiDistributor public distributor;
    IERC20 public BIGGI;
    address public devWallet;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000;
    bool public tokenSinkDepositMode;
    uint256 public biggiPerEth = 1e18;
    address public reserveAddress;

    uint256 public globalTicketMinted;
    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033;
    string public contractMetadataURI;

    mapping(uint256 => ChapterTicketState) private _chapters;
    mapping(address => uint256) public ticketCount;
    mapping(uint256 => mapping(address => uint256)) public chapterTicketCount;
    mapping(uint256 => bool) public isTicket;
    mapping(uint256 => uint256) public mintedTicketPrice;
    mapping(uint256 => uint256) public ticketChapterId;

    event MintRequested(address indexed user, uint256 ticketId);
    event ChapterMintRequested(uint256 indexed chapterId, address indexed user, uint256 ticketId);
    event TicketRedeemed(address indexed user, uint256 ticketId, uint256 ticketPriceSnapshot);
    event TicketPriceIncreased(uint256 oldPrice, uint256 newPrice, uint256 bps);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event TokenSinkDepositModeSet(bool enabled);
    event DistributorSet(address distributor);
    event ReserveAddressSet(address indexed oldAddr, address indexed newAddr);
    event MainCollectionSet(address indexed oldMain, address indexed newMain);
    event ChapterConfigured(
        uint256 indexed chapterId,
        address indexed oldMain,
        address indexed newMain,
        uint16 saleCap,
        uint16 marketingCap,
        uint16 totalCap
    );
    event BiggiCollected(address indexed from, uint256 amount, uint256 routedToSink, uint256 forwardedToReserve);
    event TicketPriceSet(uint256 indexed oldPrice, uint256 indexed newPrice);
    event PriceIncreasePerMintSet(uint256 oldBps, uint256 newBps);
    event TicketBaseURISet(string oldUri, string newUri);
    event ChapterTicketBaseURISet(uint256 indexed chapterId, string oldUri, string newUri);
    event MarketingTicketMinted(address indexed to, uint256 indexed ticketId);
    event ChapterMarketingTicketMinted(uint256 indexed chapterId, address indexed to, uint256 indexed ticketId);
    event ChapterActiveSet(uint256 indexed chapterId, bool active);
    event TicketCapsSet(uint16 saleCap, uint16 marketingCap, uint16 totalCap);
    event ChapterTicketCapsSet(uint256 indexed chapterId, uint16 saleCap, uint16 marketingCap, uint16 totalCap);
    event DevWalletSet(address indexed oldWallet, address indexed newWallet);
    event ContractURISet(string oldUri, string newUri);

    constructor(address initialOwner, address mainCollection_) ERC721("Biggi Ticket", "BGTICKET") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert OwnerZero();
        if (mainCollection_ == address(0)) revert MainZero();
        devWallet = initialOwner;
        _chapters[DEFAULT_CHAPTER_ID] = ChapterTicketState({
            exists: true,
            active: false,
            mainCollection: mainCollection_,
            ticketMinted: 0,
            marketingMinted: 0,
            saleMinted: 0,
            saleCap: MAX_TICKETS,
            marketingCap: 0,
            ticketBaseURI: ""
        });
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setMainCollection(address main_) external onlyOwner {
        _setChapterMainCollection(DEFAULT_CHAPTER_ID, main_);
    }

    function configureChapter(
        uint256 chapterId,
        address main_,
        uint16 saleCap_,
        uint16 marketingCap_,
        string calldata ticketBaseURI_
    ) external onlyOwner {
        if (chapterId == 0) revert InvalidChapter();
        if (main_ == address(0)) revert MainZero();
        _validateCapsForChapter(chapterId, saleCap_, marketingCap_);

        ChapterTicketState storage ch = _chapters[chapterId];
        address oldMain = ch.mainCollection;
        if (oldMain != main_) _requireMainBinding(main_);

        ch.exists = true;
        ch.mainCollection = main_;
        ch.saleCap = saleCap_;
        ch.marketingCap = marketingCap_;
        ch.ticketBaseURI = ticketBaseURI_;

        emit ChapterConfigured(chapterId, oldMain, main_, saleCap_, marketingCap_, MAX_TICKETS);
        emit ChapterTicketCapsSet(chapterId, saleCap_, marketingCap_, MAX_TICKETS);
    }

    function setChapterMainCollection(uint256 chapterId, address main_) external onlyOwner {
        _setChapterMainCollection(chapterId, main_);
    }

    function setDevWallet(address wallet_) external onlyOwner {
        if (wallet_ == address(0)) revert InvalidAddress();
        emit DevWalletSet(devWallet, wallet_);
        devWallet = wallet_;
    }

    function setTicketCaps(uint16 saleCap_, uint16 marketingCap_) external onlyOwner {
        _setChapterTicketCaps(DEFAULT_CHAPTER_ID, saleCap_, marketingCap_);
        emit TicketCapsSet(saleCap_, marketingCap_, MAX_TICKETS);
    }

    function setChapterTicketCaps(uint256 chapterId, uint16 saleCap_, uint16 marketingCap_) external onlyOwner {
        _setChapterTicketCaps(chapterId, saleCap_, marketingCap_);
    }

    function totalCap() external pure returns (uint16) { return MAX_TICKETS; }
    function chapterTotalCap(uint256 chapterId) external view returns (uint16) {
        _requireChapter(chapterId);
        return MAX_TICKETS;
    }

    function mainCollection() public view returns (address) {
        return _chapters[DEFAULT_CHAPTER_ID].mainCollection;
    }

    function ticketMinted() public view returns (uint16) {
        return _chapters[DEFAULT_CHAPTER_ID].ticketMinted;
    }

    function marketingMinted() public view returns (uint16) {
        return _chapters[DEFAULT_CHAPTER_ID].marketingMinted;
    }

    function saleMinted() public view returns (uint16) {
        return _chapters[DEFAULT_CHAPTER_ID].saleMinted;
    }

    function saleCap() public view returns (uint16) {
        return _chapters[DEFAULT_CHAPTER_ID].saleCap;
    }

    function marketingCap() public view returns (uint16) {
        return _chapters[DEFAULT_CHAPTER_ID].marketingCap;
    }

    function ticketBaseURI() public view returns (string memory) {
        return _chapters[DEFAULT_CHAPTER_ID].ticketBaseURI;
    }

    function chapterExists(uint256 chapterId) public view returns (bool) {
        return _chapters[chapterId].exists;
    }

    function chapterActive(uint256 chapterId) public view returns (bool) {
        return _requireChapter(chapterId).active;
    }

    function setChapterActive(uint256 chapterId, bool active_) external onlyOwner {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        ch.active = active_;
        emit ChapterActiveSet(chapterId, active_);
    }

    function chapterMainCollection(uint256 chapterId) public view returns (address) {
        return _requireChapter(chapterId).mainCollection;
    }

    function chapterTicketMinted(uint256 chapterId) public view returns (uint16) {
        return _requireChapter(chapterId).ticketMinted;
    }

    function chapterMarketingMinted(uint256 chapterId) public view returns (uint16) {
        return _requireChapter(chapterId).marketingMinted;
    }

    function chapterSaleMinted(uint256 chapterId) public view returns (uint16) {
        return _requireChapter(chapterId).saleMinted;
    }

    function chapterSaleCap(uint256 chapterId) public view returns (uint16) {
        return _requireChapter(chapterId).saleCap;
    }

    function chapterMarketingCap(uint256 chapterId) public view returns (uint16) {
        return _requireChapter(chapterId).marketingCap;
    }

    function chapterTicketBaseURI(uint256 chapterId) public view returns (string memory) {
        return _requireChapter(chapterId).ticketBaseURI;
    }

    function chapterTotalMinted(uint256 chapterId) public view returns (uint256) {
        return _requireChapter(chapterId).ticketMinted;
    }

    function setDistributor(address dist) external onlyOwner {
        if (dist == address(0)) revert InvalidAddress();
        distributor = IBiggiDistributor(dist);
        emit DistributorSet(dist);
    }

    function clearDistributor() external onlyOwner {
        distributor = IBiggiDistributor(address(0));
        emit DistributorSet(address(0));
    }

    function setBiggiToken(address token) external onlyOwner {
        if (token == address(0)) revert BiggiTokenNotSet();
        BIGGI = IERC20(token);
        emit BiggiTokenSet(token);
    }

    function setBiggiRate(uint256 _biggiPerEth) external onlyOwner {
        if (_biggiPerEth == 0) revert InvalidBiggiRate();
        biggiPerEth = _biggiPerEth;
        emit BiggiRateUpdated(_biggiPerEth);
    }

    function setTokenSink(address sink, uint256 bps) external onlyOwner {
        if (bps > 10000) revert TokenSinkBpsTooHigh();
        tokenSink = sink;
        tokenSinkBps = bps;
        emit TokenSinkUpdated(sink, bps);
    }

    function setTokenSinkDepositMode(bool enabled) external onlyOwner {
        tokenSinkDepositMode = enabled;
        emit TokenSinkDepositModeSet(enabled);
    }

    function setReserveAddress(address _reserve) external onlyOwner {
        if (_reserve == address(0)) revert InvalidReserve();
        emit ReserveAddressSet(reserveAddress, _reserve);
        reserveAddress = _reserve;
    }

    function setTicketPrice(uint256 _ticketPrice) external onlyOwner {
        uint256 old = ticketPrice;
        ticketPrice = _ticketPrice;
        emit TicketPriceSet(old, _ticketPrice);
    }

    function setPriceIncreasePerMint(uint256 _priceIncreasePerMint) external onlyOwner {
        if (_priceIncreasePerMint < 10000) revert InvalidPriceIncrease();
        uint256 old = priceIncreasePerMint;
        priceIncreasePerMint = _priceIncreasePerMint;
        emit PriceIncreasePerMintSet(old, _priceIncreasePerMint);
    }

    function setTicketBaseURI(string calldata newUri) external onlyOwner {
        _setChapterTicketBaseURI(DEFAULT_CHAPTER_ID, newUri);
    }

    function setChapterTicketBaseURI(uint256 chapterId, string calldata newUri) external onlyOwner {
        _setChapterTicketBaseURI(chapterId, newUri);
    }

    function setContractURI(string calldata newUri) external onlyOwner {
        string memory old = contractMetadataURI;
        contractMetadataURI = newUri;
        emit ContractURISet(old, newUri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NotTicket();
        uint256 chapterId = ticketChapterId[tokenId];
        if (chapterId == 0) revert NotTicket();
        return BiggiMetaRedeemLib.buildTicketUri(_chapters[chapterId].ticketBaseURI);
    }

    function contractURI() external view returns (string memory) {
        return contractMetadataURI;
    }

    function mintTicket() external payable nonReentrant whenNotPaused {
        _mintPaidTicketWithNative(DEFAULT_CHAPTER_ID);
    }

    function mintTicketForChapter(uint256 chapterId) external payable nonReentrant whenNotPaused {
        _mintPaidTicketWithNative(chapterId);
    }

    function mintTicketWithBiggi() external nonReentrant whenNotPaused {
        _mintPaidTicketWithBiggi(DEFAULT_CHAPTER_ID);
    }

    function mintTicketWithBiggiForChapter(uint256 chapterId) external nonReentrant whenNotPaused {
        _mintPaidTicketWithBiggi(chapterId);
    }

    function mintMarketingTicket(address to) external onlyOwner whenNotPaused returns (uint256 ticketId) {
        ticketId = _mintMarketingTicket(DEFAULT_CHAPTER_ID, to);
    }

    function mintMarketingTicketForChapter(
        uint256 chapterId,
        address to
    ) external onlyOwner whenNotPaused returns (uint256 ticketId) {
        ticketId = _mintMarketingTicket(chapterId, to);
    }

    function mintMarketingTicketsForChapter(
        uint256 chapterId,
        address to,
        uint16 amount
    ) external onlyOwner nonReentrant whenNotPaused returns (uint256 firstTicketId, uint256 lastTicketId) {
        if (amount == 0) revert InvalidMintAmount();
        ChapterTicketState storage ch = _requireChapter(chapterId);
        if (uint256(ch.marketingMinted) + uint256(amount) > uint256(ch.marketingCap)) {
            revert MarketingCapReached();
        }

        for (uint16 i = 0; i < amount; i++) {
            uint256 ticketId = _mintMarketingTicket(chapterId, to);
            if (i == 0) firstTicketId = ticketId;
            lastTicketId = ticketId;
        }
    }

    function ticketRedeemable(uint256 ticketId) public view returns (bool) {
        if (!isTicket[ticketId]) return false;
        uint256 chapterId = ticketChapterId[ticketId];
        return chapterId != 0 && _chapters[chapterId].active;
    }

    function redeemTicket(uint256 ticketId) external nonReentrant whenNotPaused {
        if (!isTicket[ticketId]) revert NotTicket();
        if (ownerOf(ticketId) != msg.sender) revert NotTicketOwner();
        if (ticketCount[msg.sender] == 0) revert NoTicketToRedeem();

        uint256 chapterId = ticketChapterId[ticketId];
        ChapterTicketState storage ch = _requireChapter(chapterId);
        if (!ch.active) revert ChapterInactive();
        uint256 ticketPriceSnapshot = mintedTicketPrice[ticketId];

        _burn(ticketId);
        isTicket[ticketId] = false;

        IBiggiMainRedeem(ch.mainCollection).redeemFromTicketHub(msg.sender, ticketId, ticketPriceSnapshot);
        delete mintedTicketPrice[ticketId];
        delete ticketChapterId[ticketId];

        emit TicketRedeemed(msg.sender, ticketId, ticketPriceSnapshot);
    }

    function totalMinted() public view returns (uint256) {
        return _chapters[DEFAULT_CHAPTER_ID].ticketMinted;
    }

    function getTicketPrice() external view returns (uint256) {
        return ticketPrice;
    }

    function isFullyExhausted() external view returns (bool) {
        ChapterTicketState storage ch = _chapters[DEFAULT_CHAPTER_ID];
        return ch.saleMinted == ch.saleCap && ch.marketingMinted == ch.marketingCap && ch.ticketMinted == MAX_TICKETS;
    }

    function isChapterFullyExhausted(uint256 chapterId) external view returns (bool) {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        return ch.saleMinted == ch.saleCap && ch.marketingMinted == ch.marketingCap && ch.ticketMinted == MAX_TICKETS;
    }

    function _mintPaidTicketWithNative(uint256 chapterId) internal {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        if (!ch.active) revert ChapterInactive();
        if (ch.ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ch.saleMinted >= ch.saleCap) revert SaleCapReached();
        if (chapterTicketCount[chapterId][msg.sender] >= MAX_PER_WALLET) revert MaxPerWallet();

        uint256 mintedAtPrice = ticketPrice;
        if (msg.value < mintedAtPrice) revert InsufficientPayment();

        _splitAndForward(chapterId, mintedAtPrice);
        uint256 overpay = msg.value - mintedAtPrice;
        if (overpay > 0) {
            (bool rf, ) = msg.sender.call{value: overpay}("");
            if (!rf) revert RefundFailed();
        }

        uint256 ticketId = _mintTicket(chapterId, msg.sender, mintedAtPrice);
        unchecked { ch.saleMinted++; }
        emit MintRequested(msg.sender, ticketId);
        emit ChapterMintRequested(chapterId, msg.sender, ticketId);
        _increaseTicketPrice();
    }

    function _mintPaidTicketWithBiggi(uint256 chapterId) internal {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        if (!ch.active) revert ChapterInactive();
        if (ch.ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ch.saleMinted >= ch.saleCap) revert SaleCapReached();
        if (chapterTicketCount[chapterId][msg.sender] >= MAX_PER_WALLET) revert MaxPerWallet();
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 mintedAtPrice = ticketPrice;
        uint256 tokenAmount = _ethToBiggi(mintedAtPrice);
        if (tokenAmount == 0) revert ZeroTokenPayment();
        _collectBiggi(msg.sender, tokenAmount);

        uint256 ticketId = _mintTicket(chapterId, msg.sender, mintedAtPrice);
        unchecked { ch.saleMinted++; }
        emit MintRequested(msg.sender, ticketId);
        emit ChapterMintRequested(chapterId, msg.sender, ticketId);
        _increaseTicketPrice();
    }

    function _mintMarketingTicket(
        uint256 chapterId,
        address to
    ) internal returns (uint256 ticketId) {
        if (to == address(0)) revert InvalidAddress();
        ChapterTicketState storage ch = _requireChapter(chapterId);
        if (ch.ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ch.marketingMinted >= ch.marketingCap) revert MarketingCapReached();

        uint256 mintedAtPrice = ticketPrice;
        ticketId = _mintTicket(chapterId, to, mintedAtPrice);
        unchecked { ch.marketingMinted++; }
        emit MarketingTicketMinted(to, ticketId);
        emit ChapterMarketingTicketMinted(chapterId, to, ticketId);
    }

    function _mintTicket(
        uint256 chapterId,
        address to,
        uint256 mintedAtPrice
    ) internal returns (uint256 ticketId) {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        ticketId = ((chapterId - 1) * uint256(MAX_TICKETS)) + BiggiIdIndexLib.TICKET_OFFSET + ch.ticketMinted;
        isTicket[ticketId] = true;
        ticketChapterId[ticketId] = chapterId;
        mintedTicketPrice[ticketId] = mintedAtPrice;
        unchecked {
            ch.ticketMinted++;
            globalTicketMinted++;
        }
        _safeMint(to, ticketId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (!isTicket[tokenId]) return from;
        uint256 chapterId = ticketChapterId[tokenId];

        if (from != address(0)) {
            ticketCount[from]--;
            chapterTicketCount[chapterId][from]--;
        }
        if (to != address(0)) {
            ticketCount[to]++;
            chapterTicketCount[chapterId][to]++;
        }
    }

    function _increaseTicketPrice() internal {
        uint256 oldP = ticketPrice;
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
        emit TicketPriceIncreased(oldP, ticketPrice, priceIncreasePerMint);
    }

    function _ethToBiggi(uint256 ethAmount) internal view returns (uint256) {
        return (ethAmount * biggiPerEth) / 1e18;
    }

    function _collectBiggi(address from, uint256 amount) internal {
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();
        BIGGI.safeTransferFrom(from, address(this), amount);

        uint256 routed = 0;
        if (tokenSink != address(0) && tokenSinkBps > 0) {
            routed = (amount * tokenSinkBps) / 10000;
            if (routed > 0) _routeToTokenSink(routed);
        }

        uint256 toReserve = amount - routed;
        if (toReserve > 0) {
            if (reserveAddress == address(0)) revert InvalidReserve();
            BIGGI.safeTransfer(reserveAddress, toReserve);
            IBiggiReserve(reserveAddress).notifyBiggiReceived(toReserve);
        }

        emit BiggiCollected(from, amount, routed, toReserve);
    }

    function _routeToTokenSink(uint256 amount) internal {
        if (!tokenSinkDepositMode) {
            BIGGI.safeTransfer(tokenSink, amount);
            return;
        }

        _approveTokenSink(tokenSink, amount);
        IBiggiEcosystemTokenSink(tokenSink).receiveEcosystemBiggi(amount);
    }

    function _approveTokenSink(address spender, uint256 amount) internal {
        (bool ok0, bytes memory d0) = address(BIGGI).call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
        );
        require(ok0 && (d0.length == 0 || abi.decode(d0, (bool))), "approve0 failed");

        (bool ok1, bytes memory d1) = address(BIGGI).call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        require(ok1 && (d1.length == 0 || abi.decode(d1, (bool))), "approve failed");
    }

    function _splitAndForward(uint256 chapterId, uint256 amount) internal {
        uint256 toDistributor = (amount * 6000) / 10000;
        address distributorAddress = address(distributor);
        if (distributorAddress == address(0)) revert DistributorNotSet();

        bool chapterAwareDistributor = false;
        (bool supportOk, bytes memory supportData) = distributorAddress.staticcall(
            abi.encodeWithSelector(IBiggiChapterMintShareDistributor.supportsChapterMintShare.selector)
        );
        if (supportOk && supportData.length >= 32) {
            chapterAwareDistributor = abi.decode(supportData, (bool));
        }

        bool okD;
        if (chapterAwareDistributor) {
            (okD, ) = distributorAddress.call{value: toDistributor}(
                abi.encodeWithSelector(IBiggiChapterMintShareDistributor.receiveMintShareForChapter.selector, chapterId)
            );
        } else {
            (okD, ) = distributorAddress.call{value: toDistributor}(
                abi.encodeWithSelector(IBiggiDistributor.receiveMintShare.selector)
            );
        }
        if (!okD) revert DistributorForwardFailed();

        uint256 devPart = amount - toDistributor;
        (bool sent, ) = devWallet.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    function _setChapterMainCollection(uint256 chapterId, address main_) internal {
        if (chapterId == 0) revert InvalidChapter();
        if (main_ == address(0)) revert MainZero();
        _requireMainBinding(main_);

        ChapterTicketState storage ch = _chapters[chapterId];
        if (!ch.exists) {
            ch.exists = true;
            ch.saleCap = MAX_TICKETS;
            ch.marketingCap = 0;
        }
        address old = ch.mainCollection;
        ch.mainCollection = main_;

        if (chapterId == DEFAULT_CHAPTER_ID) emit MainCollectionSet(old, main_);
        emit ChapterConfigured(chapterId, old, main_, ch.saleCap, ch.marketingCap, MAX_TICKETS);
    }

    function _setChapterTicketCaps(uint256 chapterId, uint16 saleCap_, uint16 marketingCap_) internal {
        _validateCapsForChapter(chapterId, saleCap_, marketingCap_);
        ChapterTicketState storage ch = _requireChapter(chapterId);
        ch.saleCap = saleCap_;
        ch.marketingCap = marketingCap_;
        emit ChapterTicketCapsSet(chapterId, saleCap_, marketingCap_, MAX_TICKETS);
    }

    function _setChapterTicketBaseURI(uint256 chapterId, string calldata newUri) internal {
        ChapterTicketState storage ch = _requireChapter(chapterId);
        string memory old = ch.ticketBaseURI;
        ch.ticketBaseURI = newUri;
        if (chapterId == DEFAULT_CHAPTER_ID) emit TicketBaseURISet(old, newUri);
        emit ChapterTicketBaseURISet(chapterId, old, newUri);
    }

    function _validateCapsForChapter(uint256 chapterId, uint16 saleCap_, uint16 marketingCap_) internal view {
        if (chapterId == 0) revert InvalidChapter();
        if (uint256(saleCap_) + uint256(marketingCap_) != uint256(MAX_TICKETS)) revert InvalidCaps();
        ChapterTicketState storage ch = _chapters[chapterId];
        if (saleCap_ < ch.saleMinted || marketingCap_ < ch.marketingMinted) revert CapsBelowMinted();
    }

    function _requireChapter(uint256 chapterId) internal view returns (ChapterTicketState storage ch) {
        if (chapterId == 0) revert InvalidChapter();
        ch = _chapters[chapterId];
        if (!ch.exists || ch.mainCollection == address(0)) revert InvalidChapter();
    }

    function _requireMainBinding(address main_) internal view {
        try IBiggiMainTicketHubView(main_).ticketHub() returns (address configuredHub) {
            if (configuredHub != address(0) && configuredHub != address(this)) revert MainBindingMismatch();
        } catch {
            revert MainBindingMismatch();
        }
    }

    receive() external payable { revert NoDirectETH(); }
}
