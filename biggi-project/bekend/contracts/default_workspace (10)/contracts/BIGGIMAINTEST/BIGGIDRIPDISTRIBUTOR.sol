// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./BiggiErrorsLib.sol";
import "./BiggiCapsLib.sol";

/// @notice DripDistributor — účetní kontrakt držící BIGGI tokeny pro DripLM.
/// - má CAP nezávislý na treasury — znamená to, že projekt
///   může mintnout/poslat na tento kontrakt až DRIP_DISTRIBUTOR_CAP BIGGI a DripDistributor s nimi
///   bude pracovat nezávisle na treasury toku.
/// - collections[] = whitelist kolekcí, které mohou volat notifyMint (accounting).
contract DripDistributor is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable BIGGI;

    address public dripLM;
    address public treasury;

    // počet tokenů (v raw units) které se alokují do availableTokens za 1 mint (accounting)
    uint256 public tokensPerMint;

    // účetní stav: kolik tokenů může být claimnuto DripLM (accounting)
    uint256 public availableTokens;

    // skutečné top-up / minty poslané do kontraktu
    uint256 public totalTopUp;      // skutečné tokeny přijaty (transferFrom / mint sem)
    uint256 public totalClaimed;
    uint256 public totalNotified;   // účetní notifikace (notifyMint) — sum of accounting allocations

    // CAP z knihovny BiggiCapsLib
    uint256 public constant CAP = BiggiCapsLib.DRIP_DISTRIBUTOR_CAP;

    // whitelist kolekcí (jen ty mohou volat notifyMint)
    mapping(address => bool) public collections;

    /* ===== events ===== */
    event CollectionSet(address indexed coll, bool allowed);
    event DripLMSet(address indexed oldLM, address indexed newLM);
    event TreasurySet(address indexed oldT, address indexed newT);
    event TokensPerMintSet(uint256 oldVal, uint256 newVal);
    event NotifyMint(address indexed coll, uint256 count, uint256 tokensAdded);
    event Claimed(address indexed to, uint256 amount);
    event TopUp(address indexed from, uint256 amount);
    event NotifyTokenMint(address indexed tokenContract, uint256 amount);
    event RescueERC20(address token, address to, uint256 amount);
    event RescueNative(address to, uint256 amount);

    /* ===== modifiers ===== */
    modifier onlyDripLM() {
        if (msg.sender != dripLM) revert BiggiErrorsLib.OnlyDripLM();
        _;
    }

    modifier onlyTreasury() {
        if (msg.sender != treasury) revert BiggiErrorsLib.OnlyTreasury();
        _;
    }

    constructor(address token_, address initialOwner) Ownable(initialOwner) {
        if (token_ == address(0) || initialOwner == address(0)) {
            revert BiggiErrorsLib.ZeroAddress();
        }
        BIGGI = IERC20(token_);
    }

    /* ===== admin setters ===== */

    /// @notice Synchronizuje availableTokens na aktuální on-chain balance BIGGI drženou kontraktem (obejde notify/deposit).
    /// @dev Respektuje CAP. Používej uvážlivě, protože přepisuje účetní stav.
    function syncAvailableToBalance() external onlyOwner whenNotPaused {
        uint256 bal = BIGGI.balanceOf(address(this));
        if (bal > CAP) revert BiggiErrorsLib.CapExceeded();
        availableTokens = bal;
        totalTopUp = bal;
    }
    function setCollection(address coll, bool allowed) external onlyOwner {
        if (coll == address(0)) revert BiggiErrorsLib.ZeroAddress();
        collections[coll] = allowed;
        emit CollectionSet(coll, allowed);
    }

    function setDripLM(address lm) external onlyOwner {
        emit DripLMSet(dripLM, lm);
        dripLM = lm;
    }

    function setTreasury(address t) external onlyOwner {
        emit TreasurySet(treasury, t);
        treasury = t;
    }

    /// @notice nastav tokensPerMint v raw jednotkách (owner volá s např. 1000 * 1e18)
    function setTokensPerMint(uint256 v) external onlyOwner {
        emit TokensPerMintSet(tokensPerMint, v);
        tokensPerMint = v;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ===== notify from collection (accounting only) ===== */
    /// @notice volají pouze whitelisted kolekce po mintu, pouze účetní záznam (ONLY_ACCOUNTING)
    /// This increases `availableTokens` for DripLM to claim, but does NOT move tokens.
    function notifyMint(uint256 mintedCount) external nonReentrant whenNotPaused {
        if (mintedCount == 0) revert BiggiErrorsLib.AmountZero();
        if (!collections[msg.sender]) revert BiggiErrorsLib.NotWhitelistedCollection();

        uint256 add = tokensPerMint * mintedCount;
        availableTokens += add;
        totalNotified += add;
        emit NotifyMint(msg.sender, mintedCount, add);
    }

    /* ===== token contract notification (initial/top-up) =====
       - Designed for token contract to call AFTER minting tokens directly to this contract.
       - Enforces CAP: totalTopUp + amount <= CAP.
       - Also verifies that contract actually holds at least totalTopUp+amount tokens (defensive).
    */
    function notifyTokenMint(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        if (msg.sender != address(BIGGI)) revert BiggiErrorsLib.OnlyToken();
        if (totalTopUp + amount > CAP) revert BiggiErrorsLib.CapExceeded();

        // defensive: ensure tokens are already present on this contract
        uint256 bal = BIGGI.balanceOf(address(this));
        require(bal >= totalTopUp + amount, "token not transferred");

        totalTopUp += amount;
        availableTokens += amount; // increase available (actual tokens now present)
        emit NotifyTokenMint(msg.sender, amount);
        emit TopUp(msg.sender, amount);
    }

    /* ===== treasury deposit (TopUp) =====
       - treasury address provede transferFrom(treasury, this, amount) and call this function
       - enforces CAP
    */
    function depositTokens(uint256 amount) external nonReentrant whenNotPaused onlyTreasury {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        if (totalTopUp + amount > CAP) revert BiggiErrorsLib.CapExceeded();

        // treasury must have approved this contract
        BIGGI.safeTransferFrom(msg.sender, address(this), amount);
        totalTopUp += amount;
        availableTokens += amount;
        emit TopUp(msg.sender, amount);
    }

    /* ===== claim by DripLM =====
       - volá pouze dripLM (nastavený ownerem)
       - posílá tokeny na dripLM (msg.sender) v případě partial: pošle co je k dispozici
    */
    function claim(uint256 amountRequested) external nonReentrant onlyDripLM whenNotPaused {
        if (amountRequested == 0) revert BiggiErrorsLib.AmountZero();

        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 toSend = amountRequested;

        // limit by accounting availability
        if (toSend > availableTokens) {
            toSend = availableTokens;
        }
        // limit by actual balance
        if (toSend > bal) {
            toSend = bal;
        }

        if (toSend == 0) revert BiggiErrorsLib.NoneAvailable();

        availableTokens -= toSend;
        totalClaimed += toSend;
        // totalTopUp should reflect actual tokens sent earlier; reduce if we are sending actual topUp tokens now
        if (totalTopUp >= toSend) {
            totalTopUp -= toSend;
        } else {
            totalTopUp = 0;
        }

        BIGGI.safeTransfer(msg.sender, toSend);
        emit Claimed(msg.sender, toSend);
    }

    /// @notice claim a přímé poslání na jinou adresu (useful: send directly to DripLM worker/router)
    function claimTo(address to, uint256 amountRequested) external nonReentrant onlyDripLM whenNotPaused {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        if (amountRequested == 0) revert BiggiErrorsLib.AmountZero();

        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 toSend = amountRequested;

        if (toSend > availableTokens) {
            toSend = availableTokens;
        }
        if (toSend > bal) {
            toSend = bal;
        }

        if (toSend == 0) revert BiggiErrorsLib.NoneAvailable();

        availableTokens -= toSend;
        totalClaimed += toSend;
        if (totalTopUp >= toSend) {
            totalTopUp -= toSend;
        } else {
            totalTopUp = 0;
        }

        BIGGI.safeTransfer(to, toSend);
        emit Claimed(to, toSend);
    }

    /* ===== rescue & helpers ===== */
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        IERC20(token).safeTransfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        to.transfer(amount);
        emit RescueNative(address(to), amount);
    }

    receive() external payable {}

    /* ===== view helpers pro frontend ===== */
    function getAvailable() external view returns (uint256) { return availableTokens; }
    function getTotalNotified() external view returns (uint256) { return totalNotified; }
    function getTotalClaimed() external view returns (uint256) { return totalClaimed; }
    function getTotalTopUp() external view returns (uint256) { return totalTopUp; }
    function isCollection(address a) external view returns (bool) { return collections[a]; }
    function capRemaining() external view returns (uint256) {
        if (totalTopUp >= CAP) return 0;
        return CAP - totalTopUp;
    }
}
