// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 MultiCollectionDistributor.sol - minimalistická, kompatibilní verze

 - pevné rozdělení: 25% CollectionRewards, 35% Reserve, 20% Buyback, 10% Treasury, 10% Community
 - whitelist kolekcí (owner spravuje)
 - volání příjemců pomocí receiveMintShare() (payable function)
 - pokud volání selže -> částka uložíme do pending[recipient]
 - owner může retryPending (celkem nebo částečně) a withdraw (nesmí převést částky kryté pending)
 - trackujeme totalReceived a receivedByCollection
 - pausable, nonReentrant
*/

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./Library/BiggiBpsLib.sol";

contract MultiCollectionDistributor is Ownable, ReentrancyGuard, Pausable {
    // pevné BPS (basis points) – nyní z BiggiBpsLib
    // BiggiBpsLib.DIST_COLLECTION_BPS
    // BiggiBpsLib.DIST_RESERVE_BPS
    // BiggiBpsLib.DIST_BUYBACK_BPS
    // BiggiBpsLib.DIST_TREASURY_BPS
    // BiggiBpsLib.DIST_COMMUNITY_BPS

    // cílové adresy (musí nastavit owner)
    address public collectionRewards;
    address public reserve;
    address public buybackAgent;
    address public treasury;
    address public communityCenter;

    // whitelist kolekcí (které mohou volat distribute)
    mapping(address => bool) public collections;

    // pending zůstatky pro příjemce (když forward selže)
    mapping(address => uint256) public pending;
    uint256 public totalPending; // součet všech pending (pomůže kontrolovat withdrawy ownera)

    // účetnictví
    uint256 public totalReceived;
    mapping(address => uint256) public receivedByCollection;

    // selector pro volání receiveMintShare()
    bytes4 private constant RECV_SELECTOR = bytes4(keccak256("receiveMintShare()"));

    /* ====== Events ====== */
    event CollectionAdded(address indexed coll);
    event CollectionRemoved(address indexed coll);

    event RecipientSet(string indexed name, address indexed oldAddr, address indexed newAddr);

    event MintShareReceived(address indexed collection, uint256 amount);

    event ForwardSucceeded(address indexed recipient, uint256 amount);
    event ForwardFailed(address indexed recipient, uint256 amount); // uložen v pending

    event PendingRetried(address indexed recipient, uint256 amount, bool success);
    event PendingPartiallyRetried(address indexed recipient, uint256 amount, bool success);
    event PendingWithdrawn(address indexed to, uint256 amount);

    event TreasuryRemainderHandled(uint256 remainder);

    /* ====== Modifiers ====== */
    modifier onlyWhitelisted() {
        require(collections[msg.sender], "Distributor: caller not whitelisted");
        _;
    }

    // Konstruktor: owner nastavíme při deployi
    constructor(address initialOwner) Ownable(initialOwner) {}

    /* ====== Owner management for whitelist & recipients ====== */

    function addCollection(address coll) external onlyOwner {
        require(coll != address(0), "zero");
        collections[coll] = true;
        emit CollectionAdded(coll);
    }

    function removeCollection(address coll) external onlyOwner {
        require(coll != address(0), "zero");
        collections[coll] = false;
        emit CollectionRemoved(coll);
    }

    function setCollectionRewards(address addr) external onlyOwner {
        emit RecipientSet("collectionRewards", collectionRewards, addr);
        collectionRewards = addr;
    }
    function setReserve(address addr) external onlyOwner {
        emit RecipientSet("reserve", reserve, addr);
        reserve = addr;
    }
    function setBuybackAgent(address addr) external onlyOwner {
        emit RecipientSet("buybackAgent", buybackAgent, addr);
        buybackAgent = addr;
    }
    function setTreasury(address addr) external onlyOwner {
        emit RecipientSet("treasury", treasury, addr);
        treasury = addr;
    }
    function setCommunityCenter(address addr) external onlyOwner {
        emit RecipientSet("communityCenter", communityCenter, addr);
        communityCenter = addr;
    }

    /* ====== Main entrypoint called by collection on mint ======
       - payable, onlyWhitelisted
       - splits msg.value according to fixed BPS
       - attempts to call recipient.receiveMintShare() with value; if call fails -> pending[recipient] += amt
       - remainder after integer division goes to treasury
    */
    function distribute() external payable nonReentrant whenNotPaused onlyWhitelisted {
        _distributeFrom(msg.sender, msg.value);
    }

    // compatibility wrapper — umožní volání přímo s selectorem receiveMintShare()
    function receiveMintShare() external payable nonReentrant whenNotPaused {
        require(collections[msg.sender], "Distributor: caller not whitelisted");
        _distributeFrom(msg.sender, msg.value);
    }

    // interní logika rozdělení (využívají ji oba wrappery)
    function _distributeFrom(address collection, uint256 value) internal {
        require(value > 0, "no value");

        // sanity: všechny recipients musí být nastaveny
        require(
            collectionRewards != address(0) &&
            reserve != address(0) &&
            buybackAgent != address(0) &&
            treasury != address(0) &&
            communityCenter != address(0),
            "recips not set"
        );

        // account
        totalReceived += value;
        receivedByCollection[collection] += value;
        emit MintShareReceived(collection, value);

        // spočítat díly přes BiggiBpsLib
        uint256 shareCollection = BiggiBpsLib.part(value, BiggiBpsLib.DIST_COLLECTION_BPS);
        uint256 shareReserve    = BiggiBpsLib.part(value, BiggiBpsLib.DIST_RESERVE_BPS);
        uint256 shareBuyback    = BiggiBpsLib.part(value, BiggiBpsLib.DIST_BUYBACK_BPS);
        uint256 shareTreasury   = BiggiBpsLib.part(value, BiggiBpsLib.DIST_TREASURY_BPS);
        uint256 shareCommunity  = BiggiBpsLib.part(value, BiggiBpsLib.DIST_COMMUNITY_BPS);

        uint256 sumShares = shareCollection + shareReserve + shareBuyback + shareTreasury + shareCommunity;

        // remainder (kvůli dělení) přidáme do treasury (aby nic nezůstalo "viset")
        if (value > sumShares) {
            uint256 remainder = value - sumShares;
            shareTreasury += remainder;
            sumShares += remainder;
            emit TreasuryRemainderHandled(remainder);
        }

        // forwardovat jednotlivě voláním receiveMintShare()
        _tryForwardWithFunc(collectionRewards, shareCollection);
        _tryForwardWithFunc(reserve, shareReserve);
        _tryForwardWithFunc(buybackAgent, shareBuyback);
        _tryForwardWithFunc(treasury, shareTreasury);
        _tryForwardWithFunc(communityCenter, shareCommunity);

        // všechny forward operace provedeny (pokud některá selhala -> jsou v pending)
    }

    // interní pomocník: zkus zavolat recipient.receiveMintShare() s hodnotou; při neúspěchu -> pending
    function _tryForwardWithFunc(address recipient, uint256 amt) internal {
        if (amt == 0) return;

        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);

        (bool ok, ) = recipient.call{value: amt}(payload);
        if (ok) {
            emit ForwardSucceeded(recipient, amt);
        } else {
            pending[recipient] += amt;
            totalPending += amt;
            emit ForwardFailed(recipient, amt);
        }
    }

    /* ====== Admin: retry pending for a specific recipient (owner) ====== */
    function retryPending(address recipient) external onlyOwner nonReentrant {
        uint256 amt = pending[recipient];
        require(amt > 0, "no pending");

        pending[recipient] = 0;
        totalPending -= amt;

        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amt}(payload);

        if (ok) {
            emit PendingRetried(recipient, amt, true);
        } else {
            pending[recipient] = amt;
            totalPending += amt;
            emit PendingRetried(recipient, amt, false);
        }
    }

    function retryPendingAmount(address recipient, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "zero amount");
        uint256 available = pending[recipient];
        require(available >= amount, "not enough pending");

        pending[recipient] = available - amount;
        totalPending -= amount;

        bytes memory payload = abi.encodeWithSelector(RECV_SELECTOR);
        (bool ok, ) = recipient.call{value: amount}(payload);

        if (ok) {
            emit PendingPartiallyRetried(recipient, amount, true);
        } else {
            pending[recipient] = available;
            totalPending += amount;
            emit PendingPartiallyRetried(recipient, amount, false);
        }
    }

    /* ====== Owner: možnost stáhnout (withdraw) ETH z kontraktu ====== */
    function withdrawEther(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "to0");
        uint256 freeBal = address(this).balance - totalPending;
        require(amount <= freeBal, "insufficient free balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
        emit PendingWithdrawn(to, amount);
    }

    /* ====== View helpers ====== */
    function pendingOf(address recipient) external view returns (uint256) {
        return pending[recipient];
    }

    /* ====== Emergency: pause/unpause ====== */
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    /* ====== Fallback / receive ====== */
    receive() external payable {
        // umožněno přijímat ETH mimo distribute (např. manuální top-up)
    }
}
