// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/* Minimální pohled do hlavního kontraktu kolekce */
interface IBiggiEyesMainView {
    function exists(uint256 tokenId) external view returns (bool);

    // true pokud owner vlastní všech 10 mainId v daném bloku
    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool);

    // true pokud owner vlastní všechny background varianty pro konkrétní mainId v daném bloku
    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool);
}

/* =============================================================================
 * BiggiCollectionRewards — pool v nativní měně pro odměny v rámci kolekce.
 * Distributor posílá část mintu do tohoto kontraktu.
 * =============================================================================*/
contract BiggiCollectionRewards is ReentrancyGuard {
    error NotEnoughBalance();
    error AlreadyClaimed();
    error InvalidIndex();
    error PaymentFailed();
    error OnlyOwner();
    error ZeroAddress();
    error NotDistributor();
    error AmountZero();
    error NotEligible();

    address public owner;
    IBiggiEyesMainView public main;

    address public distributor;

    // Částky (v wei, 1 ether == 1 POL dle chainu)
    uint256 public orangeReward  = 1000 ether;   // max 10x (mainId 1..10)
    uint256 public blockReward   = 3000 ether;   // max 9x (bloky 1..9)
    uint256 public rainbowReward = 10000 ether;  // globálně jednou

    // counters / limits
    uint8 public orangeWinnersCount; // max 10
    uint8 public blockWinnersCount;  // max 9
    bool  public rainbowRewardClaimedGlobal;

    // Tracking
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock; // user -> blockIdx -> claimed
    mapping(uint256 => bool) public orangeMainIdPaid; // mainId (1..10) -> už jednou vyplaceno
    mapping(uint16 => bool)  public blockPaid;        // blockIdx -> už jednou vyplaceno

    event OrangeRewardClaimed(address indexed user, uint256 mainId, uint256 amount);
    event BlockRewardClaimed(address indexed user, uint16 blockIdx, uint256 amount);
    event RainbowRewardClaimed(address indexed user, uint256 amount);

    event DistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event MintShareFromDistributor(uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address main_) {
        owner = msg.sender;
        if (main_ == address(0)) revert ZeroAddress();
        main = IBiggiEyesMainView(main_);
    }

    /* ===== admin ===== */
    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function setMain(address main_) external onlyOwner {
        if (main_ == address(0)) revert ZeroAddress();
        main = IBiggiEyesMainView(main_);
    }

    function setDistributor(address d) external onlyOwner {
        if (d == address(0)) revert ZeroAddress();
        emit DistributorSet(distributor, d);
        distributor = d;
    }

    function setRewardsAmounts(uint256 orange, uint256 blockAmt, uint256 rainbow) external onlyOwner {
        orangeReward = orange;
        blockReward = blockAmt;
        rainbowReward = rainbow;
    }

    /* ===== Claimy ===== */

    /// Orange reward:
    /// - Orange blok je blk=1
    /// - Uživatel musí vlastnit všechny background varianty pro dané mainId v oranžovém bloku
    /// - Každé mainId (1..10) může být odměněno jen jednou (orangeMainIdPaid)
    /// - Maximálně 10 výher celkem
    function claimOrangeReward(uint256 mainId) external nonReentrant {
        if (orangeReward == 0) revert InvalidIndex();
        if (orangeWinnersCount >= 10) revert AlreadyClaimed();
        if (mainId < 1 || mainId > 10) revert InvalidIndex();
        if (orangeMainIdPaid[mainId]) revert AlreadyClaimed();

        uint16 ORANGE_BLK = 1;

        bool ok = main.hasAllBackgroundsForMainIdInBlock(msg.sender, ORANGE_BLK, mainId);
        if (!ok) revert NotEligible();

        if (address(this).balance < orangeReward) revert NotEnoughBalance();

        orangeMainIdPaid[mainId] = true;
        unchecked { orangeWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        if (!sent) revert PaymentFailed();

        emit OrangeRewardClaimed(msg.sender, mainId, orangeReward);
    }

    /// Block reward:
    /// - Bloky 1..9, pro každý blok pouze jednou globálně (blockPaid)
    /// - Uživateli bude vyplaceno pokud vlastní všech 10 mainId v daném bloku
    function claimBlockReward(uint16 blockIdx) external nonReentrant {
        if (blockReward == 0) revert InvalidIndex();
        if (blockWinnersCount >= 9) revert AlreadyClaimed();
        if (blockIdx < 1 || blockIdx > 9) revert InvalidIndex();
        if (blockPaid[blockIdx]) revert AlreadyClaimed();
        if (userClaimedBlock[msg.sender][blockIdx]) revert AlreadyClaimed();

        bool ok = main.hasAllTenMainIdsInBlock(msg.sender, blockIdx);
        if (!ok) revert NotEligible();

        if (address(this).balance < blockReward) revert NotEnoughBalance();

        blockPaid[blockIdx] = true;
        userClaimedBlock[msg.sender][blockIdx] = true;
        unchecked { blockWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: blockReward}("");
        if (!sent) revert PaymentFailed();

        emit BlockRewardClaimed(msg.sender, blockIdx, blockReward);
    }

    /// Rainbow reward:
    /// - globálně jednou
    /// - vyžaduje vlastnit všech 10 mainId v bloku 10
    function claimRainbowReward() external nonReentrant {
        if (rainbowReward == 0) revert InvalidIndex();
        if (rainbowRewardClaimedGlobal) revert AlreadyClaimed();

        uint16 RAINBOW_BLK = 10;
        bool ok = main.hasAllTenMainIdsInBlock(msg.sender, RAINBOW_BLK);
        if (!ok) revert NotEligible();

        if (address(this).balance < rainbowReward) revert NotEnoughBalance();

        rainbowRewardClaimedGlobal = true;

        (bool sent, ) = msg.sender.call{value: rainbowReward}("");
        if (!sent) revert PaymentFailed();

        emit RainbowRewardClaimed(msg.sender, rainbowReward);
    }

    /* ===== Funding z Distributoru ===== */

    /// Distributor posílá native (POL) do kontraktu.
    function depositMintShareFromDistributor() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        emit MintShareFromDistributor(msg.value);
    }

    /* Backward kompatibilita: starší jméno funkce */
    function receiveMintShare() external payable nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        emit MintShareFromDistributor(msg.value);
    }

    receive() external payable {}

    /* ===== FE helpers (views) ===== */

    function canClaimOrange(address user, uint256 mainId) external view returns (bool ok, uint8 reason) {
        // reason:
        // 0=OK, 1=rewardOff, 2=limitReached, 3=badMainId, 4=alreadyPaidMainId, 5=notEligible, 6=insufficientBalance
        if (orangeReward == 0) return (false, 1);
        if (orangeWinnersCount >= 10) return (false, 2);
        if (mainId < 1 || mainId > 10) return (false, 3);
        if (orangeMainIdPaid[mainId]) return (false, 4);

        bool eligible = main.hasAllBackgroundsForMainIdInBlock(user, 1, mainId);
        if (!eligible) return (false, 5);

        if (address(this).balance < orangeReward) return (false, 6);
        return (true, 0);
    }

    function canClaimBlock(address user, uint16 blockIdx) external view returns (bool ok, uint8 reason) {
        // reason:
        // 0=OK, 1=rewardOff, 2=limitReached, 3=badBlock, 4=blockPaid, 5=userClaimed, 6=notEligible, 7=insufficientBalance
        if (blockReward == 0) return (false, 1);
        if (blockWinnersCount >= 9) return (false, 2);
        if (blockIdx < 1 || blockIdx > 9) return (false, 3);
        if (blockPaid[blockIdx]) return (false, 4);
        if (userClaimedBlock[user][blockIdx]) return (false, 5);

        bool eligible = main.hasAllTenMainIdsInBlock(user, blockIdx);
        if (!eligible) return (false, 6);

        if (address(this).balance < blockReward) return (false, 7);
        return (true, 0);
    }

    function canClaimRainbow(address user) external view returns (bool ok, uint8 reason) {
        // reason:
        // 0=OK, 1=rewardOff, 2=alreadyClaimedGlobal, 3=notEligible, 4=insufficientBalance
        if (rainbowReward == 0) return (false, 1);
        if (rainbowRewardClaimedGlobal) return (false, 2);

        bool eligible = main.hasAllTenMainIdsInBlock(user, 10);
        if (!eligible) return (false, 3);

        if (address(this).balance < rainbowReward) return (false, 4);
        return (true, 0);
    }

    function rewardsSnapshot(address user) external view returns (
        address owner_,
        address main_,
        address distributor_,
        uint256 contractBalance,
        uint256 orangeReward_,
        uint256 blockReward_,
        uint256 rainbowReward_,
        uint8 orangeWinners,
        uint8 blockWinners,
        bool rainbowClaimedGlobal,
        bool canRainbow,
        uint8 canRainbowReason
    ) {
        owner_ = owner;
        main_ = address(main);
        distributor_ = distributor;
        contractBalance = address(this).balance;

        orangeReward_ = orangeReward;
        blockReward_ = blockReward;
        rainbowReward_ = rainbowReward;

        orangeWinners = orangeWinnersCount;
        blockWinners = blockWinnersCount;
        rainbowClaimedGlobal = rainbowRewardClaimedGlobal;

        (canRainbow, canRainbowReason) = this.canClaimRainbow(user);
    }
}
