// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  BiggiToken.sol - upraveno podle posledního požadavku

  Změny:
  - odstraněn setter / sledování distributor (není potřeba)
  - přidána funkce transferFromReserveTo(address to, uint256 amount) callable ONLY owner
  - initialDistribute, refillRewardsIfBelow a další funkce beze změn
  - Ownable(initialOwner) zachováno
*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./BiggiCapsLib.sol";

interface IBiggiReserveNotify {
    function WAITING() external view returns (bytes32);
    function DEX_REFILL() external view returns (bytes32);
    function onBiggiMintedToReserve(uint256 amount, bytes32 bucket) external;
}

contract BiggiToken is ERC20, ERC20Burnable, ERC20Permit, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ---- Constants / config ----
    uint256 public constant CAP = BiggiCapsLib.BIGGI_TOTAL_SUPPLY;

    // Buckets
    bytes32 public constant WAITING = keccak256("WAITING");
    bytes32 public constant DEX_REFILL = keccak256("DEX_REFILL");

    // Addresses (set by owner before initial distribution)
    address public reserveAddr;
    address public dripDistributorAddr;
    address public tokenRewardsAddr;
    address public rewardsOperator;

    bool public distributed;

    // Events
    event InitialDistribution(
        address indexed reserve,
        address indexed dripDistributor,
        address indexed tokenRewards,
        uint256 reserveAmt,
        uint256 dripAmt,
        uint256 rewardsAmt
    );
    event ReserveSet(address indexed oldAddr, address indexed newAddr);
    event DripDistributorSet(address indexed oldAddr, address indexed newAddr);
    event TokenRewardsSet(address indexed oldAddr, address indexed newAddr);
    event RewardsOperatorSet(address indexed oldOp, address indexed newOp);
    event RewardsRefilled(uint256 beforeBal, uint256 afterBal, uint256 minted);
    event RescueERC20(address token, address to, uint256 amount);
    event ReserveTransfer(address indexed to, uint256 amount, address indexed caller);

    // Constructor: owner must be provided (Ownable(initialOwner))
    constructor(address initialOwner)
        ERC20("Biggi Token", "BIGGI")
        ERC20Permit("Biggi Token")
        Ownable(initialOwner)
    {
        // admin will call setters and initialDistribute()
    }

    // -------------------- Setters (owner) --------------------
    function setReserve(address _reserve) external onlyOwner {
        require(_reserve != address(0), "reserve=0");
        emit ReserveSet(reserveAddr, _reserve);
        reserveAddr = _reserve;
    }

    function setDripDistributor(address _drip) external onlyOwner {
        require(_drip != address(0), "drip=0");
        emit DripDistributorSet(dripDistributorAddr, _drip);
        dripDistributorAddr = _drip;
    }

    function setTokenRewards(address _rewards) external onlyOwner {
        require(_rewards != address(0), "rewards=0");
        emit TokenRewardsSet(tokenRewardsAddr, _rewards);
        tokenRewardsAddr = _rewards;
    }

    function setRewardsOperator(address _op) external onlyOwner {
        emit RewardsOperatorSet(rewardsOperator, _op);
        rewardsOperator = _op;
    }

    // -------------------- Initial distribution (one-time) --------------------
    function initialDistribute() external onlyOwner {
        require(!distributed, "already distributed");
        require(
            reserveAddr != address(0) &&
            dripDistributorAddr != address(0) &&
            tokenRewardsAddr != address(0),
            "addrs not set"
        );

        uint256 reserveAmt = BiggiCapsLib.RESERVE_INITIAL;          // 300M
        uint256 dripAmt    = BiggiCapsLib.DRIP_DISTRIBUTOR_CAP;     // 100M
        uint256 rewardsAmt = BiggiCapsLib.TOKEN_REWARDS_CAP;        // 100M

        // ensure cap won't be exceeded
        require(totalSupply() + reserveAmt + dripAmt + rewardsAmt <= CAP, "cap exceeded");

        // Mint to recipients
        _mint(reserveAddr, reserveAmt);
        _mint(dripDistributorAddr, dripAmt);
        _mint(tokenRewardsAddr, rewardsAmt);

        distributed = true;
        emit InitialDistribution(
            reserveAddr,
            dripDistributorAddr,
            tokenRewardsAddr,
            reserveAmt,
            dripAmt,
            rewardsAmt
        );
    }

    // -------------------- NOVÁ FUNKCE: přesuň tokeny z reserveAddr (ONLY OWNER) --------------------
    /// @notice Pokud je reserveAddr již naplněn tokeny při initialDistribute, owner může
    ///         přesunout tokeny z reserveAddr do libovolné cílové adresy (např. do Reserve kontraktu pro pairing).
    ///         Toto umožní doplňovat páry i když je cap dosažen.
    function transferFromReserveTo(address to, uint256 amount) external onlyOwner {
        require(reserveAddr != address(0), "reserve not set");
        require(to != address(0), "to0");
        require(amount > 0, "zero amount");

        uint256 bal = balanceOf(reserveAddr);
        require(bal >= amount, "insufficient reserve balance");

        // interní transfer z reserveAddr -> to
        _transfer(reserveAddr, to, amount);

        emit ReserveTransfer(to, amount, msg.sender);
    }

    // -------------------- refillRewardsIfBelow --------------------
    /// @notice Called by rewardsOperator to top-up tokenRewards to targetBalance when below minBalance.
    function refillRewardsIfBelow(uint256 minBalance, uint256 targetBalance) external {
        require(msg.sender == rewardsOperator, "only rewardsOperator");
        require(tokenRewardsAddr != address(0), "tokenRewards not set");
        require(targetBalance > minBalance, "bad targets");

        uint256 balBefore = balanceOf(tokenRewardsAddr);
        if (balBefore >= minBalance) {
            emit RewardsRefilled(balBefore, balBefore, 0);
            return;
        }

        uint256 toMint = targetBalance - balBefore;
        require(totalSupply() + toMint <= CAP, "cap exceeded");

        _mint(tokenRewardsAddr, toMint);
        uint256 balAfter = balanceOf(tokenRewardsAddr);
        emit RewardsRefilled(balBefore, balAfter, toMint);
    }

    // -------------------- Emergency mint --------------------
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= CAP, "cap exceeded");
        _mint(to, amount);
    }

    // -------------------- Pausable --------------------
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------- Views / helpers --------------------
    function remainingMintable() external view returns (uint256) {
        return CAP - totalSupply();
    }

    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        name_ = name();
        symbol_ = symbol();
        decimals_ = 18;
    }

    // -------------------- Rescue --------------------
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to0");
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    // -------------------- Hooks / compatibility --------------------
    // Compatibility-minded _beforeTokenTransfer: mark as view to silence "can be restricted to view" warning.
    // Note: if in the future your OZ ERC20 implements a non-view hook, you may need to revert this to non-view + override.
    function _beforeTokenTransfer(address /*from*/, address /*to*/, uint256 /*amount*/) internal view {
        require(!paused(), "token transfer while paused");
    }

    // Note: we do NOT override _mint/_burn here; cap checks enforced at public mint entrypoints.
}
