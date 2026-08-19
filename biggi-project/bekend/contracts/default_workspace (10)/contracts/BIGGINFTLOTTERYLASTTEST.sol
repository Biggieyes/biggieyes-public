// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiEyesLottery – plně on-chain NFT loterie s VRF a dynamickým cenovým modelem
/// @notice Kontrakt mintuje vstupenky, redeemuje je přes Chainlink VRF na NFT,
///         sleduje dynamické ceny bloků, vede fond odměn a umožňuje 3 typy claimů.
/// @dev Obsahuje proaktivní opravy:
///      1) indexace dynamických cen je dle BLOKU (ne dle backgroundu)
///      2) findTicket() prohledává skutečný rozsah ticket tokenId (TICKET_OFFSET..+MAX_TICKETS-1)


// --- Chainlink ---
import { VRFConsumerBaseV2Plus } from "contracts/chainlink/VRFConsumerBaseV2Plus.sol";
import { VRFCoordinatorV2PlusInterface } from "contracts/chainlink/VRFCoordinatorV2PlusInterface.sol";
import { VRFV2PlusClient } from "contracts/chainlink/VRFV2PlusClient.sol";

// --- OpenZeppelin ---
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

// --- Sloučené knihovny ---
import "./BiggiPriceMathLib.sol";
import "./BiggiIdIndexLib.sol";
import "./BiggiMetaRedeemLib.sol";
import "./BiggiRewards.sol";

// --- Custom errors ---
error NotTicketOwner();
error NotTicket();
error AlreadyPending();
error SoldOut();
error AlreadyMinted();
error AllNFTsMinted();
error LowPayment();
error NoMinter();
error DevPaymentFailed();
error NotDone();
error NotEnoughBalance();
error AlreadyClaimed();
error NoBgSet();
error InvalidBlock();
error ArraysMismatch();

