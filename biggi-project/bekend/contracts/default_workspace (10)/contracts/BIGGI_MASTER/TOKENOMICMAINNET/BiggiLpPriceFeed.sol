// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  BiggiLpPriceFeed — LP-based price/oracle helper

  Minimal ABI:
    - BIGGI()
    - WETH()
    - pair()
    - readReserves() => (bool ok, uint256 reserveBiggi, uint256 reserveWeth, uint32 blockTimestampLast)
    - latestAnswer() => int256
    - latestRoundData() => (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    - decimals()

  Admin helpers:
    - updateFromReserves() onlyOwner
    - setPair/setTokens/setDecimals onlyOwner

  NOTE:
  - Ownable in OZ v5 expects initialOwner in constructor: Ownable(initialOwner)
*/

import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2PairLike {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract BiggiLpPriceFeed is Ownable {
    // Token / pair addresses
    address public BIGGI;
    address public WETH;
    IUniswapV2PairLike public pair;

    // Aggregator-like storage (Chainlink compatible layout)
    uint8 private _decimals;
    uint80  public roundId;
    int256  public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    uint80  public answeredInRound;

    event RoundUpdated(uint80 indexed roundId, int256 answer, uint256 updatedAt);
    event PairSet(address indexed pair);
    event TokensSet(address indexed biggi, address indexed weth);
    event DecimalsSet(uint8 decimals);

    error ZeroAddress();
    error BadDecimals();
    error PairNotSet();
    error PairTokenMismatch();

    /**
     * @param _biggi         BIGGI token address
     * @param _weth          wrapped native (WETH/WPOL) address
     * @param _pair          Uniswap-like pair (BIGGI <> WETH) or address(0)
     * @param _decimalsInit  decimals (recommended 8 or 18)
     * @param initialOwner   owner for Ownable (non-zero)
     */
    constructor(
        address _biggi,
        address _weth,
        address _pair,
        uint8 _decimalsInit,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_biggi == address(0) || _weth == address(0) || initialOwner == address(0)) revert ZeroAddress();
        if (_decimalsInit > 18) revert BadDecimals(); // low-risk guard (prevents overflow / nonsense configs)

        BIGGI = _biggi;
        WETH  = _weth;
        _decimals = _decimalsInit;

        if (_pair != address(0)) {
            IUniswapV2PairLike p = IUniswapV2PairLike(_pair);
            _requirePairMatchesTokens(p, _biggi, _weth);
            pair = p;
            emit PairSet(_pair);
        }
        // aggregator fields start at zero
    }

    /* ===== Minimal ABI getters ===== */

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 _roundId,
            int256 _answer,
            uint256 _startedAt,
            uint256 _updatedAt,
            uint80 _answeredInRound
        )
    {
        _roundId = roundId;
        _answer = answer;
        _startedAt = startedAt;
        _updatedAt = updatedAt;
        _answeredInRound = answeredInRound;
    }

    function latestAnswer() external view returns (int256) {
        return answer;
    }

    function readReserves()
        external
        view
        returns (
            bool ok,
            uint256 reserveBiggi,
            uint256 reserveWeth,
            uint32 blockTimestampLast
        )
    {
        address p = address(pair);
        if (p == address(0)) {
            return (false, 0, 0, 0);
        }

        (uint112 r0, uint112 r1, uint32 ts) = pair.getReserves();
        address t0 = pair.token0();
        address t1 = pair.token1();

        if (t0 == BIGGI && t1 == WETH) {
            return (true, uint256(r0), uint256(r1), ts);
        }
        if (t0 == WETH && t1 == BIGGI) {
            return (true, uint256(r1), uint256(r0), ts);
        }

        return (false, 0, 0, 0);
    }

    /* ===== Admin functions ===== */

    function setPair(address _pair) external onlyOwner {
        if (_pair == address(0)) revert ZeroAddress();
        IUniswapV2PairLike p = IUniswapV2PairLike(_pair);
        _requirePairMatchesTokens(p, BIGGI, WETH);
        pair = p;
        emit PairSet(_pair);
    }

    function setTokens(address _biggi, address _weth) external onlyOwner {
        if (_biggi == address(0) || _weth == address(0)) revert ZeroAddress();

        // If pair already set, validate against the new token addresses before applying.
        if (address(pair) != address(0)) {
            _requirePairMatchesTokens(pair, _biggi, _weth);
        }

        BIGGI = _biggi;
        WETH  = _weth;
        emit TokensSet(_biggi, _weth);
    }

    function setDecimals(uint8 d) external onlyOwner {
        if (d > 18) revert BadDecimals(); // low-risk guard
        _decimals = d;
        emit DecimalsSet(d);
    }

    /// @notice Reads reserves and publishes an aggregated answer (onlyOwner)
    /// Answer is scaled by 10**decimals: price = reserveWeth * 10**decimals / reserveBiggi
    function updateFromReserves() external onlyOwner returns (uint80) {
        if (address(pair) == address(0)) revert PairNotSet();

        (uint112 r0, uint112 r1, ) = pair.getReserves();
        address t0 = pair.token0();
        address t1 = pair.token1();

        uint256 reserveBiggi;
        uint256 reserveWeth;

        if (t0 == BIGGI && t1 == WETH) {
            reserveBiggi = uint256(r0);
            reserveWeth  = uint256(r1);
        } else if (t0 == WETH && t1 == BIGGI) {
            reserveBiggi = uint256(r1);
            reserveWeth  = uint256(r0);
        } else {
            revert PairTokenMismatch();
        }

        require(reserveBiggi > 0, "zero reserveBiggi");

        uint256 scale = 10 ** uint256(_decimals);
        uint256 priceScaled = (reserveWeth * scale) / reserveBiggi;

        roundId += 1;
        answer = int256(priceScaled);

        if (startedAt == 0) {
            startedAt = block.timestamp;
        }
        // low-risk: use full timestamp for feed metadata (pair timestamp is uint32 modulo)
        updatedAt = block.timestamp;

        answeredInRound = roundId;

        emit RoundUpdated(roundId, answer, updatedAt);
        return roundId;
    }

    /* ===== Internal ===== */

    function _requirePairMatchesTokens(IUniswapV2PairLike p, address biggi, address weth) internal view {
        address t0 = p.token0();
        address t1 = p.token1();
        bool ok = (t0 == biggi && t1 == weth) || (t0 == weth && t1 == biggi);
        if (!ok) revert PairTokenMismatch();
    }
}
