// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Library/BiggiBpsLib.sol";
import "./BiggiErrorsLib.sol";

/**
 * BiggiTreasury — final
 * - přijímá BIGGI z BuybackAgent (agent approve -> treasury.buybackDepositAndSplit(amount))
 * - treasury provede safeTransferFrom(msg.sender, this, amount) (pull)
 * - rozdělí přijaté BIGGI: 34% -> tokenRewards, 33% -> reserveAddr, 33% -> dripDistributor
 * - přijímá POL z Distributora přes depositPolFromDistributor() a drží ho jako emergency
 */
contract BiggiTreasury is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable BIGGI;

    address public distributor;      // adresa Distributor kontraktu (posílá POL)
    address public buybackAgent;     // buyback zavolá buybackDepositAndSplit
    address public tokenRewards;     // příjemce 34%
    address public reserveAddr;      // příjemce 33%
    address public dripDistributor;  // příjemce 33%

    uint256 public totalBiggiReceived;
    uint256 public totalPolReceived;

    event DistributorSet(address indexed oldAddr, address indexed newAddr);
    event BuybackAgentSet(address indexed oldAddr, address indexed newAddr);
    event TokenRewardsSet(address indexed oldAddr, address indexed newAddr);
    event ReserveSet(address indexed oldAddr, address indexed newAddr);
    event DripDistributorSet(address indexed oldAddr, address indexed newAddr);
    event BuybackReceived(uint256 amount, uint256 toRewards, uint256 toReserve, uint256 toDrip);
    event PolFromDistributor(uint256 amount, uint256 totalReceived);

    constructor(address biggiToken, address initialOwner) Ownable(initialOwner) {
        if (biggiToken == address(0) || initialOwner == address(0)) {
            revert BiggiErrorsLib.ZeroAddress();
        }
        BIGGI = IERC20(biggiToken);
    }

    /* ===== Settery (onlyOwner) ===== */
    function setDistributor(address d) external onlyOwner {
        emit DistributorSet(distributor, d);
        distributor = d;
    }

    function setBuybackAgent(address b) external onlyOwner {
        emit BuybackAgentSet(buybackAgent, b);
        buybackAgent = b;
    }

    function setTokenRewards(address r) external onlyOwner {
        emit TokenRewardsSet(tokenRewards, r);
        tokenRewards = r;
    }

    function setReserve(address r) external onlyOwner {
        emit ReserveSet(reserveAddr, r);
        reserveAddr = r;
    }

    function setDripDistributor(address d) external onlyOwner {
        emit DripDistributorSet(dripDistributor, d);
        dripDistributor = d;
    }

    /* ===== Inflow POL z Distributoru (10% podíl apod.) =====
           Distributor musí volat tuto funkci. POL zůstanou v treasury. */
    function depositPolFromDistributor() external payable {
        if (msg.sender != distributor) revert BiggiErrorsLib.NotDistributor();
        if (msg.value == 0) revert BiggiErrorsLib.AmountZero();
        totalPolReceived += msg.value;
        emit PolFromDistributor(msg.value, totalPolReceived);
    }

    /* ===== Inflow BIGGI z BuybackAgent =====
       BuybackAgent nejprve approve(treasury, amount) a poté zavolá buybackDepositAndSplit(amount).
       Treasury PULLne tokeny pomocí safeTransferFrom(msg.sender, this, amount) a rozdělí je.
    */
    function buybackDepositAndSplit(uint256 amount) external {
        if (msg.sender != buybackAgent) revert BiggiErrorsLib.NotBuybackAgent();
        if (amount == 0) revert BiggiErrorsLib.AmountZero();

        // Pull tokeny z buyback agenta (musí mít allowance)
        BIGGI.safeTransferFrom(msg.sender, address(this), amount);

        // účetnictví
        totalBiggiReceived += amount;

        // vypočítat části přes BiggiBpsLib.part (34 % / 33 % / 33 %)
        uint256 partRewards = BiggiBpsLib.part(amount, 3400); // 34%
        uint256 partReserve = BiggiBpsLib.part(amount, 3300); // 33%
        uint256 partDrip    = amount - partRewards - partReserve; // zbytek (cca 33% +/- zaokrouhlení)

        // pokusit se rozeslat, pokud jsou cíle nastaveny; jinak ponechat v kontraktu
        if (tokenRewards != address(0) && partRewards > 0) {
            BIGGI.safeTransfer(tokenRewards, partRewards);
        }
        if (reserveAddr != address(0) && partReserve > 0) {
            BIGGI.safeTransfer(reserveAddr, partReserve);
        }
        if (dripDistributor != address(0) && partDrip > 0) {
            BIGGI.safeTransfer(dripDistributor, partDrip);
        }

        emit BuybackReceived(amount, partRewards, partReserve, partDrip);
    }

    /* ===== Views pro frontend / audit ===== */
    function biggiBalance() external view returns (uint256) {
        return BIGGI.balanceOf(address(this));
    }

    function polBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function totalBiggiReceivedFromBuyback() external view returns (uint256) {
        return totalBiggiReceived;
    }

    function totalPolReceivedFromDistributor() external view returns (uint256) {
        return totalPolReceived;
    }

    /* ===== Rescue (owner) ===== */
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "rescue failed");
    }

    receive() external payable {}
    fallback() external payable {}
}

