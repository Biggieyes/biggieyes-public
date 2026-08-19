// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiSupplyControllerView {
    function owner() external view returns (address);
    function token() external view returns (address);
    function dripDistributor() external view returns (address);
    function tokenRewards() external view returns (address);
    function pair() external view returns (address);
    function baselineReserve() external view returns (uint256);
    function minimumReserveFloor() external view returns (uint256);
    function reserveDropBps() external view returns (uint256);
    function dexRefillAmount() external view returns (uint256);
    function dexCooldown() external view returns (uint256);
    function lastDexRefill() external view returns (uint256);
    function rewardsThreshold() external view returns (uint256);
    function rewardsRefillAmount() external view returns (uint256);
    function rewardsCooldown() external view returns (uint256);
    function lastRewardsRefill() external view returns (uint256);
    function currentPairReserve() external view returns (uint256);
    function paused() external view returns (bool);
    function autoRefreshBaselineOnDexRefill() external view returns (bool);
    function keepers(address keeper) external view returns (bool);
    function allowedCallers(address caller) external view returns (bool);
    function previewMaintenance() external view returns (bool dexNeeded, bool rewardsNeeded, uint256 currentReserve, uint256 rewardsBalance);
}

contract BiggiSupplyControllerReader {
    struct SupplyStatus {
        address controller;
        address owner;
        address token;
        address dripDistributor;
        address tokenRewards;
        address pair;
        bool paused;
        bool autoRefreshBaselineOnDexRefill;
        uint256 baselineReserve;
        uint256 minimumReserveFloor;
        uint256 currentReserve;
        uint256 reserveDropBps;
        uint256 dexRefillAmount;
        uint256 dexCooldown;
        uint256 lastDexRefill;
        uint256 rewardsThreshold;
        uint256 rewardsRefillAmount;
        uint256 rewardsCooldown;
        uint256 lastRewardsRefill;
        bool dexNeeded;
        bool rewardsNeeded;
        uint256 rewardsBalance;
    }

    IBiggiSupplyControllerView public immutable controller;

    constructor(address controller_) {
        require(controller_ != address(0), "zero");
        controller = IBiggiSupplyControllerView(controller_);
    }

    function getStatus() external view returns (SupplyStatus memory s) {
        s.controller = address(controller);
        s.owner = controller.owner();
        s.token = controller.token();
        s.dripDistributor = controller.dripDistributor();
        s.tokenRewards = controller.tokenRewards();
        s.pair = controller.pair();
        s.paused = controller.paused();
        s.autoRefreshBaselineOnDexRefill = controller.autoRefreshBaselineOnDexRefill();
        s.baselineReserve = controller.baselineReserve();
        s.minimumReserveFloor = controller.minimumReserveFloor();
        s.reserveDropBps = controller.reserveDropBps();
        s.dexRefillAmount = controller.dexRefillAmount();
        s.dexCooldown = controller.dexCooldown();
        s.lastDexRefill = controller.lastDexRefill();
        s.rewardsThreshold = controller.rewardsThreshold();
        s.rewardsRefillAmount = controller.rewardsRefillAmount();
        s.rewardsCooldown = controller.rewardsCooldown();
        s.lastRewardsRefill = controller.lastRewardsRefill();
        try controller.currentPairReserve() returns (uint256 r) { s.currentReserve = r; } catch {}
        try controller.previewMaintenance() returns (bool d, bool rw, uint256 cr, uint256 rb) {
            s.dexNeeded = d; s.rewardsNeeded = rw;
            if (s.currentReserve == 0) s.currentReserve = cr;
            s.rewardsBalance = rb;
        } catch {}
    }

    function isKeeper(address keeper) external view returns (bool) {
        return controller.keepers(keeper);
    }

    function isAllowedCaller(address caller) external view returns (bool) {
        return controller.allowedCallers(caller);
    }

    function previewMaintenance() external view returns (bool dexNeeded, bool rewardsNeeded, uint256 currentReserve, uint256 rewardsBalance) {
        return controller.previewMaintenance();
    }
}
