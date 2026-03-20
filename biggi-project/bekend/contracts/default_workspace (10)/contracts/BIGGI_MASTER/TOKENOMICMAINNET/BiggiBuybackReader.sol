// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal view interfaces
interface IBuybackAgentView {
    function autoBuybackEnabled() external view returns (bool);
    function paused() external view returns (bool);
    function router() external view returns (address);
    function wrappedNative() external view returns (address);
    function treasury() external view returns (address);
    function policy() external view returns (address);
    function dripLM() external view returns (address);
    function keeper() external view returns (address);
    function lastBuybackAt() external view returns (uint256);
    function totalNativeReceived() external view returns (uint256);
    function totalNativeSpent() external view returns (uint256);
    function totalBiggiAcquired() external view returns (uint256);
    function nativeBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
}

interface ITreasuryView {
    function polBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function totalPolReceivedFromDistributor() external view returns (uint256);
    function totalBiggiReceivedFromBuyback() external view returns (uint256);
}

interface IPolicyView {
    function swapSlippageBps() external view returns (uint256);
    function txDeadlineSec() external view returns (uint256);
    function minBuybackInterval() external view returns (uint256);
    function buybacksPaused() external view returns (bool);
    function maxDailyBuybackNative() external view returns (uint256);
    function usedToday() external view returns (uint256);
    function dayIndex() external view returns (uint64);
}

interface IBuybackKeeperProxyView {
    function minNativeThresholdWei() external view returns (uint256);
    function paused() external view returns (bool);
    function allowedCaller() external view returns (address);
    function agent() external view returns (IBuybackAgentView);
}

/**
 * @title BiggiBuybackReader
 * @notice Read-only agregátor pro FE/monitoring — žádné settery, žádné změny stavu.
 */
contract BiggiBuybackReader {
    IBuybackAgentView public immutable agent;
    ITreasuryView public immutable treasury;
    IPolicyView public immutable policy;
    IBuybackKeeperProxyView public immutable keeperProxy; // optional, může být address(0)

    constructor(address agent_, address treasury_, address policy_, address keeperProxy_) {
        require(agent_ != address(0) && treasury_ != address(0), "zero addr");
        agent = IBuybackAgentView(agent_);
        treasury = ITreasuryView(treasury_);
        policy = IPolicyView(policy_);
        keeperProxy = keeperProxy_ == address(0) ? IBuybackKeeperProxyView(address(0)) : IBuybackKeeperProxyView(keeperProxy_);
    }

    struct AgentSnapshot {
        bool autoBuybackEnabled;
        bool paused;
        address router;
        address wrappedNative;
        address treasury;
        address policy;
        address dripLM;
        address keeper;
        uint256 lastBuybackAt;
        uint256 totalNativeReceived;
        uint256 totalNativeSpent;
        uint256 totalBiggiAcquired;
        uint256 nativeBalance;
        uint256 biggiBalance;
    }

    struct TreasurySnapshot {
        uint256 polBalance;
        uint256 biggiBalance;
        uint256 totalPolReceived;
        uint256 totalBiggiReceived;
    }

    struct PolicySnapshot {
        uint256 swapSlippageBps;
        uint256 txDeadlineSec;
        uint256 minBuybackInterval;
        bool buybacksPaused;
        uint256 maxDailyBuybackNative;
        uint256 usedToday;
        uint64 dayIndex;
    }

    struct KeeperProxySnapshot {
        uint256 minNativeThresholdWei;
        bool paused;
        address allowedCaller;
        address agent;
    }

    function snapshot() external view returns (
        AgentSnapshot memory a,
        TreasurySnapshot memory t,
        PolicySnapshot memory p,
        KeeperProxySnapshot memory k
    ) {
        a.treasury = address(treasury);
        a.policy = address(policy);
        if (address(agent) != address(0)) {
            try agent.autoBuybackEnabled() returns (bool v) { a.autoBuybackEnabled = v; } catch {}
            try agent.paused() returns (bool v) { a.paused = v; } catch {}
            try agent.router() returns (address v) { a.router = v; } catch {}
            try agent.wrappedNative() returns (address v) { a.wrappedNative = v; } catch {}
            try agent.treasury() returns (address v) { a.treasury = v; } catch {}
            try agent.policy() returns (address v) { a.policy = v; } catch {}
            try agent.dripLM() returns (address v) { a.dripLM = v; } catch {}
            try agent.keeper() returns (address v) { a.keeper = v; } catch {}
            try agent.lastBuybackAt() returns (uint256 v) { a.lastBuybackAt = v; } catch {}
            try agent.totalNativeReceived() returns (uint256 v) { a.totalNativeReceived = v; } catch {}
            try agent.totalNativeSpent() returns (uint256 v) { a.totalNativeSpent = v; } catch {}
            try agent.totalBiggiAcquired() returns (uint256 v) { a.totalBiggiAcquired = v; } catch {}
            try agent.nativeBalance() returns (uint256 v) { a.nativeBalance = v; } catch {}
            try agent.biggiBalance() returns (uint256 v) { a.biggiBalance = v; } catch {}
        }

        if (address(treasury) != address(0)) {
            try treasury.polBalance() returns (uint256 v) { t.polBalance = v; } catch {}
            try treasury.biggiBalance() returns (uint256 v) { t.biggiBalance = v; } catch {}
            try treasury.totalPolReceivedFromDistributor() returns (uint256 v) { t.totalPolReceived = v; } catch {}
            try treasury.totalBiggiReceivedFromBuyback() returns (uint256 v) { t.totalBiggiReceived = v; } catch {}
        }

        if (address(policy) != address(0)) {
            try policy.swapSlippageBps() returns (uint256 v) { p.swapSlippageBps = v; } catch {}
            try policy.txDeadlineSec() returns (uint256 v) { p.txDeadlineSec = v; } catch {}
            try policy.minBuybackInterval() returns (uint256 v) { p.minBuybackInterval = v; } catch {}
            try policy.buybacksPaused() returns (bool v) { p.buybacksPaused = v; } catch {}
            try policy.maxDailyBuybackNative() returns (uint256 v) { p.maxDailyBuybackNative = v; } catch {}
            try policy.usedToday() returns (uint256 v) { p.usedToday = v; } catch {}
            try policy.dayIndex() returns (uint64 v) { p.dayIndex = v; } catch {}
        }

        k.agent = address(agent);
        if (address(keeperProxy) != address(0)) {
            try keeperProxy.minNativeThresholdWei() returns (uint256 v) { k.minNativeThresholdWei = v; } catch {}
            try keeperProxy.paused() returns (bool v) { k.paused = v; } catch {}
            try keeperProxy.allowedCaller() returns (address v) { k.allowedCaller = v; } catch {}
            try keeperProxy.agent() returns (IBuybackAgentView v) { k.agent = address(v); } catch {}
        }
    }
}

