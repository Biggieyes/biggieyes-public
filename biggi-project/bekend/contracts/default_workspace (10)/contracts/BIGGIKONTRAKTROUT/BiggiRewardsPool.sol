// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiEyesMainView {
    function exists(uint256 tokenId) external view returns (bool);
    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool);
    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool);
}

contract BiggiRewardsPool {
    error NotEnoughBalance();
    error AlreadyClaimed();
    error InvalidIndex();
    error DevPaymentFailed();
    error OnlyOwner();

    address public owner;
    IBiggiEyesMainView public main;

    uint256 public orangeReward  = 0.005 ether;
    uint256 public blockReward   = 0.01 ether;
    uint256 public rainbowReward = 0.02 ether;

    uint8  public orangeWinnersCount;
    uint8  public blockWinnersCount;
    bool   public rainbowRewardClaimedGlobal;

    mapping(address => bool) public claimedOrange;
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock;
    mapping(uint256 => bool) public orangeMainIdPaid;
    mapping(uint16 => bool)  public blockPaid;

    event OrangeRewardClaimed(address indexed user, uint256 amount);
    event BlockRewardClaimed(address indexed user, uint256 amount);
    event RainbowRewardClaimed(address indexed user, uint256 amount);

    modifier onlyOwner() { if (msg.sender != owner) revert OnlyOwner(); _; }

    constructor(address main_) { owner = msg.sender; main = IBiggiEyesMainView(main_); }
    function setOwner(address newOwner) external onlyOwner { owner = newOwner; }
    function setMain(address main_) external onlyOwner { main = IBiggiEyesMainView(main_); }

    function setRewards(uint256 orange, uint256 blockAmt, uint256 rainbow) external onlyOwner {
        orangeReward = orange; blockReward = blockAmt; rainbowReward = rainbow;
    }

    /* ===== Claim funkce (platí se z balance tohoto kontraktu) ===== */
    function claimOrangeReward(uint256 mainId) external {
        if (orangeReward == 0) revert InvalidIndex();
        if (orangeWinnersCount >= 3) revert AlreadyClaimed();
        if (mainId < 1 || mainId > 10) revert InvalidIndex();
        if (claimedOrange[msg.sender]) revert AlreadyClaimed();
        if (orangeMainIdPaid[mainId]) revert AlreadyClaimed();

        uint16 ORANGE_BLK = 1;
        bool ok = main.hasAllBackgroundsForMainIdInBlock(msg.sender, ORANGE_BLK, mainId);
        if (!ok) revert InvalidIndex();

        if (address(this).balance < orangeReward) revert NotEnoughBalance();
        claimedOrange[msg.sender] = true;
        orangeMainIdPaid[mainId] = true;
        unchecked { orangeWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        if (!sent) revert DevPaymentFailed();
        emit OrangeRewardClaimed(msg.sender, orangeReward);
    }

    function claimBlockReward(uint16 blockIdx) external {
        if (blockReward == 0) revert InvalidIndex();
        if (blockWinnersCount >= 3) revert AlreadyClaimed();
        if (blockIdx < 1 || blockIdx > 9) revert InvalidIndex();
        if (blockPaid[blockIdx]) revert AlreadyClaimed();
        if (userClaimedBlock[msg.sender][blockIdx]) revert AlreadyClaimed();

        bool ok = main.hasAllTenMainIdsInBlock(msg.sender, blockIdx);
        if (!ok) revert InvalidIndex();

        if (address(this).balance < blockReward) revert NotEnoughBalance();
        blockPaid[blockIdx] = true;
        userClaimedBlock[msg.sender][blockIdx] = true;
        unchecked { blockWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: blockReward}("");
        if (!sent) revert DevPaymentFailed();
        emit BlockRewardClaimed(msg.sender, blockReward);
    }

    function claimRainbowReward() external {
        if (rainbowReward == 0) revert InvalidIndex();
        if (rainbowRewardClaimedGlobal) revert AlreadyClaimed();

        uint16 RAINBOW_BLK = 10;
        bool ok = main.hasAllTenMainIdsInBlock(msg.sender, RAINBOW_BLK);
        if (!ok) revert InvalidIndex();

        if (address(this).balance < rainbowReward) revert NotEnoughBalance();
        rainbowRewardClaimedGlobal = true;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        if (!sent) revert DevPaymentFailed();
        emit RainbowRewardClaimed(msg.sender, rainbowReward);
    }

    /* ===== Příjem 22% z mintu ===== */
    function receiveMintShare() external payable { /* přijímá ETH */ }

    receive() external payable {}
}
