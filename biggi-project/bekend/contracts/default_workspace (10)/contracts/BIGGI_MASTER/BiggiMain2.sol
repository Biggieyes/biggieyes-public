// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiEyesMain2 — PUBLIC chapter collection
 * - Public minting by specifying nft index
 * - Price is read from chapter VRF collection
 * - Public mint is locked until ChapterController confirms full VRF ticket exhaustion
 * - Keeps original public mint + distributor routing logic
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Library/BiggiPriceMathLib.sol";
import "./Library/BiggiIdIndexLib.sol";
import "./Library/BiggiMetaRedeemLib.sol";
import "./Library/BiggiNamesLib2.sol";

interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

interface IBiggiPriceProvider {
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
}

interface IBiggiReserve {
    function notifyBiggiReceived(uint256 amount) external;
}

interface IBiggiChapterControllerView {
    function isPublicMintUnlocked(uint256 chapterId) external view returns (bool);
    function getChapterPriceProvider(uint256 chapterId) external view returns (address);
}

error OwnerZero();
error AllNFTsMintedErr();
error InvalidIndex();
error InvalidBlock();
error InvalidBg();
error AlreadySet();
error InvalidCategory();
error DevPaymentFailed();
error BiggiTokenNotSet();
error TokenSinkBpsTooHigh();
error InvalidReserve();
error InsufficientPayment();
error NoToken();
error NoDirectETH();
error PublicMintLocked();
error ChapterControllerNotSet();

