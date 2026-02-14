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
        a = AgentSnapshot({
            autoBuybackEnabled: agent.autoBuybackEnabled(),
            paused: agent.paused(),
            router: agent.router(),
            wrappedNative: agent.wrappedNative(),
            treasury: agent.treasury(),
            policy: agent.policy(),
            dripLM: agent.dripLM(),
            keeper: agent.keeper(),
            lastBuybackAt: agent.lastBuybackAt(),
            totalNativeReceived: agent.totalNativeReceived(),
            totalNativeSpent: agent.totalNativeSpent(),
            totalBiggiAcquired: agent.totalBiggiAcquired(),
            nativeBalance: agent.nativeBalance(),
            biggiBalance: agent.biggiBalance()
        });

        t = TreasurySnapshot({
            polBalance: treasury.polBalance(),
            biggiBalance: treasury.biggiBalance(),
            totalPolReceived: treasury.totalPolReceivedFromDistributor(),
            totalBiggiReceived: treasury.totalBiggiReceivedFromBuyback()
        });

        p = PolicySnapshot({
            swapSlippageBps: policy.swapSlippageBps(),
            txDeadlineSec: policy.txDeadlineSec(),
            minBuybackInterval: policy.minBuybackInterval(),
            buybacksPaused: policy.buybacksPaused(),
            maxDailyBuybackNative: policy.maxDailyBuybackNative(),
            usedToday: policy.usedToday(),
            dayIndex: policy.dayIndex()
        });

        if (address(keeperProxy) != address(0)) {
            k = KeeperProxySnapshot({
                minNativeThresholdWei: keeperProxy.minNativeThresholdWei(),
                paused: keeperProxy.paused(),
                allowedCaller: keeperProxy.allowedCaller(),
                agent: address(keeperProxy.agent())
            });
        }
    }
}

