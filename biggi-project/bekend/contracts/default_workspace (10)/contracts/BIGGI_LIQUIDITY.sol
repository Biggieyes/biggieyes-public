// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiEyesLottery – on-chain NFT loterie s VRF a dynamickým cenovým modelem
/// @notice Přidána možnost platby BIGGI tokenem (ERC20). Konverze přes konfigurovatelný kurz.

import { VRFConsumerBaseV2Plus } from "contracts/chainlink/VRFConsumerBaseV2Plus.sol";
import { VRFCoordinatorV2PlusInterface } from "contracts/chainlink/VRFCoordinatorV2PlusInterface.sol";
import { VRFV2PlusClient } from "contracts/chainlink/VRFV2PlusClient.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiPriceMathLib.sol";
import "./BiggiIdIndexLib.sol";
import "./BiggiMetaRedeemLib.sol";
import "./BiggiRewards.sol";
import "./BiggiNamesLib.sol";

// -------- Custom errors --------
error OwnerZero();
error AllTicketsMinted();
error AllNFTsMintedErr();
error MaxPresaleReached();
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
error NotDone();
error NotEnoughBalance();
error AlreadyClaimed();
error NoDirectETH();

// NEW token-related errors
error BiggiTokenNotSet();
error TokenSinkBpsTooHigh();

