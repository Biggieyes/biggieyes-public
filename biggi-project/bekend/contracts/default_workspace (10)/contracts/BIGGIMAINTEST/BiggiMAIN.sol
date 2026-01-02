// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiEyesMain – MAIN COLLECTION
 * Changes vs previous draft:
 * - 60%→Distributor + 40%→DEV preserved.
 * - No change in external split BPS fields (UI only).
 * - Compatible with Distributor whitelist.
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiPriceMathLib.sol";
import "./BiggiIdIndexLib.sol";
import "./BiggiMetaRedeemLib.sol";
import "./BiggiNamesLib.sol";
import "./BiggiBpsLib.sol";

/* -------- Rozhraní na moduly -------- */
interface IBiggiCompute {
    function bgBonus(uint16 bg) external pure returns (uint8);
    function bgIncreasePct(uint16 bg) external pure returns (uint8);
}
interface IBiggiVRFRouter {
    function requestRandomFor(address minter, uint256 ticketId) external returns (uint256 requestId);
}
interface IBiggiVRFView {
    function keyHash() external view returns (bytes32);
    function subId() external view returns (uint256);
    function callbackGasLimit() external view returns (uint32);
    function requestConfirmations() external view returns (uint16);
    function numWords() external view returns (uint32);
}
interface IBiggiRewardsPool_ETH {
    function receiveMintShare() external payable;
}
interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

/* -------- Custom errors -------- */
error OwnerZero();
error AllTicketsMinted();
error AllNFTsMintedErr();
error MaxPerWallet();
error InsufficientPayment();
error DevPaymentFailed();
error NotTicket();
error NotTicketOwner();
error NoTicketToRedeem();
error AlreadyPending();
error NoMinter();
error SoldOut();
error NoToken();
error InvalidTokenId();
error InvalidBlock();
error InvalidIndex();
error InvalidBg();
error AlreadySet();
error InvalidCategory();
error NoDirectETH();
error BiggiTokenNotSet();
error TokenSinkBpsTooHigh();

