// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IBiggiTokenRewards {
    function mainNFT() external view returns (address);
    function main2NFT() external view returns (address);
    function biggi() external view returns (address);

    function unitReward() external view returns (uint256);
    function getBlockWeights() external view returns (uint8[11] memory);
    function emissionController() external view returns (address);
    function emissionControllerEnabled() external view returns (bool);

    function rewardsCap() external view returns (uint256);
    function rewardsMinted() external view returns (uint256);
    function rewardsCapRemaining() external view returns (uint256);
    function tokenRemainingMintable() external view returns (uint256);

    function totalDistributed() external view returns (uint256);
    function distributedThisWeek() external view returns (uint256);
    function lastWeekDistributed() external view returns (uint256);
    function currentWeek() external view returns (uint64);
    function lastRecordedWeek() external view returns (uint64);

    function tokenMeta() external view returns (string memory, string memory, uint8);

    function claimablePreview(uint256[] calldata tokenIds)
        external
        view
        returns (uint256 units, uint256 amount);

    function claimablePreviewFor(address[] calldata collections, uint256[] calldata tokenIds)
        external
        view
        returns (uint256 units, uint256 amount);

    function nextClaimWeekFor(uint256 tokenId) external view returns (uint64);
    function nextClaimWeekForCollection(address collection, uint256 tokenId) external view returns (uint64);
    function isAllowedCollection(address coll) external view returns (bool);
    function rewardEmissionPreview(address user, uint256 units)
        external
        view
        returns (uint256 amount, uint256 weeklyBudget, uint256 weeklyPaid, uint256 unitRewardForWeek);
}

contract BiggiTokenRewardsReader {
    struct TokenMeta {
        string name_;
        string symbol_;
        uint8 decimals_;
    }

    struct RewardsStatus {
        address tokenRewards;
        address token;
        address main;
        address main2;
        uint256 unitReward;
        address emissionController;
        bool emissionControllerEnabled;
        uint8[11] blockWeights;
        uint256 rewardsCap;
        uint256 rewardsMinted;
        uint256 rewardsCapRemaining;
        uint256 tokenRemainingMintable;
        uint256 rewardBalance;
        uint256 totalDistributed;
        uint256 distributedThisWeek;
        uint256 lastWeekDistributed;
        uint64 currentWeek;
        uint64 lastRecordedWeek;
    }

    IBiggiTokenRewards public immutable tokenRewards;

    constructor(address tokenRewards_) {
        require(tokenRewards_ != address(0), "zero");
        tokenRewards = IBiggiTokenRewards(tokenRewards_);
    }

    function getStatus() external view returns (RewardsStatus memory s, TokenMeta memory meta) {
        address tokenAddr = tokenRewards.biggi();
        IERC20Metadata token = IERC20Metadata(tokenAddr);

        s.tokenRewards = address(tokenRewards);
        s.token = tokenAddr;
        s.main = tokenRewards.mainNFT();
        s.main2 = tokenRewards.main2NFT();
        s.unitReward = tokenRewards.unitReward();
        s.emissionController = tokenRewards.emissionController();
        s.emissionControllerEnabled = tokenRewards.emissionControllerEnabled();
        s.blockWeights = tokenRewards.getBlockWeights();
        s.rewardsCap = tokenRewards.rewardsCap();
        s.rewardsMinted = tokenRewards.rewardsMinted();
        s.rewardsCapRemaining = tokenRewards.rewardsCapRemaining();
        s.tokenRemainingMintable = tokenRewards.tokenRemainingMintable();
        s.rewardBalance = token.balanceOf(address(tokenRewards));
        s.totalDistributed = tokenRewards.totalDistributed();
        s.distributedThisWeek = tokenRewards.distributedThisWeek();
        s.lastWeekDistributed = tokenRewards.lastWeekDistributed();
        s.currentWeek = tokenRewards.currentWeek();
        s.lastRecordedWeek = tokenRewards.lastRecordedWeek();

        (meta.name_, meta.symbol_, meta.decimals_) = tokenRewards.tokenMeta();
    }

    function getBlockWeights() external view returns (uint8[11] memory w) {
        return tokenRewards.getBlockWeights();
    }

    function getTokenMeta() external view returns (TokenMeta memory meta) {
        (meta.name_, meta.symbol_, meta.decimals_) = tokenRewards.tokenMeta();
    }

    function preview(uint256[] calldata tokenIds) external view returns (uint256 units, uint256 amount) {
        return tokenRewards.claimablePreview(tokenIds);
    }

    function previewFor(address[] calldata collections, uint256[] calldata tokenIds)
        external
        view
        returns (uint256 units, uint256 amount)
    {
        return tokenRewards.claimablePreviewFor(collections, tokenIds);
    }

    function emissionPreview(address user, uint256 units)
        external
        view
        returns (uint256 amount, uint256 weeklyBudget, uint256 weeklyPaid, uint256 unitRewardForWeek)
    {
        return tokenRewards.rewardEmissionPreview(user, units);
    }

    function nextClaimWeekFor(uint256 tokenId) external view returns (uint64) {
        return tokenRewards.nextClaimWeekFor(tokenId);
    }

    function nextClaimWeekForCollection(address collection, uint256 tokenId) external view returns (uint64) {
        return tokenRewards.nextClaimWeekForCollection(collection, tokenId);
    }

    function isAllowedCollection(address coll) external view returns (bool) {
        return tokenRewards.isAllowedCollection(coll);
    }
}
