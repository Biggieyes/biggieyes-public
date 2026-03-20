// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiTokenSystemView {
    function totalSupply() external view returns (uint256);
    function CAP() external view returns (uint256);
    function remainingMintable() external view returns (uint256);
    function reserveAddr() external view returns (address);
    function dripDistributorAddr() external view returns (address);
    function tokenRewardsAddr() external view returns (address);
    function supplyController() external view returns (address);
    function supplyGuardian() external view returns (address);
    function guardianDexMinted() external view returns (uint256);
    function guardianRewardsMinted() external view returns (uint256);
    function guardianMintPaused() external view returns (bool);
    function distributed() external view returns (bool);
    function paused() external view returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IBiggiSupplyControllerSystemView {
    function paused() external view returns (bool);
    function baselineReserve() external view returns (uint256);
    function currentPairReserve() external view returns (uint256);
    function previewMaintenance() external view returns (bool dexNeeded, bool rewardsNeeded, uint256 currentReserve, uint256 rewardsBalance);
}

interface IBiggiSupplyGuardianSystemView {
    function controller() external view returns (address);
}

interface IBiggiDripDistributorSystemView {
    function getAvailable() external view returns (uint256);
    function getTotalReceived() external view returns (uint256);
    function getTotalClaimed() external view returns (uint256);
}

contract BiggiSystemReader {
    struct TokenState {
        address token;
        uint256 totalSupply;
        uint256 cap;
        uint256 remainingMintable;
        bool distributed;
        bool paused;
        address reserve;
        address dripDistributor;
        address tokenRewards;
        address supplyController;
        address supplyGuardian;
        uint256 guardianDexMinted;
        uint256 guardianRewardsMinted;
        bool guardianMintPaused;
    }

    struct ControllerState {
        address controller;
        bool paused;
        uint256 baselineReserve;
        uint256 currentReserve;
        bool dexNeeded;
        bool rewardsNeeded;
        uint256 rewardsBalance;
    }

    struct GuardianState {
        address guardian;
        address controller;
    }

    struct DistributionState {
        uint256 reserveTokenBalance;
        uint256 dripTokenBalance;
        uint256 rewardsTokenBalance;
        uint256 dripAvailable;
        uint256 dripTotalReceived;
        uint256 dripTotalClaimed;
    }

    IBiggiTokenSystemView public immutable token;
    address public immutable controller;
    address public immutable guardian;

    constructor(address token_, address controller_, address guardian_) {
        require(token_ != address(0), "token=0");
        token = IBiggiTokenSystemView(token_);
        controller = controller_;
        guardian = guardian_;
    }

    function snapshot() external view returns (
        TokenState memory t,
        ControllerState memory c,
        GuardianState memory g,
        DistributionState memory d
    ) {
        t.token = address(token);
        t.totalSupply = token.totalSupply();
        t.cap = token.CAP();
        t.remainingMintable = token.remainingMintable();
        t.distributed = token.distributed();
        t.paused = token.paused();
        t.reserve = token.reserveAddr();
        t.dripDistributor = token.dripDistributorAddr();
        t.tokenRewards = token.tokenRewardsAddr();
        t.supplyController = token.supplyController();
        t.supplyGuardian = token.supplyGuardian();
        t.guardianDexMinted = token.guardianDexMinted();
        t.guardianRewardsMinted = token.guardianRewardsMinted();
        t.guardianMintPaused = token.guardianMintPaused();

        if (controller != address(0)) {
            c.controller = controller;
            try IBiggiSupplyControllerSystemView(controller).paused() returns (bool v) { c.paused = v; } catch {}
            try IBiggiSupplyControllerSystemView(controller).baselineReserve() returns (uint256 v) { c.baselineReserve = v; } catch {}
            try IBiggiSupplyControllerSystemView(controller).currentPairReserve() returns (uint256 v) { c.currentReserve = v; } catch {}
            try IBiggiSupplyControllerSystemView(controller).previewMaintenance() returns (bool dx, bool rw, uint256 curr, uint256 rb) {
                c.dexNeeded = dx; c.rewardsNeeded = rw; if (c.currentReserve == 0) c.currentReserve = curr; c.rewardsBalance = rb;
            } catch {}
        }

        g.guardian = guardian;
        if (guardian != address(0)) {
            try IBiggiSupplyGuardianSystemView(guardian).controller() returns (address v) { g.controller = v; } catch {}
        }

        d.reserveTokenBalance = t.reserve == address(0) ? 0 : token.balanceOf(t.reserve);
        d.dripTokenBalance = t.dripDistributor == address(0) ? 0 : token.balanceOf(t.dripDistributor);
        d.rewardsTokenBalance = t.tokenRewards == address(0) ? 0 : token.balanceOf(t.tokenRewards);
        if (t.dripDistributor != address(0)) {
            try IBiggiDripDistributorSystemView(t.dripDistributor).getAvailable() returns (uint256 v) { d.dripAvailable = v; } catch {}
            try IBiggiDripDistributorSystemView(t.dripDistributor).getTotalReceived() returns (uint256 v) { d.dripTotalReceived = v; } catch {}
            try IBiggiDripDistributorSystemView(t.dripDistributor).getTotalClaimed() returns (uint256 v) { d.dripTotalClaimed = v; } catch {}
        }
    }
}
