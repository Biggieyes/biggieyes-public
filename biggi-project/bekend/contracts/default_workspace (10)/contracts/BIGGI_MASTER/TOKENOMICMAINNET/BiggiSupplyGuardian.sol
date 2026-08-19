// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiSupplyControllerOps {
    function performMaintenance() external returns (bool dexTriggered, bool rewardsTriggered);
    function setKeeper(address keeper, bool allowed) external;
    function setAllowedCaller(address caller, bool allowed) external;
    function refillDex(uint256 amount) external;
    function refillRewards(uint256 amount) external;
}

/// @notice Optional admin/ops helper for the supply controller. It does not mint by itself.
contract BiggiSupplyGuardian is Ownable {
    address public controller;

    event ControllerSet(address indexed oldController, address indexed newController);
    event ManualMaintenance(address indexed caller, bool dexTriggered, bool rewardsTriggered);
    event ManualDexRefill(address indexed caller, uint256 amount);
    event ManualRewardsRefill(address indexed caller, uint256 amount);

    constructor(address initialOwner, address controller_) Ownable(initialOwner) {
        require(controller_ != address(0), "controller=0");
        controller = controller_;
    }

    function setController(address controller_) external onlyOwner {
        require(controller_ != address(0), "controller=0");
        emit ControllerSet(controller, controller_);
        controller = controller_;
    }

    function setKeeperOnController(address keeper, bool allowed) external onlyOwner {
        IBiggiSupplyControllerOps(controller).setKeeper(keeper, allowed);
    }

    function setAllowedCallerOnController(address caller, bool allowed) external onlyOwner {
        IBiggiSupplyControllerOps(controller).setAllowedCaller(caller, allowed);
    }

    function authorizeSelfOnController(bool allowed) external onlyOwner {
        IBiggiSupplyControllerOps(controller).setAllowedCaller(address(this), allowed);
    }

    function manualDexRefill(uint256 amount) external onlyOwner {
        IBiggiSupplyControllerOps(controller).refillDex(amount);
        emit ManualDexRefill(msg.sender, amount);
    }

    function manualRewardsRefill(uint256 amount) external onlyOwner {
        IBiggiSupplyControllerOps(controller).refillRewards(amount);
        emit ManualRewardsRefill(msg.sender, amount);
    }

    function manualMaintenance() external onlyOwner returns (bool dexTriggered, bool rewardsTriggered) {
        (dexTriggered, rewardsTriggered) = IBiggiSupplyControllerOps(controller).performMaintenance();
        emit ManualMaintenance(msg.sender, dexTriggered, rewardsTriggered);
    }
}