contract BiggiEyesLottery is
    ERC721,
    ERC721Enumerable,
    Ownable,
    Pausable,
    VRFConsumerBaseV2Plus,
    ReentrancyGuard
{
    using BiggiPriceMathLib for BiggiPriceMathLib.BlockInfo;
    using BiggiRewards for BiggiRewards.RewardsState;
    using BiggiIdIndexLib for uint256;
    using BiggiIdIndexLib for mapping(uint256 => BiggiIdIndexLib.NFTInfo);

    // --- Konstanty a stav ---
    address public immutable VRF_COORDINATOR;
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint256 public constant MAX_BATCH = 55;
    uint256 public constant MAX_TICKETS = 550;
    uint256 public constant MAX_SUPPLY = 550;

    bytes32 public keyHash;
    uint256 public s_subscriptionId;
    uint32 public callbackGasLimit = 300_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    uint16 public ticketMinted;
    uint16 public biggiMinted;

    mapping(address => uint256) public ticketCount;
    mapping(uint256 => bool) public isTicket;

    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033; // +0.33% (1.0033 * 1e4)

    // --- NOVÁ logika narůstání cen ---
    // Base ceny bloků (1..10) – v ether (wei)
    uint256[10] public blockBasePrices = [
        100 ether, 200 ether, 300 ether, 400 ether, 500 ether,
        600 ether, 700 ether, 800 ether, 900 ether, 1000 ether
    ];

    // Multiplikátory nárůstu ceny per mint v setinách procenta (např. 10100 = +1.00 %)
    uint256[10] public blockPriceIncrease = [
        10100, 10130, 10160, 10190, 10220,
        10250, 10280, 10310, 10340, 10370
    ];

    // Bonus podle backgroundu (index 0..9 odpovídá background 1..10) – v %
    uint8[10] public backgroundBonuses;

    // Počítadla mintů na blok + runtime struktury pro cenu
    uint16[10] public blockMintCounts;
    BiggiPriceMathLib.BlockInfo[10] public blockInfos;

    // Metadata map (index 1..MAX_SUPPLY)
    mapping(uint256 => BiggiIdIndexLib.NFTInfo) public nftInfo;

    // Pending VRF requesty
    mapping(uint256 => address) public pendingMinters;     // requestId => minter
    mapping(address => uint256) public pendingMintRequest; // minter   => requestId

    // Lidské názvy
    string[10] public blockNames = [
        "ORANGE", "BLACK", "WHITE", "BROWN", "BLUE",
        "GREEN", "VIOLET", "RED", "PINK", "RAINBOW"
    ];
    string[10] public backgroundShortNames = [
        "O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"
    ];
    string[10] public characterNames = [
        "Cosmonaut", "Snowman", "Bugs", "Pig", "Mickey",
        "Santa", "Woody", "Buzz", "Bart", "Homer"
    ];

    // Base URI per blok + další base URI
    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;
    string private _baseTokenURI;

    // --- Rewards fond a částky ---
    uint256 public rewardsPool;
    // 22.00 % v BPS
    uint256 public rewardPercent = 2200;
    uint256 public orangeReward = 0.005 ether;
    uint256 public blockReward = 0.01 ether;
    uint256 public rainbowReward = 0.02 ether;

    // --- Počítadla výherců a globální flajky ---
    uint8 public orangeWinnersCount;        // max 3
    uint8 public blockWinnersCount;         // max 3 (každý blok jen 1×)
    bool public rainbowRewardClaimedGlobal; // max 1 globálně

    // --- Stav pro speciální výhry (charaktery) ---
    mapping(uint16 => bool) public characterClaimed;

    // --- Rewards interní stav (lib) ---
    BiggiRewards.RewardsState private rewardsState;

    // --- Anti-duplication / per-blok / per-mainId ---
    // Orange: každé mainId (1..10) lze proplatit jen 1× napříč všemi uživateli
    mapping(uint256 => bool) public orangeMainIdPaid;
    // Block: každý blok 1..9 lze proplatit jen 1× globálně
    mapping(uint16 => bool) public blockPaid;
    // Block: daný uživatel může claimnout více různých bloků, ale tentýž blok ne dvakrát
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock;

    // --- Hlavní události ---
    event MintRequested(address indexed user, uint256 requestIdOrTicketId);
    event MintFulfilled(address indexed user, uint256 tokenId, uint256 nftIndex);
    event TicketRedeemed(address user, uint256 ticketId);
    event VRFRequested(address user, uint256 requestId, uint256 ticketId);
    event VRFFulfillStarted(uint256 requestId, address minter, uint256 randomWord);
    event NFTMinted(address minter, uint256 tokenId, uint256 nftIndex);
    event CharacterRewardMinted(address indexed user, uint256 characterTokenId, string characterName, uint16 blockIdx);
    event OrangeRewardClaimed(address indexed user, uint256 amount);
    event BlockRewardClaimed(address indexed user, uint256 amount);
    event RainbowRewardClaimed(address indexed user, uint256 amount);
    event RestWithdrawn(address indexed owner, uint256 amount);
    event BaseURIChanged(string newBaseURI);
    event RewardsBaseURIChanged(string uri);
    event CharactersBaseURIChanged(string uri);
    event TicketBaseURIChanged(string uri);
    event CallbackGasLimitChanged(uint32 newLimit);
    event BlockBasePricesChanged(uint256[10] newPrices);
    event BlockPriceIncreasesChanged(uint256[10] newIncreases);
    event RewardAmountsChanged(uint256 orange, uint256 block, uint256 rainbow);
    event RewardPercentChanged(uint256 percent);
    event BlockBaseURIChanged(uint16 indexed blockIdx, string newURI);
    event PendingMintRescued(address indexed user, uint256 oldRequestId);

    // --- Pauza ---
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Settery URI & parametry ---
    function setBaseURI(string calldata uri) external onlyOwner { _baseTokenURI = uri; emit BaseURIChanged(uri); }
    function setRewardsBaseURI(string calldata uri) external onlyOwner { rewardsBaseURI = uri; emit RewardsBaseURIChanged(uri); }
    function setCharactersBaseURI(string calldata uri) external onlyOwner { charactersBaseURI = uri; emit CharactersBaseURIChanged(uri); }
    function setTicketBaseURI(string calldata uri) external onlyOwner { ticketBaseURI = uri; emit TicketBaseURIChanged(uri); }
    function setCallbackGasLimit(uint32 newLimit) external onlyOwner { callbackGasLimit = newLimit; emit CallbackGasLimitChanged(newLimit); }

    /// @notice Nastaví base ceny bloků (v wei). Pořadí bloků 1..10.
    function setBlockBasePrices(uint256[10] calldata newBasePrices) external onlyOwner {
        for (uint8 i = 1; i <= 10; ++i) {
            blockBasePrices[i-1] = newBasePrices[i-1];
            blockInfos[i-1].basePrice = newBasePrices[i-1];
        }
        emit BlockBasePricesChanged(newBasePrices);
    }

    /// @notice Nastaví multiplikátory nárůstů pro bloky (např. 10100 = +1.00 %).
    function setBlockPriceIncreases(uint256[10] calldata newIncreases) external onlyOwner {
        for (uint8 i = 1; i <= 10; ++i) {
            blockPriceIncrease[i-1] = newIncreases[i-1];
            blockInfos[i-1].priceIncrease = newIncreases[i-1];
        }
        emit BlockPriceIncreasesChanged(newIncreases);
    }

    function setRewardPercent(uint256 percent) external onlyOwner { rewardPercent = percent; emit RewardPercentChanged(percent);}
    function setRewardAmounts(uint256 _orange, uint256 _block, uint256 _rainbow) external onlyOwner {
        orangeReward = _orange; blockReward = _block; rainbowReward = _rainbow;
        emit RewardAmountsChanged(_orange, _block, _rainbow);
    }
    function setKeyHash(bytes32 newKeyHash) external onlyOwner { keyHash = newKeyHash; }

    function setBlockBaseURI(uint16 blockIdx, string calldata uri) external onlyOwner {
        require(blockIdx >= 1 && blockIdx <= 10, "Block index out of range");
        blockBaseURIs[blockIdx] = uri;
        emit BlockBaseURIChanged(blockIdx, uri);
    }

    // === KONSTRUKTOR S NOVOU LOGIKOU NÁRŮSTU CEN ===
    constructor(
        string memory __baseURI,
        uint256 subscriptionId,
        address vrfCoordinator_,
        address initialOwner,
        bytes32 keyHash_
    )
        ERC721("BiggiEyes", "BIGGI")
        Ownable(initialOwner)
        VRFConsumerBaseV2Plus(vrfCoordinator_)
    {
        require(initialOwner != address(0), "Owner=0");
        _baseTokenURI = __baseURI;
        s_subscriptionId = subscriptionId;
        VRF_COORDINATOR = vrfCoordinator_;
        keyHash = keyHash_;
        _transferOwnership(initialOwner);

        // Inicializace dynamických cen pro všech 10 bloků
        BiggiPriceMathLib.initializeBlocks(blockInfos, blockBasePrices, blockPriceIncrease);

        // Base URI (per blok)
        blockBaseURIs[1]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeibvqiijfizvzzj3jec3px3qc3fpoxgqc3xst4hunqua6p2gptqtn4/";
        blockBaseURIs[2]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiessalwrplohnlgce2nhhlyuagwohoflr6fwr47bvwwctdmsqbxmy/";
        blockBaseURIs[3]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeih7vm77lehpyujdzy22rig3pcql3pkhpzyvggmchorbl6du3wnrmy/";
        blockBaseURIs[4]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiat3jf2m3gobf7kl7ecyt2eljgetsytetyf742ht5agp6dobfz6cm/";
        blockBaseURIs[5]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeifhhfkhwcfkp5nzgwbwhjmccl7d4figomo2vmjcxg67bnyhd3zscy/";
        blockBaseURIs[6]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeigid3tvlon3c2kpktaz5qpfdi36j4bzajgtdc7udv47agquvjn4om/";
        blockBaseURIs[7]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeigzh35zcct7fupgd7psgexpn2akttkhfpl2w7imhm5jbmhens2dtu/";
        blockBaseURIs[8]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiexn4jx2robagukwgcl34uw4qp6wnsoewanhddwd2pgrpldby2q6a/";
        blockBaseURIs[9]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeicewu5ivd36ves3godoubv2uriirmx6jf5rhemsqqg5rkiinkyefy/";
        blockBaseURIs[10] = "https://biggieyes.mypinata.cloud/ipfs/bafybeifvwpqzuikcupqwytmvieh4pabf6yd6j7r6hj5o6skrsmj2zjahye/";

        rewardsBaseURI      = "https://biggieyes.mypinata.cloud/ipfs/bafybeign6hbjbvpzjhll5m5ydnrk7vyeq2xf52q5otfng2hxqmcvdjxa7y/";
        charactersBaseURI   = "https://biggieyes.mypinata.cloud/ipfs/bafybeic7vx2gx5sfaoo4346azobz2k5ma3pwgatn5gwfv4lgeuvtxqu6vi/";
        ticketBaseURI       = "https://biggieyes.mypinata.cloud/ipfs/bafybeid32cnhzvsmg56nwlgf2lcowqcnaqch2us7g4af6oyta6cwhkzrgu/";

        // Bonusy dle backgroundu (0..45 %)
        backgroundBonuses = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    }

    function _baseURI() internal view override(ERC721) returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        require(exists(tokenId), "No token");
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
            string memory charFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET + 110),
                "_REWARD_",
                characterNames[uint8(tokenId - BiggiIdIndexLib.CHARACTER_OFFSET)],
                ".json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        if (
            tokenId >= BiggiIdIndexLib.BIGGI_OFFSET &&
            tokenId < BiggiIdIndexLib.CHARACTER_OFFSET
        ) {
            uint256 idx = BiggiIdIndexLib.nftIndexFromTokenId(tokenId);
            BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
            return BiggiMetaRedeemLib.buildNftUri(
                blockBaseURIs[info.blockIdx],
                info.mainId,
                blockNames[info.blockIdx - 1],
                backgroundShortNames[info.background - 1]
            );
        }
        revert("Unknown tokenId");
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // --- Ticket mint ---
    function mintTicket() external payable nonReentrant whenNotPaused {
        require(ticketMinted < MAX_TICKETS, "All tickets minted");
        require(ticketCount[msg.sender] < 10, "Max 10 tickets per wallet");
        require(msg.value >= ticketPrice, "Insufficient payment");

        // Rozdělení plateb: rewards fond + dev wallet
        uint256 rewardPart = (msg.value * rewardPercent) / 10000;
        uint256 devPart = msg.value - rewardPart;
        rewardsPool += rewardPart;

        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) {
            revert DevPaymentFailed();
        }

        uint256 ticketId = BiggiIdIndexLib.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;
        ticketMinted++;
        ticketCount[msg.sender]++;
        _safeMint(msg.sender, ticketId);

        emit MintRequested(msg.sender, ticketId);
        ticketPrice = BiggiPriceMathLib.increaseByPercent(ticketPrice, priceIncreasePerMint);
    }

    // --- Redeem ticket + VRF mint ---
    function redeemTicketAndMintNFT(uint256 ticketId) external nonReentrant whenNotPaused {
        require(isTicket[ticketId], "Not a ticket");
        require(ownerOf(ticketId) == msg.sender, "Not ticket owner");
        require(ticketCount[msg.sender] > 0, "No ticket to redeem");
        require(biggiMinted < MAX_SUPPLY, "All NFTs minted");
        require(pendingMintRequest[msg.sender] == 0, "Already pending");

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

        emit MintRequested(msg.sender, requestId);
    }

    function adminRescuePendingMint(address user) external onlyOwner {
        uint256 requestId = pendingMintRequest[user];
        require(requestId != 0, "No pending request");
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
        emit PendingMintRescued(user, requestId);
    }

    // --- Manuální mint pro testy ---
    function publicMint(uint256 index) external payable nonReentrant whenNotPaused {
        require(msg.value >= 0.001 ether, "Low payment");
        require(biggiMinted < MAX_SUPPLY, "All NFTs minted");
        require(index >= 1 && index <= MAX_SUPPLY, "Invalid index");
        require(!nftInfo[index].minted, "NFT already minted");

        BiggiIdIndexLib.NFTInfo storage info = nftInfo[index];
        require(
            info.background >= 1 && info.background <= 10 &&
            info.blockIdx  >= 1 && info.blockIdx  <= 10 &&
            info.mainId != 0,
            "NFT not configured"
        );

        info.minted = true;
        biggiMinted++;

        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(index);
        _safeMint(msg.sender, tokenId);

        // počítadlo mintů pro BLOK
        blockMintCounts[info.blockIdx - 1]++;

        // === OPRAVA: dynamická cena se zvyšuje podle BLOKU (nikoli backgroundu) ===
        uint16 blkIdx0 = info.blockIdx - 1;
        blockInfos[blkIdx0].updatePrice();
        uint256 currentBlockPrice = blockInfos[blkIdx0].currentPrice;

        info.ticketPrice = ticketPrice;
        info.blockPrice = currentBlockPrice;

        // bonus zůstává dle backgroundu
        uint8 bonus = backgroundBonuses[info.background - 1];
        info.finalPrice = currentBlockPrice + ((currentBlockPrice * bonus) / 100);

        emit MintFulfilled(msg.sender, tokenId, index);
    }

    // --- VRF callback ---
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address minter = pendingMinters[requestId];
        if (minter == address(0)) {
            revert NoMinter();
        }

        emit VRFFulfillStarted(requestId, minter, randomWords[0]);

        uint256 index = BiggiIdIndexLib.randomToMintIndex(randomWords[0], MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; ++i) {
            if (!nftInfo[index].minted) {
                nftInfo[index].minted = true;
                biggiMinted++;
                uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(index);
                _safeMint(minter, tokenId);

                uint16 blk = nftInfo[index].blockIdx;
                uint16 bg  = nftInfo[index].background;

                // počítadlo mintů pro BLOK
                blockMintCounts[blk - 1]++;

                // === OPRAVA: dynamická cena dle BLOKU ===
                uint16 blkIdx0 = blk - 1;
                blockInfos[blkIdx0].updatePrice();
                uint256 currentBlockPrice = blockInfos[blkIdx0].currentPrice;

                nftInfo[index].ticketPrice = ticketPrice;
                nftInfo[index].blockPrice = currentBlockPrice;

                // bonus dle backgroundu
                uint8 bonus = backgroundBonuses[bg - 1];
                nftInfo[index].finalPrice = currentBlockPrice + ((currentBlockPrice * bonus) / 100);

                // Charakter – mint, jakmile je blok kompletní
                if (!characterClaimed[blk] && _blockMinted(blk) == _totalBlockNFTs(blk)) {
                    characterClaimed[blk] = true;
                    uint256 charId = BiggiIdIndexLib.CHARACTER_OFFSET + (blk - 1);
                    _safeMint(minter, charId);
                    emit CharacterRewardMinted(minter, charId, characterNames[blk - 1], blk);
                }
                BiggiMetaRedeemLib.clearPendingRequest(pendingMintRequest, pendingMinters, minter, requestId);
                return;
            }
            index = (index % MAX_SUPPLY) + 1;
        }
        revert SoldOut();
    }

    // --- Helpers pro analýzu a frontend ---
    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }

    /// @notice Vrátí seznam ticket tokenId držených `owner`.
    /// @dev OPRAVA: prohledává reálný rozsah ticketId [TICKET_OFFSET .. TICKET_OFFSET+MAX_TICKETS-1]
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

    // =========================
    //   INTERNAL OWNERSHIP CHECKS
    // =========================

    /// @dev Bezpečné zjištění, zda `owner` drží NFT podle interního indexu (1..MAX_SUPPLY).
    function _ownsByNftIndex(address owner, uint256 idx) internal view returns (bool) {
        if (idx < 1 || idx > MAX_SUPPLY) return false;
        BiggiIdIndexLib.NFTInfo memory info = nftInfo[idx];
        if (!info.minted) return false;
        uint256 tokenId = BiggiIdIndexLib.tokenIdFromNftIndex(idx);
        if (!exists(tokenId)) return false;
        return _ownerOf(tokenId) == owner;
    }

    /// @dev Ověří, že `owner` drží všech 10 backgroundů (1..10) pro dané `mainId` v daném bloku `blk`.
    function _hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) internal view returns (bool) {
        if (blk < 1 || blk > 10) return false;
        bool[11] memory hasBg; // 1..10
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

    /// @dev Ověří, že `owner` drží všech 10 různých mainId (1..10) v daném bloku `blk` (pozadí libovolné).
    function _hasAllTenMainIdsInBlock(address owner, uint16 blk) internal view returns (bool) {
        if (blk < 1 || blk > 10) return false;
        bool[11] memory hasMain; // 1..10
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

    // --- Claimování peněžních odměn ---

    /// @notice Orange: drž všech 10 backgroundů (1..10) pro 1 konkrétní mainId v ORANGE (blk=1).
    /// @dev Každé mainId lze proplatit jen 1× globálně. Max 3 výherci celkem. Uživatel pouze 1× (RewardsState).
    function claimOrangeReward(uint256 mainId) external nonReentrant {
        require(orangeReward > 0, "Reward not set");
        require(orangeWinnersCount < 3, "All claimed");
        require(mainId >= 1 && mainId <= 10, "Invalid mainId");

        uint16 ORANGE_BLK = 1;

        if (rewardsState.hasClaimedOrange(msg.sender)) revert AlreadyClaimed();
        require(!orangeMainIdPaid[mainId], "MainId already rewarded");
        require(_hasAllBackgroundsForMainIdInBlock(msg.sender, ORANGE_BLK, mainId), "Need all 10 bgs for this mainId in ORANGE");

        // Výplata z fondu
        require(rewardsPool >= orangeReward, "Rewards pool empty");
        rewardsPool -= orangeReward;

        // Záznamy
        rewardsState.claimOrange(msg.sender);
        orangeMainIdPaid[mainId] = true;
        orangeWinnersCount++;

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        require(sent, "Transfer failed");

        emit OrangeRewardClaimed(msg.sender, orangeReward);
    }

    /// @notice Block: drž všech 10 různých mainId (1..10) v jednom z bloků 1..9 (RAINBOW=10 je vyloučen).
    /// @dev Každý blok lze proplatit jen 1× globálně. Uživatel může claimnout více různých bloků, tentýž blok jen 1×.
    function claimBlockReward(uint16 blockIdx) external nonReentrant {
        require(blockReward > 0, "Reward not set");
        require(blockWinnersCount < 3, "All claimed");
        require(blockIdx >= 1 && blockIdx <= 9, "Invalid block"); // Rainbow (10) vyloučen
        require(!blockPaid[blockIdx], "Block already rewarded");
        require(!userClaimedBlock[msg.sender][blockIdx], "You already claimed this block");

        require(_hasAllTenMainIdsInBlock(msg.sender, blockIdx), "Need all 10 mainIds in block");

        // Výplata z fondu
        require(rewardsPool >= blockReward, "Rewards pool empty");
        rewardsPool -= blockReward;

        // Záznamy
        blockPaid[blockIdx] = true;
        userClaimedBlock[msg.sender][blockIdx] = true;
        blockWinnersCount++;

        (bool sent, ) = msg.sender.call{value: blockReward}("");
        require(sent, "Transfer failed");

        emit BlockRewardClaimed(msg.sender, blockReward);
    }

    /// @notice Rainbow: drž všech 10 mainId (1..10) v RAINBOW bloku (10). Celkově pouze 1×.
    function claimRainbowReward() external nonReentrant {
        require(rainbowReward > 0, "Reward not set");
        require(!rainbowRewardClaimedGlobal, "Already claimed");
        if (rewardsState.hasClaimedRainbow(msg.sender)) revert AlreadyClaimed();

        uint16 RAINBOW_BLK = 10;
        require(_hasAllTenMainIdsInBlock(msg.sender, RAINBOW_BLK), "Need all 10 mainIds in RAINBOW");

        // Výplata z fondu
        require(rewardsPool >= rainbowReward, "Rewards pool empty");
        rewardsPool -= rainbowReward;

        // Záznamy
        rewardsState.claimRainbow(msg.sender);
        rainbowRewardClaimedGlobal = true;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        require(sent, "Transfer failed");

        emit RainbowRewardClaimed(msg.sender, rainbowReward);
    }

    // --- Blokové info ---
    function _totalBlockNFTs(uint16 blk) internal pure returns (uint256) {
        if (blk == 1) return 100;
        if (blk == 2) return 90;
        if (blk == 3) return 80;
        if (blk == 4) return 70;
        if (blk == 5) return 60;
        if (blk == 6) return 50;
        if (blk == 7) return 40;
        if (blk == 8) return 30;
        if (blk == 9) return 20;
        if (blk == 10) return 10;
        return 0;
    }
    function _blockMinted(uint16 blk) internal view returns (uint256) {
        require(blk >= 1 && blk <= 10, "Block out of range");
        return blockMintCounts[blk - 1];
    }

    // --- Batch nastavení metadat ---
    function batchSetNFTBackgroundAndBlock(
        uint256[] calldata indices,
        uint16[] calldata bgCodes,
        uint16[] calldata blockIndices,
        uint256[] calldata mainIds
    ) external onlyOwner {
        uint256 len = indices.length;
        if (len > MAX_BATCH) revert ArraysMismatch();
        if (!(len == bgCodes.length && len == blockIndices.length && len == mainIds.length)) revert ArraysMismatch();

        for (uint256 i = 0; i < len; ++i) {
            uint256 idx = indices[i];
            require(idx >= 1 && idx <= MAX_SUPPLY, "Index");
            require(bgCodes[i] >= 1 && bgCodes[i] <= 10, "Bg");
            require(blockIndices[i] >= 1 && blockIndices[i] <= 10, "Blk");

            BiggiIdIndexLib.NFTInfo storage info = nftInfo[idx];
            require(!info.minted && info.background == 0 && info.blockIdx == 0 && info.mainId == 0, "Set");

            info.background = bgCodes[i];
            info.blockIdx = blockIndices[i];
            info.mainId = mainIds[i];
        }
    }

    // --- Withdraw zbytku po rezervaci nevyplacených odměn ---
    function withdrawRest() external onlyOwner nonReentrant {
        if (biggiMinted != MAX_SUPPLY) revert NotDone();

        uint256 reserved = (orangeReward * (3 - orangeWinnersCount))
            + (blockReward * (3 - blockWinnersCount))
            + (rainbowReward * (rainbowRewardClaimedGlobal ? 0 : 1));
        uint256 bal = address(this).balance;
        if (bal <= reserved) revert NotEnoughBalance();

        uint256 toSend = bal - reserved;
        Address.sendValue(payable(msg.sender), toSend);
        emit RestWithdrawn(msg.sender, toSend);
    }

    // --- Read-only pro frontend ---
    function getCurrentBlockPrice(uint16 blockIdx) public view returns (uint256) {
        require(blockIdx >= 1 && blockIdx <= 10, "Block index out of range");
        return blockInfos[blockIdx - 1].currentPrice;
    }
    function getBlockMintCount(uint16 blockIdx) public view returns (uint16) {
        require(blockIdx >= 1 && blockIdx <= 10, "Block index out of range");
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

    // --- ERC721 overrides ---
    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, ERC721) returns (bool) {
        return ERC721Enumerable.supportsInterface(interfaceId) || ERC721.supportsInterface(interfaceId);
    }

    function _increaseBalance(address account, uint128 value) internal virtual override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    receive() external payable {
        revert("No direct ETH");
    }
}
