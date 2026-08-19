// SPDX-License-Identifier: AUTOMATIC_INCOME
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

contract AutoIncomeGenerator is AutomationCompatibleInterface, VRFConsumerBaseV2 {
    // Chainlink nastavení
    VRFCoordinatorV2Interface private immutable VRF_COORDINATOR;
    uint64 private immutable SUBSCRIPTION_ID;
    bytes32 private immutable KEY_HASH;
    
    // Automatické příjmy
    uint256 public lastExecution;
    uint256 public generatedIncome;
    address public immutable OWNER;
    
    // Stavy systému
    enum SystemState { IDLE, REQUESTING, PROCESSING }
    SystemState public state;
    
    // Finanční tok
    uint256 public constant DAILY_RATE = 0.01 ether; // ~3 ETH měsíčně
    uint256 public constant MAX_DAILY_CLAIM = 0.05 ether;
    uint256 public dailyClaimed;
    
    // VRF pro náhodnost
    uint256 public lastRandom;
    uint256 public requestId;
    
    event IncomeGenerated(uint256 amount, uint256 timestamp);
    event RandomProcessed(uint256 randomValue);
    event AutomationTriggered(uint256 timestamp);

    constructor(
        address vrfCoordinator,
        uint64 subscriptionId,
        bytes32 keyHash
    ) VRFConsumerBaseV2(vrfCoordinator) {
        VRF_COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        SUBSCRIPTION_ID = subscriptionId;
        KEY_HASH = keyHash;
        OWNER = msg.sender;
        lastExecution = block.timestamp;
    }
    
    // Automatické generování příjmů
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = (block.timestamp - lastExecution > 1 days) && (dailyClaimed < MAX_DAILY_CLAIM);
    }
    
    function performUpkeep(bytes calldata) external override {
        require((block.timestamp - lastExecution) > 1 days, "Too soon");
        require(dailyClaimed < MAX_DAILY_CLAIM, "Daily limit reached");
        
        state = SystemState.REQUESTING;
        requestId = VRF_COORDINATOR.requestRandomWords(
            KEY_HASH,
            SUBSCRIPTION_ID,
            3, // Počet konfirmací
            100000, // Gas limit
            1 // Počet náhodných čísel
        );
        
        emit AutomationTriggered(block.timestamp);
    }
    
    // Zpracování náhodnosti
    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        require(state == SystemState.REQUESTING, "Invalid state");
        
        lastRandom = randomWords[0];
        state = SystemState.PROCESSING;
        
        _generateIncome();
    }
    
    // Generování příjmu
    function _generateIncome() private {
        uint256 amount = DAILY_RATE + (lastRandom % (MAX_DAILY_CLAIM - DAILY_RATE));
        
        // Bezpečnostní omezení
        if (dailyClaimed + amount > MAX_DAILY_CLAIM) {
            amount = MAX_DAILY_CLAIM - dailyClaimed;
        }
        
        generatedIncome += amount;
        dailyClaimed += amount;
        lastExecution = block.timestamp;
        state = SystemState.IDLE;
        
        emit IncomeGenerated(amount, block.timestamp);
    }
    
    // Výběr prostředků
    function withdraw() external {
        require(msg.sender == OWNER, "Not owner");
        require(address(this).balance >= generatedIncome, "Insufficient balance");
        
        uint256 amount = generatedIncome;
        generatedIncome = 0;
        
        (bool success, ) = OWNER.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // Příjem externích plateb
    receive() external payable {}
    
    // Ruční trigger pro testování
    function manualTrigger() external {
        require(msg.sender == OWNER, "Not owner");
        _generateIncome();
    }
}