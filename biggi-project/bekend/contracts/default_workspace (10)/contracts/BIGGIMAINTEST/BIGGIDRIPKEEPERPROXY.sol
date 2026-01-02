// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  DripKeeperProxy.sol
  - proxy / keeper gateway pro BiggiDripLiquidityManager.dripOnBuy(uint256)
  - owner spravuje seznam keeperů (adresy které mohou volat)
  - podporuje:
      * performDrip(uint256) - manuální / keeper volání
      * performUpkeep(bytes) - pro Chainlink Automation (performData = abi.encode(uint256 biggiBought))
      * checkUpkeep(bytes) - jednoduchý echo (vrátí performData)
  - pokud volání dripOnBuy selže, funkce revertuje (záměrně, aby keepery/automation viděly chybu)
*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract DripKeeperProxy is Ownable, ReentrancyGuard, Pausable {
    // adresa dripLM (BiggiDripLiquidityManager)
    address public dripLM;

    // whitelisted keepers (např. chainlink nodes / orchestrators)
    mapping(address => bool) public keepers;

    event KeeperSet(address indexed who, bool allowed);
    event DripLMSet(address indexed oldAddr, address indexed newAddr);
    event DripCalled(address indexed caller, uint256 biggiBought, bytes returnData);

    modifier onlyKeeperOrOwner() {
        require(msg.sender == owner() || keepers[msg.sender], "proxy: only keeper/owner");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    /* ===== admin setters ===== */
    function setDripLM(address _dripLM) external onlyOwner {
        emit DripLMSet(dripLM, _dripLM);
        dripLM = _dripLM;
    }

    function setKeeper(address who, bool allowed) external onlyOwner {
        keepers[who] = allowed;
        emit KeeperSet(who, allowed);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ===== core: direct keeper call ===== */
    /// @notice Keeper / owner can call this to invoke dripOnBuy on dripLM
    function performDrip(uint256 biggiBought) external nonReentrant whenNotPaused onlyKeeperOrOwner {
        _forwardDripCall(biggiBought);
    }

    /// @notice Low-level wrapper used by performUpkeep and manual call
    function _forwardDripCall(uint256 biggiBought) internal {
        require(dripLM != address(0), "proxy: dripLM not set");
        // encode call to dripOnBuy(uint256)
        bytes memory payload = abi.encodeWithSelector(bytes4(keccak256("dripOnBuy(uint256)")), biggiBought);

        (bool ok, bytes memory ret) = dripLM.call{ gas: gasleft() }(payload);

        // emit for audit
        emit DripCalled(msg.sender, biggiBought, ret);

        // revert on failure to make automation aware of failure
        require(ok, "proxy: dripOnBuy failed");
    }

    /* ===== Chainlink-friendly interface =====
       - performData: abi.encode(uint256 biggiBought)
       - checkUpkeep: basic echo (user/operator should implement off-chain condition)
    */
    // changed to pure to silence "can be restricted to pure" warning
    function checkUpkeep(bytes calldata performData) external pure returns (bool upkeepNeeded, bytes memory) {
        // Simple: we can't (and shouldn't) decide upkeep logic on-chain here.
        // Return (true, performData) to allow Upkeep registry to call performUpkeep with same data.
        upkeepNeeded = true;
        return (upkeepNeeded, performData);
    }

    /// @notice Called by Chainlink Automation (or any caller). performData = abi.encode(uint256 biggiBought)
    function performUpkeep(bytes calldata performData) external nonReentrant whenNotPaused onlyKeeperOrOwner {
        // decode biggiBought
        require(performData.length == 32, "proxy: bad performData");
        uint256 biggiBought = abi.decode(performData, (uint256));
        _forwardDripCall(biggiBought);
    }

    /* ===== emergency helper: call arbitrary function on dripLM (owner only) =====
       - for debugging, upgrade or calling extended functions on dripLM
    */
    function ownerCallDripLM(bytes calldata data) external onlyOwner nonReentrant whenNotPaused returns (bool ok, bytes memory ret) {
        require(dripLM != address(0), "proxy: dripLM not set");
        (ok, ret) = dripLM.call(data);
        emit DripCalled(msg.sender, 0, ret);
        return (ok, ret);
    }

    // allow receiving native refunds (if any)
    receive() external payable {}
    fallback() external payable {}
}
