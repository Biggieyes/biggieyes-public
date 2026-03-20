// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiMasterTokenomicsConfigView {
    function supplyController() external view returns (address);
    function supplyGuardian() external view returns (address);
    function dexReserveGuard() external view returns (address);
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

contract BiggiTokenomicsSystemAddonReader {
    struct AddonStatus {
        address masterConfig;
        address token;
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
    }
}
