// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiBuybackUpkeepProxy (OZ Ownable(initialOwner))
 * - Proxy pro Chainlink Automation (keeper) k volání buybackAgenta.
 * - checkUpkeep: ověří lokální paused, existence agenta, threshold, policy a cooldown.
 * - performUpkeep: bezpečně zavolá agent.buybackAllToTreasury(0) v try/catch, proxy nezarevertuje při chybě agenta.
 */

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBiggiPolicy {
    function buybacksPaused() external view returns (bool);
    function minBuybackInterval() external view returns (uint256);
}

interface IBiggiBuybackAgent {
    function policy() external view returns (IBiggiPolicy);
    function lastBuybackAt() external view returns (uint256);
    function buybackAllToTreasury(uint256 minOut) external;
    function nativeBalance() external view returns (uint256); // view helper (preferred)
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData);
    function performUpkeep(bytes calldata) external;
}

contract BiggiBuybackUpkeepProxy is AutomationCompatibleInterface, Ownable {
    // --- state ---
    IBiggiBuybackAgent public agent;
    uint256 public minNativeThresholdWei; // např. 1e18 = 1 POL
    bool public paused;

    // --- events ---
    event AgentSet(address indexed agent);
    event ThresholdSet(uint256 weiAmount);
    event PausedSet(bool paused);
    event Performed(bool success, uint256 nativeBalanceAtCall);
    event PerformFailed(string reason);

    // Deploy s ownerem (multisig) => Ownable(initialOwner)
    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- admin ---
    function setAgent(address a) external onlyOwner {
        require(a != address(0), "ZERO_AGENT");
        agent = IBiggiBuybackAgent(a);
        emit AgentSet(a);
    }
    function setThreshold(uint256 t) external onlyOwner {
        require(t > 0, "THRESHOLD_ZERO");
        minNativeThresholdWei = t;
        emit ThresholdSet(t);
    }
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    // --- automation ---
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (paused) return (false, bytes("PAUSED_LOCAL"));
        if (address(agent) == address(0)) return (false, bytes("NO_AGENT"));
        if (minNativeThresholdWei == 0) return (false, bytes("NO_THRESHOLD"));

        // policy checks via agent
        IBiggiPolicy pol = agent.policy();
        if (address(pol) == address(0)) return (false, bytes("NO_POLICY"));
        if (pol.buybacksPaused()) return (false, bytes("PAUSED_POLICY"));

        uint256 last = agent.lastBuybackAt();
        uint256 cool = pol.minBuybackInterval();
        if (cool > 0 && last != 0 && block.timestamp < last + cool) {
            return (false, bytes("COOLDOWN"));
        }

        // preferovaný check přes agent.nativeBalance() pokud implementováno
        uint256 nativeBal = agent.nativeBalance();
        if (nativeBal < minNativeThresholdWei) return (false, bytes("LOW_BALANCE"));

        // pokud vše OK, do performData vracíme adresu agenta a threshold (keeper může použít)
        return (true, abi.encode(address(agent), minNativeThresholdWei));
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        if (paused) {
            emit PerformFailed("PAUSED_LOCAL");
            return;
        }
        if (address(agent) == address(0)) {
            emit PerformFailed("NO_AGENT_AT_PERFORM");
            return;
        }
        if (minNativeThresholdWei == 0) {
            emit PerformFailed("NO_THRESHOLD_AT_PERFORM");
            return;
        }

        uint256 nativeBal = agent.nativeBalance();

        if (nativeBal < minNativeThresholdWei) {
            emit PerformFailed("LOW_BALANCE_AT_PERFORM");
            return;
        }

        // bezpečné volání: pokud agent revertne, proxy nezarevertuje a jen zaloguje
        try agent.buybackAllToTreasury(0) {
            emit Performed(true, nativeBal);
        } catch Error(string memory reason) {
            emit PerformFailed(reason);
            emit Performed(false, nativeBal);
        } catch {
            emit PerformFailed("BUYBACK_CALL_REVERT");
            emit Performed(false, nativeBal);
        }
    }
}
