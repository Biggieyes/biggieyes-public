// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

// --- Vlastní knihovny ---
import "./BiggiMath2.sol";
import "./BiggiPriceLibrary2.sol";
import "./BiggiUriHelper2.sol";
import "./BiggiIDHelper2.sol";
import "./BiggiRedeemHelper2.sol";
import "./BiggiIndexHelper2.sol";

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
    using BiggiPriceLibrary2 for BiggiPriceLibrary2.BlockInfo;
    using BiggiIDHelper2 for uint256;
    using BiggiIndexHelper2 for mapping(uint256 => BiggiIndexHelper2.NFTInfo);

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
    uint256 public priceIncreasePerMint = 10033;

    uint256[10] public blockBasePrices;
    uint256[10] public blockPriceIncrease;

    uint16[10] public blockMintCounts;
    BiggiPriceLibrary2.BlockInfo[10] public blockInfos;

    mapping(uint256 => BiggiIndexHelper2.NFTInfo) public nftInfo;
    mapping(uint256 => address) public pendingMinters;
    mapping(address => uint256) public pendingMintRequest;

    string[10] public blockNames;
    string[10] public backgroundShortNames;
    string[10] public characterNames;

    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;
    string private _baseTokenURI;

    // --- Propojení s Rewards kontraktem ---
    address public rewardsContract;

    // --- PUBLIC STORAGE PRO REWARDS KONTRAKT ---
    mapping(uint16 => mapping(uint256 => bool)) public orangeRewardClaimedForMainId;
    mapping(uint16 => bool) public blockRewardClaimedForBlock;
    bool public rainbowRewardClaimedGlobal;

    // --- DEBUG/TRACE Události ---
    event Debug(string msg);
    event DebugUint(string msg, uint256 value);
    event DebugAddress(string msg, address addr);
    event DebugBytes(string msg, bytes32 data);
    event DebugBool(string msg, bool b);

    // --- Hlavní události ---
    event MintRequested(address indexed user, uint256 requestId);
    event MintFulfilled(address indexed user, uint256 tokenId, uint256 nftIndex);
    event TicketRedeemed(address user, uint256 ticketId);
    event VRFRequested(address user, uint256 requestId, uint256 ticketId);
    event VRFFulfillStarted(uint256 requestId, address minter, uint256 randomWord);
    event NFTMinted(address minter, uint256 tokenId, uint256 nftIndex);
    event CharacterRewardMinted(address indexed user, uint256 characterTokenId, string characterName, uint16 blockIdx);
    event RestWithdrawn(address indexed owner, uint256 amount);
    event BaseURIChanged(string newBaseURI);
    event RewardsBaseURIChanged(string uri);
    event CharactersBaseURIChanged(string uri);
    event TicketBaseURIChanged(string uri);
    event CallbackGasLimitChanged(uint32 newLimit);
    event BlockBasePricesChanged(uint256[10] newPrices);
    event BlockPriceIncreasesChanged(uint256[10] newIncreases);
    event BlockBaseURIChanged(uint16 indexed blockIdx, string newURI);
    event PendingMintRescued(address indexed user, uint256 oldRequestId);

    // --- Pauza ---
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Setter na Rewards kontrakt ---
    function setRewardsContract(address _addr) external onlyOwner {
        require(_addr != address(0), "Zero address");
        rewardsContract = _addr;
    }

 // --- Zápisy claimů (přístupné jen Rewards kontraktu) ---
function markOrangeClaimed(uint16 blockIdx, uint256 mainId) external {
    require(msg.sender == rewardsContract, "Not allowed");
    orangeRewardClaimedForMainId[blockIdx][mainId] = true;
}

function markBlockClaimed(uint16 blockIdx) external {
    require(msg.sender == rewardsContract, "Not allowed");
    blockRewardClaimedForBlock[blockIdx] = true;
}

