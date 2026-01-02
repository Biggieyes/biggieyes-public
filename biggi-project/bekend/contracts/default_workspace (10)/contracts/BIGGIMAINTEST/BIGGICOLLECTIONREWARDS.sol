// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* Minimální pohled do hlavního kontraktu kolekce */
interface IBiggiEyesMainView {
    function exists(uint256 tokenId) external view returns (bool);
    // vrací true pokud owner vlastní všech 10 mainId v daném bloku (předpokládáme, že to kontroluje "originální" varianty / O background)
    function hasAllTenMainIdsInBlock(address owner, uint16 blk) external view returns (bool);
    // vrací true pokud owner vlastní všechny background varianty pro konkrétní mainId v daném bloku
    function hasAllBackgroundsForMainIdInBlock(address owner, uint16 blk, uint256 mainId) external view returns (bool);
}

/* =============================================================================
 * BiggiCollectionRewards — ETH pool pro odměny v rámci kolekce
 * (teď očekáváme, že Distributor bude posílat ~25% část mintu do tohoto kontraktu)
 * =============================================================================*/
contract BiggiCollectionRewards {
    error NotEnoughBalance();
    error AlreadyClaimed();
    error InvalidIndex();
    error DevPaymentFailed();
    error OnlyOwner();
    error ZeroAddress();
    error NotDistributor();
    error AmountZero();

    address public owner;
    IBiggiEyesMainView public main;

    address public distributor;

    // Upravené částky (v wei, 1 ether == 1 MATIC pro tvůj use-case)
    uint256 public orangeReward  = 1000 ether;   // každý mainId v oranžovém bloku => 1000 MATIC výhra (max 10x)
    uint256 public blockReward   = 3000 ether;   // každý blok 1..9 => 3000 MATIC (max 9x)
    uint256 public rainbowReward = 10000 ether;  // zůstává 10000 MATIC (globálně jednou)

    // counters / limits
    uint8  public orangeWinnersCount; // max 10
    uint8  public blockWinnersCount;  // max 9
    bool   public rainbowRewardClaimedGlobal;

    // Tracking: per-user / per-mainId / per-block
    mapping(address => bool) public claimedOrange; // uživatel nemůže brát orange víc než jednou celkově (volitelné, nechal jsem pro backward compat)
    mapping(address => mapping(uint16 => bool)) public userClaimedBlock; // user -> blockIdx -> claimed
    mapping(uint256 => bool) public orangeMainIdPaid; // mainId (1..10) -> už jednou vyplaceno
    mapping(uint16 => bool)  public blockPaid; // blockIdx -> už jednou vyplaceno

    event OrangeRewardClaimed(address indexed user, uint256 mainId, uint256 amount);
    event BlockRewardClaimed(address indexed user, uint16 blockIdx, uint256 amount);
    event RainbowRewardClaimed(address indexed user, uint256 amount);

    event DistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event MintShareFromDistributor(uint256 amount);

    modifier onlyOwner() { if (msg.sender != owner) revert OnlyOwner(); _; }

    constructor(address main_) {
        owner = msg.sender;
        if (main_ == address(0)) revert ZeroAddress();
        main = IBiggiEyesMainView(main_);
    }

    /* ===== admin ===== */
    function setOwner(address newOwner) external onlyOwner { owner = newOwner; }
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
        orangeReward = orange; blockReward = blockAmt; rainbowReward = rainbow;
    }

    /* ===== Claimy ===== */

    /// Orange reward:
    /// - Uživatel musí vlastnit všechny background varianty (včetně 'O') pro dané mainId v oranžovém bloku.
    /// - Každé mainId (1..10) může být odměněno jen jednou (orangeMainIdPaid).
    /// - Maximálně 10 hlavních ID (tedy 10 výher celkem).
    function claimOrangeReward(uint256 mainId) external {
        if (orangeReward == 0) revert InvalidIndex();
        if (orangeWinnersCount >= 10) revert AlreadyClaimed();
        if (mainId < 1 || mainId > 10) revert InvalidIndex();
        if (orangeMainIdPaid[mainId]) revert AlreadyClaimed();

        uint16 ORANGE_BLK = 1;

        // kontrola: uživatel vlastní všechny background varianty pro tento mainId v oranžovém bloku
        bool ok = main.hasAllBackgroundsForMainIdInBlock(msg.sender, ORANGE_BLK, mainId);
        if (!ok) revert InvalidIndex();

        if (address(this).balance < orangeReward) revert NotEnoughBalance();

        orangeMainIdPaid[mainId] = true;
        unchecked { orangeWinnersCount++; }

        (bool sent, ) = msg.sender.call{value: orangeReward}("");
        if (!sent) revert DevPaymentFailed();
        emit OrangeRewardClaimed(msg.sender, mainId, orangeReward);
    }

    /// Block reward:
    /// - Bloky 1..9, pro každý blok pouze jednou.
    /// - Uživateli bude vyplaceno pokud vlastní všech 10 mainId v daném bloku (předpokládáme, že main.hasAllTenMainIdsInBlock kontroluje "originální" / O varianty).
    function claimBlockReward(uint16 blockIdx) external {
        if (blockReward == 0) revert InvalidIndex();
        if (blockWinnersCount >= 9) revert AlreadyClaimed();
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
        emit BlockRewardClaimed(msg.sender, blockIdx, blockReward);
    }

    /// Rainbow reward: zachováno jako dříve (globálně jednou)
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

    /* ===== 25 % z Distributoru (v praxi: distributor pošle částky do tohoto kontraktu) ===== */
    /// Distributor volá, posílá ETH/MATIC do kontraktu.
    function depositMintShareFromDistributor() external payable {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert AmountZero();
        emit MintShareFromDistributor(msg.value);
        // Peníze zůstanou v kontraktu; claimy je možné volat podle pravidel výše.
    }

    /* Backward kompatibilita */
    function receiveMintShare() external payable { 
        // some distributors may call this older name; necháme to přijmout, ale nevyvoláme emit ani nic jiného
        if (msg.value > 0) emit MintShareFromDistributor(msg.value);
    }

    receive() external payable {}
}
