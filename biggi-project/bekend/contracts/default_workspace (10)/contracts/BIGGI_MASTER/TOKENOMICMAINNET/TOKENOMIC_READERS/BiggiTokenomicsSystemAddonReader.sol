// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiMasterTokenomicsConfigView {
    function supplyController() external view returns (address);
    function supplyGuardian() external view returns (address);
    function dexReserveGuard() external view returns (address);
    function coreBundle() external view returns (address biggi, address reserve, address treasury, address distributor);
    function rewardsBundle()
        external
        view
        returns (address collectionRewards, address tokenRewards, address nftRewards, address communityCenter);
    function pumpBundle()
        external
        view
        returns (address buybackAgent, address dripLM, address dripDistributor, address policy);
    function liquidityBundle()
        external
        view
        returns (address liquidityManager, address liquidityVault, address router, address factory, address weth);
    function collectionsBundle()
        external
        view
        returns (address collection1, address collection2, address rewardsReader, address distributor);
}

interface IBiggiTokenViewAddon {
    function supplyGuardian() external view returns (address);
    function guardianDexMinted() external view returns (uint256);
    function guardianRewardsMinted() external view returns (uint256);
    function paused() external view returns (bool);
    function guardianMintPaused() external view returns (bool);
}

interface IBiggiSupplyControllerAddonView {
    function paused() external view returns (bool);
    function baselineReserve() external view returns (uint256);
    function currentPairReserve() external view returns (uint256);
}

interface IBiggiDexReserveGuardAddonView {
    function paused() external view returns (bool);
    function baselineReserve() external view returns (uint256);
    function currentTokenReserve() external view returns (uint256);
    function priceCheckEnabled() external view returns (bool);
    function quoteOracle() external view returns (address);
    function quoteOracleStatus()
        external
        view
        returns (
            bool configured,
            bool roundDataSupported,
            bool legacyAnswerSupported,
            uint256 answerE18,
            uint256 updatedAt,
            bool stale,
            bool valid
        );
}

contract BiggiTokenomicsSystemAddonReader {
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
        address rewardsReader;
        address distributor;
    }

    struct AddonStatus {
        address masterConfig;
        address token;
        CoreBundle core;
        RewardsBundle rewards;
        PumpBundle pump;
        LiquidityBundle liquidity;
        CollectionsBundle collections;
        address supplyController;
        address supplyGuardian;
        address dexReserveGuard;
        bool tokenPaused;
        bool guardianMintPaused;
        bool controllerPaused;
        uint256 guardianDexMinted;
        uint256 guardianRewardsMinted;
        uint256 baselineReserve;
        uint256 currentPairReserve;
        bool guardPaused;
        uint256 guardBaselineReserve;
        uint256 guardCurrentTokenReserve;
        bool guardPriceCheckEnabled;
        address guardQuoteOracle;
        bool guardQuoteOracleConfigured;
        bool guardQuoteOracleStale;
        bool guardQuoteOracleValid;
    }

    address public immutable masterConfig;
    address public immutable token;

    constructor(address masterConfig_, address token_) {
        require(masterConfig_ != address(0) && token_ != address(0), "zero addr");
        masterConfig = masterConfig_;
        token = token_;
    }

    function getStatus() external view returns (AddonStatus memory s) {
        s.masterConfig = masterConfig;
        s.token = token;
        (
            s.core.biggi,
            s.core.reserve,
            s.core.treasury,
            s.core.distributor
        ) = IBiggiMasterTokenomicsConfigView(masterConfig).coreBundle();
        (
            s.rewards.collectionRewards,
            s.rewards.tokenRewards,
            s.rewards.nftRewards,
            s.rewards.communityCenter
        ) = IBiggiMasterTokenomicsConfigView(masterConfig).rewardsBundle();
        (
            s.pump.buybackAgent,
            s.pump.dripLM,
            s.pump.dripDistributor,
            s.pump.policy
        ) = IBiggiMasterTokenomicsConfigView(masterConfig).pumpBundle();
        (
            s.liquidity.liquidityManager,
            s.liquidity.liquidityVault,
            s.liquidity.router,
            s.liquidity.factory,
            s.liquidity.weth
        ) = IBiggiMasterTokenomicsConfigView(masterConfig).liquidityBundle();
        (
            s.collections.collection1,
            s.collections.collection2,
            s.collections.rewardsReader,
            s.collections.distributor
        ) = IBiggiMasterTokenomicsConfigView(masterConfig).collectionsBundle();
        try IBiggiMasterTokenomicsConfigView(masterConfig).supplyController() returns (address v) { s.supplyController = v; } catch {}
        try IBiggiMasterTokenomicsConfigView(masterConfig).supplyGuardian() returns (address v) { s.supplyGuardian = v; } catch {}
        try IBiggiMasterTokenomicsConfigView(masterConfig).dexReserveGuard() returns (address v) { s.dexReserveGuard = v; } catch {}
        if (s.supplyGuardian == address(0)) {
            try IBiggiTokenViewAddon(token).supplyGuardian() returns (address v) { s.supplyGuardian = v; } catch {}
        }
        try IBiggiTokenViewAddon(token).paused() returns (bool v) { s.tokenPaused = v; } catch {}
        try IBiggiTokenViewAddon(token).guardianMintPaused() returns (bool v) { s.guardianMintPaused = v; } catch {}
        try IBiggiTokenViewAddon(token).guardianDexMinted() returns (uint256 v) { s.guardianDexMinted = v; } catch {}
        try IBiggiTokenViewAddon(token).guardianRewardsMinted() returns (uint256 v) { s.guardianRewardsMinted = v; } catch {}
        if (s.supplyController != address(0)) {
            try IBiggiSupplyControllerAddonView(s.supplyController).paused() returns (bool v) { s.controllerPaused = v; } catch {}
            try IBiggiSupplyControllerAddonView(s.supplyController).baselineReserve() returns (uint256 v) { s.baselineReserve = v; } catch {}
            try IBiggiSupplyControllerAddonView(s.supplyController).currentPairReserve() returns (uint256 v) { s.currentPairReserve = v; } catch {}
        }
        if (s.dexReserveGuard != address(0)) {
            IBiggiDexReserveGuardAddonView guard = IBiggiDexReserveGuardAddonView(s.dexReserveGuard);
            try guard.paused() returns (bool v) { s.guardPaused = v; } catch {}
            try guard.baselineReserve() returns (uint256 v) { s.guardBaselineReserve = v; } catch {}
            try guard.currentTokenReserve() returns (uint256 v) { s.guardCurrentTokenReserve = v; } catch {}
            try guard.priceCheckEnabled() returns (bool v) { s.guardPriceCheckEnabled = v; } catch {}
            try guard.quoteOracle() returns (address v) { s.guardQuoteOracle = v; } catch {}
            try guard.quoteOracleStatus() returns (bool configured, bool, bool, uint256, uint256, bool stale, bool valid) {
                s.guardQuoteOracleConfigured = configured;
                s.guardQuoteOracleStale = stale;
                s.guardQuoteOracleValid = valid;
            } catch {}
        }
    }
}
