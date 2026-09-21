// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiEyesMainV2 - versioned VRF recovery; V1 pricing and metadata rules preserved.
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CORE_LIBRARY/BiggiPriceMathLib.sol";
import "./CORE_LIBRARY/BiggiIdIndexLib.sol";
import "./CORE_LIBRARY/BiggiMetaRedeemLib.sol";
import "./CORE_LIBRARY/BiggiNamesLib.sol";

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

interface IBiggiTicketHubMainView {
    function mainCollection() external view returns (address);
    function chapterMainCollection(uint256 chapterId) external view returns (address);
}

interface IBiggiVRFRecoveryRouter {
    function vrfRecoveryVersion() external pure returns (uint256);
    function getRequestResult(uint256 requestId) external view returns (address consumer, bool ready, uint256 word);
}

/* -------- Custom errors -------- */
error OwnerZero();
error AllNFTsMintedErr();
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
error TicketHubZero();
error OnlyTicketHub();
error TicketHubBindingMismatch();
error ComputeNotSet();
error VRFRouterNotSet();
error MetadataNotInitialized();
error NoPendingMint();
error PendingRetryTooEarly();
error PendingStateCorrupted();
error PendingRetryDelayZero();
error OnlyVrfRouter();
error NoConfiguredMintableIndex();
error MetadataConfigurationIncomplete();
error RewardMatrixInconsistent();
error InvalidChapter();