contract BiggiEyesMain2 is ERC721, Ownable, Pausable, ReentrancyGuard {
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);
    using SafeERC20 for IERC20;

    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint256 public constant MAX_BATCH   = 55;
    uint256 public constant MAX_SUPPLY  = 550;

    IBiggiDistributor public distributor;
    IBiggiPriceProvider public priceProvider;
    IBiggiChapterControllerView public chapterController;
    uint256 public chapterId;

    uint16[10] public blockMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;
    uint16[10] public backgroundMintCounts;
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;
    uint16 public biggiMinted;

    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;

    IERC20 public BIGGI;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000;
    uint256 public biggiPerEth  = 1e18;
    address public reserveAddress;

    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event DistributorSet(address distributor);
    event PriceProviderSet(address provider);
    event ChapterControllerSet(address indexed controller, uint256 indexed chapterId);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event ReserveAddressSet(address indexed oldAddr, address indexed newAddr);
    event PublicMint(address indexed minter, uint256 tokenId, uint256 idx);
    event BlockStatsUpdated(uint16 blk, uint16 blockMinted, uint16 bgMinted);
    event BiggiCollected(address indexed from, uint256 amount, uint256 routedToSink, uint256 forwardedToReserve);
    event BlockPriceUpdated(uint16 indexed blockIdx, uint256 oldPrice, uint256 newPrice);

    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1;
    uint8 private constant URI_BLOCK      = 2;

    constructor(address initialOwner) ERC721("BiggiEyesPublic", "BIGGI-PUB") Ownable(initialOwner) {
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

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function setDistributor(address dist) external onlyOwner {
        distributor = IBiggiDistributor(dist);
        emit DistributorSet(dist);
    }

    function setPriceProvider(address provider_) external onlyOwner {
        priceProvider = IBiggiPriceProvider(provider_);
        emit PriceProviderSet(provider_);
    }

    function setChapterController(address controller_, uint256 chapterId_) external onlyOwner {
        chapterController = IBiggiChapterControllerView(controller_);
        chapterId = chapterId_;
        emit ChapterControllerSet(controller_, chapterId_);
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

    function setBlockCurrentPrice(uint16 blockIdx, uint256 newPrice) external onlyOwner {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        uint256 old = blockInfos[blockIdx - 1].currentPrice;
        blockInfos[blockIdx - 1].currentPrice = newPrice;
        emit BlockPriceUpdated(blockIdx, old, newPrice);
    }

    function setURI(uint8 category, uint16 idx, string calldata uri) external onlyOwner {
        if (category == URI_REWARDS) {
            rewardsBaseURI = uri;
        } else if (category == URI_CHARACTERS) {
            charactersBaseURI = uri;
        } else if (category == URI_BLOCK) {
            if (idx < 1 || idx > 10) revert InvalidBlock();
            blockBaseURIs[idx] = uri;
        } else {
            revert InvalidCategory();
        }
        emit URIUpdated(category, idx, uri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert NoToken();
        if (tokenId >= BiggiIdIndexLib.BIGGI_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            return BiggiMetaRedeemLib.buildNftUri(
                blockBaseURIs[info.blockIdx], info.mainId,
                BiggiNamesLib2.blockName(info.blockIdx), BiggiNamesLib2.backgroundShort(info.background)
            );
        }
        if (tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET + 10) {
            string memory charFile = string.concat(
                "Biggi_", Strings.toString(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110),
                "_REWARD.json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        revert InvalidIndex();
    }

    function exists(uint256 tokenId) public view returns (bool) { return _ownerOf(tokenId) != address(0); }

    function blockOf(uint256 tokenId) external view returns (uint16) {
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) return 0;
        if (!exists(tokenId)) return 0;
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return nftInfo[idx].blockIdx;
    }

    function _requirePublicUnlocked() internal view {
        if (address(chapterController) == address(0)) revert ChapterControllerNotSet();
        if (!chapterController.isPublicMintUnlocked(chapterId)) revert PublicMintLocked();
    }

    function getCurrentBlockPrice(uint16 blockIdx) public view returns (uint256) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();

        address provider = address(0);
        if (address(chapterController) != address(0)) {
            provider = chapterController.getChapterPriceProvider(chapterId);
        }
        if (provider == address(0)) {
            provider = address(priceProvider);
        }
        if (provider == address(0)) {
            return blockInfos[blockIdx - 1].currentPrice;
        }
        return IBiggiPriceProvider(provider).getCurrentBlockPrice(blockIdx);
    }

    function getBlockMintCount(uint16 blockIdx) public view returns (uint16) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        return blockMintCounts[blockIdx - 1];
    }

    function getMintData(uint256 index) external view returns (uint256, uint256, uint256) {
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[index];
        return (info.ticketPrice, info.blockPrice, info.finalPrice);
    }

    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }

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

    function mintPublic(uint256 idx) external payable nonReentrant whenNotPaused {
        _requirePublicUnlocked();
        if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[idx].minted) revert InvalidIndex();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        if (info.background == 0 || info.blockIdx == 0) revert InvalidIndex();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();

        uint16 blk_ = info.blockIdx;
        uint256 price = getCurrentBlockPrice(blk_);
        if (msg.value < price) revert InsufficientPayment();

        _splitAndForwardAmount(price);

        uint256 overpay = msg.value - price;
        if (overpay > 0) {
            (bool rf, ) = msg.sender.call{value: overpay}("");
            require(rf, "refund failed");
        }

        _finalizePublicMint(msg.sender, idx, blk_, info.background, price);
    }

    function mintPublicWithBiggi(uint256 idx) external nonReentrant whenNotPaused {
        _requirePublicUnlocked();
        if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[idx].minted) revert InvalidIndex();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        if (info.background == 0 || info.blockIdx == 0) revert InvalidIndex();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();

        uint16 blk_ = info.blockIdx;
        uint256 price = getCurrentBlockPrice(blk_);
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 tokenAmount = _ethToBiggi(price);
        _collectBiggi(msg.sender, tokenAmount);
        _finalizePublicMint(msg.sender, idx, blk_, info.background, price);
    }

    function _finalizePublicMint(address to, uint256 idx, uint16 blk_, uint16 bg_, uint256 price) internal {
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        info.minted = true;
        unchecked { biggiMinted++; }

        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        _safeMint(to, tokenId);

        unchecked {
            blockMintCounts[blk_ - 1]++;
            backgroundMintCounts[bg_ - 1]++;
        }

        info.ticketPrice = 0;
        info.blockPrice  = price;
        info.finalPrice  = price;

        emit PublicMint(to, tokenId, idx);
        emit BlockStatsUpdated(blk_, blockMintCounts[blk_ - 1], backgroundMintCounts[bg_ - 1]);
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

    function _splitAndForwardAmount(uint256 amount) internal {
        require(amount > 0, "zero amount");
        uint256 toDistributor = (amount * 6000) / 10000;
        if (address(distributor) != address(0) && toDistributor > 0) {
            (bool okD, ) = address(distributor).call{value: toDistributor}(
                abi.encodeWithSelector(IBiggiDistributor.receiveMintShare.selector)
            );
            require(okD, "distributor fwd failed");
        } else {
            (bool sDev, ) = DEV_WALLET.call{value: amount}("");
            require(sDev, "dev send failed");
            return;
        }
        uint256 devPart = amount - toDistributor;
        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    function getBackgroundMintCount(uint16 bg) external view returns (uint16) {
        if (bg < 1 || bg > 10) revert InvalidBg();
        return backgroundMintCounts[bg - 1];
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native rescue failed");
    }

    receive() external payable { revert NoDirectETH(); }
}
