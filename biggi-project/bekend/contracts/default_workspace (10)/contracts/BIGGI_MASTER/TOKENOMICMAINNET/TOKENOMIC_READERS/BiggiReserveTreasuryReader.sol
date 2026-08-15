// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiReserveTreasuryReader
 * Kompaktní snapshoty pro Reserve a Treasury, aby FE nemusel volat více getterů.
 */

interface IReserveSnapshotView {
    function polBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function waitingBiggi() external view returns (uint256);
    function dexRefillBiggi() external view returns (uint256);
    function totalPolReceived() external view returns (uint256);
    function liquidityManager() external view returns (address);
    function distributor() external view returns (address);
    function notifyCallerCheckEnabled() external view returns (bool);
    function notifyCallers(address caller) external view returns (bool);
    function isBucketConsistent() external view returns (bool);
}

interface ITreasurySnapshotView {
    function polBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function totalBiggiReceivedFromBuyback() external view returns (uint256);
    function totalBiggiReceivedFromEcosystem() external view returns (uint256);
    function totalPolReceivedFromDistributor() external view returns (uint256);
    function distributor() external view returns (address);
    function buybackAgent() external view returns (address);
    function tokenRewards() external view returns (address);
    function reserveAddr() external view returns (address);
    function dripDistributor() external view returns (address);
    function ecosystemBiggiCallers(address caller) external view returns (bool);
}

contract BiggiReserveTreasuryReader {
    struct EcosystemBiggiRouteSnapshot {
        address treasury;
        address reserve;
        address ticketHub;
        address publicCollection;
        address tokenRewards;
        address reserveRecipient;
        address dripDistributor;
        bool ticketHubAllowed;
        bool publicCollectionAllowed;
        bool reserveNotifyTreasuryAllowed;
        bool reserveNotifyCheckEnabled;
        bool splitRecipientsConfigured;
        bool routeReady;
    }

    struct WiringSnapshot {
        address reserve;
        address treasury;
        address reserveLiquidityManager;
        address reserveDistributor;
        address treasuryDistributor;
        address treasuryBuybackAgent;
        address treasuryTokenRewards;
        address treasuryReserveRecipient;
        address treasuryDripDistributor;
        bool reserveBucketConsistent;
    }

    IReserveSnapshotView public immutable reserve;
    ITreasurySnapshotView public immutable treasury;

    constructor(address reserve_, address treasury_) {
        require(reserve_ != address(0) && treasury_ != address(0), "zero addr");
        reserve = IReserveSnapshotView(reserve_);
        treasury = ITreasurySnapshotView(treasury_);
    }

    function reserveSnapshot() external view returns (
        uint256 reservePol,
        uint256 reserveBiggi,
        uint256 waiting,
        uint256 dexRefill,
        uint256 totalReceivedPol
    ) {
        reservePol = reserve.polBalance();
        reserveBiggi = reserve.biggiBalance();
        waiting = reserve.waitingBiggi();
        dexRefill = reserve.dexRefillBiggi();
        totalReceivedPol = reserve.totalPolReceived();
    }

    function treasurySnapshot() external view returns (
        uint256 treasuryPol,
        uint256 treasuryBiggi,
        uint256 totalBiggiFromBuyback,
        uint256 totalBiggiFromEcosystem,
        uint256 totalPolFromDistributor
    ) {
        treasuryPol = treasury.polBalance();
        treasuryBiggi = treasury.biggiBalance();
        totalBiggiFromBuyback = treasury.totalBiggiReceivedFromBuyback();
        totalBiggiFromEcosystem = treasury.totalBiggiReceivedFromEcosystem();
        totalPolFromDistributor = treasury.totalPolReceivedFromDistributor();
    }

    function wiringSnapshot() external view returns (WiringSnapshot memory s) {
        s.reserve = address(reserve);
        s.treasury = address(treasury);
        s.reserveLiquidityManager = reserve.liquidityManager();
        s.reserveDistributor = reserve.distributor();
        s.reserveBucketConsistent = reserve.isBucketConsistent();
        s.treasuryDistributor = treasury.distributor();
        s.treasuryBuybackAgent = treasury.buybackAgent();
        s.treasuryTokenRewards = treasury.tokenRewards();
        s.treasuryReserveRecipient = treasury.reserveAddr();
        s.treasuryDripDistributor = treasury.dripDistributor();
    }

    function ecosystemBiggiRouteSnapshot(
        address ticketHub,
        address publicCollection,
        address expectedTokenRewards,
        address expectedDripDistributor
    ) external view returns (EcosystemBiggiRouteSnapshot memory s) {
        s.treasury = address(treasury);
        s.reserve = address(reserve);
        s.ticketHub = ticketHub;
        s.publicCollection = publicCollection;
        s.tokenRewards = treasury.tokenRewards();
        s.reserveRecipient = treasury.reserveAddr();
        s.dripDistributor = treasury.dripDistributor();
        s.reserveNotifyCheckEnabled = reserve.notifyCallerCheckEnabled();

        if (ticketHub != address(0)) {
            s.ticketHubAllowed = treasury.ecosystemBiggiCallers(ticketHub);
        }
        if (publicCollection != address(0)) {
            s.publicCollectionAllowed = treasury.ecosystemBiggiCallers(publicCollection);
        }
        s.reserveNotifyTreasuryAllowed = reserve.notifyCallers(address(treasury));

        s.splitRecipientsConfigured =
            s.tokenRewards != address(0) &&
            s.reserveRecipient == address(reserve) &&
            s.dripDistributor != address(0) &&
            (expectedTokenRewards == address(0) || s.tokenRewards == expectedTokenRewards) &&
            (expectedDripDistributor == address(0) || s.dripDistributor == expectedDripDistributor);

        s.routeReady =
            s.ticketHubAllowed &&
            s.publicCollectionAllowed &&
            s.reserveNotifyTreasuryAllowed &&
            s.splitRecipientsConfigured;
    }
}