contract BiggiEyesMain is ERC721, Ownable, Pausable, ReentrancyGuard {
    using BiggiPriceMathLib for BiggiPriceMathLib.BlockInfo;
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);
    using SafeERC20 for IERC20;

    /* ---- Konstanty ---- */
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint256 public constant MAX_BATCH   = 55;
    uint256 public constant MAX_TICKETS = 550;
    uint256 public constant MAX_SUPPLY  = 550;

    /* ---- Moduly ---- */
    IBiggiCompute     public compute;
    IBiggiVRFRouter   public vrfRouter;
    IBiggiVRFView     public vrfView;
    IBiggiRewardsPool_ETH public rewardsPoolETH; // pouze interface pro kompatibilitu (není volán zde)
    IBiggiDistributor public distributor;

    /* ---- Počty / tickety ---- */
    uint16 public ticketMinted;
    uint16 public biggiMinted;
    mapping(address => uint256) public ticketCount;
    mapping(uint256 => bool) public isTicket;

    /* ---- Ticket price ---- */
    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033; // +0.33%

    /* ---- Ceny bloků / statistiky ---- */
    uint16[10] public blockMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;
    uint16[10] public backgroundMintCounts;

    /* ---- Metadata / indexy ---- */
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;

    /* ---- URI ---- */
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;

    /* ---- Character rewards ---- */
    mapping(uint16 => bool) public characterClaimed;

    /* ---- UI-kompat BPS (neaktivní v logice) ---- */
    uint256 public rewardsBps  = 2200;
    uint256 public buybackBps  = 1500;
    uint256 public treasuryBps = 2300;

    /* ---- BIGGI token ---- */
    IERC20  public BIGGI;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000; // 100%
    uint256 public biggiPerEth  = 1e18;

    /* ---- VRF pending (pro UI) ---- */
    mapping(address => uint256) public pendingMintRequest; // user => requestId
    mapping(uint256 => address) public pendingMinters;     // requestId => user
    mapping(uint256 => uint64)  public pendingRequestedAt; // requestId => timestamp

    /* ---- Události ---- */
    event MintRequested(address indexed user, uint256 requestIdOrTicketId);
    event TicketRedeemed(address indexed user, uint256 ticketId);
    event VRFRequested(address indexed user, uint256 requestId, uint256 ticketId);
    event VRFFulfillStarted(uint256 requestId, address minter, uint256 randomWord);
    event NFTMinted(address indexed minter, uint256 tokenId, uint256 nftIndex);

    event TicketPriceIncreased(uint256 oldPrice, uint256 newPrice, uint256 bps);
    event BlockPriceBoosted(uint16 bg, uint256 oldPrice, uint256 newPrice, uint8 incPct);

    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event VRFRouterSet(address router);
    event ComputeSet(address compute);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event DistributorSet(address distributor);

    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1;
    uint8 private constant URI_TICKET     = 2;
    uint8 private constant URI_BLOCK      = 3;

    constructor(address initialOwner) ERC721("BiggiEyes", "BIGGI") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert OwnerZero();
        uint256[10] memory base = [
            uint256(100 ether), 200 ether, 300 ether, 400 ether, 500 ether,
            600 ether, 700 ether, 800 ether, 900 ether, 1000 ether
        ];
        uint256[10] memory growth = [
            uint256(10000), 10000, 10000, 10000, 10000,
            10000, 10000, 10000, 10000, 10000
        ];
        BiggiPriceMathLib.initializeBlocks(blockInfos, base, growth);
    }

    /* ===== Admin ===== */
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setModules(address compute_, address vrfRouter_) external onlyOwner {
        if (compute_ != address(0)) { compute = IBiggiCompute(compute_); emit ComputeSet(compute_); }
        if (vrfRouter_ != address(0)) {
            vrfRouter = IBiggiVRFRouter(vrfRouter_);
            vrfView   = IBiggiVRFView(vrfRouter_);
            emit VRFRouterSet(vrfRouter_);
        }
    }

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

    /* ===== URI ===== */
    function setURI(uint8 category, uint16 idx, string calldata uri) external onlyOwner {
        if (category == URI_REWARDS) {
            rewardsBaseURI = uri;
        } else if (category == URI_CHARACTERS) {
            charactersBaseURI = uri;
        } else if (category == URI_TICKET) {
            ticketBaseURI = uri;
        } else if (category == URI_BLOCK) {
            if (idx < 1 || idx > 10) revert InvalidBlock();
            blockBaseURIs[idx] = uri;
        } else {
            revert InvalidCategory();
        }
        emit URIUpdated(category, idx, uri);
    }

    /* ===== tokenURI / exists ===== */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert NoToken();

        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) {
            return BiggiMetaRedeemLib.buildTicketUri(ticketBaseURI);
        }
        if (tokenId >= BiggiIdIndexLib.REWARDS_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            string memory rewardFile = string.concat(
                "Biggi_", Strings.toString(tokenId - BiggiIdIndexLib.REWARDS_OFFSET + 101), "_REWARDS_RB.json"
            );
            return string.concat(rewardsBaseURI, rewardFile);
        }
        if (tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET + 10) {
            uint16 blk = uint16(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 1);
            string memory charFile = string.concat(
                "Biggi_", Strings.toString(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110),
                "_REWARD_", BiggiNamesLib.characterName(blk), ".json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        if (tokenId >= BiggiIdIndexLib.BIGGI_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            return BiggiMetaRedeemLib.buildNftUri(
                blockBaseURIs[info.blockIdx], info.mainId,
                BiggiNamesLib.blockName(info.blockIdx), BiggiNamesLib.backgroundShort(info.background)
            );
        }
        revert InvalidTokenId();
    }

    function exists(uint256 tokenId) public view returns (bool) { return _ownerOf(tokenId) != address(0); }

    /* ===== View helpery pro FE ===== */
    function blockOf(uint256 tokenId) external view returns (uint16) {
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) return 0;
        if (!exists(tokenId)) return 0;
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return nftInfo[idx].blockIdx;
    }
    function getCurrentBlockPrice(uint16 blockIdx) public view returns (uint256) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        return blockInfos[blockIdx - 1].currentPrice;
    }
    function getBlockMintCount(uint16 blockIdx) public view returns (uint16) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        return blockMintCounts[blockIdx - 1];
    }
    function getTicketPrice() public view returns (uint256) { return ticketPrice; }

    function getMintData(uint256 index) external view returns (uint256, uint256, uint256) {
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[index];
        return (info.ticketPrice, info.blockPrice, info.finalPrice);
    }

    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }

    function keyHash() external view returns (bytes32) { return vrfView.keyHash(); }
    function s_subscriptionId() external view returns (uint256) { return vrfView.subId(); }
    function requestConfirmations() external view returns (uint16) { return vrfView.requestConfirmations(); }
    function numWords() external view returns (uint32) { return vrfView.numWords(); }
    function callbackGasLimit() external view returns (uint32) { return vrfView.callbackGasLimit(); }

    /* ===== Batch metadata ===== */
    function batchSetNFTBackgroundAndBlock(
        uint256[] calldata indices,
        uint16[] calldata bgCodes,
        uint16[] calldata blockIndices,
        uint256[] calldata mainIds
    ) external onlyOwner {
        uint256 len = indices.length;
        if (len > MAX_BATCH) revert InvalidIndex();
        if (!(len == bgCodes.length && len == blockIndices.length && len == mainIds.length)) revert InvalidIndex();

        for (uint256 i = 0; i < len; ++i) {
            uint256 idx = indices[i];
            if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
            if (bgCodes[i] < 1 || bgCodes[i] > 10) revert InvalidBg();
            if (blockIndices[i] < 1 || blockIndices[i] > 10) revert InvalidBlock();

            BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
            if (info.minted || info.background != 0 || info.blockIdx != 0 || info.mainId != 0) revert AlreadySet();

            info.background = bgCodes[i];
            info.blockIdx   = blockIndices[i];
            info.mainId     = mainIds[i];
        }
    }

    /* ===== MINT: ticket (ETH) ===== */
    function mintTicket() external payable nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ticketCount[msg.sender] >= 10) revert MaxPerWallet();
        if (msg.value < ticketPrice) revert InsufficientPayment();

        _splitAndForward(); // 60% distributor, 40% DEV

        _mintTicket(msg.sender);
        emit MintRequested(msg.sender, BiggiIdIndexLib.TICKET_OFFSET + (ticketMinted - 1));

        uint256 oldP = ticketPrice;
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
        emit TicketPriceIncreased(oldP, ticketPrice, priceIncreasePerMint);
    }

    /* ===== MINT: ticket (BIGGI) ===== */
    function mintTicketWithBiggi() external nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ticketCount[msg.sender] >= 10) revert MaxPerWallet();
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 tokenAmount = _ethToBiggi(ticketPrice);
        _collectBiggi(msg.sender, tokenAmount);

        _mintTicket(msg.sender);
        emit MintRequested(msg.sender, BiggiIdIndexLib.TICKET_OFFSET + (ticketMinted - 1));

        uint256 oldP = ticketPrice;
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
        emit TicketPriceIncreased(oldP, ticketPrice, priceIncreasePerMint);
    }

    /* ===== Redeem → VRF request ===== */
    function redeemTicketAndMintNFT(uint256 ticketId) external nonReentrant whenNotPaused {
        if (!isTicket[ticketId]) revert NotTicket();
        if (ownerOf(ticketId) != msg.sender) revert NotTicketOwner();
        if (ticketCount[msg.sender] == 0) revert NoTicketToRedeem();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();
        if (pendingMintRequest[msg.sender] != 0) revert AlreadyPending();

        isTicket[ticketId] = false;
        ticketCount[msg.sender]--;
        _burn(ticketId);
        emit TicketRedeemed(msg.sender, ticketId);

        uint256 reqId = vrfRouter.requestRandomFor(msg.sender, ticketId);
        pendingMintRequest[msg.sender] = reqId;
        pendingMinters[reqId] = msg.sender;
        pendingRequestedAt[reqId] = uint64(block.timestamp);

        emit VRFRequested(msg.sender, reqId, ticketId);
        emit MintRequested(msg.sender, reqId);
    }

    /* ===== VRF callback (volá router) ===== */
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external {
        require(msg.sender == address(vrfRouter), "ONLY_VRF_ROUTER");

        address minter = pendingMinters[requestId];
        if (minter == address(0)) revert NoMinter();

        emit VRFFulfillStarted(requestId, minter, randomWord);

        uint256 idx = BiggiIdIndexLib.randomToMintIndex(randomWord, MAX_SUPPLY);

        for (uint256 i = 0; i < MAX_SUPPLY; ++i) {
            if (!nftInfo[idx].minted) {
                nftInfo[idx].minted = true;
                unchecked { biggiMinted++; }

                uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
                _safeMint(minter, tokenId);

                uint16 blk_;
                uint16 bg_;
                {
                    BiggiIdIndexLib.NFTInfo memory info_ = nftInfo[idx];
                    blk_ = info_.blockIdx;
                    bg_  = info_.background;
                }

                unchecked {
                    blockMintCounts[blk_ - 1]++;
                    backgroundMintCounts[bg_ - 1]++;
                }

                {
                    uint8 incPct = compute.bgIncreasePct(bg_);
                    BiggiPriceMathLib.BlockInfo storage biColor = blockInfos[bg_ - 1];
                    uint256 curr = biColor.currentPrice;
                    uint256 next = curr + (curr * incPct) / 100;
                    biColor.currentPrice = next;
                    emit BlockPriceBoosted(bg_, curr, next, incPct);
                }

                uint256 blkPriceNow;
                uint256 finalPrice;
                {
                    uint8 bonusPct = compute.bgBonus(bg_);
                    blkPriceNow = blockInfos[blk_ - 1].currentPrice;
                    finalPrice  = blkPriceNow + (blkPriceNow * bonusPct) / 100;
                }

                nftInfo[idx].ticketPrice = ticketPrice;
                nftInfo[idx].blockPrice  = blkPriceNow;
                nftInfo[idx].finalPrice  = finalPrice;

                if (!characterClaimed[blk_] && _blockMinted(blk_) == _totalBlockNFTs(blk_)) {
                    characterClaimed[blk_] = true;
                    uint256 charId = BiggiIdIndexLib.CHARACTER_OFFSET + (blk_ - 1);
                    _safeMint(minter, charId);
                }

                delete pendingMintRequest[minter];
                delete pendingMinters[requestId];
                delete pendingRequestedAt[requestId];

                emit NFTMinted(minter, tokenId, idx);
                return;
            }
            idx = (idx % MAX_SUPPLY) + 1;
        }
        revert SoldOut();
    }

    /* ===== Interní helpers ===== */
    function _totalBlockNFTs(uint16 blk) internal pure returns (uint256) {
        if (blk < 1 || blk > 10) return 0;
        return 110 - 10 * blk;
    }
    function _blockMinted(uint16 blk) internal view returns (uint256) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        return blockMintCounts[blk - 1];
    }
    function _mintTicket(address to) internal returns (uint256 ticketId) {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        ticketId = BiggiIdIndexLib.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;
        unchecked { ticketMinted++; }
        ticketCount[to]++;
        _safeMint(to, ticketId);
    }
    function _ethToBiggi(uint256 ethAmount) internal view returns (uint256) {
        return (ethAmount * biggiPerEth) / 1e18;
    }
    function _collectBiggi(address from, uint256 amount) internal {
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();
        BIGGI.safeTransferFrom(from, address(this), amount);
        if (tokenSink != address(0) && tokenSinkBps > 0) {
            uint256 routed = (amount * tokenSinkBps) / 10000;
            if (routed > 0) BIGGI.safeTransfer(tokenSink, routed);
        }
    }

    /* === SPLIT: 60% Distributor + 40% DEV (přes BiggiBpsLib) === */
    function _splitAndForward() internal {
        uint256 amount = msg.value;

        uint256 toDistributor = BiggiBpsLib.part(amount, BiggiBpsLib.DISTRIBUTOR_BPS);
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
