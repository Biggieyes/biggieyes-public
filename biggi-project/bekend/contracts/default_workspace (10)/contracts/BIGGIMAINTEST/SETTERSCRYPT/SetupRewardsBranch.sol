// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiTreasury {
    function setTokenRewards(address r) external;
    function setReserve(address r) external;
}

interface IBiggiTokenRewards {
    function setTreasure(address treasure_) external;
}

/// @title SetupRewardsBranch — T T R wiring (Treasury, TokenRewards, Reserve)
/// @notice Jednorázový skript pro propojení:
/// - Treasury → TokenRewards
/// - Treasury → Reserve
/// - TokenRewards → Treasury (treasure)
contract SetupRewardsBranch is Ownable {
    IBiggiTreasury public treasury;
    IBiggiTokenRewards public tokenRewards;
    address public reserve;

    event TTRConfigured(address indexed treasury, address indexed tokenRewards, address indexed reserve);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenRewardsUpdated(address indexed oldTokenRewards, address indexed newTokenRewards);
    event ReserveUpdated(address indexed oldReserve, address indexed newReserve);

    constructor(
        address initialOwner,
        address treasury_,
        address tokenRewards_,
        address reserve_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(treasury_ != address(0), "treasury=0");
        require(tokenRewards_ != address(0), "tokenRewards=0");
        require(reserve_ != address(0), "reserve=0");

        treasury = IBiggiTreasury(treasury_);
        tokenRewards = IBiggiTokenRewards(tokenRewards_);
        reserve = reserve_;
    }

    /// @notice hlavní jednorázová akce – provede celé T T R propojení
    function configureTTR() external onlyOwner {
        treasury.setTokenRewards(address(tokenRewards));
        treasury.setReserve(reserve);
        tokenRewards.setTreasure(address(treasury));

        emit TTRConfigured(address(treasury), address(tokenRewards), reserve);
    }

    /// @notice fallback, kdybys náhodou zadal špatnou adresu při deployi
    function updateTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "treasury=0");
        emit TreasuryUpdated(address(treasury), treasury_);
        treasury = IBiggiTreasury(treasury_);
    }

    function updateTokenRewards(address tokenRewards_) external onlyOwner {
        require(tokenRewards_ != address(0), "tokenRewards=0");
        emit TokenRewardsUpdated(address(tokenRewards), tokenRewards_);
        tokenRewards = IBiggiTokenRewards(tokenRewards_);
    }

    function updateReserve(address reserve_) external onlyOwner {
        require(reserve_ != address(0), "reserve=0");
        emit ReserveUpdated(reserve, reserve_);
        reserve = reserve_;
    }
}
