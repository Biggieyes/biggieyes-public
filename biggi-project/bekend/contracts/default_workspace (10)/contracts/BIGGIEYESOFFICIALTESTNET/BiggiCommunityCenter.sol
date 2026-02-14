// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiCommunityCenter
 *
 * Owner-curated grants + events (bez hlasování).
 * - Pool (rezerva) v kontraktu: distributor posílá share (depositFromDistributor / receiveMintShare)
 * - Owner vytvoří event s meta (title, ipfsHash, start, end) + totalPrize
 * - Owner při vytvoření eventu přiřadí winners[] a amounts[] (per-winner amounts)
 *   -> součet amounts musí rovnat totalPrize
 * - Při vytvoření se totalPrize "zamkne" z poolBalance (rezervováno pro event)
 * - Výherci volají claim(eventId) a obdrží svůj přidělený amount
 * - Žádné refundy/cancel (NE)
 * - Owner nemá admin-override nad claim statusy (NE)
 *
 * Low-risk vylepšení:
 * - Zero-address guard u setDistributor
 * - vlastní Donation event (receive už nelže “OwnerDeposit”)
 * - zákaz duplicitních winner adres v jednom eventu (eliminuje tichou nekonzistenci)
 * - totalLocked tracking (emergencyWithdraw už nemusí loopovat všechny eventy)
 * - sjednocení revertů na custom errors tam, kde to dává smysl
 * - drobné FE helper views (canClaim + userStatus) bez změny logiky
 */

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BiggiCommunityCenter is Ownable, ReentrancyGuard, Pausable {
    using Address for address payable;

    /* ------------ Events & Errors ------------ */
    event DistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event DepositedFromDistributor(address indexed from, uint256 amount);
    event OwnerDeposit(address indexed from, uint256 amount);
    event DonationReceived(address indexed from, uint256 amount);

    event EventCreated(uint256 indexed eventId, string title, uint256 totalPrize);
    event WinnerAssigned(uint256 indexed eventId, address indexed winner, uint256 amount);
    event Claimed(uint256 indexed eventId, address indexed who, uint256 amount);

    event Rescue(address indexed to, uint256 amount);

    error NotDistributor();
    error ZeroAmount();
    error ZeroAddress();
    error BadLengths();
    error SumMismatch();
    error NotWinner();
    error AlreadyClaimed();
    error InsufficientPool();
    error EventNotExists();
    error DuplicateWinner();
    error TransferFailed();

    /* ------------ Storage ------------ */
    address public distributor; // distributor address (set by owner)

    uint256 public poolBalance; // POL available for new events (in wei)
    uint256 public totalLocked; // total locked across all events (avoids emergency loop)

    uint256 public nextEventId;

    struct EventInfo {
        string title;
        string ipfsHash;
        uint256 start;
        uint256 end;
        uint256 totalPrize; // requested total prize for event
        uint256 locked;     // how much currently locked / reserved for this event
        bool exists;
    }

    // eventId => EventInfo
    mapping(uint256 => EventInfo) public events;

    // eventId => winners array
    mapping(uint256 => address[]) private eventWinners;

    // eventId => winner => amount
    mapping(uint256 => mapping(address => uint256)) private eventAmounts;

    // eventId => winner => claimed
    mapping(uint256 => mapping(address => bool)) private eventClaimed;

    // list of all event ids
    uint256[] private allEventIds;

    /* ------------ Constructor ------------ */
    constructor(address initialOwner) Ownable(initialOwner) {
        nextEventId = 1;
    }

    /* ------------ Admin / Configuration ------------ */

    /// @notice set distributor address (owner)
    function setDistributor(address d) external onlyOwner {
        if (d == address(0)) revert ZeroAddress();
        address old = distributor;
        distributor = d;
        emit DistributorSet(old, d);
    }

    /// @notice deposit from Distributor (payable). Only distributor address can call.
    function depositFromDistributor() external payable whenNotPaused nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit DepositedFromDistributor(msg.sender, msg.value);
    }

    /// @notice compatibility: called by Distributor via selector receiveMintShare()
    function receiveMintShare() external payable whenNotPaused nonReentrant {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit DepositedFromDistributor(msg.sender, msg.value);
    }

    /// @notice owner can also top up pool manually
    function ownerDeposit() external payable onlyOwner whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit OwnerDeposit(msg.sender, msg.value);
    }

    /* ------------ Events management (owner) ------------ */

    function createEvent(
        string calldata title,
        string calldata ipfsHash,
        uint256 start,
        uint256 end,
        uint256 totalPrize,
        address[] calldata winners,
        uint256[] calldata amounts
    ) external onlyOwner whenNotPaused returns (uint256 eventId) {
        if (winners.length == 0 || winners.length != amounts.length) revert BadLengths();
        if (totalPrize == 0) revert ZeroAmount();

        // sum amounts
        uint256 s = 0;
        for (uint256 i = 0; i < amounts.length; ++i) {
            s += amounts[i];
        }
        if (s != totalPrize) revert SumMismatch();
        if (totalPrize > poolBalance) revert InsufficientPool();

        // reserve pool
        poolBalance -= totalPrize;
        totalLocked += totalPrize;

        eventId = nextEventId++;
        EventInfo storage e = events[eventId];
        e.title = title;
        e.ipfsHash = ipfsHash;
        e.start = start;
        e.end = end;
        e.totalPrize = totalPrize;
        e.locked = totalPrize;
        e.exists = true;

        // store winners + amounts
        for (uint256 i = 0; i < winners.length; ++i) {
            address w = winners[i];
            uint256 a = amounts[i];

            if (w == address(0)) revert ZeroAddress();
            if (a == 0) revert ZeroAmount();

            // prevent duplicates (otherwise mapping overwrite would cause silent inconsistency)
            if (eventAmounts[eventId][w] != 0) revert DuplicateWinner();

            eventWinners[eventId].push(w);
            eventAmounts[eventId][w] = a;

            emit WinnerAssigned(eventId, w, a);
        }

        allEventIds.push(eventId);
        emit EventCreated(eventId, title, totalPrize);
    }

    /* ------------ Claim (recipient withdraw) ------------ */

    /// @notice winner claims their amount for a given eventId
    function claim(uint256 eventId) external nonReentrant whenNotPaused {
        if (!events[eventId].exists) revert EventNotExists();

        uint256 amount = eventAmounts[eventId][msg.sender];
        if (amount == 0) revert NotWinner();
        if (eventClaimed[eventId][msg.sender]) revert AlreadyClaimed();

        // checks-effects-interactions
        eventClaimed[eventId][msg.sender] = true;

        EventInfo storage e = events[eventId];
        // sanity
        if (e.locked < amount) revert SumMismatch();

        e.locked -= amount;
        totalLocked -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Claimed(eventId, msg.sender, amount);
    }

    /* ------------ Getters for frontend / indexers ------------ */

    /// @notice list of event ids (useful for FE)
    function getEvents() external view returns (uint256[] memory) {
        return allEventIds;
    }

    /// @notice basic event data
    function getEvent(uint256 eventId)
        external
        view
        returns (
            string memory title,
            string memory ipfsHash,
            uint256 start,
            uint256 end,
            uint256 totalPrize_,
            uint256 locked,
            bool exists
        )
    {
        EventInfo storage e = events[eventId];
        return (e.title, e.ipfsHash, e.start, e.end, e.totalPrize, e.locked, e.exists);
    }

    /// @notice winners + amounts + claimed flags
    function getEventWinners(uint256 eventId)
        external
        view
        returns (address[] memory winners, uint256[] memory amounts, bool[] memory claimed)
    {
        winners = eventWinners[eventId];
        amounts = new uint256[](winners.length);
        claimed = new bool[](winners.length);

        for (uint256 i = 0; i < winners.length; ++i) {
            address w = winners[i];
            amounts[i] = eventAmounts[eventId][w];
            claimed[i] = eventClaimed[eventId][w];
        }
    }

    /// @notice how much is locked for an event
    function balanceOfEvent(uint256 eventId) external view returns (uint256) {
        return events[eventId].locked;
    }

    /// @notice check payout assigned to an address (0 if none)
    function assignedAmountOf(uint256 eventId, address who) external view returns (uint256) {
        return eventAmounts[eventId][who];
    }

    /// @notice FE helper: user status for a given event
    function userStatus(uint256 eventId, address who) external view returns (uint256 amount, bool claimed, bool exists) {
        exists = events[eventId].exists;
        amount = eventAmounts[eventId][who];
        claimed = eventClaimed[eventId][who];
    }

    /// @notice FE helper: canClaim with reason codes
    /// reason: 0=OK, 1=EventNotExists, 2=NotWinner, 3=AlreadyClaimed, 4=Paused
    function canClaim(uint256 eventId, address who) external view returns (bool ok, uint8 reason, uint256 amount) {
        if (paused()) return (false, 4, 0);
        if (!events[eventId].exists) return (false, 1, 0);

        amount = eventAmounts[eventId][who];
        if (amount == 0) return (false, 2, 0);
        if (eventClaimed[eventId][who]) return (false, 3, amount);

        return (true, 0, amount);
    }

    /* ------------ Rescue / Admin helpers ------------ */

    /// @notice owner may rescue leftover pool funds (non-locked). Locked funds per event remain.
    function rescuePool(address payable to, uint256 amount) external onlyOwner whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > poolBalance) revert InsufficientPool();
        poolBalance -= amount;
        to.sendValue(amount);
        emit Rescue(to, amount);
    }

    /// @notice emergency withdraw (owner) - sends entire contract balance that is not locked by events
    function emergencyWithdraw(address payable to) external onlyOwner whenPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();

        uint256 contractBal = address(this).balance;
        uint256 avail = contractBal > totalLocked ? (contractBal - totalLocked) : 0;
        require(avail > 0, "no avail");

        // keep poolBalance consistent: emergency withdraw should reduce free pool first
        if (avail >= poolBalance) {
            poolBalance = 0;
        } else {
            poolBalance -= avail;
        }

        to.sendValue(avail);
        emit Rescue(to, avail);
    }

    /* ------------ Pause / Unpause ------------ */
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ------------ Fallbacks ------------ */
    receive() external payable {
        if (msg.value == 0) return;

        poolBalance += msg.value;

        if (msg.sender == owner()) {
            emit OwnerDeposit(msg.sender, msg.value);
        } else if (msg.sender == distributor) {
            emit DepositedFromDistributor(msg.sender, msg.value);
        } else {
            emit DonationReceived(msg.sender, msg.value);
        }
    }
}
