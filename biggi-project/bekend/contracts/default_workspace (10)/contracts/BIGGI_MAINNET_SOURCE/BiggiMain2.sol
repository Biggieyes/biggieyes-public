// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* =========================================================================================
 * BiggiEyesMain2 — PUBLIC collection (no VRF, no tickets)
 * - Public minting by specifying nft index
 * - Block price is read from Main (price provider) so it follows VRF/main1 updates
 * - Connected to Distributor (60% → distributor, 40% → DEV)
 * - Minimal parity with BiggiEyesMain data structures (nftInfo, block/background counters)
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

/* -------- Rozhraní na moduly -------- */
interface IBiggiDistributor {
    function receiveMintShare() external payable;
}

/* Simple price provider interface (Main contract) */
interface IBiggiPriceProvider {
    function getCurrentBlockPrice(uint16 blockIdx) external view returns (uint256);
}

interface IBiggiReserve {
    function notifyBiggiReceived(uint256 amount) external;
}

/* -------- Custom errors -------- */
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

contract BiggiEyesMain2 is ERC721, Ownable, Pausable, ReentrancyGuard {
    using BiggiPriceMathLib for BiggiPriceMathLib.BlockInfo;
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);
    using SafeERC20 for IERC20;

    /* ---- Konstanty ---- */
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint256 public constant MAX_BATCH   = 55;
    uint256 public constant MAX_SUPPLY  = 550;

    /* ---- Moduly ---- */
    IBiggiDistributor public distributor;

    /* ---- Price provider (pointer to main contract) ---- */
    IBiggiPriceProvider public priceProvider;

    /* ---- Ceny bloků / statistiky (local counts only) ---- */
    uint16[10] public blockMintCounts;
    // keep local blockInfos for metadata compatibility but we DO NOT use currentPrice here for pricing
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;
    uint16[10] public backgroundMintCounts;

    /* ---- Metadata / indexy ---- */
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;

    /* ---- Token counts ---- */
    uint16 public biggiMinted;

    /* ---- URI ---- */
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI; // ponecháno pro kompatibilitu, ale kontrakt už postavy nemintuje

    /* ---- BIGGI token (optional) ---- */
    IERC20 public BIGGI;
    address public tokenSink;
    uint256 public tokenSinkBps = 10_000; // 100%
    uint256 public biggiPerEth  = 1e18;

    /* ---- Reserve adresy / forward ---- */
    address public reserveAddress;

    /* ---- Events ---- */
    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event DistributorSet(address distributor);
    event PriceProviderSet(address provider);
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event ReserveAddressSet(address indexed oldAddr, address indexed newAddr);

    event PublicMint(address indexed minter, uint256 tokenId, uint256 idx);
    event BlockStatsUpdated(uint16 blk, uint16 blockMinted, uint16 bgMinted);
    event BiggiCollected(address indexed from, uint256 amount, uint256 routedToSink, uint256 forwardedToReserve);

    // new event: owner-settable block price
    event BlockPriceUpdated(uint16 indexed blockIdx, uint256 oldPrice, uint256 newPrice);

    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1; // ponecháno pro kompatibilitu importů FE/skriptů
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

    /* ===== Admin ===== */
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

    /* ===== NEW: setter for block current price ===== */
    function setBlockCurrentPrice(uint16 blockIdx, uint256 newPrice) external onlyOwner {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        uint256 old = blockInfos[blockIdx - 1].currentPrice;
        blockInfos[blockIdx - 1].currentPrice = newPrice;
        emit BlockPriceUpdated(blockIdx, old, newPrice);
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
        if (!exists(tokenId)) revert("NoToken");
        if (tokenId >= BiggiIdIndexLib.BIGGI_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            return BiggiMetaRedeemLib.buildNftUri(
                blockBaseURIs[info.blockIdx], info.mainId,
                BiggiNamesLib2.blockName(info.blockIdx), BiggiNamesLib2.backgroundShort(info.background)
            );
        }
        // Pozn.: tento kontrakt už NEmintuje character tokeny, ale fallback URI pro
        // charakterové tokeny je dál k dispozici pro kompatibilitu (pokud někdo externě
        // mintne char tokeny nebo pro budoucí použití).
        if (tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET + 10) {
            string memory charFile = string.concat(
                "Biggi_", Strings.toString(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110),
                "_REWARD.json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        revert("InvalidTokenId");
    }

    function exists(uint256 tokenId) public view returns (bool) { return _ownerOf(tokenId) != address(0); }

    /* ===== View helpery pro FE ===== */
    function blockOf(uint256 tokenId) external view returns (uint16) {
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) return 0;
        if (!exists(tokenId)) return 0;
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return nftInfo[idx].blockIdx;
    }

    /* get price for block from main price provider */
    function getCurrentBlockPrice(uint16 blockIdx) public view returns (uint256) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        if (address(priceProvider) == address(0)) {
            // fallback to local (shouldn't be used in normal flow)
            return blockInfos[blockIdx - 1].currentPrice;
        }
        return priceProvider.getCurrentBlockPrice(blockIdx);
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

    /* ===== Batch metadata (same as Main) ===== */
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

    /* ===== PUBLIC MINT =====
     * - minter specifies nft index (prepopulated via batchSetNFTBackgroundAndBlock)
     * - price is taken from main price provider: getCurrentBlockPrice(blockIdx)
     * - forwards price via split: 60% → distributor, 40% → DEV (using _splitAndForwardAmount)
     * - refunds any overpay
     */
    function mintPublic(uint256 idx) external payable nonReentrant whenNotPaused {
        if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[idx].minted) revert InvalidIndex();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        if (info.background == 0 || info.blockIdx == 0) revert InvalidIndex();

        uint16 blk_ = info.blockIdx;

        // price from main
        uint256 price = getCurrentBlockPrice(blk_);
        if (msg.value < price) revert InsufficientPayment();

        // forward price (explicit amount) and refund overpay
        _splitAndForwardAmount(price);

        uint256 overpay = msg.value - price;
        if (overpay > 0) {
            (bool rf, ) = msg.sender.call{value: overpay}("");
            require(rf, "refund failed");
        }

        // mint flow (similar to main)
        info.minted = true;
        unchecked { biggiMinted++; }

        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        _safeMint(msg.sender, tokenId);

        unchecked {
            blockMintCounts[blk_ - 1]++;
            backgroundMintCounts[info.background - 1]++;
        }

        // ŽÁDNÉ BONUSY - cena je přesně cena bloku
        uint256 blkPriceNow = price;
        uint256 finalPrice = blkPriceNow; // žádné bonusy

        info.ticketPrice = 0; // no ticket in public mint
        info.blockPrice  = blkPriceNow;
        info.finalPrice  = finalPrice;

        // POZOR: mintování character tokenů bylo ZDE ODSTRANĚNO pro tuto kolekci.

        emit PublicMint(msg.sender, tokenId, idx);
        emit BlockStatsUpdated(blk_, blockMintCounts[blk_ - 1], backgroundMintCounts[info.background - 1]);
    }

    /* ===== Collect BIGGI (optional flow: mint with BIGGI) =====
     * Keep parity with main: user can pay with BIGGI token amount (converted from eth-equivalent)
     */
    function mintPublicWithBiggi(uint256 idx) external nonReentrant whenNotPaused {
        if (idx < 1 || idx > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[idx].minted) revert InvalidIndex();
        BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
        if (info.background == 0 || info.blockIdx == 0) revert InvalidIndex();

        uint16 blk_ = info.blockIdx;
        uint256 price = getCurrentBlockPrice(blk_);
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 tokenAmount = _ethToBiggi(price);
        _collectBiggi(msg.sender, tokenAmount);

        // mint
        info.minted = true;
        unchecked { biggiMinted++; }

        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        _safeMint(msg.sender, tokenId);

        unchecked {
            blockMintCounts[blk_ - 1]++;
            backgroundMintCounts[info.background - 1]++;
        }

        // ŽÁDNÉ BONUSY - cena je přesně cena bloku
        uint256 blkPriceNow = price;
        uint256 finalPrice = blkPriceNow; // žádné bonusy

        info.ticketPrice = 0;
        info.blockPrice  = blkPriceNow;
        info.finalPrice  = finalPrice;

        // POZOR: mintování character tokenů bylo ZDE ODSTRANĚNO pro tuto kolekci.

        emit PublicMint(msg.sender, tokenId, idx);
        emit BlockStatsUpdated(blk_, blockMintCounts[blk_ - 1], backgroundMintCounts[info.background - 1]);
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
    function _ethToBiggi(uint256 ethAmount) internal view returns (uint256) {
        return (ethAmount * biggiPerEth) / 1e18;
    }

    /* ===== SBĚR BIGGI + forwarding do Reserve ===== */
    function _collectBiggi(address from, uint256 amount) internal {
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        // 1) stáhnout tokeny od uživatele
        BIGGI.safeTransferFrom(from, address(this), amount);

        // 2) tokenSink (pokud je nastaven)
        uint256 routed = 0;
        if (tokenSink != address(0) && tokenSinkBps > 0) {
            routed = (amount * tokenSinkBps) / 10000;
            if (routed > 0) {
                BIGGI.safeTransfer(tokenSink, routed);
            }
        }

        // 3) zbytek poslat do reserve (pokud je nastavená)
        uint256 toReserve = amount - routed;
        if (toReserve > 0) {
            if (reserveAddress == address(0)) revert InvalidReserve();
            BIGGI.safeTransfer(reserveAddress, toReserve);

            // voláme hook, pokud ho reserve implementuje (nepovinné)
            try IBiggiReserve(reserveAddress).notifyBiggiReceived(toReserve) {
                // ok
            } catch {
                // silent
            }
        }

        emit BiggiCollected(from, amount, routed, toReserve);
    }

    /* === SPLIT: 60% Distributor + 40% DEV (explicit amount) === */
    function _splitAndForwardAmount(uint256 amount) internal {
        require(amount > 0, "zero amount");
        uint256 toDistributor = (amount * 6000) / 10000; // 60%
        if (address(distributor) != address(0) && toDistributor > 0) {
            (bool okD, ) = address(distributor).call{value: toDistributor}(
                abi.encodeWithSelector(IBiggiDistributor.receiveMintShare.selector)
            );
            require(okD, "distributor fwd failed");
        } else {
            // If no distributor configured, send whole amount to DEV_WALLET
            (bool sDev, ) = DEV_WALLET.call{value: amount}("");
            require(sDev, "dev send failed");
            return;
        }
        uint256 devPart = amount - toDistributor;
        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    /* ===== View helpers ===== */
    function getBackgroundMintCount(uint16 bg) external view returns (uint16) {
        if (bg < 1 || bg > 10) revert InvalidBg();
        return backgroundMintCounts[bg - 1];
    }

    /* ===== Emergency / Rescue ===== */
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native rescue failed");
    }

    /* ===== Receive ===== */
    receive() external payable { revert NoDirectETH(); }
}