function markRainbowClaimed() external {
    require(msg.sender == rewardsContract, "Not allowed");
    rainbowRewardClaimedGlobal = true;
}
    // --- Settery URI & parametry ---
    function setBaseURI(string calldata uri) external onlyOwner { _baseTokenURI = uri; emit BaseURIChanged(uri); }
    function setRewardsBaseURI(string calldata uri) external onlyOwner { rewardsBaseURI = uri; emit RewardsBaseURIChanged(uri); }
    function setCharactersBaseURI(string calldata uri) external onlyOwner { charactersBaseURI = uri; emit CharactersBaseURIChanged(uri); }
    function setTicketBaseURI(string calldata uri) external onlyOwner { ticketBaseURI = uri; emit TicketBaseURIChanged(uri); }
    function setCallbackGasLimit(uint32 newLimit) external onlyOwner { callbackGasLimit = newLimit; emit CallbackGasLimitChanged(newLimit); }
    function setBlockBasePrices(uint256[10] calldata newBasePrices) external onlyOwner {
        for (uint8 i = 1; i <= 10; ++i) {
            blockBasePrices[i-1] = newBasePrices[i-1];
            blockInfos[i-1].basePrice = newBasePrices[i-1];
        }
        emit BlockBasePricesChanged(newBasePrices);
    }
    function setBlockPriceIncreases(uint256[10] calldata newIncreases) external onlyOwner {
        for (uint8 i = 1; i <= 10; ++i) {
            blockPriceIncrease[i-1] = newIncreases[i-1];
            blockInfos[i-1].priceIncrease = newIncreases[i-1];
        }
        emit BlockPriceIncreasesChanged(newIncreases);
    }
    function setKeyHash(bytes32 newKeyHash) external onlyOwner { keyHash = newKeyHash; }

    function setBlockBaseURI(uint16 blockIdx, string calldata uri) external onlyOwner {
        require(blockIdx >= 1 && blockIdx <= 10, "Block index out of range");
        blockBaseURIs[blockIdx] = uri;
        emit BlockBaseURIChanged(blockIdx, uri);
    }

    // === KONSTRUKTOR S AKTUÁLNÍMI METADATA URL ===
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

        blockBasePrices = [
            0.01 ether, 0.02 ether, 0.03 ether, 0.04 ether, 0.05 ether,
            0.06 ether, 0.07 ether, 0.08 ether, 0.09 ether, 0.1 ether
        ];
        blockPriceIncrease = [
            10100, 10130, 10160, 10190, 10220,
            10250, 10280, 10310, 10340, 10370
        ];

        blockNames = [
            "ORANGE", "BLACK", "WHITE", "BROWN", "BLUE",
            "GREEN", "VIOLET", "RED", "PINK", "RAINBOW"
        ];
        backgroundShortNames = [
            "O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"
        ];
        characterNames = [
            "Cosmonaut", "Snowman", "Bugs", "Pig", "Mickey",
            "Santa", "Woody", "Buzz", "Bart", "Homer"
        ];

        BiggiPriceLibrary2.initializeBlocks(blockInfos, blockBasePrices, blockPriceIncrease);

        blockBaseURIs[1]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeif3xrjhqtfrt5fcmv7pan2xbmuvmws672ewsfjhkktyqccwbfhkku/"; // ORANGE_METADATA
        blockBaseURIs[2]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeihnbpirtzywjmpwjykyqg53xycnie5m4gjdr3h327tqd73bmivq2m/"; // BLACK_METADATA
        blockBaseURIs[3]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiaxd2c3yfafn7jytgbz6s7bgngkh4vyuycodjhwbqabkd5tbxs6ae/"; // WHITE_METADATA
        blockBaseURIs[4]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeidjjeabrpqzeup3svqlrecafmrzfjr7zl6dieypxwccdhw3ic3eiy/"; // BROWN_METADATA
        blockBaseURIs[5]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeidfv4ns2hpwbgxek52l3k3voj44la5vg4ioipxvfqbi7wn4rja7ku/"; // BLUE_METADATA
        blockBaseURIs[6]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiczbzc4pft5sytti3dihtwtpyw7rauiz22kddl3pzizgqgun6kela/"; // GREEN_METADATA
        blockBaseURIs[7]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeibrm6xel2uuerm6sqgdh32qql7zy7b75657e4ks3nxkuafhz2divu/"; // VIOLET_METADATA
        blockBaseURIs[8]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeibasg62oa7ixbgkimcd2yghlm77difctoh74zxiwsusyxlgbxxjua/"; // RED_METADATA
        blockBaseURIs[9]  = "https://biggieyes.mypinata.cloud/ipfs/bafybeiezlnhqhlx6kolj3tzxeydy2qd7sraqwjf4f5f3qdfbpu7a7ay6ou/"; // PINK_METADATA
        blockBaseURIs[10] = "https://biggieyes.mypinata.cloud/ipfs/bafybeidgodoady7olw52fgedapt475jf5u6gcvfwphvfcrsfmsk4aspm5m/"; // RAINBOW_METADATA

        rewardsBaseURI      = "https://biggieyes.mypinata.cloud/ipfs/bafybeibgx66o5yhcjnhrjtevuzzw4aow3cpfe7ni6qbyo3kdhpbrap2xum/"; // RAINBOW_REWARDS
        charactersBaseURI   = "https://biggieyes.mypinata.cloud/ipfs/bafybeic7vx2gx5sfaoo4346azobz2k5ma3pwgatn5gwfv4lgeuvtxqu6vi/"; // SPECIAL_CHARACTERS
        ticketBaseURI       = "https://biggieyes.mypinata.cloud/ipfs/bafybeid32cnhzvsmg56nwlgf2lcowqcnaqch2us7g4af6oyta6cwhkzrgu/"; // MINT_TICKET
    }

    function _baseURI() internal view override(ERC721) returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        require(exists(tokenId), "No token");
        if (tokenId < BiggiIDHelper2.BIGGI_OFFSET) {
            return string.concat(ticketBaseURI, "Biggi_RANDOM_MINT_TICKET.json");
        }
        if (tokenId >= BiggiIDHelper2.REWARDS_OFFSET && tokenId < BiggiIDHelper2.CHARACTER_OFFSET) {
            string memory rewardFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIDHelper2.REWARDS_OFFSET + 101),
                "_REWARDS_RB.json"
            );
            return string.concat(rewardsBaseURI, rewardFile);
        }
        if (tokenId >= BiggiIDHelper2.CHARACTER_OFFSET && tokenId < BiggiIDHelper2.CHARACTER_OFFSET + 10) {
            string memory charFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIDHelper2.CHARACTER_OFFSET + 110),
                "_REWARD_",
                characterNames[uint8(tokenId - BiggiIDHelper2.CHARACTER_OFFSET)],
                ".json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        if (
            tokenId >= BiggiIDHelper2.BIGGI_OFFSET &&
            tokenId < BiggiIDHelper2.CHARACTER_OFFSET
        ) {
            uint256 idx = BiggiIDHelper2.nftIndexFromTokenId(tokenId);
            BiggiIndexHelper2.NFTInfo memory info = nftInfo[idx];
            return BiggiUriHelper2.buildNftUri(
                blockBaseURIs[info.blockIdx],
                info.mainId,
                blockNames[info.blockIdx - 1],
                backgroundShortNames[info.background - 1]
            );
        }
        revert("Unknown tokenId");
    }

    /// --- Kontrola existence tokenu ---
    function exists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // === ON-CHAIN FINAL PRICE & BONUS LOGIKA ===

    /// Vrátí procento bonusu podle barvy pozadí (0=O, 5=B, ..., 45=RB)
    function getNFTBonusPercent(uint256 tokenId) public view returns (uint256) {
        require(exists(tokenId), "No token");
        uint256 idx = BiggiIDHelper2.nftIndexFromTokenId(tokenId);
        BiggiIndexHelper2.NFTInfo memory info = nftInfo[idx];
        return (info.background - 1) * 5;
    }

    /// Vrátí aktuální cenu bloku (block price) daného NFT
    function getNFTBlockPrice(uint256 tokenId) public view returns (uint256) {
        require(exists(tokenId), "No token");
        uint256 idx = BiggiIDHelper2.nftIndexFromTokenId(tokenId);
        BiggiIndexHelper2.NFTInfo memory info = nftInfo[idx];
        return blockInfos[info.blockIdx - 1].currentPrice;
    }

    /// Vrátí finální cenu NFT včetně bonusu (block price + jednorázový bonus)
    function getNFTFinalPrice(uint256 tokenId) public view returns (uint256) {
        require(exists(tokenId), "No token");
        uint256 blockPrice = getNFTBlockPrice(tokenId);
        uint256 bonusPercent = getNFTBonusPercent(tokenId);
        if (bonusPercent == 0) {
            return blockPrice;
        } else {
            return (blockPrice * (100 + bonusPercent)) / 100;
        }
    }

    // --- Mint vstupenky ---
    function mintTicket() external payable nonReentrant whenNotPaused {
        emit Debug("mintTicket: Start");
        require(ticketMinted < MAX_TICKETS, "All tickets minted");
        require(ticketCount[msg.sender] < 10, "Max 10 tickets per wallet");
        require(msg.value >= ticketPrice, "Insufficient payment");

        uint256 devPart = msg.value;
        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) {
            emit Debug("mintTicket: Dev payment failed");
            revert DevPaymentFailed();
        }

        uint256 ticketId = BiggiIDHelper2.BIGGI_OFFSET + ticketMinted;
        isTicket[ticketId] = true;
        ticketMinted++;
        ticketCount[msg.sender]++;
        _safeMint(msg.sender, ticketId);

        emit MintRequested(msg.sender, ticketId);
        emit DebugUint("mintTicket: ticketId", ticketId);
        ticketPrice = BiggiMath2.increaseByPercent(ticketPrice, priceIncreasePerMint);

        emit DebugUint("mintTicket: NewTicketPrice", ticketPrice);
    }

    function redeemTicketAndMintNFT(uint256 ticketId) external nonReentrant whenNotPaused {
        emit DebugUint("redeemTicketAndMintNFT: ticketId", ticketId);
        require(isTicket[ticketId], "Not a ticket");
        require(ownerOf(ticketId) == msg.sender, "Not ticket owner");
        require(ticketCount[msg.sender] > 0, "No ticket to redeem");
        require(biggiMinted < MAX_SUPPLY, "All NFTs minted");
        require(pendingMintRequest[msg.sender] == 0, "Already pending");

        isTicket[ticketId] = false;
        ticketCount[msg.sender]--;
        _burn(ticketId);

        emit TicketRedeemed(msg.sender, ticketId);

        emit Debug("redeemTicketAndMintNFT: Calling VRFCoordinatorV2PlusInterface.requestRandomWords");

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
        emit DebugUint("redeemTicketAndMintNFT: VRF requestId", requestId);

        BiggiRedeemHelper2.setPendingRequest(pendingMintRequest, pendingMinters, msg.sender, requestId);

        emit MintRequested(msg.sender, requestId);
    }

    /// --- ADMIN RESCUE (reset stuck pendingMintRequest for user) ---
    function adminRescuePendingMint(address user) external onlyOwner {
        uint256 requestId = pendingMintRequest[user];
        require(requestId != 0, "No pending request");
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
        emit PendingMintRescued(user, requestId);
        emit DebugAddress("adminRescuePendingMint: Cleared user", user);
    }

    function publicMint(uint256 index) external payable nonReentrant whenNotPaused {
        emit DebugUint("publicMint: index", index);
        require(msg.value >= 0.001 ether, "Low payment");
        require(biggiMinted < MAX_SUPPLY, "All NFTs minted");
        require(index >= 1 && index <= MAX_SUPPLY, "Invalid index");
        require(!nftInfo[index].minted, "NFT already minted");

        BiggiIndexHelper2.NFTInfo storage info = nftInfo[index];
        require(info.background >= 1 && info.background <= 10 && info.blockIdx >= 1 && info.blockIdx <= 10 && info.mainId != 0, "NFT not configured");

        info.minted = true;
        biggiMinted++;

        uint256 tokenId = BiggiIDHelper2.tokenIdFromNftIndex(index);
        _safeMint(msg.sender, tokenId);

        blockMintCounts[info.blockIdx - 1]++;
        blockInfos[info.background - 1].updatePrice();

        emit MintFulfilled(msg.sender, tokenId, index);
        emit DebugUint("publicMint: tokenId", tokenId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address minter = pendingMinters[requestId];
        if (minter == address(0)) {
            emit DebugUint("fulfillRandomWords: No minter for requestId", requestId);
            revert NoMinter();
        }

        emit VRFFulfillStarted(requestId, minter, randomWords[0]);
        emit DebugUint("fulfillRandomWords: randomWord", randomWords[0]);

        uint256 index = BiggiIDHelper2.randomToMintIndex(randomWords[0], MAX_SUPPLY);
        for (uint256 i = 0; i < MAX_SUPPLY; ++i) {
            if (!nftInfo[index].minted) {
                nftInfo[index].minted = true;
                biggiMinted++;
                uint256 tokenId = BiggiIDHelper2.tokenIdFromNftIndex(index);
                _safeMint(minter, tokenId);
                blockMintCounts[nftInfo[index].blockIdx - 1]++;
                blockInfos[nftInfo[index].background - 1].updatePrice();

                emit NFTMinted(minter, tokenId, index);
                emit MintFulfilled(minter, tokenId, index);

                BiggiRedeemHelper2.clearPendingRequest(pendingMintRequest, pendingMinters, minter, requestId);
                return;
            }
            index = (index % MAX_SUPPLY) + 1;
        }
        emit Debug("fulfillRandomWords: Sold out in for loop");
        revert SoldOut();
    }

    function findUnsetIndices() external view returns (uint256[] memory) {
        return nftInfo.findUnsetIndices(MAX_SUPPLY);
    }

    function findTicket(address owner) external view returns (uint256[] memory) {
        uint256[] memory tickets = new uint256[](MAX_TICKETS);
        uint256 found;
        for (uint256 i = 1; i <= MAX_TICKETS; i++) {
            if (exists(i) && ownerOf(i) == owner && isTicket[i]) {
                tickets[found] = i;
                found++;
            }
        }
        uint256[] memory res = new uint256[](found);
        for (uint256 j = 0; j < found; j++) res[j] = tickets[j];
        return res;
    }

    // --- Utility funkce ---
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

    // *** NOVÉ VEŘEJNÉ FUNKCE PRO REWARDS KONTRAKT ***
    function getNftInfo(uint256 idx) external view returns (bool, uint16, uint16, uint256) {
        BiggiIndexHelper2.NFTInfo storage info = nftInfo[idx];
        return (info.minted, info.background, info.blockIdx, info.mainId);
    }
    function tokenIdFromNftIndex(uint256 idx) external pure returns (uint256) {
        return BiggiIDHelper2.tokenIdFromNftIndex(idx);
    }
    function totalBlockNFTs(uint16 blk) external pure returns (uint256) {
        return _totalBlockNFTs(blk);
    }

    // --- Batch setter ---
    function batchSetNFTBackgroundAndBlock(
        uint256[] calldata indices,
        uint16[] calldata bgCodes,
        uint16[] calldata blockIndices,
        uint256[] calldata mainIds
    ) external onlyOwner {
        emit Debug("batchSetNFTBackgroundAndBlock: called");
        uint256 len = indices.length;
        if (len > MAX_BATCH) revert ArraysMismatch();
        if (!(len == bgCodes.length && len == blockIndices.length && len == mainIds.length)) revert ArraysMismatch();

        for (uint256 i = 0; i < len; ++i) {
            uint256 idx = indices[i];
            require(idx >= 1 && idx <= MAX_SUPPLY, "Index");
            require(bgCodes[i] >= 1 && bgCodes[i] <= 10, "Bg");
            require(blockIndices[i] >= 1 && blockIndices[i] <= 10, "Blk");

            BiggiIndexHelper2.NFTInfo storage info = nftInfo[idx];
            require(!info.minted && info.background == 0 && info.blockIdx == 0 && info.mainId == 0, "Set");

            info.background = bgCodes[i];
            info.blockIdx = blockIndices[i];
            info.mainId = mainIds[i];

            emit DebugUint("batchSetNFTBackgroundAndBlock: index", idx);
        }
    }

    function withdrawRest() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        Address.sendValue(payable(msg.sender), bal);
        emit RestWithdrawn(msg.sender, bal);
        emit DebugUint("withdrawRest: toSend", bal);
    }

    // --- Onchain statistiky pro dashboard ---
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

    // --- OZ DIAMOND INHERITANCE OVERRIDES ---
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
