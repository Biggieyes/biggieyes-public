// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiTokenRewardsConfig {
    function setTreasure(address treasure_) external;
    function setUnitReward(uint256 newUnit) external;
    function setBlockWeights(uint8[11] calldata weights) external;
    function setCollectionAllowed(address coll, bool allowed) external;
}

/// @title SetupTokenRewardsConfig
/// @notice Konfigurační skript pro BiggiTokenRewards:
/// - nastaví unitReward
/// - nastaví blockWeights[0..10]
/// - povolí mainNFT, main2NFT a extra kolekce
contract SetupTokenRewardsConfig is Ownable {
    IBiggiTokenRewardsConfig public tokenRewards;

    address public mainNFT;
    address public main2NFT;

    // volitelné extra kolekce (např. další main kolekce v budoucnu)
    address[] public extraCollections;

    uint256 public unitReward;       // např. 1e18 = 1 BIGGI
    uint8[11] public weights;        // index 1..10 použijeme pro bloky

    event TokenRewardsUpdated(address indexed oldAddr, address indexed newAddr);
    event MainNFTUpdated(address indexed oldAddr, address indexed newAddr);
    event Main2NFTUpdated(address indexed oldAddr, address indexed newAddr);
    event ExtraCollectionAdded(address indexed coll);
    event ExtraCollectionRemoved(uint256 indexed idx, address indexed coll);
    event UnitRewardPlanned(uint256 value);
    event WeightsPlanned(uint8[11] weights);
    event TokenRewardsConfigured(address indexed tokenRewards);

    constructor(
        address initialOwner,
        address tokenRewards_,
        address mainNFT_,
        address main2NFT_,
        uint256 unitReward_,
        uint8[11] memory weights_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(tokenRewards_ != address(0), "tr=0");
        require(mainNFT_ != address(0), "main=0");
        require(main2NFT_ != address(0), "main2=0");

        tokenRewards = IBiggiTokenRewardsConfig(tokenRewards_);
        mainNFT = mainNFT_;
        main2NFT = main2NFT_;

        unitReward = unitReward_;
        weights = weights_;

        emit TokenRewardsUpdated(address(0), tokenRewards_);
        emit MainNFTUpdated(address(0), mainNFT_);
        emit Main2NFTUpdated(address(0), main2NFT_);
        emit UnitRewardPlanned(unitReward_);
        emit WeightsPlanned(weights_);
    }

    // ========= plánování / úprava parametrů před finálním configure =========

    function updateTokenRewards(address tr) external onlyOwner {
        require(tr != address(0), "tr=0");
        emit TokenRewardsUpdated(address(tokenRewards), tr);
        tokenRewards = IBiggiTokenRewardsConfig(tr);
    }

    function updateMainNFT(address m) external onlyOwner {
        require(m != address(0), "main=0");
        emit MainNFTUpdated(mainNFT, m);
        mainNFT = m;
    }

    function updateMain2NFT(address m2) external onlyOwner {
        require(m2 != address(0), "main2=0");
        emit Main2NFTUpdated(main2NFT, m2);
        main2NFT = m2;
    }

    function setPlannedUnitReward(uint256 newUnit) external onlyOwner {
        unitReward = newUnit;
        emit UnitRewardPlanned(newUnit);
    }

    function setPlannedWeights(uint8[11] calldata newWeights) external onlyOwner {
        weights = newWeights;
        emit WeightsPlanned(newWeights);
    }

    function addExtraCollection(address coll) external onlyOwner {
        require(coll != address(0), "coll=0");
        extraCollections.push(coll);
        emit ExtraCollectionAdded(coll);
    }

    function removeExtraCollection(uint256 index) external onlyOwner {
        require(index < extraCollections.length, "bad index");
        address removed = extraCollections[index];

        uint256 last = extraCollections.length - 1;
        if (index != last) {
            extraCollections[index] = extraCollections[last];
        }
        extraCollections.pop();

        emit ExtraCollectionRemoved(index, removed);
    }

    function extraCollectionsLength() external view returns (uint256) {
        return extraCollections.length;
    }

    // ========= hlavní jednorázová akce =========

    /// @notice Provede:
    /// - setUnitReward(unitReward)
    /// - setBlockWeights(weights)
    /// - setCollectionAllowed(mainNFT, true)
    /// - setCollectionAllowed(main2NFT, true)
    /// - setCollectionAllowed(extraCollections[i], true) pro všechny
    /// Treasure (treasury) už máš nastavené z SetupRewardsBranch.
    function configureTokenRewards() external onlyOwner {
        // základní parametry
        tokenRewards.setUnitReward(unitReward);
        tokenRewards.setBlockWeights(weights);

        // kolekce
        tokenRewards.setCollectionAllowed(mainNFT, true);
        tokenRewards.setCollectionAllowed(main2NFT, true);

        for (uint256 i = 0; i < extraCollections.length; i++) {
            tokenRewards.setCollectionAllowed(extraCollections[i], true);
        }

        emit TokenRewardsConfigured(address(tokenRewards));
    }
}
