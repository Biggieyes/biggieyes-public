// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// ===== Minimalní rozhraní BiggiToken =====
interface IBiggiToken {
    function setReserve(address _reserve) external;
    function setDripDistributor(address _drip) external;
    function setTokenRewards(address _rewards) external;
    function setRewardsOperator(address _op) external;
    function initialDistribute() external;
}

/// ===== Minimalní rozhraní DripDistributor =====
interface IDripDistributor {
    function setDripLM(address lm) external;
    function setTreasury(address t) external;
    function setTokensPerMint(uint256 v) external;
    function setCollection(address coll, bool allowed) external;
}

/// ===== Minimalní rozhraní BiggiTokenRewards =====
interface IBiggiTokenRewards {
    function setUnitReward(uint256 newUnit) external;
    function setBlockWeights(uint8[11] calldata weights) external;
    function setCollectionAllowed(address coll, bool allowed) external;
}

/// ===== Obecné Ownable rozhraní (na vrácení ownera) =====
interface IOwnable {
    function transferOwnership(address newOwner) external;
}

/**
 * @title SetupCoreTokenomics
 * @notice Jednorázový setup skript pro:
 *  - BiggiToken (reserve/drip/rewards adresy + initialDistribute)
 *  - DripDistributor (treasury, tokensPerMint, collections)
 *  - BiggiTokenRewards (unitReward, blockWeights, collections)
 *
 * Postup:
 *  1) Nasadíš tento kontrakt.
 *  2) Na BiggiToken, DripDistributor, BiggiTokenRewards zavoláš transferOwnership(adresa_tohohle_kontraktu).
 *  3) Zavoláš configureDripAndCollections(...) a configureRewards(...).
 *  4) Zavoláš run().
 *  5) Zavoláš returnOwnership(tvoje_wallet_adresa).
 */
