// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// Minimal WETH9 kompatibilní s UniswapV2 Router
contract WETH9 {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8  public decimals = 18;
    event  Approval(address indexed owner, address indexed spender, uint value);
    event  Transfer(address indexed from, address indexed to, uint value);
    event  Deposit(address indexed dst, uint value);
    event  Withdrawal(address indexed src, uint value);

    mapping (address => uint)                       public  balanceOf;
    mapping (address => mapping (address => uint))  public  allowance;

    receive() external payable {
        deposit();
    }
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad, "insufficient");
        balanceOf[msg.sender] -= wad;
        (bool success, ) = msg.sender.call{value: wad}("");
        require(success, "withdraw failed");
        emit Withdrawal(msg.sender, wad);
    }
    function totalSupply() public view returns (uint) {
        // not tracked separately - sum of balances
        return address(this).balance;
    }
    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }
    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }
    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        if (src != msg.sender) {
            uint allowed = allowance[src][msg.sender];
            require(allowed >= wad, "insufficient-allowance");
            allowance[src][msg.sender] = allowed - wad;
        }
        require(balanceOf[src] >= wad, "insufficient-balance");
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        emit Transfer(src, dst, wad);
        return true;
    }
}
