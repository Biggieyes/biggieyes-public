// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiTicketHub — chapter ticket layer
 * - Holds ticket sale + marketing distribution + ticket ownership
 * - Preserves original payment routing from BiggiMain
 * - Sends redeem requests into BiggiEyesMain VRF collection
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Library/BiggiPriceMathLib.sol";
import "./Library/BiggiIdIndexLib.sol";
import "./Library/BiggiMetaRedeemLib.sol";

interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

interface IBiggiReserve {
    function notifyBiggiReceived(uint256 amount) external;
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

contract BiggiTicketHub is ERC721, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint16 public constant MAX_TICKETS = 550;
    uint16 public constant MAX_PER_WALLET = 10;

    IBiggiDistributor public distributor;
    IERC20 public BIGGI;
    address public mainCollection;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000;
    uint256 public biggiPerEth  = 1e18;
    address public reserveAddress;

    uint16 public ticketMinted;
    uint16 public marketingMinted;
    uint16 public saleMinted;
    uint16 public saleCap = 550;
    uint16 public marketingCap = 0;
    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033;
    string public ticketBaseURI;

    mapping(address => uint256) public ticketCount;
    mapping(uint256 => bool) public isTicket;
    mapping(uint256 => uint256) public mintedTicketPrice;

    event MintRequested(address indexed user, uint256 ticketId);
    event TicketRedeemed(address indexed user, uint256 ticketId, uint256 ticketPriceSnapshot);
    event TicketPriceIncreased(uint256 oldPrice, uint256 newPrice, uint256 bps);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event DistributorSet(address distributor);
    event ReserveAddressSet(address indexed oldAddr, address indexed newAddr);
    event MainCollectionSet(address indexed oldMain, address indexed newMain);
    event BiggiCollected(address indexed from, uint256 amount, uint256 routedToSink, uint256 forwardedToReserve);
    event TicketPriceSet(uint256 indexed oldPrice, uint256 indexed newPrice);
    event PriceIncreasePerMintSet(uint256 oldBps, uint256 newBps);
    event TicketBaseURISet(string oldUri, string newUri);
    event MarketingTicketMinted(address indexed to, uint256 indexed ticketId);
    event TicketCapsSet(uint16 saleCap, uint16 marketingCap, uint16 totalCap);

    constructor(address initialOwner, address mainCollection_) ERC721("Biggi Ticket", "BGTICKET") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert OwnerZero();
        if (mainCollection_ == address(0)) revert MainZero();
        mainCollection = mainCollection_;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setMainCollection(address main_) external onlyOwner {
        if (main_ == address(0)) revert MainZero();
        emit MainCollectionSet(mainCollection, main_);
        mainCollection = main_;
    }

    function setTicketCaps(uint16 saleCap_, uint16 marketingCap_) external onlyOwner {
        if (uint256(saleCap_) + uint256(marketingCap_) != uint256(MAX_TICKETS)) revert InvalidCaps();
        saleCap = saleCap_;
        marketingCap = marketingCap_;
        emit TicketCapsSet(saleCap_, marketingCap_, MAX_TICKETS);
    }

    function totalCap() external pure returns (uint16) { return MAX_TICKETS; }

    function setDistributor(address dist) external onlyOwner {
        distributor = IBiggiDistributor(dist);
        emit DistributorSet(dist);
    }

    function setBiggiToken(address token) external onlyOwner {
        if (token == address(0)) revert BiggiTokenNotSet();
        BIGGI = IERC20(token);
        emit BiggiTokenSet(token);
    }

    function setBiggiRate(uint256 _biggiPerEth) external onlyOwner {
        biggiPerEth = _biggiPerEth;
        emit BiggiRateUpdated(_biggiPerEth);
    }

    function setTokenSink(address sink, uint256 bps) external onlyOwner {
        if (bps > 10000) revert TokenSinkBpsTooHigh();
        tokenSink = sink;
        tokenSinkBps = bps;
        emit TokenSinkUpdated(sink, bps);
    }

    function setReserveAddress(address _reserve) external onlyOwner {
        emit ReserveAddressSet(reserveAddress, _reserve);
        reserveAddress = _reserve;
    }

    function setTicketPrice(uint256 _ticketPrice) external onlyOwner {
        uint256 old = ticketPrice;
        ticketPrice = _ticketPrice;
        emit TicketPriceSet(old, _ticketPrice);
    }

    function setPriceIncreasePerMint(uint256 _priceIncreasePerMint) external onlyOwner {
        uint256 old = priceIncreasePerMint;
        priceIncreasePerMint = _priceIncreasePerMint;
        emit PriceIncreasePerMintSet(old, _priceIncreasePerMint);
    }

