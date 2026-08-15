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
}

interface ITreasurySnapshotView {
    function polBalance() external view returns (uint256);
    function biggiBalance() external view returns (uint256);
    function totalBiggiReceivedFromBuyback() external view returns (uint256);
    function totalPolReceivedFromDistributor() external view returns (uint256);
}

contract BiggiReserveTreasuryReader {
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
        uint256 totalPolFromDistributor
    ) {
        treasuryPol = treasury.polBalance();
        treasuryBiggi = treasury.biggiBalance();
        totalBiggiFromBuyback = treasury.totalBiggiReceivedFromBuyback();
        totalPolFromDistributor = treasury.totalPolReceivedFromDistributor();
    }
}
