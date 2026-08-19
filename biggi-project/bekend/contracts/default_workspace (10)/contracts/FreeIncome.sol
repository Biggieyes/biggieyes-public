// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Vložena implementace Ownable přímo do kontraktu
contract FreeIncomeGenerator {
    address private _owner;
    uint256 public lastClaim;
    uint256 public airdropPool;
    mapping(address => bool) public hasClaimed;
    
    event DailyClaimed(address user, uint256 amount);
    event AirdropDistributed(address recipient, uint256 amount);

    constructor() {
        _owner = msg.sender;
        lastClaim = block.timestamp;
    }
    
    // Modifier pro ověření vlastníka
    modifier onlyOwner() {
        require(msg.sender == _owner, "Nejsi vlastnik");
        _;
    }
    
    function claimDaily() external {
        require(block.timestamp > lastClaim + 1 days, "Cekej 24 hodin");
        require(address(this).balance >= 0.0005 ether, "Nedostatek prostredku");
        
        lastClaim = block.timestamp;
        (bool success, ) = msg.sender.call{value: 0.0005 ether}("");
        require(success, "Chyba prevodu");
        
        emit DailyClaimed(msg.sender, 0.0005 ether);
    }
    
    function claimAirdrop() external {
        require(!hasClaimed[msg.sender], "Uz jsi claimnul");
        require(airdropPool >= 0.001 ether, "Airdrop vycerpan");
        
        hasClaimed[msg.sender] = true;
        airdropPool -= 0.001 ether;
        
        (bool success, ) = msg.sender.call{value: 0.001 ether}("");
        require(success, "Chyba prevodu");
        
        emit AirdropDistributed(msg.sender, 0.001 ether);
    }
    
    function fundContract() external payable {
        airdropPool += msg.value;
    }
    
    // Funkce pro vlastníka
    function withdrawFunds() external onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = _owner.call{value: amount}("");
        require(success, "Chyba prevodu");
    }
    
    receive() external payable {
        airdropPool += msg.value;
    }
}