// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./BiggiPriceLibrary.sol";

contract BiggiEyesNFTLottery is ERC721Enumerable, Ownable2Step, ReentrancyGuard {
    using BiggiPriceLibrary for BiggiPriceLibrary.BlockInfo;
    
    struct NFTDataStructure {
        bool isMinted;
        uint8 backgroundType;
        uint8 blockTypeIndex;
        uint256 mainIdentifier;
    }

    struct UserRewardStatus {
        bool hasClaimedOrangeReward;
        bool hasClaimedBlockReward;
    }

    uint256 public constant MAXIMUM_NUMBER_OF_TICKETS = 550;
    uint256 public constant MAXIMUM_NUMBER_OF_NFTS = 550;
    uint256 public constant TICKET_ID_OFFSET = 1;
    uint256 public constant BIGGI_NFT_OFFSET = 1001;
    uint256 public constant CHARACTER_NFT_OFFSET = 2001;
    uint256 public constant REWARD_NFT_OFFSET = 3001;
    uint256 public constant MAXIMUM_BATCH_UPLOAD_SIZE = 55;
    address public constant DEVELOPMENT_TEAM_WALLET = 0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0;

    uint256 public totalTicketsMinted;
    uint256 public totalNFTsMinted;
    uint256 public currentTicketPriceInWei = 0.001 ether;
    uint256 public priceIncreasePercentagePerMint = 1;
    uint256 public totalRewardsPoolInWei;
    uint256 public rewardDistributionPercentage = 100;
    uint256 public orangeRewardAmountInWei = 0.005 ether;
    uint256 public blockRewardAmountInWei = 0.01 ether;
    uint256 public rainbowRewardAmountInWei = 0.02 ether;
    uint8 public numberOfOrangeRewardWinners;
    uint8 public numberOfBlockRewardWinners;
    bool public isRainbowRewardClaimed;

    mapping(address => bool) public addressToTicketOwnershipMapping;
    mapping(uint256 => bool) public tokenIdToTicketStatusMapping;
    mapping(uint256 => NFTDataStructure) public indexToNFTDataMapping;
    mapping(address => UserRewardStatus) public addressToUserRewardStatusMapping;
    mapping(uint8 => bool) public blockIndexToCharacterRewardClaimStatus;
    
    uint16[10] public blockMintCountersArray;
    BiggiPriceLibrary.BlockInfo[10] public blockInfoArray;

    string[10] public blockNamesArray = [
        "ORANGE", "BLACK", "WHITE", "BROWN", "BLUE",
        "GREEN", "VIOLET", "RED", "PINK", "RAINBOW"
    ];

    string[10] public backgroundNamesArray = [
        "ORANGE", "BLACK", "WHITE", "BROWN", "BLUE",
        "GREEN", "VIOLET", "RED", "PINK", "RAINBOW"
    ];

    string[10] public characterNamesArray = [
        "Cosmonaut", "Snowman", "Bugs", "Pig", "Mickey",
        "Santa", "Woody", "Buzz", "Bart", "Homer"
    ];

    mapping(uint8 => string) public blockIndexToBaseURIMapping;
    string public rewardNFTsBaseURI = "ipfs://bafybeies6v7rpoufrz2xzbpi3kd6veylfz3w44xtesi5p6ajcvayxnrzua/";
    string public characterNFTsBaseURI = "ipfs://bafybeiheno3gljkloqwzircv2jm7bela4hezhefv35rvrrpv2xskdgccxa/";
    string public ticketNFTsBaseURI = "ipfs://bafybeibbuxkqj74o3wou22ti4cjupiecdojylc5yyjrxcj3c2fto3m7lpa/";
    string private baseTokenURI = "ipfs://biggieyes.mypinata.cloud/";

    event TicketMintRequested(address indexed userAddress, uint256 ticketId);
    event NFTMintCompleted(address indexed userAddress, uint256 tokenId, uint256 nftIndex);
    event CharacterRewardMinted(address indexed recipient, uint256 characterTokenId, string characterName, uint8 blockIndex);
    event OrangeRewardClaimed(address indexed winner, uint256 mainId, uint256 amount);
    event BlockRewardClaimed(address indexed winner, uint8 blockIndex, uint256 amount);
    event RainbowRewardClaimed(address indexed winner, uint256 amount);
    event RemainingBalanceWithdrawn(address indexed owner, uint256 amount);
    event BlockBaseURIUpdated(uint8 indexed blockIndex, string newBaseURI);
    event RewardBaseURIUpdated(string newBaseURI);
    event CharacterBaseURIUpdated(string newBaseURI);
    event TicketBaseURIUpdated(string newBaseURI);
    event BaseTokenURIUpdated(string newBaseURI);
    event BlockPricesUpdated(uint256[10] newPrices);
    event PriceIncreaseUpdated(uint256[10] newIncreaseFactors);
    event RewardAmountsUpdated(uint256 orangeReward, uint256 blockReward, uint256 rainbowReward);
    event RewardPercentageUpdated(uint256 newPercentage);

    constructor(address initialContractOwner) 
        ERC721("BiggiEyesNFTLottery", "BIGG") 
        Ownable(initialContractOwner) 
    {
        // OPRAVENO: Explicitní přetypování na uint256
        uint256[10] memory initialPrices = [
            uint256(0.01 ether), 
            uint256(0.02 ether), 
            uint256(0.03 ether), 
            uint256(0.04 ether), 
            uint256(0.05 ether),
            uint256(0.06 ether), 
            uint256(0.07 ether), 
            uint256(0.08 ether), 
            uint256(0.09 ether), 
            uint256(0.1 ether)
        ];
        
        // OPRAVENO: Explicitní přetypování na uint256
        uint256[10] memory initialIncreaseFactors = [
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000),
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000), 
            uint256(10010000)
        ];

        for (uint8 i = 0; i < 10; i++) {
            blockInfoArray[i] = BiggiPriceLibrary.BlockInfo({
                basePrice: initialPrices[i],
                priceIncrease: initialIncreaseFactors[i],
                currentPrice: initialPrices[i],
                mintCount: 0
            });
        }

        blockIndexToBaseURIMapping[0] = "ipfs://bafybeieqwsc642s5bv2uoyg6fov4zg3s425x67zb3pf6img6bbam5pzeda/";
        blockIndexToBaseURIMapping[1] = "ipfs://bafybeiexwu2aiocaw4jh4yihywdkabbp2u7v2vf7wydhqcgehcispvjhfy/";
        blockIndexToBaseURIMapping[2] = "ipfs://bafybeicqja4j6wmdm2jbomtloggwafe4kluokgp5qhdr2pkrgxju6tpyl4/";
        blockIndexToBaseURIMapping[3] = "ipfs://bafybeibbqjofkkvldzfmmi5tfzucrmbd56ba3i5pfivywqb7g25wa7677m/";
        blockIndexToBaseURIMapping[4] = "ipfs://bafybeieuk5o3mktitbutdzyymacz27me5zntkybk3zhndjvsfuqa6osj4m/";
        blockIndexToBaseURIMapping[5] = "ipfs://bafybeihgbvpuomieigi3eenho6fzbbtwpvw7lfqbpbriojenvutufn6opa/";
        blockIndexToBaseURIMapping[6] = "ipfs://bafybeibs3xyn3wdsssxubow5wqh4vyg4dkumshqza6ppssiqqrbo4chq3a/";
        blockIndexToBaseURIMapping[7] = "ipfs://bafybeifuhvp33jihz2xzr45vwme2drg7uxe5sukabttx4eqqupdbfmmebi/";
        blockIndexToBaseURIMapping[8] = "ipfs://bafybeihkz72p25huca3b463o7q7yp4xnv2l4lejyzckodolqij6m5ofw2a/";
        blockIndexToBaseURIMapping[9] = "ipfs://bafybeibvroqt2og7x26t3qe3mdwbiua53kjjpgzjdhmhxubhsmy7hrm7y4/";
    }

    // === ADMINISTRATIVNÍ FUNKCE ===

    function setTicketPrice(uint256 newPrice) external onlyOwner {
        currentTicketPriceInWei = newPrice;
    }

    function setPriceIncreasePerMint(uint256 newIncrease) external onlyOwner {
        priceIncreasePercentagePerMint = newIncrease;
    }

    function setNFTData(
        uint256 index,
        uint8 backgroundType,
        uint8 blockTypeIndex,
        uint256 mainIdentifier
    ) external onlyOwner {
        require(index >= 1 && index <= MAXIMUM_NUMBER_OF_NFTS, "Index out of range");
        NFTDataStructure storage nftData = indexToNFTDataMapping[index];
        nftData.backgroundType = backgroundType;
        nftData.blockTypeIndex = blockTypeIndex;
        nftData.mainIdentifier = mainIdentifier;
    }

    function setBaseTokenURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
        emit BaseTokenURIUpdated(newBaseURI);
    }

    function setBlockBaseURI(uint8 blockIndex, string calldata newBaseURI) external onlyOwner {
        require(blockIndex < 10, "Invalid block index");
        blockIndexToBaseURIMapping[blockIndex] = newBaseURI;
        emit BlockBaseURIUpdated(blockIndex, newBaseURI);
    }

    function setRewardBaseURI(string calldata newBaseURI) external onlyOwner {
        rewardNFTsBaseURI = newBaseURI;
        emit RewardBaseURIUpdated(newBaseURI);
    }

    function setCharacterBaseURI(string calldata newBaseURI) external onlyOwner {
        characterNFTsBaseURI = newBaseURI;
        emit CharacterBaseURIUpdated(newBaseURI);
    }

    function setTicketBaseURI(string calldata newBaseURI) external onlyOwner {
        ticketNFTsBaseURI = newBaseURI;
        emit TicketBaseURIUpdated(newBaseURI);
    }

    function setBlockBasePrices(uint256[10] calldata newPrices) external onlyOwner {
        for (uint8 i = 0; i < 10; ++i) {
            blockInfoArray[i].basePrice = newPrices[i];
            blockInfoArray[i].currentPrice = newPrices[i];
        }
        emit BlockPricesUpdated(newPrices);
    }

    function setBlockPriceIncreaseFactors(uint256[10] calldata newIncreaseFactors) external onlyOwner {
        for (uint8 i = 0; i < 10; ++i) {
            blockInfoArray[i].priceIncrease = newIncreaseFactors[i];
        }
        emit PriceIncreaseUpdated(newIncreaseFactors);
    }

    function setRewardDistributionPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 10000, "Percentage too high");
        rewardDistributionPercentage = newPercentage;
        emit RewardPercentageUpdated(newPercentage);
    }

    function setRewardAmounts(
        uint256 newOrangeReward,
        uint256 newBlockReward,
        uint256 newRainbowReward
    ) external onlyOwner {
        orangeRewardAmountInWei = newOrangeReward;
        blockRewardAmountInWei = newBlockReward;
        rainbowRewardAmountInWei = newRainbowReward;
        emit RewardAmountsUpdated(newOrangeReward, newBlockReward, newRainbowReward);
    }

    // === HLAVNÍ FUNKCE ===

    function purchaseTicket() external payable nonReentrant {
        require(totalTicketsMinted < MAXIMUM_NUMBER_OF_TICKETS, "Maximum tickets minted");
        require(!addressToTicketOwnershipMapping[msg.sender], "Already owns ticket");
        require(msg.value >= currentTicketPriceInWei, "Insufficient payment");

        uint256 rewardAllocation = (msg.value * rewardDistributionPercentage) / 10000;
        uint256 developmentAllocation = msg.value - rewardAllocation;
        totalRewardsPoolInWei += rewardAllocation;

        (bool transferSuccess, ) = DEVELOPMENT_TEAM_WALLET.call{value: developmentAllocation}("");
        require(transferSuccess, "Dev transfer failed");

        uint256 newTicketId = TICKET_ID_OFFSET + totalTicketsMinted;
        tokenIdToTicketStatusMapping[newTicketId] = true;
        addressToTicketOwnershipMapping[msg.sender] = true;
        totalTicketsMinted++;

        _safeMint(msg.sender, newTicketId);
        currentTicketPriceInWei = (currentTicketPriceInWei * (10000 + priceIncreasePercentagePerMint)) / 10000;
        emit TicketMintRequested(msg.sender, newTicketId);
    }

    function redeemTicketForNFT(uint256 ticketId) external nonReentrant {
        require(ownerOf(ticketId) == msg.sender, "Not ticket owner");
        require(tokenIdToTicketStatusMapping[ticketId], "Invalid ticket");
        require(totalNFTsMinted < MAXIMUM_NUMBER_OF_NFTS, "All NFTs minted");

        uint256 selectedIndex = _generateRandomNFTIndex(msg.sender, ticketId);
        
        tokenIdToTicketStatusMapping[ticketId] = false;
        addressToTicketOwnershipMapping[msg.sender] = false;
        _burn(ticketId);

        NFTDataStructure storage nftData = indexToNFTDataMapping[selectedIndex];
        require(!nftData.isMinted, "NFT already minted");
        nftData.isMinted = true;
        totalNFTsMinted++;

        uint256 newTokenId = BIGGI_NFT_OFFSET + totalNFTsMinted - 1;
        _safeMint(msg.sender, newTokenId);

        uint8 backgroundCategory = nftData.backgroundType;
        uint8 blockCategory = nftData.blockTypeIndex;
        blockMintCountersArray[blockCategory - 1]++;

        if (backgroundCategory == blockCategory) {
            blockInfoArray[blockCategory - 1].updatePrice();
        }

        emit NFTMintCompleted(msg.sender, newTokenId, selectedIndex);

        uint256 totalNFTsInCategory = getTotalNFTsForBlockCategory(blockCategory);
        if (!blockIndexToCharacterRewardClaimStatus[blockCategory] && getMintedNFTsForBlockCategory(blockCategory) == totalNFTsInCategory) {
            blockIndexToCharacterRewardClaimStatus[blockCategory] = true;
            uint256 characterTokenId = CHARACTER_NFT_OFFSET + (blockCategory - 1);
            _safeMint(msg.sender, characterTokenId);
            emit CharacterRewardMinted(msg.sender, characterTokenId, characterNamesArray[blockCategory - 1], blockCategory);
        }
    }

    // === POMOCNÉ FUNKCE ===

    function _generateRandomNFTIndex(address userAddress, uint256 ticketId) private view returns (uint256) {
        uint256 pseudoRandomValue = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1),
                    userAddress,
                    ticketId,
                    totalNFTsMinted
                )
            )
        );
        uint256 selectedIndex = (pseudoRandomValue % MAXIMUM_NUMBER_OF_NFTS) + 1;
        
        uint256 searchCounter = 0;
        while (indexToNFTDataMapping[selectedIndex].isMinted && searchCounter < MAXIMUM_NUMBER_OF_NFTS) {
            selectedIndex = (selectedIndex % MAXIMUM_NUMBER_OF_NFTS) + 1;
            searchCounter++;
        }
        require(!indexToNFTDataMapping[selectedIndex].isMinted, "No NFTs available");
        return selectedIndex;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721Metadata: URI query for nonexistent token");

        if (tokenId < BIGGI_NFT_OFFSET) {
            return string(abi.encodePacked(ticketNFTsBaseURI, "Biggi_RANDOM_MINT_TICKET.json"));
        }
        if (tokenId >= REWARD_NFT_OFFSET && tokenId < CHARACTER_NFT_OFFSET) {
            string memory rewardFileName = string(
                abi.encodePacked("Biggi_", Strings.toString(tokenId - REWARD_NFT_OFFSET + 101), "_REWARDS_RB.json")
            );
            return string(abi.encodePacked(rewardNFTsBaseURI, rewardFileName));
        }
        if (tokenId >= CHARACTER_NFT_OFFSET) {
            uint8 characterIndex = uint8(tokenId - CHARACTER_NFT_OFFSET);
            string memory characterFileName = string(
                abi.encodePacked(
                    "Biggi_",
                    Strings.toString(uint256(characterIndex) + 110),
                    "_REWARD_",
                    characterNamesArray[characterIndex],
                    ".json"
                )
            );
            return string(abi.encodePacked(characterNFTsBaseURI, characterFileName));
        }
        
        uint256 nftIndex = tokenId - BIGGI_NFT_OFFSET + 1;
        NFTDataStructure storage nftData = indexToNFTDataMapping[nftIndex];
        string memory fileName = string(
            abi.encodePacked(
                "Biggi_",
                Strings.toString(nftData.mainIdentifier),
                "_",
                blockNamesArray[nftData.blockTypeIndex - 1],
                "_",
                backgroundNamesArray[nftData.backgroundType - 1],
                ".json"
            )
        );
        return string(abi.encodePacked(blockIndexToBaseURIMapping[nftData.blockTypeIndex - 1], fileName));
    }

    function batchConfigureNFTs(
        uint256[] calldata nftIndices,
        uint8[] calldata backgroundTypes,
        uint8[] calldata blockIndices,
        uint256[] calldata mainIdentifiers
    ) external onlyOwner {
        require(nftIndices.length <= MAXIMUM_BATCH_UPLOAD_SIZE, "Batch too large");
        require(nftIndices.length == backgroundTypes.length, "Backgrounds length mismatch");
        require(nftIndices.length == blockIndices.length, "Blocks length mismatch");
        require(nftIndices.length == mainIdentifiers.length, "IDs length mismatch");
        
        for (uint256 i = 0; i < nftIndices.length; ++i) {
            uint256 currentIndex = nftIndices[i];
            require(currentIndex >= 1 && currentIndex <= MAXIMUM_NUMBER_OF_NFTS, "Index out of range");
            
            NFTDataStructure storage nftData = indexToNFTDataMapping[currentIndex];
            require(!nftData.isMinted, "NFT already minted");
            
            nftData.backgroundType = backgroundTypes[i];
            nftData.blockTypeIndex = blockIndices[i];
            nftData.mainIdentifier = mainIdentifiers[i];
        }
    }

    function getCurrentPriceForBlockType(uint8 blockIndex) public view returns (uint256) {
        require(blockIndex >= 1 && blockIndex <= 10, "Invalid block");
        return blockInfoArray[blockIndex - 1].getCurrentPrice();
    }

    function getTotalNFTsForBlockCategory(uint8 blockIndex) public pure returns (uint256) {
        require(blockIndex >= 1 && blockIndex <= 10, "Invalid block");
        return [100, 90, 80, 70, 60, 50, 40, 30, 20, 10][blockIndex - 1];
    }

    function getMintedNFTsForBlockCategory(uint8 blockIndex) public view returns (uint256) {
        require(blockIndex >= 1 && blockIndex <= 10, "Invalid block");
        return blockMintCountersArray[blockIndex - 1];
    }

    function withdrawRemainingFunds() external onlyOwner nonReentrant {
        require(totalNFTsMinted == MAXIMUM_NUMBER_OF_NFTS, "Minting incomplete");
        uint256 reservedFunds = (orangeRewardAmountInWei * (3 - numberOfOrangeRewardWinners)) +
                              (blockRewardAmountInWei * (3 - numberOfBlockRewardWinners)) +
                              (rainbowRewardAmountInWei * (isRainbowRewardClaimed ? 0 : 1));
        uint256 withdrawableAmount = address(this).balance - reservedFunds;
        Address.sendValue(payable(owner()), withdrawableAmount);
        emit RemainingBalanceWithdrawn(owner(), withdrawableAmount);
    }

    // === REWARD FUNKCE ===

    function claimOrangeReward(uint256 mainId) external nonReentrant {
        require(numberOfOrangeRewardWinners < 3, "All orange rewards claimed");
        require(!addressToUserRewardStatusMapping[msg.sender].hasClaimedOrangeReward, "Already claimed");
        
        uint256 rewardAmount = orangeRewardAmountInWei;
        require(totalRewardsPoolInWei >= rewardAmount, "Insufficient rewards pool");
        
        totalRewardsPoolInWei -= rewardAmount;
        addressToUserRewardStatusMapping[msg.sender].hasClaimedOrangeReward = true;
        numberOfOrangeRewardWinners++;
        
        (bool success, ) = msg.sender.call{value: rewardAmount}("");
        require(success, "Transfer failed");
        
        emit OrangeRewardClaimed(msg.sender, mainId, rewardAmount);
    }

    function claimBlockReward(uint8 blockIndex) external nonReentrant {
        require(blockIndex >= 1 && blockIndex <= 10, "Invalid block");
        require(numberOfBlockRewardWinners < 3, "All block rewards claimed");
        require(!addressToUserRewardStatusMapping[msg.sender].hasClaimedBlockReward, "Already claimed");
        
        uint256 rewardAmount = blockRewardAmountInWei;
        require(totalRewardsPoolInWei >= rewardAmount, "Insufficient rewards pool");
        
        totalRewardsPoolInWei -= rewardAmount;
        addressToUserRewardStatusMapping[msg.sender].hasClaimedBlockReward = true;
        numberOfBlockRewardWinners++;
        
        (bool success, ) = msg.sender.call{value: rewardAmount}("");
        require(success, "Transfer failed");
        
        emit BlockRewardClaimed(msg.sender, blockIndex, rewardAmount);
    }

    function claimRainbowReward() external nonReentrant {
        require(!isRainbowRewardClaimed, "Rainbow reward already claimed");
        
        uint256 rewardAmount = rainbowRewardAmountInWei;
        require(totalRewardsPoolInWei >= rewardAmount, "Insufficient rewards pool");
        
        totalRewardsPoolInWei -= rewardAmount;
        isRainbowRewardClaimed = true;
        
        (bool success, ) = msg.sender.call{value: rewardAmount}("");
        require(success, "Transfer failed");
        
        emit RainbowRewardClaimed(msg.sender, rewardAmount);
    }

    // === ROZŠÍŘENÉ FUNKCE ===

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {
        revert("Direct payments not accepted");
    }
}