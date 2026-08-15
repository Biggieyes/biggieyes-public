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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CORE_LIBRARY/BiggiPriceMathLib.sol";
import "./CORE_LIBRARY/BiggiIdIndexLib.sol";
import "./CORE_LIBRARY/BiggiMetaRedeemLib.sol";
import "./CORE_LIBRARY/BiggiNamesLib2.sol";

interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

interface IBiggiPriceProvider {
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
}

interface IBiggiReserve {
    function notifyBiggiReceived(uint256 amount) external;
}

interface IBiggiEcosystemTokenSink {
    function receiveEcosystemBiggi(uint256 amount) external;
}

interface IBiggiChapterControllerView {
    function isPublicMintUnlocked(uint256 chapterId) external view returns (bool);
    function getChapterPriceProvider(uint256 chapterId) external view returns (address);
    function getChapterCollections(uint256 chapterId) external view returns (address vrfCollection, address publicCollection, address ticketHub);
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
error InvalidAddress();
error DistributorNotSet();
error RefundFailed();
error DistributorForwardFailed();
error ZeroAmount();
error NativeRescueFailed();
error ChapterControllerCollectionMismatch();
error ChapterPriceProviderUnavailable();
error MetadataConfigurationIncomplete();
error RewardMatrixInconsistent();
error InvalidBiggiRate();
error ZeroTokenPayment();

contract BiggiEyesMain2 is ERC721, Ownable, Pausable, ReentrancyGuard {
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BATCH   = 55;
    uint256 public constant MAX_SUPPLY  = 550;

    IBiggiDistributor public distributor;
    IBiggiPriceProvider public priceProvider;
    IBiggiChapterControllerView public chapterController;
    address public devWallet;
    uint256 public chapterId;

    uint16[10] public blockMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;
    uint16[10] public backgroundMintCounts;
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;
    uint16 public biggiMinted;

    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public contractMetadataURI;

    IERC20 public BIGGI;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000;
    bool public tokenSinkDepositMode;
    uint256 public biggiPerEth  = 1e18;
    address public reserveAddress;

    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event DistributorSet(address distributor);
    event PriceProviderSet(address provider);
    event ChapterControllerSet(address indexed controller, uint256 indexed chapterId);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event TokenSinkDepositModeSet(bool enabled);
    event ReserveAddressSet(address indexed oldAddr, address indexed newAddr);
    event PublicMint(address indexed minter, uint256 tokenId, uint256 idx);
    event BlockStatsUpdated(uint16 blk, uint16 blockMinted, uint16 bgMinted);
    event BiggiCollected(address indexed from, uint256 amount, uint256 routedToSink, uint256 forwardedToReserve);
    event BlockPriceUpdated(uint16 indexed blockIdx, uint256 oldPrice, uint256 newPrice);
    event DevWalletSet(address indexed oldWallet, address indexed newWallet);
    event ContractURISet(string oldUri, string newUri);

    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1;
    uint8 private constant URI_BLOCK      = 2;

    constructor(address initialOwner) ERC721("BiggiEyesPublic", "BIGGI-PUB") Ownable(initialOwner) {
        if (initialOwner == address(0)) revert OwnerZero();
        devWallet = initialOwner;
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
        if (dist == address(0)) revert InvalidAddress();
        distributor = IBiggiDistributor(dist);
        emit DistributorSet(dist);
    }

    function setDevWallet(address wallet_) external onlyOwner {
        if (wallet_ == address(0)) revert InvalidAddress();
        emit DevWalletSet(devWallet, wallet_);
        devWallet = wallet_;
    }

    function setPriceProvider(address provider_) external onlyOwner {
        if (provider_ == address(0)) revert InvalidAddress();
        priceProvider = IBiggiPriceProvider(provider_);
        emit PriceProviderSet(provider_);
    }

    function clearPriceProvider() external onlyOwner {
        priceProvider = IBiggiPriceProvider(address(0));
        emit PriceProviderSet(address(0));
    }

    function setChapterController(address controller_, uint256 chapterId_) external onlyOwner {
        if (controller_ == address(0)) revert InvalidAddress();
        (, address publicCollection, ) = IBiggiChapterControllerView(controller_).getChapterCollections(chapterId_);
        if (publicCollection != address(this)) revert ChapterControllerCollectionMismatch();
        chapterController = IBiggiChapterControllerView(controller_);
        chapterId = chapterId_;
        emit ChapterControllerSet(controller_, chapterId_);
    }

    function clearChapterController() external onlyOwner {
        chapterController = IBiggiChapterControllerView(address(0));
        chapterId = 0;
        emit ChapterControllerSet(address(0), 0);
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

    function setContractURI(string calldata newUri) external onlyOwner {
        string memory oldUri = contractMetadataURI;
        contractMetadataURI = newUri;
        emit ContractURISet(oldUri, newUri);
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
            return BiggiMetaRedeemLib.buildPublicCharacterUri(
                charactersBaseURI,
                tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110
            );
        }
        revert InvalidIndex();
    }

    function contractURI() external view returns (string memory) {
        return contractMetadataURI;
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
        return getEffectiveBlockPrice(blockIdx);
    }

    function getEffectiveBlockPrice(uint256 blockId) public view returns (uint256) {
        uint16 blockIdx = uint16(blockId);
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();

        if (address(chapterController) != address(0)) {
            address chapterProvider = chapterController.getChapterPriceProvider(chapterId);
            if (chapterProvider == address(0)) revert ChapterPriceProviderUnavailable();
            try IBiggiPriceProvider(chapterProvider).getCurrentBlockPrice(blockIdx) returns (uint256 resolvedPrice) {
                if (resolvedPrice == 0) revert ChapterPriceProviderUnavailable();
                return resolvedPrice;
            } catch {
                revert ChapterPriceProviderUnavailable();
            }
        }

        address provider = address(priceProvider);
        if (provider != address(0)) {
            try IBiggiPriceProvider(provider).getCurrentBlockPrice(blockIdx) returns (uint256 resolvedPrice) {
                if (resolvedPrice > 0) return resolvedPrice;
            } catch {
                // Fall through to local storage price.
            }
        }
        return blockInfos[blockIdx - 1].currentPrice;
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
        uint256[] memory invalid = new uint256[](MAX_SUPPLY);
        uint256 count;
        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!_isMetadataValid(info.blockIdx, info.background, info.mainId)) {
                invalid[count] = idx;
                unchecked { ++count; }
            }
        }
        uint256[] memory trimmed = new uint256[](count);
        for (uint256 i = 0; i < count; ++i) {
            trimmed[i] = invalid[i];
        }
        return trimmed;
    }

    function metadataConfiguredCount() external view returns (uint256 configuredCount) {
        (configuredCount,,) = _metadataConsistencyState();
    }

    function isMetadataFullyConfigured() external view returns (bool fullyConfigured) {
        (, fullyConfigured,) = _metadataConsistencyState();
    }

    function isRewardMatrixConsistent() external view returns (bool rewardMatrixConsistent) {
        (,, rewardMatrixConsistent) = _metadataConsistencyState();
    }

    function metadataConsistency()
        external
        view
        returns (uint256 configuredCount, bool fullyConfigured, bool rewardMatrixConsistent)
    {
        return _metadataConsistencyState();
    }

    function assertMetadataConsistency() external view returns (bool) {
        (, bool fullyConfigured, bool rewardMatrixConsistent) = _metadataConsistencyState();
        if (!fullyConfigured) revert MetadataConfigurationIncomplete();
        if (!rewardMatrixConsistent) revert RewardMatrixInconsistent();
        return true;
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
            if (!_isMetadataValid(blockIndices[i], bgCodes[i], mainIds[i])) revert InvalidIndex();

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
        if (!_isMintMetadataValid(info)) revert InvalidIndex();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();

        uint16 blk_ = info.blockIdx;
        uint256 price = getEffectiveBlockPrice(blk_);
        if (msg.value < price) revert InsufficientPayment();

        _splitAndForwardAmount(price);

        uint256 overpay = msg.value - price;
        if (overpay > 0) {
            (bool rf, ) = msg.sender.call{value: overpay}("");
            if (!rf) revert RefundFailed();
        }

        _finalizePublicMint(msg.sender, idx, blk_, info.background, price);
    }

    function mintPublicWithBiggi(uint256 idx) external nonReentrant whenNotPaused {
        _requirePublicUnlocked();
        if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[idx].minted) revert InvalidIndex();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        if (!_isMintMetadataValid(info)) revert InvalidIndex();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();

        uint16 blk_ = info.blockIdx;
        uint256 price = getEffectiveBlockPrice(blk_);
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 tokenAmount = _ethToBiggi(price);
        if (tokenAmount == 0) revert ZeroTokenPayment();
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

    function _splitAndForwardAmount(uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (address(distributor) == address(0)) revert DistributorNotSet();
        uint256 toDistributor = (amount * 6000) / 10000;
        (bool okD, ) = address(distributor).call{value: toDistributor}(
            abi.encodeWithSelector(IBiggiDistributor.receiveMintShare.selector)
        );
        if (!okD) revert DistributorForwardFailed();
        uint256 devPart = amount - toDistributor;
        (bool sent, ) = devWallet.call{value: devPart}("");
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
        if (!ok) revert NativeRescueFailed();
    }

    function _backgroundCountForBlock(uint16 blk_) internal pure returns (uint16) {
        if (blk_ < 1 || blk_ > 10) return 0;
        return uint16(11 - blk_);
    }

    function _minMainIdForBlock(uint16 blk_) internal pure returns (uint256) {
        if (blk_ < 1 || blk_ > 10) return 0;
        return (uint256(blk_ - 1) * 10) + 1;
    }

    function _maxMainIdForBlock(uint16 blk_) internal pure returns (uint256) {
        if (blk_ < 1 || blk_ > 10) return 0;
        return uint256(blk_) * 10;
    }

    function _isMetadataValid(uint16 blk_, uint16 bg_, uint256 mainId_) internal pure returns (bool) {
        uint16 bgCount = _backgroundCountForBlock(blk_);
        if (bgCount == 0) return false;
        uint256 minMainId = _minMainIdForBlock(blk_);
        uint256 maxMainId = _maxMainIdForBlock(blk_);
        return bg_ >= 1 && bg_ <= bgCount && mainId_ >= minMainId && mainId_ <= maxMainId;
    }

    function _isMintMetadataValid(BiggiIdIndexLib.NFTInfo storage info) internal view returns (bool) {
        return _isMetadataValid(info.blockIdx, info.background, info.mainId);
    }

    function _metadataConsistencyState()
        internal
        view
        returns (uint256 configuredCount, bool fullyConfigured, bool rewardMatrixConsistent)
    {
        uint16[101][11] memory seenBackgroundMaskByBlockMain;
        uint8[101][11] memory uniqueBackgroundCountByBlockMain;

        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!_isMetadataValid(info.blockIdx, info.background, info.mainId)) continue;

            configuredCount++;
            uint16 bit = uint16(1 << (info.background - 1));
            if ((seenBackgroundMaskByBlockMain[info.blockIdx][info.mainId] & bit) == 0) {
                seenBackgroundMaskByBlockMain[info.blockIdx][info.mainId] |= bit;
                unchecked {
                    uniqueBackgroundCountByBlockMain[info.blockIdx][info.mainId] += 1;
                }
            }
        }

        fullyConfigured = configuredCount == MAX_SUPPLY;
        rewardMatrixConsistent = fullyConfigured;

        for (uint16 blk = 1; blk <= 10; ++blk) {
            uint16 expectedBackgroundCount = _backgroundCountForBlock(blk);
            uint256 minMainId = _minMainIdForBlock(blk);
            uint256 maxMainId = _maxMainIdForBlock(blk);
            for (uint256 mainId = minMainId; mainId <= maxMainId; ++mainId) {
                if (uniqueBackgroundCountByBlockMain[blk][mainId] != expectedBackgroundCount) {
                    rewardMatrixConsistent = false;
                }
            }
        }
    }

    receive() external payable { revert NoDirectETH(); }
}
