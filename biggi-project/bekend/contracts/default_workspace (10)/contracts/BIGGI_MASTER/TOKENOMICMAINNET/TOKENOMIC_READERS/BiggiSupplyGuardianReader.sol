// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBiggiSupplyGuardianView {
    function owner() external view returns (address);
    function controller() external view returns (address);
}

interface IBiggiSupplyControllerKeeperView {
    function keepers(address keeper) external view returns (bool);
    function allowedCallers(address caller) external view returns (bool);
}

contract BiggiSupplyGuardianReader {
    struct GuardianStatus {
        address guardian;
        address owner;
        address controller;
        bool guardianIsKeeperOnController;
        bool guardianIsAllowedCallerOnController;
    }

    IBiggiSupplyGuardianView public immutable guardian;

    constructor(address guardian_) {
        require(guardian_ != address(0), "guardian=0");
        guardian = IBiggiSupplyGuardianView(guardian_);
    }

    function getStatus() external view returns (GuardianStatus memory s) {
        s.guardian = address(guardian);
        s.owner = guardian.owner();
        s.controller = guardian.controller();
        if (s.controller != address(0)) {
            try IBiggiSupplyControllerKeeperView(s.controller).keepers(address(guardian)) returns (bool ok) {
                s.guardianIsKeeperOnController = ok;
            } catch {}
            try IBiggiSupplyControllerKeeperView(s.controller).allowedCallers(address(guardian)) returns (bool ok2) {
                s.guardianIsAllowedCallerOnController = ok2;
            } catch {}
        }
    }
}
