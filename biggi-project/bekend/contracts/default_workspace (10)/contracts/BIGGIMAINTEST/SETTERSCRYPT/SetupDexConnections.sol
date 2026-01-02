// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFactory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

interface ILM {
    function setFactory(address f) external;
    function setLiquidityVault(address v) external;
}

interface IVault {
    function addWhitelistedPair(address lpPair) external;
}

interface IRouter {
    function WETH() external view returns (address);
}

contract SetupDexConnections {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function run(
        address lm,
        address vault,
        address router,
        address factory,
        address biggiToken
    ) external onlyOwner {

        // 1. Nastav factory do LM
        ILM(lm).setFactory(factory);

        // 2. Zjisti WMATIC
        address wmatic = IRouter(router).WETH();

        // 3. Zjisti pair
        address pair = IFactory(factory).getPair(biggiToken, wmatic);
        require(pair != address(0), "pair not created yet");

        // 4. Whitelistuj pair ve Vaultu
        IVault(vault).addWhitelistedPair(pair);
    }
}
