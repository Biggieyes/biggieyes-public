// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// ====== Minimalní rozhraní pro kolekce (main1, main2, další) ======
interface IBiggiCollection {
    function setDistributor(address distributor) external;
}

/// ====== Minimalní rozhraní pro DistributorMulti ======
interface IBiggiDistributorMulti {
    function setReserve(address reserve_) external;
    function setCollectionRewards(address collectionRewards_) external;
    function setBuybackAgent(address buybackAgent_) external;
    function setTreasury(address treasury_) external;
    function setCommunityCenter(address communityCenter_) external;
}

/// ====== Minimalní rozhraní pro spodní kontrakty, které znají distributora ======
interface IHasDistributorSetter {
    function setDistributor(address distributor_) external;
}

/**
 * @title SetupDistributorMulti
 * @notice Jednorázový skript pro nastavení BiggiDistributorMulti a jeho vazeb:
 *  - přiřadí DistributorMulti jako distributora všem kolekcím (main1, main2, ...),
 *  - nastaví v DistributorMulti adresy Reserve, CollectionRewards, Buyback, Treasury, CommunityCenter,
 *  - nastaví v Reserve, CollectionRewards, Treasury jejich distributor = DistributorMulti.
 *
 * Použití:
 *  - nasadíš kontrakt přes Remix,
 *  - v konstruktoru vyplníš všechny adresy,
 *  - jako owner zavoláš run(), jen jednou.
 */
contract SetupDistributorMulti is Ownable, ReentrancyGuard {
    // hlavní router/distributor
    IBiggiDistributorMulti public immutable distributor;

    // kolekce
    IBiggiCollection public immutable main1;
    IBiggiCollection public immutable main2;
    IBiggiCollection[] public extraCollections; // volitelně další kolekce

    // spodní kontrakty
    IHasDistributorSetter public immutable reserve;
    IHasDistributorSetter public immutable collectionRewards;
    IHasDistributorSetter public immutable treasury;
    address public immutable buybackAgent;
    address public immutable communityCenter;

    bool public executed;

    event ExecutedOnce(
        address indexed distributor,
        address indexed main1,
        address indexed main2
    );
    event ExtraCollectionAdded(address collection);

    constructor(
        address initialOwner,
        address distributor_,
        address main1_,
        address main2_,
        address reserve_,
        address collectionRewards_,
        address treasury_,
        address buybackAgent_,
        address communityCenter_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(distributor_ != address(0), "dist=0");
        require(main1_ != address(0), "main1=0");
        require(main2_ != address(0), "main2=0");
        require(reserve_ != address(0), "reserve=0");
        require(collectionRewards_ != address(0), "collRw=0");
        require(treasury_ != address(0), "treasury=0");
        require(buybackAgent_ != address(0), "bb=0");
        require(communityCenter_ != address(0), "cc=0");

        distributor       = IBiggiDistributorMulti(distributor_);
        main1             = IBiggiCollection(main1_);
        main2             = IBiggiCollection(main2_);
        reserve           = IHasDistributorSetter(reserve_);
        collectionRewards = IHasDistributorSetter(collectionRewards_);
        treasury          = IHasDistributorSetter(treasury_);
        buybackAgent      = buybackAgent_;
        communityCenter   = communityCenter_;
    }

    /// @notice volitelně můžeš přidat další kolekce, které mají setDistributor()
    function addExtraCollection(address coll) external onlyOwner {
        require(coll != address(0), "coll=0");
        extraCollections.push(IBiggiCollection(coll));
        emit ExtraCollectionAdded(coll);
    }

    /// @notice Hlavní jednorázové nastavení – zavolej z Remixu JEDNOU.
    function run() external nonReentrant onlyOwner {
        require(!executed, "already executed");
        executed = true;

        address distAddr = address(distributor);

        // 1) nastavit distributor na kolekcích (main1, main2, extra)
        main1.setDistributor(distAddr);
        main2.setDistributor(distAddr);

        for (uint256 i = 0; i < extraCollections.length; i++) {
            extraCollections[i].setDistributor(distAddr);
        }

        // 2) nastavit downstream adresy v DistributorMulti
        distributor.setReserve(address(reserve));
        distributor.setCollectionRewards(address(collectionRewards));
        distributor.setBuybackAgent(buybackAgent);
        distributor.setTreasury(address(treasury));
        distributor.setCommunityCenter(communityCenter);

        // 3) nastavit v Reserve / CollectionRewards / Treasury jejich distributor = DistributorMulti
        reserve.setDistributor(distAddr);
        collectionRewards.setDistributor(distAddr);
        treasury.setDistributor(distAddr);

        emit ExecutedOnce(distAddr, address(main1), address(main2));
    }

    /// helper pro FE/debug
    function extraCollectionsCount() external view returns (uint256) {
        return extraCollections.length;
    }
}
