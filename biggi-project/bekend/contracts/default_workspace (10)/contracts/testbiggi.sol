// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// --- Chainlink VRF v2.5 importy ---
import "contracts/chainlink/VRFConsumerBaseV2Plus.sol";
import "contracts/chainlink/VRFCoordinatorV2PlusInterface.sol";

// --- OpenZeppelin ---
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// --- Vlastní knihovny ---
import "./BiggiMath.sol";
import "./BiggiPriceLibrary.sol";
import "./BiggiUriHelper.sol";
import "./BiggiRewards.sol";
import "./BiggiIdHelper.sol";

// --- Custom errors pro gas optimalizaci ---
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
    ERC721Enumerable,
    Ownable,
    Pausable,
    VRFConsumerBaseV2Plus,
    ReentrancyGuard
{
    using BiggiPriceLibrary for BiggiPriceLibrary.BlockInfo;
    using BiggiRewards for BiggiRewards.RewardsState;
    using BiggiIdHelper for uint256;

    // --- Konstanty a stav ---
    address public immutable VRF_COORDINATOR;
    address public constant DEV_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;
    uint256 public constant MAX_BATCH = 55;
    uint256 public constant MAX_TICKETS = 550;
    uint256 public constant MAX_SUPPLY = 550;

    bytes32 public keyHash = 0x3f631d5ec60a0ce16203bcd6aff7ffbc423e22e452786288e172d467354304c8;
    uint256 public s_subscriptionId;
    uint32 public callbackGasLimit = 300_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;

    uint16 public ticketMinted;   // úspora storage
    uint16 public biggiMinted;    // úspora storage

    mapping(address => bool) public hasTicket;
    mapping(uint256 => bool) public isTicket;

    uint256 public ticketPrice = 0.001 ether;
    uint256 public priceIncreasePerMint = 10033; // 0.33 % (basis points)

    uint256[10] public blockBasePrices = [
        0.01 ether, 0.02 ether, 0.03 ether, 0.04 ether, 0.05 ether,
        0.06 ether, 0.07 ether, 0.08 ether, 0.09 ether, 0.1 ether
    ];
    uint256[10] public blockPriceIncrease = [
        10033, 10033, 10033, 10033, 10033,
        10033, 10033, 10033, 10033, 10033
    ];

    uint16[10] public blockMintCounts;
    BiggiPriceLibrary.BlockInfo[10] public blockInfos;

    struct NFTInfo {
        bool minted;
        uint16 background;
        uint16 blockIdx;
        uint256 mainId;
    }

    mapping(uint256 => NFTInfo) public nftInfo;
    mapping(uint256 => address) public pendingMinters;
    mapping(address => uint256) public pendingMintRequest;

    string[10] public blockNames = [
        "ORANGE", "BLACK", "WHITE", "BROWN", "BLUE",
        "GREEN", "VIOLET", "RED", "PINK", "RAINBOW"
    ];
    string[10] public backgroundNames = [
        "O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"
    ];
    string[10] public characterNames = [
        "Cosmonaut", "Snowman", "Bugs", "Pig", "Mickey",
        "Santa", "Woody", "Buzz", "Bart", "Homer"
    ];

    mapping(uint16 => string) public blockBaseURIs;
    string public rewardsBaseURI;
    string public charactersBaseURI;
    string public ticketBaseURI;
    string private _baseTokenURI;

    uint256 public rewardsPool;
    uint256 public rewardPercent = 100;
    uint256 public orangeReward = 0.005 ether;
    uint256 public blockReward = 0.01 ether;
    uint256 public rainbowReward = 0.02 ether;
    uint8 public orangeWinnersCount; // úspora storage
    uint8 public blockWinnersCount;  // úspora storage
    bool public rainbowRewardClaimedGlobal;

    mapping(uint16 => bool) public characterClaimed;

    // --- Rewards knihovna stav ---
    BiggiRewards.RewardsState private rewardsState;

    // --- Události ---
    event MintRequested(address indexed user, uint256 requestId);
    event MintFulfilled(address indexed user, uint256 tokenId, uint256 nftIndex);
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

    // --- Pauza ---
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Settery URI & parametry ---
    function setBaseURI(string calldata uri) external onlyOwner { _baseTokenURI = uri; emit BaseURIChanged(uri); }
    function setRewardsBaseURI(string calldata uri) external onlyOwner { rewardsBaseURI = uri; emit RewardsBaseURIChanged(uri); }
    function setCharactersBaseURI(string calldata uri) external onlyOwner { charactersBaseURI = uri; emit CharactersBaseURIChanged(uri); }
    function setTicketBaseURI(string calldata uri) external onlyOwner { ticketBaseURI = uri; emit TicketBaseURIChanged(uri); }
    function setCallbackGasLimit(uint32 newLimit) external onlyOwner { callbackGasLimit = newLimit; emit CallbackGasLimitChanged(newLimit); }
    function setBlockBasePrices(uint256[10] calldata newBasePrices) external onlyOwner {
        for (uint8 i = 0; i < 10; ++i) {
            blockBasePrices[i] = newBasePrices[i];
            blockInfos[i].basePrice = newBasePrices[i];
        }
        emit BlockBasePricesChanged(newBasePrices);
    }
    function setBlockPriceIncreases(uint256[10] calldata newIncreases) external onlyOwner {
        for (uint8 i = 0; i < 10; ++i) {
            blockPriceIncrease[i] = newIncreases[i];
            blockInfos[i].priceIncrease = newIncreases[i];
        }
        emit BlockPriceIncreasesChanged(newIncreases);
    }
    function setRewardPercent(uint256 percent) external onlyOwner { rewardPercent = percent; emit RewardPercentChanged(percent);}
    function setRewardAmounts(uint256 _orange, uint256 _block, uint256 _rainbow) external onlyOwner {
        orangeReward = _orange; blockReward = _block; rainbowReward = _rainbow;
        emit RewardAmountsChanged(_orange, _block, _rainbow);
    }

    constructor(
        string memory __baseURI,
        uint256 subscriptionId,
        address initialOwner
    )
        ERC721("BiggiEyes", "BIGGI")
        Ownable(initialOwner)
        VRFConsumerBaseV2Plus(0x7E10652Cb79Ba97bC1D0F38a1e8FaD8464a8a908)
    {
        require(initialOwner != address(0), "Owner=0");
        _baseTokenURI = __baseURI;
        s_subscriptionId = subscriptionId;
        VRF_COORDINATOR = 0x7E10652Cb79Ba97bC1D0F38a1e8FaD8464a8a908;
        _transferOwnership(initialOwner);

        BiggiPriceLibrary.initializeBlocks(blockInfos, blockBasePrices, blockPriceIncrease);

        // BaseURIs 1-based indexace!
        blockBaseURIs[1] = "https://biggieyes.mypinata.cloud/ipfs/bafybeif4zgiwl4cswbb3uendtptq5bpe5covfl7su27rrjypklmcjidhu4/";
        blockBaseURIs[2] = "https://biggieyes.mypinata.cloud/ipfs/bafybeig57zxrgaco7lbv7oa5ikk7wxkae6ogh47z7fmoy4dzzwv2vmiux4/";
        blockBaseURIs[3] = "https://biggieyes.mypinata.cloud/ipfs/bafybeifghbfwaslhlu75byrje3okthniwhks567uhnaqtqjfn55ah7ie4q/";
        blockBaseURIs[4] = "https://biggieyes.mypinata.cloud/ipfs/bafybeibifthtryld2zvobtbvlj4e4m252ipkbgnxbyih5xalif7ke47dvu/";
        blockBaseURIs[5] = "https://biggieyes.mypinata.cloud/ipfs/bafybeieovll7sr3cqiznujfnokbjmni4bu5ey2hfeqea7rtmslxhehuz3u/";
        blockBaseURIs[6] = "https://biggieyes.mypinata.cloud/ipfs/bafybeicjdyhpgyfjxe35covufdcfxptfxthmxxzplpm767janzj7wpdwzu/";
        blockBaseURIs[7] = "https://biggieyes.mypinata.cloud/ipfs/bafybeifhkxioxvfqhr5fnmx56gkqqiiupbjdliroelw4rv2mn2caq7fozy/";
        blockBaseURIs[8] = "https://biggieyes.mypinata.cloud/ipfs/bafybeidwklktfqfkqtqqyece3io4fyfjwfaxeuhezjgxlxgowieuhroiea/";
        blockBaseURIs[9] = "https://biggieyes.mypinata.cloud/ipfs/bafybeiaxdnj7f5oy7m2o65r454ivs26drcmm47gtbzcmuxrlm6mrp3zpry/";
        blockBaseURIs[10] = "https://biggieyes.mypinata.cloud/ipfs/bafybeiexcd6dewaf6q2vdsob7qhnolu3clrejqbwao3ewld6twdnbpo3bq/";

        charactersBaseURI = "https://biggieyes.mypinata.cloud/ipfs/bafybeih2m3ve2yxd5xrpcpcbpe3g3odp2zn4wbmzjpndkhumksd437htqa/";
        rewardsBaseURI = "https://biggieyes.mypinata.cloud/ipfs/bafybeib4a7ie73dheivp3xrlbmqfl52ytph3a3c4lxtwkv7fj7xw34rz3u/";
        ticketBaseURI = "https://biggieyes.mypinata.cloud/ipfs/bafybeigfhirifej6qeqw55f2bxclvzvew5phegalsqzucju4yw5yi3mifu/";
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "No token");
        if (tokenId < BiggiIdHelper.BIGGI_OFFSET) {
            return string.concat(ticketBaseURI, "Biggi_RANDOM_MINT_TICKET.json");
        }
        if (tokenId >= BiggiIdHelper.REWARDS_OFFSET && tokenId < BiggiIdHelper.CHARACTER_OFFSET) {
            string memory rewardFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIdHelper.REWARDS_OFFSET + 101),
                "_REWARDS_RB.json"
            );
            return string.concat(rewardsBaseURI, rewardFile);
        }
        if (tokenId >= BiggiIdHelper.CHARACTER_OFFSET && tokenId < BiggiIdHelper.CHARACTER_OFFSET + 10) {
            string memory charFile = string.concat(
                "Biggi_",
                Strings.toString(tokenId - BiggiIdHelper.CHARACTER_OFFSET + 110),
                "_REWARD_",
                characterNames[uint8(tokenId - BiggiIdHelper.CHARACTER_OFFSET)],
                ".json"
            );
            return string.concat(charactersBaseURI, charFile);
        }
        uint256 idx = BiggiIdHelper.nftIndexFromTokenId(tokenId);
        NFTInfo memory info = nftInfo[idx];
        return BiggiUriHelper.buildNftUri(
            blockBaseURIs[info.blockIdx],
            info.mainId,
            blockNames[info.blockIdx - 1],
            backgroundNames[info.background - 1]
        );
    }

    // --- Mintování vstupenky ---
    // Všechny změny stavu jsou PŘED _safeMint kvůli ochraně před reentrancy.
    function mintTicket() external payable nonReentrant whenNotPaused {
        if (ticketMinted >= MAX_TICKETS) revert SoldOut();
        if (hasTicket[msg.sender]) revert AlreadyMinted();
        if (msg.value < ticketPrice) revert LowPayment();

        uint256 rewardPart = (msg.value * rewardPercent) / 10000;
        uint256 devPart = msg.value - rewardPart;
        rewardsPool += rewardPart;

        (bool sent, ) = DEV_WALLET.call{value: devPart}("");
        if (!sent) revert DevPaymentFailed();

        uint256 ticketId = BiggiIdHelper.TICKET_OFFSET + ticketMinted;
        isTicket[ticketId] = true;
        hasTicket[msg.sender] = true;
        ticketMinted++;

        _safeMint(msg.sender, ticketId);

        ticketPrice = BiggiMath.increaseByPercent(ticketPrice, priceIncreasePerMint);

        emit MintRequested(msg.sender, ticketId);
    }

   function redeemTicketAndMintNFT(uint256 ticketId) external nonReentrant whenNotPaused {
    if (ownerOf(ticketId) != msg.sender) revert NotTicketOwner();
    if (!isTicket[ticketId]) revert NotTicket();
    if (biggiMinted >= MAX_SUPPLY) revert AllNFTsMinted();
    if (pendingMintRequest[msg.sender] != 0) revert AlreadyPending();

    isTicket[ticketId] = false;
    hasTicket[msg.sender] = false;
    _burn(ticketId);

    uint256 requestId = VRFCoordinatorV2PlusInterface(VRF_COORDINATOR).requestRandomWords(
        keyHash,
        s_subscriptionId,
        requestConfirmations,
        callbackGasLimit,
        numWords,
        address(this)
    );

    pendingMinters[requestId] = msg.sender;
    pendingMintRequest[msg.sender] = requestId;

    emit MintRequested(msg.sender, requestId);
}
    }
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    address minter = pendingMinters[requestId];
    if (minter == address(0)) revert NoMinter();

    uint256 index = BiggiIdHelper.randomToMintIndex(randomWords[0], MAX_SUPPLY);
    uint256 attempts;

    while (nftInfo[index].minted && attempts < MAX_SUPPLY) {
        unchecked { index = (index % MAX_SUPPLY) + 1; attempts++; }
    }
    if (nftInfo[index].minted) revert AllNFTsMinted();

    NFTInfo storage info = nftInfo[index];
    info.minted = true;
    biggiMinted++;

    uint256 tokenId = BiggiIdHelper.tokenIdFromNftIndex(index);
    _safeMint(minter, tokenId);

    uint16 bg = info.background;
    uint16 blk = info.blockIdx;
    require(bg >= 1 && bg <= 10, "Bad bg");
    require(blk >= 1 && blk <= 10, "Bad block");

    blockMintCounts[blk - 1]++;
    if (bg == blk) {
        blockInfos[blk - 1].updatePrice();
    }

    emit MintFulfilled(minter, tokenId, index);

    if (!characterClaimed[blk] && _blockMinted(blk) == _totalBlockNFTs(blk)) {
        characterClaimed[blk] = true;
        uint256 charId = BiggiIdHelper.CHARACTER_OFFSET + (blk - 1);
        _safeMint(minter, charId);
        emit CharacterRewardMinted(minter, charId, characterNames[blk - 1], blk);
    }

    delete pendingMinters[requestId];
    delete pendingMintRequest[minter];
}

       

        if (!characterClaimed[blk] && _blockMinted(blk) == _totalBlockNFTs(blk)) {
            characterClaimed[blk] = true;
            uint256 charId = BiggiIdHelper.CHARACTER_OFFSET + (blk - 1);
            _safeMint(minter, charId);
            emit CharacterRewardMinted(minter, charId, characterNames[blk - 1], blk);
        }

        delete pendingMinters[requestId];
        delete pendingMintRequest[minter];
    

    function simulateFulfillRandomWords(uint256 requestId, uint256 randomWord) external onlyOwner {
    uint256[] memory randomWords = new uint256[](1);
    randomWords[0] = randomWord;
    fulfillRandomWords(requestId, randomWords);
}

    // --- Claimování peněžních odměn ---
    function claimOrangeReward() external nonReentrant {
        require(orangeReward > 0, "Reward not set");
        require(orangeWinnersCount < 3, "All claimed");
        if (rewardsState.hasClaimedOrange(msg.sender)) revert AlreadyClaimed();

        rewardsState.claimOrange(msg.sender);
        orangeWinnersCount++;
        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        require(sent, "Transfer failed");

        emit OrangeRewardClaimed(msg.sender, orangeReward);
    }

    function claimBlockReward() external nonReentrant {
        require(blockReward > 0, "Reward not set");
        require(blockWinnersCount < 3, "All claimed");
        if (rewardsState.hasClaimedBlock(msg.sender)) revert AlreadyClaimed();

        rewardsState.claimBlock(msg.sender);
        blockWinnersCount++;
        (bool sent, ) = msg.sender.call{value: blockReward}("");
        require(sent, "Transfer failed");

        emit BlockRewardClaimed(msg.sender, blockReward);
    }

    function claimRainbowReward() external nonReentrant {
        require(rainbowReward > 0, "Reward not set");
        require(!rainbowRewardClaimedGlobal, "Already claimed");
        if (rewardsState.hasClaimedRainbow(msg.sender)) revert AlreadyClaimed();

        rewardsState.claimRainbow(msg.sender);
        rainbowRewardClaimedGlobal = true;
        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        require(sent, "Transfer failed");

        emit RainbowRewardClaimed(msg.sender, rainbowReward);
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
        return blockMintCounts[blk - 1];
    }

    // --- Batch setter ---
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

            NFTInfo storage info = nftInfo[idx];
            require(!info.minted && info.background == 0 && info.blockIdx == 0 && info.mainId == 0, "Set");

            info.background = bgCodes[i];
            info.blockIdx = blockIndices[i];
            info.mainId = mainIds[i];
        }
    }

    // --- Bezpečné vybrání zůstatku ---
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

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable { revert("No direct ETH"); }
}
