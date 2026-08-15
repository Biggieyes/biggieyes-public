// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Master tokenomics/config agregátor.
 * Slouží jen jako read-only úložiště adres pro FE/backoffice; nenese žádnou logiku.
 */
contract BiggiMasterTokenomicsConfig is Ownable {
    struct CoreBundle {
        address biggi;
        address reserve;
        address treasury;
        address distributor;
    }

    struct RewardsBundle {
        address collectionRewards;
        address tokenRewards;
        address nftRewards;
        address communityCenter;
    }

    struct PumpBundle {
        address buybackAgent;
        address dripLM;
        address dripDistributor;
        address policy;
    }

    struct LiquidityBundle {
        address liquidityManager;
        address liquidityVault;
        address router;
        address factory;
        address weth;
    }

    struct CollectionsBundle {
        address collection1;
        address collection2;
        address rewardsReader; // nebo tokenomik reader
        address distributor;   // multi-collection distributor
    }

    CoreBundle public core;
    RewardsBundle public rewards;
    PumpBundle public pump;
    LiquidityBundle public liquidity;
    CollectionsBundle public collections;

    event CoreSet(CoreBundle bundle);
    event RewardsSet(RewardsBundle bundle);
    event PumpSet(PumpBundle bundle);
    event LiquiditySet(LiquidityBundle bundle);
    event CollectionsSet(CollectionsBundle bundle);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setCore(address biggi, address reserve, address treasury, address distributor) external onlyOwner {
        core = CoreBundle(biggi, reserve, treasury, distributor);
        emit CoreSet(core);
    }

    function setRewards(address collectionRewards, address tokenRewards, address nftRewards, address communityCenter)
        external
        onlyOwner
    {
        rewards = RewardsBundle(collectionRewards, tokenRewards, nftRewards, communityCenter);
        emit RewardsSet(rewards);
    }

    function setPumpBranch(address buybackAgent, address dripLM, address dripDistributor, address policy) external onlyOwner {
        pump = PumpBundle(buybackAgent, dripLM, dripDistributor, policy);
        emit PumpSet(pump);
    }

    function setLiquidityBranch(address liquidityManager, address liquidityVault, address router, address factory, address weth)
        external
        onlyOwner
    {
        liquidity = LiquidityBundle(liquidityManager, liquidityVault, router, factory, weth);
        emit LiquiditySet(liquidity);
    }

    function setCollections(address collection1, address collection2, address rewardsReader, address distributor) external onlyOwner {
        collections = CollectionsBundle(collection1, collection2, rewardsReader, distributor);
        emit CollectionsSet(collections);
    }

    // Kompatibilní view funkce
    function coreBundle() external view returns (address, address, address, address) {
        return (core.biggi, core.reserve, core.treasury, core.distributor);
    }

    function rewardsBundle() external view returns (address, address, address, address) {
        return (rewards.collectionRewards, rewards.tokenRewards, rewards.nftRewards, rewards.communityCenter);
    }

    function pumpBundle() external view returns (address, address, address, address) {
        return (pump.buybackAgent, pump.dripLM, pump.dripDistributor, pump.policy);
    }

    function liquidityBundle() external view returns (address, address, address, address, address) {
        return (liquidity.liquidityManager, liquidity.liquidityVault, liquidity.router, liquidity.factory, liquidity.weth);
    }

    function collectionsBundle() external view returns (address, address, address, address) {
        return (collections.collection1, collections.collection2, collections.rewardsReader, collections.distributor);
    }
}
