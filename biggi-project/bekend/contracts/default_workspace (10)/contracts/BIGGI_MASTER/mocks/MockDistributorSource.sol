// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDistributor {
    function distribute() external payable;
}

contract MockDistributorSource {
    function forwardDistribute(address distributor) external payable {
        IDistributor(distributor).distribute{value: msg.value}();
    }

    receive() external payable {}
}