    function setTicketBaseURI(string calldata newUri) external onlyOwner {
        string memory old = ticketBaseURI;
        ticketBaseURI = newUri;
        emit TicketBaseURISet(old, newUri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NotTicket();
        return BiggiMetaRedeemLib.buildTicketUri(ticketBaseURI);
    }

    function mintTicket() external payable nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (saleMinted >= saleCap) revert SaleCapReached();
        if (ticketCount[msg.sender] >= MAX_PER_WALLET) revert MaxPerWallet();
        if (msg.value < ticketPrice) revert InsufficientPayment();

        _splitAndForward(msg.value);
        uint256 mintedAtPrice = ticketPrice;
        uint256 ticketId = _mintTicket(msg.sender, mintedAtPrice);
        unchecked { saleMinted++; }
        emit MintRequested(msg.sender, ticketId);
        _increaseTicketPrice();
    }

    function mintTicketWithBiggi() external nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (saleMinted >= saleCap) revert SaleCapReached();
        if (ticketCount[msg.sender] >= MAX_PER_WALLET) revert MaxPerWallet();
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 mintedAtPrice = ticketPrice;
        uint256 tokenAmount = _ethToBiggi(mintedAtPrice);
        _collectBiggi(msg.sender, tokenAmount);

        uint256 ticketId = _mintTicket(msg.sender, mintedAtPrice);
        unchecked { saleMinted++; }
        emit MintRequested(msg.sender, ticketId);
        _increaseTicketPrice();
    }

    function mintMarketingTicket(address to) external onlyOwner whenNotPaused returns (uint256 ticketId) {
        if (to == address(0)) revert InvalidAddress();
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (marketingMinted >= marketingCap) revert MarketingCapReached();
        uint256 mintedAtPrice = ticketPrice;
        ticketId = _mintTicket(to, mintedAtPrice);
        unchecked { marketingMinted++; }
        emit MarketingTicketMinted(to, ticketId);
    }

    function redeemTicket(uint256 ticketId) external nonReentrant whenNotPaused {
        if (!isTicket[ticketId]) revert NotTicket();
        if (ownerOf(ticketId) != msg.sender) revert NotTicketOwner();
        if (ticketCount[msg.sender] == 0) revert NoTicketToRedeem();

        uint256 ticketPriceSnapshot = mintedTicketPrice[ticketId];
        isTicket[ticketId] = false;
        ticketCount[msg.sender]--;
        _burn(ticketId);

        IBiggiMainRedeem(mainCollection).redeemFromTicketHub(msg.sender, ticketId, ticketPriceSnapshot);
        delete mintedTicketPrice[ticketId];

        emit TicketRedeemed(msg.sender, ticketId, ticketPriceSnapshot);
    }

    function totalMinted() public view returns (uint256) {
        return ticketMinted;
    }

    function getTicketPrice() external view returns (uint256) {
        return ticketPrice;
    }

    function isFullyExhausted() external view returns (bool) {
        return saleMinted == saleCap && marketingMinted == marketingCap && ticketMinted == MAX_TICKETS;
    }

    function _mintTicket(address to, uint256 mintedAtPrice) internal returns (uint256 ticketId) {
        ticketId = BiggiIdIndexLib.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;
        mintedTicketPrice[ticketId] = mintedAtPrice;
        unchecked { ticketMinted++; }
        ticketCount[to]++;
        _safeMint(to, ticketId);
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
            if (routed > 0) BIGGI.safeTransfer(tokenSink, routed);
        }

        uint256 toReserve = amount - routed;
        if (toReserve > 0) {
            if (reserveAddress == address(0)) revert InvalidReserve();
            BIGGI.safeTransfer(reserveAddress, toReserve);
            try IBiggiReserve(reserveAddress).notifyBiggiReceived(toReserve) {
            } catch {
            }
        }

        emit BiggiCollected(from, amount, routed, toReserve);
    }

    function _splitAndForward(uint256 amount) internal {
        uint256 toDistributor = (amount * 6000) / 10000;
        if (address(distributor) != address(0) && toDistributor > 0) {
            (bool okD, ) = address(distributor).call{value: toDistributor}(
                abi.encodeWithSelector(IBiggiDistributor.receiveMintShare.selector)
            );
            require(okD, "distributor fwd failed");
        }
        uint256 devPart = amount - toDistributor;
        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    receive() external payable { revert NoDirectETH(); }
}
