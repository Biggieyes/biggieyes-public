// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BiggiRewardsLib2.sol";

// Interface na hlavní kontrakt BiggiEyesLottery (jen potřebné funkce)
interface IBiggiEyesLottery {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenIdFromNftIndex(uint256 idx) external pure returns (uint256);
    function totalBlockNFTs(uint16 blk) external pure returns (uint256);

    function orangeRewardClaimedForMainId(uint16 blockIdx, uint256 mainId) external view returns (bool);
    function blockRewardClaimedForBlock(uint16 blockIdx) external view returns (bool);
    function rainbowRewardClaimedGlobal() external view returns (bool);

    // Pro zápisy (jen rewards kontrakt smí volat)
    function markOrangeClaimed(uint16 blockIdx, uint256 mainId, address user) external;
    function markBlockClaimed(uint16 blockIdx, address user) external;
    function markRainbowClaimed(address user) external;
}

contract BiggiRewards is Ownable, ReentrancyGuard {
    IBiggiEyesLottery public immutable lottery;

    mapping(uint16 => mapping(uint256 => uint8)) public orangeClaims; // blockIdx => mainId => claimCount (max 3)
    mapping(uint16 => uint8) public blockClaims; // blockIdx => claimCount (max 3)
    uint8 public rainbowClaims; // max 1

    event OrangeClaimed(address indexed user, uint16 blockIdx, uint256 mainId, uint8 claimCount);
    event BlockClaimed(address indexed user, uint16 blockIdx, uint8 claimCount);
    event RainbowClaimed(address indexed user);

    constructor(address _lottery, address initialOwner) Ownable(initialOwner) {
        require(_lottery != address(0), "Lottery address cannot be zero");
        lottery = IBiggiEyesLottery(_lottery);
    }

    // --- ORANGE CLAIM ---
    function claimOrange(uint16 blockIdx, uint256 mainId) external nonReentrant {
        require(blockIdx == 1, "Only ORANGE block");
        require(orangeClaims[blockIdx][mainId] < 3, "Already claimed max 3x");
        require(!lottery.orangeRewardClaimedForMainId(blockIdx, mainId), "Already marked claimed in main contract");

        // Připravíme indexy a zkontrolujeme eligibility
        uint256[10] memory tokenIds;
        for (uint16 bg = 1; bg <= 10; bg++) {
            uint256 idx = (blockIdx - 1) * 100 + (mainId - 1) * 10 + (bg - 1) + 1;
            tokenIds[bg - 1] = lottery.tokenIdFromNftIndex(idx);
        }
        require(
            BiggiRewardsLib2.isOrangeEligible(
                msg.sender,
                tokenIds,
                lottery.exists,
                lottery.ownerOf
            ),
            "Not eligible"
        );

        orangeClaims[blockIdx][mainId]++;
        lottery.markOrangeClaimed(blockIdx, mainId, msg.sender);

        emit OrangeClaimed(msg.sender, blockIdx, mainId, orangeClaims[blockIdx][mainId]);
    }

    // --- BLOCK CLAIM ---
    function claimBlock(uint16 blockIdx) external nonReentrant {
        require(blockIdx >= 1 && blockIdx <= 9, "BlockIdx 1-9 only (not RAINBOW)");
        require(blockClaims[blockIdx] < 3, "Already claimed max 3x");
        require(!lottery.blockRewardClaimedForBlock(blockIdx), "Already marked claimed in main contract");

        uint256 mainCount = lottery.totalBlockNFTs(blockIdx);
        uint256[] memory tokenIds = new uint256[](mainCount);

        for (uint256 mainId = 1; mainId <= mainCount; mainId++) {
            uint256 idx = (blockIdx - 1) * 100 + (mainId - 1) * 10 + (1 - 1) + 1;
            tokenIds[mainId - 1] = lottery.tokenIdFromNftIndex(idx);
        }
        require(
            BiggiRewardsLib2.isBlockEligible(
                msg.sender,
                tokenIds,
                lottery.exists,
                lottery.ownerOf
            ),
            "Not eligible"
        );

        blockClaims[blockIdx]++;
        lottery.markBlockClaimed(blockIdx, msg.sender);

        emit BlockClaimed(msg.sender, blockIdx, blockClaims[blockIdx]);
    }

    // --- RAINBOW CLAIM ---
    function claimRainbow() external nonReentrant {
        require(rainbowClaims < 1, "Rainbow already claimed");
        require(!lottery.rainbowRewardClaimedGlobal(), "Already marked claimed in main contract");

        uint256 mainCount = lottery.totalBlockNFTs(10);
        uint256[] memory tokenIds = new uint256[](mainCount);

        for (uint256 mainId = 1; mainId <= mainCount; mainId++) {
            uint256 idx = (10 - 1) * 100 + (mainId - 1) * 10 + (1 - 1) + 1;
            tokenIds[mainId - 1] = lottery.tokenIdFromNftIndex(idx);
        }
        require(
            BiggiRewardsLib2.isRainbowEligible(
                msg.sender,
                tokenIds,
                lottery.exists,
                lottery.ownerOf
            ),
            "Not eligible"
        );

        rainbowClaims = 1;
        lottery.markRainbowClaimed(msg.sender);

        emit RainbowClaimed(msg.sender);
    }

    // --- Helpery pro frontend (čtení stavu) ---
    function orangeClaimsOf(uint16 blockIdx, uint256 mainId) external view returns (uint8) {
        return orangeClaims[blockIdx][mainId];
    }

    function blockClaimsOf(uint16 blockIdx) external view returns (uint8) {
        return blockClaims[blockIdx];
    }

    function rainbowClaimsCount() external view returns (uint8) {
        return rainbowClaims;
    }
}
