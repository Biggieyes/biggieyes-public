// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * BiggiCommunityCenter
 *
 * Owner-curated grants + events (bez hlasování).
 * - Pool (rezerva) v kontraktu: distributor posílá share (depositFromDistributor)
 * - Owner vytvoří event s meta (title, ipfsHash, start, end) + totalPrize
 * - Owner při vytvoření eventu přiřadí winners[] a amounts[] (per-winner amounts)
 *   -> součet amounts musí rovnat totalPrize
 * - Při vytvoření se totalPrize "zamkne" z poolBalance (rezervováno pro event)
 * - Výherci volají claim(eventId) a obdrží svůj přidělený amount
 * - Žádné refundy/cancel (tvůj požadavek: NE)
 * - Owner nemá admin-override nad claim statusy (tvé: NE)
 *
 * Bezpečnost: ReentrancyGuard, Pausable, Ownable (constructor přijímá initialOwner).
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BiggiCommunityCenter is Ownable, ReentrancyGuard, Pausable {
    using Address for address payable;

    /* ------------ Events & Errors ------------ */
    event DistributorSet(address indexed oldDistributor, address indexed newDistributor);
    event DepositedFromDistributor(address indexed from, uint256 amount);
    event OwnerDeposit(address indexed from, uint256 amount);
    event EventCreated(uint256 indexed eventId, string title, uint256 totalPrize);
    event WinnerAssigned(uint256 indexed eventId, address indexed winner, uint256 amount);
    event Claimed(uint256 indexed eventId, address indexed who, uint256 amount);
    event Rescue(address indexed to, uint256 amount);

    error NotDistributor();
    error ZeroAmount();
    error BadLengths();
    error SumMismatch();
    error NotWinner();
    error AlreadyClaimed();
    error InsufficientPool();
    error EventNotExists();

    /* ------------ Storage ------------ */
    address public distributor; // distributor address (set by owner)

    uint256 public poolBalance; // MATIC available for new events (in wei)

    uint256 public nextEventId;

    struct EventInfo {
        string title;
        string ipfsHash;
        uint256 start;
        uint256 end;
        uint256 totalPrize;     // requested total prize for event
        uint256 locked;         // how much currently locked / reserved for this event (initially == totalPrize)
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
        // owner set by Ownable(initialOwner)
        nextEventId = 1;
    }

    /* ------------ Admin / Configuration ------------ */

    /// @notice set distributor address (owner)
    function setDistributor(address d) external onlyOwner {
        address old = distributor;
        distributor = d;
        emit DistributorSet(old, d);
    }

    /// @notice deposit from Distributor (payable). Only distributor address can call.
    function depositFromDistributor() external payable whenNotPaused {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit DepositedFromDistributor(msg.sender, msg.value);
    }

    /// @notice compatibility: called by Distributor via selector receiveMintShare()
    function receiveMintShare() external payable whenNotPaused {
        if (msg.sender != distributor) revert NotDistributor();
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit DepositedFromDistributor(msg.sender, msg.value);
    }

    /// @notice owner can also top up pool manually
    function ownerDeposit() external payable onlyOwner whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        poolBalance += msg.value;
        emit OwnerDeposit(msg.sender, msg.value);
    }

    /* ------------ Events management (owner) ------------ */

    /**
     * @notice createEvent - owner creates event and assigns winners + per-winner amounts
     * @param title human-readable title
     * @param ipfsHash arbitrary metadata pointer (IPFS hash or other)
     * @param start unix start timestamp (informational)
     * @param end unix end timestamp (informational)
     * @param totalPrize total amount to lock for this event (wei)
     * @param winners array of winner addresses
     * @param amounts array of per-winner amounts (wei) — same length as winners
     *
     * Requirements:
     *  - winners.length == amounts.length > 0
     *  - sum(amounts) == totalPrize
     *  - totalPrize <= poolBalance
     *
     * Behavior:
     *  - reserve totalPrize from poolBalance and store mapping eventAmounts
     *  - winners will be able to `claim(eventId)` to receive their assigned amount
     */
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
            require(w != address(0), "zero winner");
            require(a > 0, "zero amount");
            // accumulate in mapping
            eventWinners[eventId].push(w);
            eventAmounts[eventId][w] = a;
            // claimed flag is false by default
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

        // mark claimed first (checks-effects-interactions)
        eventClaimed[eventId][msg.sender] = true;
        // reduce locked
        EventInfo storage e = events[eventId];
        require(e.locked >= amount, "locked mismatch");
        e.locked -= amount;

        // transfer
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");

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
            uint256 totalPrize,
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
        returns (
            address[] memory winners,
            uint256[] memory amounts,
            bool[] memory claimed
        )
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

    /* ------------ Rescue / Admin helpers ------------ */

    /// @notice owner may rescue leftover pool funds (non-locked). Locked funds per event remain.
    function rescuePool(address payable to, uint256 amount) external onlyOwner whenNotPaused {
        require(to != address(0), "to0");
        require(amount <= poolBalance, "amt>pool");
        poolBalance -= amount;
        to.sendValue(amount);
        emit Rescue(to, amount);
    }

    /// @notice emergency withdraw (owner) - sends entire contract balance that is not locked by events
    function emergencyWithdraw(address payable to) external onlyOwner whenPaused {
        require(to != address(0), "to0");
        // compute total locked across events
        uint256 totalLocked = 0;
        for (uint256 i = 0; i < allEventIds.length; ++i) {
            totalLocked += events[allEventIds[i]].locked;
        }
        uint256 contractBal = address(this).balance;
        uint256 avail = 0;
        if (contractBal > totalLocked) avail = contractBal - totalLocked;
        require(avail > 0, "no avail");
        to.sendValue(avail);
        emit Rescue(to, avail);
    }

    /* ------------ Pause / Unpause ------------ */
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    /* ------------ Fallbacks ------------ */
    receive() external payable {
        // treat direct sends as owner deposit if from owner, otherwise as pool topup (not enforced)
        if (msg.sender == owner()) {
            poolBalance += msg.value;
            emit OwnerDeposit(msg.sender, msg.value);
        } else if (msg.sender == distributor) {
            poolBalance += msg.value;
            emit DepositedFromDistributor(msg.sender, msg.value);
        } else {
            // default: add to pool
            poolBalance += msg.value;
            emit OwnerDeposit(msg.sender, msg.value);
        }
    }
}
