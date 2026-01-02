// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/* ============ Minimalní rozhraní BiggiTokenRewards ============ */
interface IBiggiTokenRewards {
    function setTreasure(address treasure_) external;
    function setUnitReward(uint256 newUnit) external;
    function setBlockWeights(uint8[11] calldata weights) external;
    function setCollectionAllowed(address coll, bool allowed) external;
}

/**
 * @title SetupTokenRewardsAndCollections
 * @notice Jednorázový nastavovací skript pro BiggiTokenRewards:
 *  - nastaví treasure adresu
 *  - nastaví unitReward
 *  - nastaví blockWeights
 *  - zaregistruje kolekce (main1, main2 + extra kolekce)
 *
 * Použití (Remix):
 * 1) Nasadit kontrakt s parametrem `initialOwner` = tvoje EOA.
 * 2) Zavolat `runSetup(...)` jednou s konkrétními adresami a hodnotami.
 */
contract SetupTokenRewardsAndCollections is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @param tokenRewards      adresa BiggiTokenRewards kontraktu
     * @param treasure          adresa treasury (ta, která může dělat top-up)
     * @param unitReward        počet BIGGI (v wei) za 1 unit (např. 1e18 = 1 BIGGI)
     * @param blockWeights      váhy bloků [0..10], index 0 se ignoruje (bloky 1–10)
     * @param main1             adresa první main kolekce (BiggiEyesMain1)
     * @param main2             adresa druhé main kolekce (BiggiEyesMain2)
     * @param extraCollections  pole dalších kolekcí, které chceš povolit pro claim
     */
    function runSetup(
        address tokenRewards,
        address treasure,
        uint256 unitReward,
        uint8[11] calldata blockWeights,
        address main1,
        address main2,
        address[] calldata extraCollections
    ) external onlyOwner {
        require(tokenRewards != address(0), "tokenRewards=0");
        require(treasure != address(0), "treasure=0");
        require(main1 != address(0), "main1=0");
        require(main2 != address(0), "main2=0");

        IBiggiTokenRewards tr = IBiggiTokenRewards(tokenRewards);

        // 1) treasure
        tr.setTreasure(treasure);

        // 2) unitReward
        tr.setUnitReward(unitReward);

        // 3) block weights
        tr.setBlockWeights(blockWeights);

        // 4) kolekce – main1, main2
        tr.setCollectionAllowed(main1, true);
        tr.setCollectionAllowed(main2, true);

        // 5) extra kolekce
        for (uint256 i = 0; i < extraCollections.length; ++i) {
            address c = extraCollections[i];
            require(c != address(0), "extra coll=0");
            tr.setCollectionAllowed(c, true);
        }
    }
}
