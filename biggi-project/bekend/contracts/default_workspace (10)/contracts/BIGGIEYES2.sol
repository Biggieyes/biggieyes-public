// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiEyesLottery – on-chain NFT loterie s VRF a dynamickým cenovým modelem
/// @dev Odlehčeno na bytecode: bez ERC721Enumerable, názvy přes externí knihovnu, bez dlouhých URI v konstruktoru.

import { VRFConsumerBaseV2Plus } from "contracts/chainlink/VRFConsumerBaseV2Plus.sol";
import { VRFCoordinatorV2PlusInterface } from "contracts/chainlink/VRFCoordinatorV2PlusInterface.sol";
import { VRFV2PlusClient } from "contracts/chainlink/VRFV2PlusClient.sol";

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import "./BiggiPriceMathLib.sol";
import "./BiggiIdIndexLib.sol";
import "./BiggiMetaRedeemLib.sol";
import "./BiggiRewards.sol";
import "./BiggiNamesLib.sol";

// -------- Custom errors --------
error OwnerZero();
error AllTicketsMinted();
error AllNFTsMintedErr();
error PresaleContractOnly();
error PresaleNotActive();
error NotWhitelisted();
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

    // -------- Konst / stav --------
    address public immutable VRF_COORDINATOR;
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;

    uint256 public constant MAX_BATCH = 55;
    uint256 public constant MAX_TICKETS = 550;
    uint256 public constant MAX_SUPPLY = 550;
    uint256 public constant MAX_PRESALE_TICKETS = 50; // 20 owner + 30 veřejnost

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

    // Ticket ceny (public + růst)
    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033; // +0.33% (1.0033 * 1e4)

    // Presale
    uint256 public presalePrice = 0.0005 ether; // fixní (bez setteru)
    uint256 public presaleMinted;
    bool public presaleActive;
    mapping(address => bool) public presaleWhitelist;
    mapping(address => uint256) public presalePurchases;
    address public presaleContract;

    // Cenový model bloků
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

    // Metadata / indexy
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;
    mapping(uint256 => address) public pendingMinters;
    mapping(address => uint256) public pendingMintRequest;

    // VRF pending timestamp (timeout rescue)
    mapping(uint256 => uint64) public pendingRequestedAt; // requestId => timestamp

    // URI (nastaví se po deployi přes setURI)
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;

    // Rewards
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
    mapping(uint256 => bool) public orangeMainIdPaid;      // mainId -> paid?
    mapping(uint16 => bool) public blockPaid;              // blockIdx -> paid?
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock; // kdo claimnul který block

    // -------- Události --------
    event PresaleTicketMinted(address indexed buyer, uint256 indexed ticketId);
    event PresaleStatusChanged(bool active);
    event PresaleWhitelistUpdated(address[] users);
    event PresaleContractSet(address presaleContract);

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
    event PendingMintRescued(address indexed user, uint256 indexed requestId);

    // Konfigurační eventy
    event URIUpdated(uint8 category, uint16 indexed idx, string uri);
    event RewardsConfigUpdated(uint256 percent, uint256 orange, uint256 blockAmt, uint256 rainbow);
    event VRFConfigUpdated(uint32 callbackGasLimit, bytes32 keyHash);

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

        // Init cenových bloků (URI nenastavujeme – nastavíš po deployi přes setURI)
        BiggiPriceMathLib.initializeBlocks(blockInfos, blockBasePrices, blockPriceIncrease);
    }

    // -------- Presale --------
    function setPresaleContract(address _presaleContract) external onlyOwner {
        presaleContract = _presaleContract;
        emit PresaleContractSet(_presaleContract);
    }

    function togglePresale(bool _active) external onlyOwner {
        presaleActive = _active;
        emit PresaleStatusChanged(_active);
    }

    function addToPresaleWhitelist(address[] calldata users) external onlyOwner {
        if (users.length > 200) revert InvalidIndex();
        for (uint256 i = 0; i < users.length; i++) {
            presaleWhitelist[users[i]] = true;
        }
        emit PresaleWhitelistUpdated(users);
    }

    /// @notice Presale mint skutečného ticketu volaný presale kontraktem (payable → split do poolu + DEV)
    function mintPresaleTicket(address to) external payable returns (uint256) {
        if (msg.sender != presaleContract) revert PresaleContractOnly();
        if (presaleMinted >= MAX_PRESALE_TICKETS) revert MaxPresaleReached();
        if (msg.value < presalePrice) revert InsufficientPayment();

        _splitAndAccrue(msg.value);
        return _mintTicket(to, true, true);
    }

    function buyPresaleTicket() external payable nonReentrant {
        if (!presaleActive) revert PresaleNotActive();
        if (!presaleWhitelist[msg.sender]) revert NotWhitelisted();
        if (presaleMinted >= MAX_PRESALE_TICKETS) revert MaxPresaleReached();
        if (msg.value < presalePrice) revert InsufficientPayment();
        if (presalePurchases[msg.sender] >= 3) revert MaxPerWallet();

        _splitAndAccrue(msg.value);
        presalePurchases[msg.sender]++;

        _mintTicket(msg.sender, true, true);
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

    // -------- Public ticket mint --------
    function mintTicket() external payable nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();
        if (ticketCount[msg.sender] >= 10) revert MaxPerWallet();
        if (msg.value < ticketPrice) revert InsufficientPayment();

        _splitAndAccrue(msg.value);

        _mintTicket(msg.sender, false, false);
        emit MintRequested(msg.sender, BiggiIdIndexLib.TICKET_OFFSET + (ticketMinted - 1));
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
    }

    // -------- TESTOVACÍ PUBLIC MINT (obejde ticket/VRF) --------
    function publicMint(uint256 index) external payable nonReentrant whenNotPaused {
        if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMintedErr();
        if (index < 1 || index > MAX_SUPPLY) revert InvalidIndex();
        if (nftInfo[index].minted) revert AlreadyClaimed();

        BiggiIdIndexLib.NFTInfo storage info = nftInfo[index];
        if (info.background < 1 || info.background > 10) revert InvalidBg();
        if (info.blockIdx   < 1 || info.blockIdx   > 10) revert InvalidBlock();
        if (info.mainId == 0) revert InvalidIndex();

        uint256 requiredPrice = blockInfos[info.blockIdx - 1].currentPrice;
        if (msg.value < requiredPrice) revert InsufficientPayment();

        info.minted = true;
        unchecked { biggiMinted++; }

        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(index);
        _safeMint(msg.sender, tokenId);

        // Ekonomika
        blockMintCounts[info.blockIdx - 1]++;
        blockInfos[info.background - 1].updatePrice();

        uint256 currentBlockPrice = blockInfos[info.blockIdx - 1].currentPrice;
        info.ticketPrice = ticketPrice;
        info.blockPrice  = currentBlockPrice;
        uint8 bonus = backgroundBonuses[info.background - 1];
        info.finalPrice = currentBlockPrice + ((currentBlockPrice * bonus) / 100);

        emit NFTMinted(msg.sender, tokenId, index);
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
                blockInfos[bg - 1].updatePrice();

                uint256 currentBlockPrice = blockInfos[blk - 1].currentPrice;

                nftInfo[index].ticketPrice = ticketPrice;
                nftInfo[index].blockPrice  = currentBlockPrice;

                uint8 bonus = backgroundBonuses[bg - 1];
                nftInfo[index].finalPrice = currentBlockPrice + ((currentBlockPrice * bonus) / 100);

                if (!characterClaimed[blk] && _blockMinted(blk) == _totalBlockNFTs(blk)) {
                    characterClaimed[blk] = true;
                    uint256 charId = BiggiIdIndexLib.CHARACTER_OFFSET + (blk - 1);
                    _safeMint(minter, charId);
                    emit CharacterRewardMinted(minter, charId, BiggiNamesLib.characterName(blk), blk);
                }
                BiggiMetaRedeemLib.clearPendingRequest(pendingMintRequest, pendingMinters, minter, requestId);
                delete pendingRequestedAt[requestId];
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

    // -------- Claimy --------
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
        return 110 - 10 * blk; // (1→100, 2→90, …, 10→10)
    }

    function _blockMinted(uint16 blk) internal view returns (uint256) {
        if (blk < 1 || blk > 10) revert InvalidBlock();
        return blockMintCounts[blk - 1];
    }

    // -------- Batch metadata --------
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
            info.blockIdx = blockIndices[i];
            info.mainId = mainIds[i];
        }
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

    function getMintData(uint256 index) public view returns (
        uint256 ticketPrice_,
        uint256 blockPrice_,
        uint256 finalPrice_
    ) {
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[index];
        return (info.ticketPrice, info.blockPrice, info.finalPrice);
    }

    // -------- Interní: pay-split + mint ticket helpery --------
    function _splitAndAccrue(uint256 amount) internal {
        uint256 rewardPart = (amount * rewardPercent) / 10000;
        rewardsPool += rewardPart;
        (bool sent, ) = DEV_WALLET.call{value: amount - rewardPart}("");
        if (!sent) revert DevPaymentFailed();
    }

    function _mintTicket(address to, bool isPresale, bool emitPresaleEvent) internal returns (uint256 ticketId) {
        if (ticketMinted >= MAX_TICKETS) revert AllTicketsMinted();

        ticketId = BiggiIdIndexLib.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;

        unchecked { ticketMinted++; }

        if (isPresale) {
            if (presaleMinted >= MAX_PRESALE_TICKETS) revert MaxPresaleReached();
            unchecked { presaleMinted++; }
        }

        ticketCount[to]++;
        _safeMint(to, ticketId);

        if (emitPresaleEvent) emit PresaleTicketMinted(to, ticketId);
        emit MintRequested(to, ticketId);
    }

    receive() external payable {
        revert NoDirectETH();
    }
}