contract SetupCoreTokenomics is Ownable {
    // cílové kontrakty
    IBiggiToken public immutable biggiToken;
    IDripDistributor public immutable dripDistributor;
    IBiggiTokenRewards public immutable tokenRewards;

    // stejné adresy ale jako IOwnable pro vrácení vlastnictví
    IOwnable public immutable biggiTokenOwn;
    IOwnable public immutable dripDistributorOwn;
    IOwnable public immutable tokenRewardsOwn;

    // adresy / parametry pro nastavení (část z konstruktoru)
    address public immutable reserveAddr;
    address public immutable dripDistributorAddr; // stejná adresa jako dripDistributor kontrakt
    address public immutable tokenRewardsAddr;
    address public immutable rewardsOperator;
    address public immutable treasureAddr; // treasury pro DripDistributor
    address public immutable main1Collection;

    // parametry, které se nastavují až po deploy skriptu (kvůli stack-too-deep)
    address public main2Collection;      // může být address(0) pokud nechceš druhou
    uint256 public tokensPerMint;        // kolik BG za jeden mint (accounting)
    uint256 public unitReward;           // BIGGI jednotka v TokenRewards (např. 1e18)
    uint8[11] public blockWeights;       // pro TokenRewards

    bool public executed;

    event SetupExecuted(
        address indexed token,
        address indexed drip,
        address indexed rewards
    );

    /**
     * @param _biggiToken         adresa BiggiToken kontraktu
     * @param _dripDistributor    adresa DripDistributor kontraktu
     * @param _tokenRewards       adresa BiggiTokenRewards kontraktu
     * @param _reserveAddr        adresa Reserve kontraktu (z BiggiTokenu 600M)
     * @param _dripDistributorAddr adresa DripDistributor kontraktu (pro BiggiToken.setDripDistributor)
     * @param _tokenRewardsAddr   adresa TokenRewards kontraktu (pro BiggiToken.setTokenRewards)
     * @param _rewardsOperator    adresa, která bude ovládat refillRewardsIfBelow
     * @param _treasureAddr       adresa Treasury (pro DripDistributor.setTreasury)
     * @param _main1Collection    main1 NFT kolekce
     */
    constructor(
        address _biggiToken,
        address _dripDistributor,
        address _tokenRewards,
        address _reserveAddr,
        address _dripDistributorAddr,
        address _tokenRewardsAddr,
        address _rewardsOperator,
        address _treasureAddr,
        address _main1Collection
    ) Ownable(msg.sender) {
        require(_biggiToken != address(0), "token=0");
        require(_dripDistributor != address(0), "drip=0");
        require(_tokenRewards != address(0), "rewards=0");
        require(_reserveAddr != address(0), "reserve=0");
        require(_dripDistributorAddr != address(0), "dripAddr=0");
        require(_tokenRewardsAddr != address(0), "rewardsAddr=0");
        require(_rewardsOperator != address(0), "op=0");
        require(_treasureAddr != address(0), "treasure=0");
        require(_main1Collection != address(0), "main1=0");

        biggiToken = IBiggiToken(_biggiToken);
        dripDistributor = IDripDistributor(_dripDistributor);
        tokenRewards = IBiggiTokenRewards(_tokenRewards);

        biggiTokenOwn = IOwnable(_biggiToken);
        dripDistributorOwn = IOwnable(_dripDistributor);
        tokenRewardsOwn = IOwnable(_tokenRewards);

        reserveAddr = _reserveAddr;
        dripDistributorAddr = _dripDistributorAddr;
        tokenRewardsAddr = _tokenRewardsAddr;
        rewardsOperator = _rewardsOperator;
        treasureAddr = _treasureAddr;
        main1Collection = _main1Collection;
    }

    /// @notice Nastavení DripLM parametrů a kolekcí (voláš po deployi skriptu).
    function configureDripAndCollections(
        address _main2Collection,
        uint256 _tokensPerMint
    ) external onlyOwner {
        main2Collection = _main2Collection; // může být 0
        tokensPerMint = _tokensPerMint;
    }

    /// @notice Nastavení rewards parametrů (unitReward + blockWeights) po deployi skriptu.
    function configureRewards(
        uint256 _unitReward,
        uint8[11] calldata _blockWeights
    ) external onlyOwner {
        unitReward = _unitReward;
        blockWeights = _blockWeights;
    }

    /// @notice Spustí jednorázový setup všech tří kontraktů.
    /// Vyžaduje, aby tento kontrakt byl aktuálním ownerm BiggiToken, DripDistributor a BiggiTokenRewards.
    function run() external onlyOwner {
        require(!executed, "already executed");
        require(tokensPerMint > 0, "tokensPerMint=0");
        require(unitReward > 0, "unitReward=0");

        // ---- BiggiToken nastavení ----
        biggiToken.setReserve(reserveAddr);
        biggiToken.setDripDistributor(dripDistributorAddr);
        biggiToken.setTokenRewards(tokenRewardsAddr);
        biggiToken.setRewardsOperator(rewardsOperator);
        biggiToken.initialDistribute();

        // ---- DripDistributor nastavení ----
        dripDistributor.setTreasury(treasureAddr);
        dripDistributor.setTokensPerMint(tokensPerMint);
        dripDistributor.setCollection(main1Collection, true);
        if (main2Collection != address(0)) {
            dripDistributor.setCollection(main2Collection, true);
        }

        // ---- TokenRewards nastavení ----
        tokenRewards.setUnitReward(unitReward);
        tokenRewards.setBlockWeights(blockWeights);
        tokenRewards.setCollectionAllowed(main1Collection, true);
        if (main2Collection != address(0)) {
            tokenRewards.setCollectionAllowed(main2Collection, true);
        }

        executed = true;
        emit SetupExecuted(address(biggiToken), address(dripDistributor), address(tokenRewards));
    }

    /// @notice Vrátí vlastnictví všech tří kontraktů zpět na zadanou adresu (typicky tvůj wallet).
    function returnOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "newOwner=0");

        biggiTokenOwn.transferOwnership(newOwner);
        dripDistributorOwn.transferOwnership(newOwner);
        tokenRewardsOwn.transferOwnership(newOwner);
    }
}