contract BiggiEyesMainV2 is ERC721, Ownable, Pausable, ReentrancyGuard {
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);

    /* ---- Konstanty ---- */
    uint256 public constant MAX_BATCH  = 55;
    uint256 public constant MAX_SUPPLY = 550;

    /* ---- Moduly ---- */
    IBiggiCompute   public compute;
    IBiggiVRFRouter public vrfRouter;
    IBiggiVRFView   public vrfView;
    address public ticketHub;
    uint256 public chapterId = 1;

    /* ---- Statistiky ---- */
    uint16 public biggiMinted;
    uint16[10] public blockMintCounts;
    uint16[10] public backgroundMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;

    /* ---- Metadata / indexy ---- */
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;

    /* ---- URI ---- */
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public contractMetadataURI;

    /* ---- Character rewards ---- */
    mapping(uint16 => bool) public characterClaimed;

    /* ---- VRF pending (pro UI) ---- */
    mapping(address => uint256) public pendingMintRequest; // user => requestId
    mapping(uint256 => address) public pendingMinters;     // requestId => user
    mapping(uint256 => uint64)  public pendingRequestedAt; // requestId => timestamp
    mapping(uint256 => uint256) public pendingTicketId;    // requestId => ticketId
    mapping(uint256 => uint256) public pendingTicketPrice; // requestId => ticketPrice snapshot
    // V2 resumes the same draw immediately once verified randomness is available.
    uint64 public constant pendingRetryDelay = 0;
    uint16 public pendingMintCount;
    bool public metadataSealed;
    bool public hasRequests;
    mapping(uint256 => uint256) public assignedIndex;
    uint256[3] private availableIndices;

    error PendingMintsExist();
    error RoutingLocked();
    error MetadataNotSealed();
    error RandomnessNotReady();
    error InvalidRandomnessSource();
    error PreferredIndexDisabled();

    event MetadataSealed();
    event PendingMintAssigned(uint256 indexed requestId, address indexed minter, uint256 indexed nftIndex);

    /* ---- Události ---- */
    event MintRequested(address indexed user, uint256 requestIdOrTicketId);
    event VRFRequested(address indexed user, uint256 requestId, uint256 ticketId);
    event VRFFulfillStarted(uint256 requestId, address minter, uint256 randomWord);
    event NFTMinted(address indexed minter, uint256 tokenId, uint256 nftIndex);
    event BlockPriceBoosted(uint16 bg, uint256 oldPrice, uint256 newPrice, uint8 incPct);
    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event VRFRouterSet(address router);
    event ComputeSet(address compute);
    event TicketHubSet(address indexed oldHub, address indexed newHub);
    event ChapterIdSet(uint256 indexed oldChapterId, uint256 indexed newChapterId);
    event PendingRetryDelaySet(uint64 oldDelaySec, uint64 newDelaySec);
    event PendingMintRetried(address indexed user, uint256 indexed oldRequestId, uint256 indexed newRequestId, uint256 ticketId);
    event ContractURISet(string oldUri, string newUri);
    event PendingMintFallbackSelected(uint256 indexed requestId, uint256 indexed requestedIndex, uint256 indexed resolvedIndex);
    event PendingMintEmergencyResolved(address indexed user, uint256 indexed requestId, uint256 indexed resolvedIndex, uint256 tokenId);

    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1;
    uint8 private constant URI_BLOCK      = 3;

    modifier onlyTicketHub() {
        if (msg.sender != ticketHub) revert OnlyTicketHub();
        _;
    }

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
        if (pendingMintCount != 0) revert PendingMintsExist();
        if (vrfRouter_ != address(0) && vrfRouter_ != address(vrfRouter)) {
            if (hasRequests) revert RoutingLocked();
            if (IBiggiVRFRecoveryRouter(vrfRouter_).vrfRecoveryVersion() != 2) revert InvalidRandomnessSource();
        }
        if (compute_ != address(0)) require(compute_.code.length != 0, "INVALID_COMPUTE");
        if (compute_ != address(0)) {
            compute = IBiggiCompute(compute_);
            emit ComputeSet(compute_);
        }
        if (vrfRouter_ != address(0)) {
            vrfRouter = IBiggiVRFRouter(vrfRouter_);
            vrfView   = IBiggiVRFView(vrfRouter_);
            emit VRFRouterSet(vrfRouter_);
        }
    }

    function setTicketHub(address hub) external onlyOwner {
        if (hasRequests && hub != ticketHub) revert RoutingLocked();
        if (hub == address(0)) revert TicketHubZero();
        if (!_isTicketHubBoundToThisChapter(hub, chapterId)) revert TicketHubBindingMismatch();
        emit TicketHubSet(ticketHub, hub);
        ticketHub = hub;
    }

    function setChapterId(uint256 chapterId_) external onlyOwner {
        if (hasRequests && chapterId_ != chapterId) revert RoutingLocked();
        if (chapterId_ == 0) revert InvalidChapter();
        if (ticketHub != address(0) && !_isTicketHubBoundToThisChapter(ticketHub, chapterId_)) {
            revert TicketHubBindingMismatch();
        }
        emit ChapterIdSet(chapterId, chapterId_);
        chapterId = chapterId_;
    }

    function vrfRecoveryVersion() external pure returns (uint256) { return 2; }

    function sealMetadata() external onlyOwner {
        (, bool full, bool consistent) = _metadataConsistencyState();
        if (!full) revert MetadataConfigurationIncomplete();
        if (!consistent) revert RewardMatrixInconsistent();
        metadataSealed = true;
        emit MetadataSealed();
    }

    function setContractURI(string calldata newUri) external onlyOwner {
        string memory oldUri = contractMetadataURI;
        contractMetadataURI = newUri;
        emit ContractURISet(oldUri, newUri);
    }

    /* ======= owner-only settery zachovány pro block pricing ======= */
    event BlockCurrentPriceSet(uint16 indexed blockIdx, uint256 oldPrice, uint256 newPrice);

    function setBlockCurrentPrice(uint16 blockIdx, uint256 _newPrice) external onlyOwner {
        if (pendingMintCount != 0) revert PendingMintsExist();
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        BiggiPriceMathLib.BlockInfo storage bi = blockInfos[blockIdx - 1];
        uint256 old = bi.currentPrice;
        bi.currentPrice = _newPrice;
        emit BlockCurrentPriceSet(blockIdx, old, _newPrice);
    }

    /* ===== URI ===== */
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

    /* ===== tokenURI / exists ===== */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert NoToken();

        if (BiggiIdIndexLib.isRewardNft(tokenId)) {
            return BiggiMetaRedeemLib.buildRewardUri(
                rewardsBaseURI,
                tokenId - BiggiIdIndexLib.REWARDS_OFFSET + 101
            );
        }
        if (tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET + 10) {
            uint16 blk = uint16(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 1);
            return BiggiMetaRedeemLib.buildCharacterUri(
                charactersBaseURI,
                tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110,
                BiggiNamesLib.characterName(blk)
            );
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

    function contractURI() external view returns (string memory) {
        return contractMetadataURI;
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

    function _vrfViewOrRevert() internal view returns (IBiggiVRFView) {
        if (address(vrfView) == address(0)) revert VRFRouterNotSet();
        return vrfView;
    }

    function _isTicketHubBoundToThisChapter(address hub, uint256 chapterId_) internal view returns (bool) {
        try IBiggiTicketHubMainView(hub).chapterMainCollection(chapterId_) returns (address configuredMain) {
            return configuredMain == address(this);
        } catch {
            if (chapterId_ != 1) return false;
            try IBiggiTicketHubMainView(hub).mainCollection() returns (address configuredMain) {
                return configuredMain == address(0) || configuredMain == address(this);
            } catch {
                return false;
            }
        }
    }

    function keyHash() external view returns (bytes32) { return _vrfViewOrRevert().keyHash(); }
    function s_subscriptionId() external view returns (uint256) { return _vrfViewOrRevert().subId(); }
    function requestConfirmations() external view returns (uint16) { return _vrfViewOrRevert().requestConfirmations(); }
    function numWords() external view returns (uint32) { return _vrfViewOrRevert().numWords(); }
    function callbackGasLimit() external view returns (uint32) { return _vrfViewOrRevert().callbackGasLimit(); }

    /* ===== Batch metadata ===== */
    function batchSetNFTBackgroundAndBlock(
        uint256[] calldata indices,
        uint16[] calldata bgCodes,
        uint16[] calldata blockIndices,
        uint256[] calldata mainIds
    ) external onlyOwner {
        require(!metadataSealed, "METADATA_SEALED");
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
            availableIndices[(idx - 1) / 256] |= uint256(1) << ((idx - 1) % 256);
        }
    }

    /* ===== Redeem entry pouze z TicketHub ===== */
    function redeemFromTicketHub(
        address user,
        uint256 ticketId,
        uint256 ticketPriceSnapshot
    ) external nonReentrant whenNotPaused onlyTicketHub {
        if (address(vrfRouter) == address(0)) revert VRFRouterNotSet();
        if (uint256(biggiMinted) + pendingMintCount >= MAX_SUPPLY) revert AllNFTsMintedErr();
        if (!metadataSealed) revert MetadataNotSealed();
        if (address(compute) == address(0)) revert ComputeNotSet();
        require(user != address(0), "ZERO_MINTER");
        if (pendingMintRequest[user] != 0) revert AlreadyPending();

        uint256 reqId = vrfRouter.requestRandomFor(user, ticketId);
        if (reqId == 0 || assignedIndex[reqId] != 0 || pendingMinters[reqId] != address(0)) revert PendingStateCorrupted();
        hasRequests = true;
        ++pendingMintCount;
        pendingMintRequest[user] = reqId;
        pendingMinters[reqId] = user;
        pendingRequestedAt[reqId] = uint64(block.timestamp);
        pendingTicketId[reqId] = ticketId;
        pendingTicketPrice[reqId] = ticketPriceSnapshot;

        emit VRFRequested(user, reqId, ticketId);
        emit MintRequested(user, reqId);
    }

    // Compatibility selectors now complete an existing draw, never request new randomness.
    function retryPendingMint() external nonReentrant returns (uint256 requestId) {
        requestId = pendingMintRequest[msg.sender];
        _completePendingMint(requestId);
    }

    function ownerRetryPendingMint(address user) external onlyOwner nonReentrant returns (uint256 requestId) {
        requestId = pendingMintRequest[user];
        _completePendingMint(requestId);
    }

    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external nonReentrant {
        if (msg.sender != address(vrfRouter)) revert OnlyVrfRouter();
        if (assignedIndex[requestId] != 0) return;
        _assignPendingMint(requestId, randomWord);
    }

    function completePendingMint(uint256 requestId) external nonReentrant returns (uint256 tokenId) {
        return _completePendingMint(requestId);
    }

    function emergencyResolvePendingMint(address user, uint256 preferredIndex)
        external onlyOwner nonReentrant returns (uint256 tokenId, uint256 resolvedIndex)
    {
        if (preferredIndex != 0) revert PreferredIndexDisabled();
        uint256 requestId = pendingMintRequest[user];
        tokenId = _completePendingMint(requestId);
        resolvedIndex = assignedIndex[requestId];
        emit PendingMintEmergencyResolved(user, requestId, resolvedIndex, tokenId);
    }

    function _completePendingMint(uint256 requestId) internal returns (uint256 tokenId) {
        uint256 idx = assignedIndex[requestId];
        address minter = pendingMinters[requestId];
        // Idempotence lets router replay acknowledge an NFT completed directly by its owner.
        if (minter == address(0)) {
            if (idx != 0 && nftInfo[idx].minted) return BiggiIdIndexLib.tokenIdFromNftIndex(idx);
            revert NoPendingMint();
        }
        if (pendingMintRequest[minter] != requestId) revert PendingStateCorrupted();
        (address consumer, bool ready, uint256 word) =
            IBiggiVRFRecoveryRouter(address(vrfRouter)).getRequestResult(requestId);
        if (consumer != address(this)) revert InvalidRandomnessSource();
        if (!ready) revert RandomnessNotReady();
        if (idx == 0) {
            _assignPendingMint(requestId, word);
            idx = assignedIndex[requestId];
        }
        // Keep this legacy event in the successful NFTMinted transaction for existing UI correlation.
        emit VRFFulfillStarted(requestId, minter, word);
        tokenId = _finalizePendingMint(minter, requestId, idx);
    }

    function _assignPendingMint(uint256 requestId, uint256 randomWord) internal {
        address minter = pendingMinters[requestId];
        if (minter == address(0)) revert NoMinter();
        if (pendingMintRequest[minter] != requestId) revert PendingStateCorrupted();
        uint256 requestedIndex = BiggiIdIndexLib.randomToMintIndex(randomWord, MAX_SUPPLY);
        uint256 idx = _selectMintableIndex(requestedIndex);
        availableIndices[(idx - 1) / 256] &= ~(uint256(1) << ((idx - 1) % 256));
        assignedIndex[requestId] = idx;
        if (idx != requestedIndex) emit PendingMintFallbackSelected(requestId, requestedIndex, idx);
        emit PendingMintAssigned(requestId, minter, idx);
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

    function _finalizePendingMint(address minter, uint256 requestId, uint256 idx) internal returns (uint256 tokenId) {
        if (address(compute) == address(0)) revert ComputeNotSet();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        uint16 blk_ = info.blockIdx;
        uint16 bg_ = info.background;
        uint256 mainId_ = info.mainId;
        if (!_isMetadataValid(blk_, bg_, mainId_)) revert MetadataNotInitialized();

        if (info.minted) revert AlreadySet();
        info.minted = true;
        unchecked { biggiMinted++; }

        tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        _safeMint(minter, tokenId);

        unchecked {
            blockMintCounts[blk_ - 1]++;
            backgroundMintCounts[bg_ - 1]++;
        }

        uint8 incPct = compute.bgIncreasePct(bg_);
        BiggiPriceMathLib.BlockInfo storage biColor = blockInfos[bg_ - 1];
        uint256 curr = biColor.currentPrice;
        uint256 next = curr + (curr * incPct) / 100;
        biColor.currentPrice = next;
        emit BlockPriceBoosted(bg_, curr, next, incPct);

        uint8 bonusPct = compute.bgBonus(bg_);
        uint256 blkPriceNow = blockInfos[blk_ - 1].currentPrice;
        uint256 finalPrice = blkPriceNow + (blkPriceNow * bonusPct) / 100;

        info.ticketPrice = pendingTicketPrice[requestId];
        info.blockPrice  = blkPriceNow;
        info.finalPrice  = finalPrice;

        if (!characterClaimed[blk_] && _blockMinted(blk_) == _totalBlockNFTs(blk_)) {
            characterClaimed[blk_] = true;
            uint256 charId = BiggiIdIndexLib.CHARACTER_OFFSET + (blk_ - 1);
            _safeMint(minter, charId);
        }

        --pendingMintCount;
        delete pendingMintRequest[minter];
        delete pendingMinters[requestId];
        delete pendingRequestedAt[requestId];
        delete pendingTicketId[requestId];
        delete pendingTicketPrice[requestId];

        emit NFTMinted(minter, tokenId, idx);
    }

    // Preserve V1's first-free circular scan, but read at most four bitmap words for all 550 NFTs.
    function _selectMintableIndex(uint256 requestedIndex) internal view returns (uint256) {
        if (requestedIndex < 1 || requestedIndex > MAX_SUPPLY) revert InvalidIndex();
        uint256 wordIndex = (requestedIndex - 1) / 256;
        uint256 bits = availableIndices[wordIndex] & (type(uint256).max << ((requestedIndex - 1) % 256));
        if (bits != 0) return _firstIndex(wordIndex, bits);
        for (uint256 step = 1; step <= 3; ++step) {
            uint256 next = (wordIndex + step) % 3;
            bits = availableIndices[next];
            if (bits != 0) return _firstIndex(next, bits);
        }
        revert NoConfiguredMintableIndex();
    }

    function _firstIndex(uint256 wordIndex, uint256 bits) private pure returns (uint256) {
        uint256 lowestBit = bits & (~bits + 1);
        return wordIndex * 256 + Math.log2(lowestBit) + 1;
    }

    function _isMintableIndex(uint256 idx) internal view returns (bool) {
        if (idx < 1 || idx > MAX_SUPPLY) return false;
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
        return !info.minted && _isMetadataValid(info.blockIdx, info.background, info.mainId);
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

    function _mainIdBelongsToBlock(uint16 blk_, uint256 mainId_) internal pure returns (bool) {
        uint256 minId = _minMainIdForBlock(blk_);
        if (minId == 0) return false;
        return mainId_ >= minId && mainId_ <= _maxMainIdForBlock(blk_);
    }

    function _isMetadataValid(uint16 blk_, uint16 bg_, uint256 mainId_) internal pure returns (bool) {
        uint16 bgCount = _backgroundCountForBlock(blk_);
        if (bgCount == 0) return false;
        return bg_ >= 1 && bg_ <= bgCount && _mainIdBelongsToBlock(blk_, mainId_);
    }

    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        uint256 minMainId = _minMainIdForBlock(blk);
        uint16 seenMask;
        uint256 count;
        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!info.minted || info.blockIdx != blk) continue;
            if (!_mainIdBelongsToBlock(blk, info.mainId)) continue;
            uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
            if (_ownerOf(tokenId) != owner) continue;
            uint16 slot = uint16(info.mainId - minMainId);
            uint16 bit = uint16(1 << slot);
            if ((seenMask & bit) == 0) {
                seenMask |= bit;
                unchecked { ++count; }
                if (count == 10) return true;
            }
        }
        return false;
    }

    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        if (!_mainIdBelongsToBlock(blk, mainId)) return false;
        uint16 expectedCount = _backgroundCountForBlock(blk);
        uint16 seenMask;
        uint256 count;
        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!info.minted || info.blockIdx != blk || info.mainId != mainId) continue;
            if (info.background == 0 || info.background > expectedCount) continue;
            uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
            if (_ownerOf(tokenId) != owner) continue;
            uint16 bit = uint16(1 << (info.background - 1));
            if ((seenMask & bit) == 0) {
                seenMask |= bit;
                unchecked { ++count; }
                if (count == expectedCount) return true;
            }
        }
        return false;
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
