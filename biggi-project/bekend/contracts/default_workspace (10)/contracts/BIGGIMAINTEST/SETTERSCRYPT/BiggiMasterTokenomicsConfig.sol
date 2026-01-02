// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title BiggiMasterTokenomicsConfig
/// @notice Master registry pro všechny hlavní kontrakty tokenomiky.
///         Nesahá na settery v ostatních kontraktech, jen drží adresy jako
///         centrální zdroj pravdy pro FE / audity / nástroje.
contract BiggiMasterTokenomicsConfig is Ownable {
    /// -------- Core kontrakty --------
    address public biggiToken;          // BiggiToken
    address public reserve;             // BiggiReserveV4
    address public treasury;            // BiggiTreasury
    address public distributor;         // BiggiDistributorMulti (pokud používáš)

    /// -------- Rewards větev --------
    address public collectionRewards;   // BiggiCollectionRewards (ETH)
    address public tokenRewards;        // BiggiTokenRewards
    address public nftRewards;          // BiggiNFTRewards
    address public communityCenter;     // CommunityCenter / governance (pokud máš)

    /// -------- Pump / Buyback / Drip větev --------
    address public buybackAgent;        // BiggiBuybackAgent
    address public dripLM;              // BiggiDripLiquidityManager
    address public dripDistributor;     // DripDistributor
    address public policy;              // BiggiPolicy (guardrails)

    /// -------- Likvidita / DEX --------
    address public liquidityManager;    // BiggiLiquidityManager
    address public liquidityVault;      // LiquidityVault
    address public router;              // UniswapV2 router (Quickswap / Sushi)
    address public factory;             // UniswapV2 factory
    address public weth9;               // WMATIC/WETH wrapper

    /// -------- Kolekce / multi-collection --------
    address public mainCollection;      // BiggiEyesMain (VRF)
    address public publicCollection;    // BiggiEyesMain2 (public mint)
    address public rewardsReader;       // BiggiRewardsReader (pokud používáš)
    address public collectionDistributor; // MultiCollectionDistributor / Expansion modul

    /// ====== eventy pro audit / FE ======
    event CoreSet(address biggiToken, address reserve, address treasury, address distributor);
    event RewardsSet(address collectionRewards, address tokenRewards, address nftRewards, address communityCenter);
    event PumpSet(address buybackAgent, address dripLM, address dripDistributor, address policy);
    event LiquiditySet(address liquidityManager, address liquidityVault, address router, address factory, address weth9);
    event CollectionsSet(address mainCollection, address publicCollection, address rewardsReader, address collectionDistributor);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /* ========= Settery (voláš jednou po nasazení) ========= */

    /// @notice Nastaví core kontrakty (token, reserve, treasury, distributor)
    function setCore(
        address _biggiToken,
        address _reserve,
        address _treasury,
        address _distributor
    ) external onlyOwner {
        biggiToken  = _biggiToken;
        reserve     = _reserve;
        treasury    = _treasury;
        distributor = _distributor;
        emit CoreSet(_biggiToken, _reserve, _treasury, _distributor);
    }

    /// @notice Nastaví rewards kontrakty
    function setRewards(
        address _collectionRewards,
        address _tokenRewards,
        address _nftRewards,
        address _communityCenter
    ) external onlyOwner {
        collectionRewards = _collectionRewards;
        tokenRewards      = _tokenRewards;
        nftRewards        = _nftRewards;
        communityCenter   = _communityCenter;
        emit RewardsSet(_collectionRewards, _tokenRewards, _nftRewards, _communityCenter);
    }

    /// @notice Nastaví pump / buyback / drip větev
    function setPumpBranch(
        address _buybackAgent,
        address _dripLM,
        address _dripDistributor,
        address _policy
    ) external onlyOwner {
        buybackAgent   = _buybackAgent;
        dripLM         = _dripLM;
        dripDistributor = _dripDistributor;
        policy         = _policy;
        emit PumpSet(_buybackAgent, _dripLM, _dripDistributor, _policy);
    }

    /// @notice Nastaví likviditní větev (LM, vault, router, factory, WETH/WMATIC)
    function setLiquidityBranch(
        address _liquidityManager,
        address _liquidityVault,
        address _router,
        address _factory,
        address _weth9
    ) external onlyOwner {
        liquidityManager = _liquidityManager;
        liquidityVault   = _liquidityVault;
        router           = _router;
        factory          = _factory;
        weth9            = _weth9;
        emit LiquiditySet(_liquidityManager, _liquidityVault, _router, _factory, _weth9);
    }

    /// @notice Nastaví kolekce / multi-collection vrstvu
    function setCollections(
        address _mainCollection,
        address _publicCollection,
        address _rewardsReader,
        address _collectionDistributor
    ) external onlyOwner {
        mainCollection        = _mainCollection;
        publicCollection      = _publicCollection;
        rewardsReader         = _rewardsReader;
        collectionDistributor = _collectionDistributor;
        emit CollectionsSet(_mainCollection, _publicCollection, _rewardsReader, _collectionDistributor);
    }

    /* ========= View helper bundly pro FE ========= */

    function coreBundle()
        external
        view
        returns (address _biggiToken, address _reserve, address _treasury, address _distributor)
    {
        return (biggiToken, reserve, treasury, distributor);
    }

    function rewardsBundle()
        external
        view
        returns (address _collectionRewards, address _tokenRewards, address _nftRewards, address _communityCenter)
    {
        return (collectionRewards, tokenRewards, nftRewards, communityCenter);
    }

    function pumpBundle()
        external
        view
        returns (address _buybackAgent, address _dripLM, address _dripDistributor, address _policy)
    {
        return (buybackAgent, dripLM, dripDistributor, policy);
    }

    function liquidityBundle()
        external
        view
        returns (address _liquidityManager, address _liquidityVault, address _router, address _factory, address _weth9)
    {
        return (liquidityManager, liquidityVault, router, factory, weth9);
    }

    function collectionsBundle()
        external
        view
        returns (address _mainCollection, address _publicCollection, address _rewardsReader, address _collectionDistributor)
    {
        return (mainCollection, publicCollection, rewardsReader, collectionDistributor);
    }
}
