// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiEyesMain – VRF CHAPTER COLLECTION (refactored)
 * =======================================================================================*/

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import "./Library/BiggiPriceMathLib.sol";
import "./Library/BiggiIdIndexLib.sol";
import "./Library/BiggiMetaRedeemLib.sol";
import "./Library/BiggiNamesLib.sol";

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
error ComputeNotSet();
error VRFRouterNotSet();
error MetadataNotInitialized();

contract BiggiEyesMain is ERC721, Ownable, Pausable, ReentrancyGuard {
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

    /* ---- Character rewards ---- */
    mapping(uint16 => bool) public characterClaimed;

    /* ---- VRF pending (pro UI) ---- */
    mapping(address => uint256) public pendingMintRequest; // user => requestId
    mapping(uint256 => address) public pendingMinters;     // requestId => user
    mapping(uint256 => uint64)  public pendingRequestedAt; // requestId => timestamp
    mapping(uint256 => uint256) public pendingTicketId;    // requestId => ticketId
    mapping(uint256 => uint256) public pendingTicketPrice; // requestId => ticketPrice snapshot

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
        if (hub == address(0)) revert TicketHubZero();
        emit TicketHubSet(ticketHub, hub);
        ticketHub = hub;
    }

    /* ======= owner-only settery zachovány pro block pricing ======= */
    event BlockCurrentPriceSet(uint16 indexed blockIdx, uint256 oldPrice, uint256 newPrice);

    function setBlockCurrentPrice(uint16 blockIdx, uint256 _newPrice) external onlyOwner {
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
    function getMintData(uint256 index) external view returns (uint256, uint256, uint256) {
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[index];
        return (info.ticketPrice, info.blockPrice, info.finalPrice);
    }
    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }
    function _vrfViewOrRevert() internal view returns (IBiggiVRFView) {
        if (address(vrfView) == address(0)) revert VRFRouterNotSet();
        return vrfView;
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

    /* ===== Redeem entry pouze z TicketHub ===== */
    function redeemFromTicketHub(
        address user,
        uint256 ticketId,
        uint256 ticketPriceSnapshot
    ) external nonReentrant whenNotPaused onlyTicketHub {
        if (address(vrfRouter) == address(0)) revert VRFRouterNotSet();
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();
        if (pendingMintRequest[user] != 0) revert AlreadyPending();

        uint256 reqId = vrfRouter.requestRandomFor(user, ticketId);
        pendingMintRequest[user] = reqId;
        pendingMinters[reqId] = user;
        pendingRequestedAt[reqId] = uint64(block.timestamp);
        pendingTicketId[reqId] = ticketId;
        pendingTicketPrice[reqId] = ticketPriceSnapshot;

        emit VRFRequested(user, reqId, ticketId);
        emit MintRequested(user, reqId);
    }

    /* ===== VRF callback (volá router) ===== */
    function fulfillRandomFromRouter(uint256 requestId, uint256 randomWord) external {
        require(msg.sender == address(vrfRouter), "ONLY_VRF_ROUTER");
        if (address(compute) == address(0)) revert ComputeNotSet();

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
                if (blk_ == 0 || bg_ == 0) revert MetadataNotInitialized();

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

                nftInfo[idx].ticketPrice = pendingTicketPrice[requestId];
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
                delete pendingTicketId[requestId];
                delete pendingTicketPrice[requestId];

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

    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        bool[11] memory seen;
        uint256 count;
        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!info.minted || info.blockIdx != blk) continue;
            if (info.mainId == 0 || info.mainId > 10) continue;
            uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
            if (_ownerOf(tokenId) != owner) continue;
            uint256 mid = info.mainId;
            if (!seen[mid]) {
                seen[mid] = true;
                unchecked { ++count; }
                if (count == 10) return true;
            }
        }
        return false;
    }

    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        if (mainId == 0 || mainId > 10) return false;
        bool[11] memory seen;
        uint256 count;
        for (uint256 idx = 1; idx <= MAX_SUPPLY; ++idx) {
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            if (!info.minted || info.blockIdx != blk || info.mainId != mainId) continue;
            if (info.background == 0 || info.background > 10) continue;
            uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
            if (_ownerOf(tokenId) != owner) continue;
            uint256 bg = info.background;
            if (!seen[bg]) {
                seen[bg] = true;
                unchecked { ++count; }
                if (count == 10) return true;
            }
        }
        return false;
    }

    receive() external payable { revert NoDirectETH(); }
}
