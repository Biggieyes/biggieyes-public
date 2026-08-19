// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Minimal Uniswap V2-like Pair (ERC20 LP inside)
 * - mint/burn/swap/sync/skim
 * - simple invariant, no fees (suitable for local testing)
 */

interface IERC20Minimal {
    function totalSupply() external view returns (uint);
    function balanceOf(address) external view returns (uint);
    function transfer(address, uint) external returns (bool);
    function allowance(address, address) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

library Math {
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) { z = 1; }
    }
}

contract UniswapV2Pair is IERC20Minimal {
    /* ERC20 LP token */
    string public name = "UNI-V2 LP";
    string public symbol = "UNI-V2";
    uint8  public decimals = 18;

    uint public override totalSupply;
    mapping(address => uint) public override balanceOf;
    mapping(address => mapping(address => uint)) public override allowance;

    function approve(address spender, uint value) external override returns (bool) {
        allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
    }
    function transfer(address to, uint value) external override returns (bool) {
        _transfer(msg.sender, to, value); return true;
    }
    function transferFrom(address from, address to, uint value) external override returns (bool) {
        uint allowed = allowance[from][msg.sender];
        if (allowed != type(uint).max) { require(allowed >= value, "ALLOW"); allowance[from][msg.sender] = allowed - value; }
        _transfer(from, to, value); return true;
    }
    function _transfer(address from, address to, uint value) internal {
        require(balanceOf[from] >= value, "BAL");
        unchecked { balanceOf[from] -= value; balanceOf[to] += value; }
        emit Transfer(from, to, value);
    }

    /* Pair state */
    address public token0;
    address public token1;

    uint112 private reserve0;           // cached reserves
    uint112 private reserve1;
    uint32  private blockTimestampLast; // last update

    uint private constant MIN_LIQUIDITY = 1000;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(address indexed sender, uint amount0Out, uint amount1Out, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    bool private locked;
    modifier lock() { require(!locked, "LOCK"); locked = true; _; locked = false; }

    /* one-time init, volá factory */
    function initialize(address _token0, address _token1) external {
        require(token0 == address(0) && token1 == address(0), "INIT");
        require(_token0 != _token1 && _token0 != address(0) && _token1 != address(0), "ARGS");
        token0 = _token0; token1 = _token1;
    }

    /* reserves view pro router */
    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    /* internal helpers */
    function _update(uint balance0, uint balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(0xa9059cbb, to, value)); // transfer(address,uint256)
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER");
    }

    /* mint: očekává, že tokeny už dorazily na pár */
    function mint(address to) external lock returns (uint liquidity) {
        uint balance0 = _balanceOf(token0);
        uint balance1 = _balanceOf(token1);
        uint amount0 = balance0 - reserve0;
        uint amount1 = balance1 - reserve1;

        if (totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MIN_LIQUIDITY;
            _mint(address(0), MIN_LIQUIDITY); // lock minimum
        } else {
            liquidity = Math.min(
                (amount0 * totalSupply) / reserve0,
                (amount1 * totalSupply) / reserve1
            );
        }
        require(liquidity > 0, "LIQ=0");
        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /* burn: očekává, že LP tokeny už dorazily na pár */
    function burn(address to) external lock returns (uint amount0, uint amount1) {
        uint balance0 = _balanceOf(token0);
        uint balance1 = _balanceOf(token1);
        uint liquidity = balanceOf[address(this)];

        require(liquidity > 0, "NO_LP");

        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        require(amount0 > 0 && amount1 > 0, "AMT=0");

        _burn(address(this), liquidity);
        _safeTransfer(token0, to, amount0);
        _safeTransfer(token1, to, amount1);

        balance0 = _balanceOf(token0);
        balance1 = _balanceOf(token1);
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /* swap bez poplatku, kontrola invariantů */
    function swap(uint amount0Out, uint amount1Out, address to) external lock {
        require(amount0Out > 0 || amount1Out > 0, "OUT=0");
        require(amount0Out < reserve0 && amount1Out < reserve1, "LIQ");

        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);

        uint balance0 = _balanceOf(token0);
        uint balance1 = _balanceOf(token1);

        // amountIn = (newBalance - (oldReserve - out))
        uint amount0In = balance0 > (reserve0 - amount0Out) ? balance0 - (reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > (reserve1 - amount1Out) ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "NO_IN");

        // invariant x*y >= k (bez fee)
        require(balance0 * balance1 >= uint(reserve0) * uint(reserve1), "K");

        _update(balance0, balance1);
        emit Swap(msg.sender, amount0Out, amount1Out, to);
    }

    /* utility */
    function skim(address to) external lock {
        _safeTransfer(token0, to, _balanceOf(token0) - reserve0);
        _safeTransfer(token1, to, _balanceOf(token1) - reserve1);
    }

    function sync() external lock {
        _update(_balanceOf(token0), _balanceOf(token1));
    }

    /* LP mint/burn interně */
    function _mint(address to, uint value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }
    function _burn(address from, uint value) internal {
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }
    function _balanceOf(address token) internal view returns (uint) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, address(this))); // balanceOf
        require(ok && data.length >= 32, "BAL_CALL");
        return abi.decode(data, (uint));
    }
}
