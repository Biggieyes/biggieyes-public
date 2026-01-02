// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV2PairInit {
    function initialize(address, address) external;
}

contract UniswapV2Factory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _feeToSetter) { feeToSetter = _feeToSetter; }

    function allPairsLength() external view returns (uint) { return allPairs.length; }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO");
        require(getPair[token0][token1] == address(0), "EXISTS");

        // deploy minimal pair and initialize
        UniswapV2Pair p = new UniswapV2Pair();
        pair = address(p);
        IUniswapV2PairInit(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}

// Minimal pair contract referenced (to avoid missing symbol in same file)
contract UniswapV2Pair {
    function initialize(address, address) external {}
}