contract BiggiEyesLottery is
    ERC721,
    Ownable,
    Pausable,
    VRFConsumerBaseV2Plus,
    ReentrancyGuard
{
    using BiggiPriceMathLib for BiggiPriceMathLib.BlockInfo;
    using BiggiRewards for BiggiRewards.RewardsState;
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);
    using SafeERC20 for IERC20;

    // -------- Konst / stav --------
    address public immutable VRF_COORDINATOR;
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;

    uint256 public constant MAX_BATCH = 55;
    uint256 public constant MAX_TICKETS = 550;
    uint256 public constant MAX_SUPPLY = 550;

    // VRF
    bytes32 public keyHash;
    uint256 public s_subscriptionId;
    uint32 public callbackGasLimit = 300_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    // Počty
    uint16 public ticketMinted;
    uint16 public biggiMinted;

    mapping(address => uint256) public ticketCount;
    mapping(uint256 => bool) public isTicket;

    // Ticket ceny (ETH)
    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033; // +0.33% (1.0033 * 1e4)

    // Cenový model bloků (ETH)
    uint256[10] public blockBasePrices = [
        100 ether, 200 ether, 300 ether, 400 ether, 500 ether,
        600 ether, 700 ether, 800 ether, 900 ether, 1000 ether
    ];
    uint256[10] public blockPriceIncrease = [
        10500, 10200, 10200, 10300, 10300,
        10400, 10400, 10500, 10500, 11000
    ];
    uint8[10] public backgroundBonuses = [5,10,15,20,25,30,35,40,45,50];
    uint16[10] public blockMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;

    // NOVÉ: procenta zdražení bloku dle barvy pozadí (5–10 %)
    uint8[10] public blockBgIncreasePct = [5,2,2,3,3,4,4,5,5,10];

    // Metadata / indexy
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;
    mapping(uint256 => address) public pendingMinters;
    mapping(address => uint256) public pendingMintRequest;

    // VRF pending timestamp
    mapping(uint256 => uint64) public pendingRequestedAt; // requestId => timestamp

    // URI
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;

    // Rewards (ETH)
    uint256 public rewardsPool;
    uint256 public rewardPercent = 2200; // 22%
    uint256 public orangeReward = 0.005 ether;
    uint256 public blockReward  = 0.01 ether;
    uint256 public rainbowReward = 0.02 ether;

    uint8 public orangeWinnersCount;
    uint8 public blockWinnersCount;
    bool public rainbowRewardClaimedGlobal;

    mapping(uint16 => bool) public characterClaimed;
    BiggiRewards.RewardsState private rewardsState;
    mapping(uint256 => bool) public orangeMainIdPaid;
    mapping(uint16 => bool) public blockPaid;
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock;

    // ---- Likvidita (ETH) ----
    address payable public liquiditySink;   // adresa kontraktu BiggiRewardsAndLiquidity
    uint256 public liquidityBps = 500;      // např. 5% = 500 bps

    // ---- BIGGI Token Payment (NEW) ----
    IERC20  public BIGGI;                   // adresa BIGGI ERC20
    address public tokenSink;               // kam routovat přijaté BIGGI (typicky BiggiRewardsAndLiquidity)
    uint256 public tokenSinkBps = 10_000;   // default 100% do tokenSink (bps)
    uint256 public biggiPerEth = 1e18;      // konverzní kurz: kolik BIGGI za 1 ETH (18 dec)

    // -------- Události --------
    event MintRequested(address indexed user, uint256 requestIdOrTicketId);
    event TicketRedeemed(address indexed user, uint256 ticketId);
    event VRFRequested(address indexed user, uint256 requestId, uint256 ticketId);
    event VRFFulfillStarted(uint256 requestId, address minter, uint256 randomWord);
    event NFTMinted(address indexed minter, uint256 tokenId, uint256 nftIndex);

    event CharacterRewardMinted(address indexed user, uint256 characterTokenId, string characterName, uint16 blockIdx);
    event OrangeRewardClaimed(address indexed user, uint256 amount);
    event BlockRewardClaimed(address indexed user, uint256 amount);
    event RainbowRewardClaimed(address indexed user, uint256 amount);

    event RestWithdrawn(address indexed owner, uint256 amount);
    event PendingMintRescued(address indexed user, uint256 requestId);

    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event RewardsConfigUpdated(uint256 percent, uint256 orange, uint256 blockAmt, uint256 rainbow);
    event VRFConfigUpdated(uint32 callbackGasLimit, bytes32 keyHash);

    event LiquiditySinkUpdated(address sink, uint256 bps);

    // NEW token events
    event BiggiTokenSet(address token);
    event BiggiRateUpdated(uint256 biggiPerEth);
    event TokenSinkUpdated(address sink, uint256 bps);
    event TokenPaymentRouted(address indexed from, address indexed to, uint256 amount, uint256 kept);

    // Kategorie pro setURI
    uint8 private constant URI_REWARDS    = 0;
    uint8 private constant URI_CHARACTERS = 1;
    uint8 private constant URI_TICKET     = 2;
    uint8 private constant URI_BLOCK      = 3;

    // -------- Konstruktor --------
    constructor(
        uint256 subscriptionId,
        address vrfCoordinator_,
        address initialOwner,
        bytes32 keyHash_
    )
        ERC721("BiggiEyes", "BIGGI")
        Ownable(initialOwner)
        VRFConsumerBaseV2Plus(vrfCoordinator_)
    {
        if (initialOwner == address(0)) revert OwnerZero();
        s_subscriptionId = subscriptionId;
        VRF_COORDINATOR = vrfCoordinator_;
        keyHash = keyHash_;

        BiggiPriceMathLib.initializeBlocks(blockInfos, blockBasePrices, blockPriceIncrease);
    }

    // -------- Pauza --------
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // -------- Sjednocené settery --------
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

    function setVRFConfig(uint32 newCallbackGasLimit, bytes32 newKeyHash) external onlyOwner {
        callbackGasLimit = newCallbackGasLimit;
        keyHash = newKeyHash;
        emit VRFConfigUpdated(newCallbackGasLimit, newKeyHash);
    }

    function setRewardsConfig(uint256 percent, uint256 orange, uint256 blockAmt, uint256 rainbow) external onlyOwner {
        rewardPercent = percent;
        orangeReward = orange;
        blockReward  = blockAmt;
        rainbowReward = rainbow;
        emit RewardsConfigUpdated(percent, orange, blockAmt, rainbow);
    }

    /// @notice Nastaví cílový kontrakt na likviditu + podíl v BPS (ETH tok)
    function setLiquiditySink(address payable sink, uint256 bps) external onlyOwner {
        liquiditySink = sink;
        if (bps > 10000) revert InvalidIndex();
        liquidityBps = bps;
        emit LiquiditySinkUpdated(sink, bps);

        // pokud není nastaven tokenSink, zrcadli
        if (tokenSink == address(0)) {
            tokenSink = sink;
            emit TokenSinkUpdated(sink, tokenSinkBps);
        }
    }

    /// @notice Nastaví ERC20 BIGGI token (pro platby)
    function setBiggiToken(address token) external onlyOwner {
        BIGGI = IERC20(token);
        if (token == address(0)) revert BiggiTokenNotSet();
        emit BiggiTokenSet(token);
    }

    /// @notice Nastaví konverzní kurz BIGGI/ETH (18 dec) – kolik BIGGI odpovídá 1 ETH.
    function setBiggiRate(uint256 _biggiPerEth) external onlyOwner {
        biggiPerEth = _biggiPerEth;
        emit BiggiRateUpdated(_biggiPerEth);
    }

    /// @notice Nastavení tokenSink cíle a BPS (kolik % přijatých BIGGI posílat dál)
    function setTokenSink(address sink, uint256 bps) external onlyOwner {
        if (bps > 10000) revert TokenSinkBpsTooHigh();
        tokenSink = sink;
        tokenSinkBps = bps;
        emit TokenSinkUpdated(sink, bps);
    }

    // -------- tokenURI / existence --------
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!exists(tokenId)) revert NoToken();

        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) {
            return BiggiMetaRedeemLib.buildTicketUri(ticketBaseURI);
        }
        if (tokenId >= BiggiIdIndexLib.REWARDS_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            string memory rewardFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIdIndexLib.REWARDS_OFFSET + 101),
                "_REWARDS_RB.json"
            );
            return string.concat(rewardsBaseURI, rewardFile);
        }
        if (tokenId >= BiggiIdIndexLib.CHARACTER_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET + 10) {
            uint16 blk = uint16(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 1);
            string memory charFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110),
                "_REWARD_",
                BiggiNamesLib.characterName(blk),
                ".json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        if (tokenId >= BiggiIdIndexLib.BIGGI_OFFSET && tokenId < BiggiIdIndexLib.CHARACTER_OFFSET) {
            uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            return BiggiMetaRedeemLib.buildNftUri(
                blockBaseURIs[info.blockIdx],
                info.mainId,
                BiggiNamesLib.blockName(info.blockIdx),
                BiggiNamesLib.backgroundShort(info.background)
            );
        }
        revert InvalidTokenId();
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// @notice EXTERNÍ helper pro rewards kontrakt – vrátí blockIdx (1..10), u ticketu/nezaloženého vrací 0
    function blockOf(uint256 tokenId) external view returns (uint16) {
        if (tokenId < BiggiIdIndexLib.BIGGI_OFFSET) return 0;       // ticket
        if (!exists(tokenId)) return 0;                              // neexistuje
        uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
        return nftInfo[idx].blockIdx;                                // 1..10
    }

    // ======================= PUBLIC MINT – ETH =======================

    function mintTicket() external payable nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ticketCount[msg.sender] >= 10) revert MaxPerWallet();
        if (msg.value < ticketPrice) revert InsufficientPayment();

        _splitAndAccrue(msg.value); // rozdělení ETH

        _mintTicket(msg.sender);
        emit MintRequested(msg.sender, BiggiIdIndexLib.TICKET_OFFSET + (ticketMinted - 1));
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
    }

    // ======================= PUBLIC MINT – BIGGI TOKEN (NEW) =======================

    /// @notice Zaplatí ticket BIGGI tokenem (nutný allowance na tento kontrakt)
    function mintTicketWithBiggi() external nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ticketCount[msg.sender] >= 10) revert MaxPerWallet();
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();

        uint256 tokenAmount = _ethToBiggi(ticketPrice);
        _collectBiggi(msg.sender, tokenAmount);

        _mintTicket(msg.sender);
        emit MintRequested(msg.sender, BiggiIdIndexLib.TICKET_OFFSET + (ticketMinted - 1));
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
    }

    // -------- Redeem + VRF mint --------
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

        uint256 requestId = VRFCoordinatorV2PlusInterface(VRF_COORDINATOR).requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({ nativePayment: true })
                )
            })
        );

        emit VRFRequested(msg.sender, requestId, ticketId);

        BiggiMetaRedeemLib.setPendingRequest(pendingMintRequest, pendingMinters, msg.sender, requestId);
        pendingRequestedAt[requestId] = uint64(block.timestamp);
        emit MintRequested(msg.sender, requestId);
    }

    function adminRescuePendingMint(address user) external onlyOwner {
        uint256 requestId = pendingMintRequest[user];
        if (requestId == 0) revert InvalidIndex();
        delete pendingRequestedAt[requestId];
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
        emit PendingMintRescued(user, requestId);
    }

    function adminRescuePendingMintIfExpired(address user, uint64 minAge) external onlyOwner {
        uint256 requestId = pendingMintRequest[user];
        if (requestId == 0) revert InvalidIndex();
        uint64 started = pendingRequestedAt[requestId];
        if (started == 0) revert InvalidIndex();
        if (uint64(block.timestamp) - started < minAge) revert InvalidIndex();
        delete pendingRequestedAt[requestId];
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
        emit PendingMintRescued(user, requestId);
    }

    // -------- VRF callback --------
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address minter = pendingMinters[requestId];
        if (minter == address(0)) revert NoMinter();

        emit VRFFulfillStarted(requestId, minter, randomWords[0]);

        uint256 index = BiggiIdIndexLib.randomToMintIndex(randomWords[0], MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; ++i) {
            if (!nftInfo[index].minted) {
                nftInfo[index].minted = true;
                unchecked { biggiMinted++; }
                uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(index);
                _safeMint(minter, tokenId);

                uint16 blk = nftInfo[index].blockIdx;
                uint16 bg  = nftInfo[index].background;

                blockMintCounts[blk - 1]++;

                // --- NOVÁ LOGIKA CEN ---
                BiggiPriceMathLib.BlockInfo storage bi = blockInfos[blk - 1];
                uint256 priorBlockPrice = bi.currentPrice;

                // trvalé zdražení bloku dle barvy pozadí (5–10 %)
                uint8 incPct = blockBgIncreasePct[bg - 1];
                uint256 newBlockPrice = priorBlockPrice + ((priorBlockPrice * incPct) / 100);

                // jednorázový bonus do finalPrice (5–50 %) dle pozadí
                uint8 oneOffPct = backgroundBonuses[bg - 1];
                uint256 finalPrice = priorBlockPrice + ((priorBlockPrice * oneOffPct) / 100);

                // uložit transparentní ceny k NFT
                nftInfo[index].ticketPrice = ticketPrice;
                nftInfo[index].blockPrice  = priorBlockPrice; // cena bloku před jednorázovým bonusem
                nftInfo[index].finalPrice  = finalPrice;

                // persist nová cena bloku pro další minty
                bi.currentPrice = newBlockPrice;
                // --- KONEC NOVÉ LOGIKY ---

                if (!characterClaimed[blk] && _blockMinted(blk) == _totalBlockNFTs(blk)) {
                    characterClaimed[blk] = true;
                    uint256 charId = BiggiIdIndexLib.CHARACTER_OFFSET + (blk - 1);
                    _safeMint(minter, charId);
                    emit CharacterRewardMinted(minter, charId, BiggiNamesLib.characterName(blk), blk);
                }

                // --- INLINE CLEAR (řešení 'stack too deep') ---
                delete pendingMintRequest[minter];
                delete pendingMinters[requestId];
                delete pendingRequestedAt[requestId];
                // --- konec inline clear ---

                emit NFTMinted(minter, tokenId, index);
                return;
            }
            index = (index % MAX_SUPPLY) + 1;
        }
        revert SoldOut();
    }

    // -------- Helpers --------
    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }

    function findTicket(address owner) external view returns (uint256[] memory) {
        uint256[] memory tickets = new uint256[](MAX_TICKETS);
        uint256 found;
        uint256 start = BiggiIdIndexLib.TICKET_OFFSET;
        uint256 end   = BiggiIdIndexLib.TICKET_OFFSET + MAX_TICKETS - 1;
        for (uint256 tokenId = start; tokenId <= end; tokenId++) {
            if (exists(tokenId) && _ownerOf(tokenId) == owner && isTicket[tokenId]) {
                tickets[found] = tokenId;
                found++;
            }
        }
        uint256[] memory res = new uint256[](found);
        for (uint256 j = 0; j < found; j++) res[j] = tickets[j];
        return res;
    }

    function _ownsByNftIndex(address owner, uint256 idx) internal view returns (bool) {
        if (idx < 1 || idx > MAX_SUPPLY) return false;
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
        if (!info.minted) return false;
        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        if (!exists(tokenId)) return false;
        return _ownerOf(tokenId) == owner;
    }

    function _hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) internal view returns (bool) {
        if (blk < 1 || blk > 10) return false;
        bool[11] memory hasBg;
        uint256 found;
        for (uint256 i = 1; i <= MAX_SUPPLY; ++i) {
            BiggiIdIndexLib.NFTInfo memory inf = nftInfo[i];
            if (inf.minted && inf.blockIdx == blk && inf.mainId == mainId) {
                uint16 bg = inf.background;
                if (bg >= 1 && bg <= 10 && !hasBg[bg]) {
                    if (_ownsByNftIndex(owner, i)) {
                        hasBg[bg] = true;
                        found++;
                        if (found == 10) return true;
                    }
                }
            }
        }
        return false;
    }

    function _hasAllTenMainIdsInBlock(address owner, uint16 blk) internal view returns (bool) {
        if (blk < 1 || blk > 10) return false;
        bool[11] memory hasMain;
        uint256 found;
        for (uint256 i = 1; i <= MAX_SUPPLY; ++i) {
            BiggiIdIndexLib.NFTInfo memory inf = nftInfo[i];
            if (inf.minted && inf.blockIdx == blk) {
                uint256 mid = inf.mainId;
                if (mid >= 1 && mid <= 10 && !hasMain[mid]) {
                    if (_ownsByNftIndex(owner, i)) {
                        hasMain[mid] = true;
                        found++;
                        if (found == 10) return true;
                    }
                }
            }
        }
        return false;
    }

    // -------- Claimy (ETH) --------
    function claimOrangeReward(uint256 mainId) external nonReentrant {
        if (orangeReward == 0) revert InsufficientPayment(); // reuse
        if (orangeWinnersCount >= 3) revert MaxPresaleReached(); // reuse
        if (mainId < 1 || mainId > 10) revert InvalidIndex();

        uint16 ORANGE_BLK = 1;

        if (rewardsState.hasClaimedOrange(msg.sender)) revert AlreadyClaimed();
        if (orangeMainIdPaid[mainId]) revert AlreadyClaimed();
        if (!_hasAllBackgroundsForMainIdInBlock(msg.sender, ORANGE_BLK, mainId)) revert InvalidIndex();

        if (rewardsPool < orangeReward) revert NotEnoughBalance();
        rewardsPool -= orangeReward;

        rewardsState.claimOrange(msg.sender);
        orangeMainIdPaid[mainId] = true;
        unchecked { orangeWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        if (!sent) revert DevPaymentFailed();

        emit OrangeRewardClaimed(msg.sender, orangeReward);
    }

    function claimBlockReward(uint16 blockIdx) external nonReentrant {
        if (blockReward == 0) revert InsufficientPayment();
        if (blockWinnersCount >= 3) revert MaxPresaleReached();
        if (blockIdx < 1 || blockIdx > 9) revert InvalidBlock();
        if (blockPaid[blockIdx]) revert AlreadyClaimed();
        if (userClaimedBlock[msg.sender][blockIdx]) revert AlreadyClaimed();

        if (!_hasAllTenMainIdsInBlock(msg.sender, blockIdx)) revert InvalidIndex();

        if (rewardsPool < blockReward) revert NotEnoughBalance();
        rewardsPool -= blockReward;

        blockPaid[blockIdx] = true;
        userClaimedBlock[msg.sender][blockIdx] = true;
        unchecked { blockWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: blockReward}("");
        if (!sent) revert DevPaymentFailed();

        emit BlockRewardClaimed(msg.sender, blockReward);
    }

    function claimRainbowReward() external nonReentrant {
        if (rainbowReward == 0) revert InsufficientPayment();
        if (rainbowRewardClaimedGlobal) revert AlreadyClaimed();
        if (rewardsState.hasClaimedRainbow(msg.sender)) revert AlreadyClaimed();

        uint16 RAINBOW_BLK = 10;
        if (!_hasAllTenMainIdsInBlock(msg.sender, RAINBOW_BLK)) revert InvalidIndex();

        if (rewardsPool < rainbowReward) revert NotEnoughBalance();
        rewardsPool -= rainbowReward;

        rewardsState.claimRainbow(msg.sender);
        rainbowRewardClaimedGlobal = true;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        if (!sent) revert DevPaymentFailed();

        emit RainbowRewardClaimed(msg.sender, rainbowReward);
    }

    // -------- Interní pomůcky --------
    function _totalBlockNFTs(uint16 blk) internal pure returns (uint256) {
        if (blk < 1 || blk > 10) return 0;
        return 110 - 10 * blk;
    }

    function _blockMinted(uint16 blk) internal view returns (uint256) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        return blockMintCounts[blk - 1];
    }

    // -------- Interní: pay-split + mint ticket helpery (ETH) --------
    function _splitAndAccrue(uint256 amount) internal {
        uint256 rewardPart = (amount * rewardPercent) / 10000;
        rewardsPool += rewardPart;

        uint256 liqPart = 0;
        if (liquiditySink != address(0) && liquidityBps > 0) {
            liqPart = (amount * liquidityBps) / 10000;
            Address.sendValue(liquiditySink, liqPart); // pošleme do liquidity kontraktu (hromadí si ETH)
        }

        uint256 devPart = amount - rewardPart - liqPart;
        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    function _mintTicket(address to) internal returns (uint256 ticketId) {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();

        ticketId = BiggiIdIndexLib.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;

        unchecked { ticketMinted++; }

        ticketCount[to]++;
        _safeMint(to, ticketId);

        emit MintRequested(to, ticketId);
    }

    // -------- Interní: BIGGI tok (NEW) --------
    function _ethToBiggi(uint256 ethAmount) internal view returns (uint256) {
        // konverze přes kurz (18 dec): tokens = ethAmount * biggiPerEth / 1e18
        return (ethAmount * biggiPerEth) / 1e18;
    }

    /// @dev vybere BIGGI od uživatele, pošle část do tokenSink dle BPS, zbytek ponechá v kontraktu
    function _collectBiggi(address from, uint256 amount) internal {
        if (address(BIGGI) == address(0)) revert BiggiTokenNotSet();
        BIGGI.safeTransferFrom(from, address(this), amount);

        uint256 routed = 0;
        if (tokenSink != address(0) && tokenSinkBps > 0) {
            routed = (amount * tokenSinkBps) / 10000;
            if (routed > 0) {
                BIGGI.safeTransfer(tokenSink, routed);
            }
        }
        emit TokenPaymentRouted(from, tokenSink, routed, amount - routed);
    }

    // -------- Withdraw zbytku --------
    function withdrawRest() external onlyOwner nonReentrant {
        if (biggiMinted != MAX_SUPPLY) revert NotDone();

        uint256 reserved = (orangeReward * (3 - orangeWinnersCount))
            + (blockReward * (3 - blockWinnersCount))
            + (rainbowRewardClaimedGlobal ? 0 : rainbowReward);
        uint256 bal = address(this).balance;
        if (bal <= reserved) revert NotEnoughBalance();

        uint256 toSend = bal - reserved;
        Address.sendValue(payable(msg.sender), toSend);
        emit RestWithdrawn(msg.sender, toSend);
    }

    // -------- Gettery --------
    function getCurrentBlockPrice(uint16 blockIdx) public view returns (uint256) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        return blockInfos[blockIdx - 1].currentPrice;
    }

    function getBlockMintCount(uint16 blockIdx) public view returns (uint16) {
        if (blockIdx < 1 || blockIdx > 10) revert InvalidBlock();
        return blockMintCounts[blockIdx - 1];
    }

    function getTicketPrice() public view returns (uint256) {
        return ticketPrice;
    }

    /// @notice Pomocné gettery pro frontend – BIGGI ceny
    function getTicketPriceInBiggi() external view returns (uint256) {
        return _ethToBiggi(ticketPrice);
    }

    function getBlockPriceInBiggi(uint16 blockIdx) external view returns (uint256) {
        return _ethToBiggi(getCurrentBlockPrice(blockIdx));
    }

    function getMintData(uint256 index) public view returns (
        uint256 ticketPrice_,
               uint256 blockPrice_,
        uint256 finalPrice_
    ) {
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[index];
        return (info.ticketPrice, info.blockPrice, info.finalPrice);
    }

    // -------- Fallback/receive --------
    receive() external payable {
        revert NoDirectETH();
    }
}
