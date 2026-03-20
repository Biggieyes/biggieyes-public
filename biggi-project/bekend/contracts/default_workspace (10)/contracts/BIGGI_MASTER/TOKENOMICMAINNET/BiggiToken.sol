// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Library/BiggiCapsLib.sol";

interface IBiggiDripDistributorNotify {
    function notifyTokenMint(uint256 amount) external;
}

contract BiggiToken is ERC20, ERC20Burnable, ERC20Permit, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant CAP = BiggiCapsLib.BIGGI_TOTAL_SUPPLY;

    address public reserveAddr;
    address public dripDistributorAddr;
    address public tokenRewardsAddr;
    address public marketingSupportAddr;
    address public rewardsOperator;
    address public supplyController;
    address public supplyGuardian; // optional manual guardian helper; same authority class as controller

    bool public distributed;
    bool public guardianMintPaused;

    uint256 public guardianDexMinted;
    uint256 public guardianRewardsMinted;

    event InitialDistribution(
        address indexed reserve,
        address indexed dripDistributor,
        address indexed tokenRewards,
        address marketingSupport,
        uint256 reserveAmt,
        uint256 dripAmt,
        uint256 rewardsAmt,
        uint256 marketingAmt
    );
    event ReserveSet(address indexed oldAddr, address indexed newAddr);
    event DripDistributorSet(address indexed oldAddr, address indexed newAddr);
    event TokenRewardsSet(address indexed oldAddr, address indexed newAddr);
    event MarketingSupportSet(address indexed oldAddr, address indexed newAddr);
    event RewardsOperatorSet(address indexed oldOp, address indexed newOp);
    event SupplyControllerSet(address indexed oldController, address indexed newController);
    event SupplyGuardianSet(address indexed oldGuardian, address indexed newGuardian);
    event GuardianMintPauseSet(bool paused);
    event RewardsRefilled(uint256 beforeBal, uint256 afterBal, uint256 minted);
    event RescueERC20(address token, address to, uint256 amount);
    event ReserveTransfer(address indexed to, uint256 amount, address indexed caller);
    event GuardianDexMint(address indexed to, uint256 amount, uint256 mintedTotal);
    event GuardianRewardsMint(address indexed to, uint256 amount, uint256 mintedTotal);

    constructor(address initialOwner)
        ERC20("Biggi Token", "BIGGI")
        ERC20Permit("Biggi Token")
        Ownable(initialOwner)
    {}

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

    function setMarketingSupport(address _marketingSupport) external onlyOwner {
        require(_marketingSupport != address(0), "marketing=0");
        emit MarketingSupportSet(marketingSupportAddr, _marketingSupport);
        marketingSupportAddr = _marketingSupport;
    }

    function setRewardsOperator(address _op) external onlyOwner {
        emit RewardsOperatorSet(rewardsOperator, _op);
        rewardsOperator = _op;
    }

    function setSupplyController(address controller) external onlyOwner {
        require(controller != address(0), "controller=0");
        emit SupplyControllerSet(supplyController, controller);
        supplyController = controller;
    }

    function setSupplyGuardian(address g) external onlyOwner {
        require(g != address(0), "guardian=0");
        emit SupplyGuardianSet(supplyGuardian, g);
        supplyGuardian = g;
    }

    function setGuardianMintPaused(bool paused_) external onlyOwner {
        guardianMintPaused = paused_;
        emit GuardianMintPauseSet(paused_);
    }

    modifier onlySupplyAuthority() {
        require(msg.sender == supplyController || msg.sender == supplyGuardian, "not supply authority");
        _;
    }

    function initialDistribute() external onlyOwner {
        require(!distributed, "already distributed");
        require(
            reserveAddr != address(0) &&
            dripDistributorAddr != address(0) &&
            tokenRewardsAddr != address(0) &&
            marketingSupportAddr != address(0),
            "addrs not set"
        );

        uint256 reserveAmt = BiggiCapsLib.RESERVE_INITIAL;
        uint256 dripAmt    = BiggiCapsLib.DRIP_DISTRIBUTOR_CAP;
        uint256 rewardsAmt = BiggiCapsLib.TOKEN_REWARDS_CAP;
        uint256 marketingAmt = BiggiCapsLib.MARKETING_SUPPORT_INITIAL;

        require(totalSupply() + reserveAmt + dripAmt + rewardsAmt + marketingAmt <= CAP, "cap exceeded");

        _mint(reserveAddr, reserveAmt);
        _mint(dripDistributorAddr, dripAmt);
        IBiggiDripDistributorNotify(dripDistributorAddr).notifyTokenMint(dripAmt);
        _mint(tokenRewardsAddr, rewardsAmt);
        _mint(marketingSupportAddr, marketingAmt);

        distributed = true;
        emit InitialDistribution(
            reserveAddr,
            dripDistributorAddr,
            tokenRewardsAddr,
            marketingSupportAddr,
            reserveAmt,
            dripAmt,
            rewardsAmt,
            marketingAmt
        );
    }

    function transferFromReserveTo(address to, uint256 amount) external onlyOwner {
        require(reserveAddr != address(0), "reserve not set");
        require(to != address(0), "to0");
        require(amount > 0, "zero amount");
        require(balanceOf(reserveAddr) >= amount, "insufficient reserve balance");
        _transfer(reserveAddr, to, amount);
        emit ReserveTransfer(to, amount, msg.sender);
    }

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
        emit RewardsRefilled(balBefore, balanceOf(tokenRewardsAddr), toMint);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= CAP, "cap exceeded");
        _mint(to, amount);
    }

    function mintToDripDistributor(uint256 amount) external onlySupplyAuthority {
        require(!guardianMintPaused, "guardian mint paused");
        require(dripDistributorAddr != address(0), "drip not set");
        require(guardianDexMinted + amount <= BiggiCapsLib.GUARDIAN_DEX_MINT_CAP, "DEX_CAP");
        require(totalSupply() + amount <= CAP, "cap exceeded");
        guardianDexMinted += amount;
        _mint(dripDistributorAddr, amount);
        IBiggiDripDistributorNotify(dripDistributorAddr).notifyTokenMint(amount);
        emit GuardianDexMint(dripDistributorAddr, amount, guardianDexMinted);
    }

    function mintToTokenRewards(uint256 amount) external onlySupplyAuthority {
        require(!guardianMintPaused, "guardian mint paused");
        require(tokenRewardsAddr != address(0), "tokenRewards not set");
        require(guardianRewardsMinted + amount <= BiggiCapsLib.GUARDIAN_REWARDS_MINT_CAP, "REWARDS_CAP");
        require(totalSupply() + amount <= CAP, "cap exceeded");
        guardianRewardsMinted += amount;
        _mint(tokenRewardsAddr, amount);
        emit GuardianRewardsMint(tokenRewardsAddr, amount, guardianRewardsMinted);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _update(address from, address to, uint256 value) internal override {
        require(!paused(), "token transfer while paused");
        super._update(from, to, value);
    }

    function remainingMintable() external view returns (uint256) { return CAP - totalSupply(); }
    function tokenMeta() external view returns (string memory name_, string memory symbol_, uint8 decimals_) {
        return (name(), symbol(), 18);
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to0");
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }
}
