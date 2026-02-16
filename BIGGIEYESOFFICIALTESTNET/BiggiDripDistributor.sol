// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./BiggiErrorsLib.sol";
import "./BiggiCapsLib.sol";

/// @notice Účetní kontrakt držící BIGGI pro DripLM.
/// - CAP nezávislý na treasury (DRIP_DISTRIBUTOR_CAP)
/// - whitelist kolekcí pro notifyMint (accounting)
contract BiggiDripDistributor is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable BIGGI;

    address public dripLM;
    address public treasury;

    // volitelný operator (např. DripLM), který může dynamicky přepisovat tokensPerMint
    address public tokensPerMintOperator;

    // kolik BIGGI (raw) se účetně alokuje za 1 mint
    uint256 public tokensPerMint;

    // účetní stav (claimovatelné)
    uint256 public availableTokens;

    // kumulativní statistiky
    uint256 public totalReceived;
    uint256 public totalClaimed;
    uint256 public totalNotified;

    uint256 public constant CAP = BiggiCapsLib.DRIP_DISTRIBUTOR_CAP;

    mapping(address => bool) public collections;

    /* ===== events ===== */
    event CollectionSet(address indexed coll, bool allowed);
    event DripLMSet(address indexed oldLM, address indexed newLM);
    event TreasurySet(address indexed oldT, address indexed newT);
    event TokensPerMintOperatorSet(address indexed oldOp, address indexed newOp);
    event TokensPerMintSet(uint256 oldVal, uint256 newVal);

    event NotifyMint(address indexed coll, uint256 count, uint256 tokensAdded);
    event Claimed(address indexed to, uint256 amount);

    event TopUp(address indexed from, uint256 amount);
    event NotifyTokenMint(address indexed tokenContract, uint256 amount);

    event RescueERC20(address token, address to, uint256 amount);
    event RescueNative(address to, uint256 amount);

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

    function syncAvailableToBalance() external onlyOwner whenNotPaused {
        uint256 bal = BIGGI.balanceOf(address(this));
        availableTokens = bal;
    }

    function setCollection(address coll, bool allowed) external onlyOwner {
        if (coll == address(0)) revert BiggiErrorsLib.ZeroAddress();
        collections[coll] = allowed;
        emit CollectionSet(coll, allowed);
    }

    function setDripLM(address lm) external onlyOwner {
        if (lm == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit DripLMSet(dripLM, lm);
        dripLM = lm;
    }

    function setTreasury(address t) external onlyOwner {
        if (t == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit TreasurySet(treasury, t);
        treasury = t;
    }

    function setTokensPerMintOperator(address op) external onlyOwner {
        emit TokensPerMintOperatorSet(tokensPerMintOperator, op);
        tokensPerMintOperator = op;
    }

    /// @notice Owner nastaví tokensPerMint v raw jednotkách (např. 1000 * 1e18)
    function setTokensPerMint(uint256 v) external onlyOwner {
        emit TokensPerMintSet(tokensPerMint, v);
        tokensPerMint = v;
    }

    /// @notice Operator (např. DripLM) může dynamicky přepsat tokensPerMint podle buybacku
    function setTokensPerMintFromOperator(uint256 v) external {
        require(msg.sender == tokensPerMintOperator, "not operator");
        emit TokensPerMintSet(tokensPerMint, v);
        tokensPerMint = v;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ===== notify from collection (accounting only) ===== */
    function notifyMint(uint256 mintedCount) external nonReentrant whenNotPaused {
        if (mintedCount == 0) revert BiggiErrorsLib.AmountZero();
        if (!collections[msg.sender]) revert BiggiErrorsLib.NotWhitelistedCollection();

        uint256 add = tokensPerMint * mintedCount;
        availableTokens += add;
        totalNotified += add;

        emit NotifyMint(msg.sender, mintedCount, add);
    }

    /* ===== token contract notification (initial/top-up) ===== */
    function notifyTokenMint(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        if (msg.sender != address(BIGGI)) revert BiggiErrorsLib.OnlyToken();
        if (totalReceived + amount > CAP) revert BiggiErrorsLib.CapExceeded();

        uint256 netHeld = totalReceived >= totalClaimed ? (totalReceived - totalClaimed) : 0;
        uint256 bal = BIGGI.balanceOf(address(this));
        require(bal >= netHeld + amount, "token not transferred");

        totalReceived += amount;
        availableTokens += amount;

        emit NotifyTokenMint(msg.sender, amount);
        emit TopUp(msg.sender, amount);
    }

    /* ===== treasury deposit (TopUp) ===== */
    function depositTokens(uint256 amount) external nonReentrant whenNotPaused onlyTreasury {
        if (amount == 0) revert BiggiErrorsLib.AmountZero();
        if (totalReceived + amount > CAP) revert BiggiErrorsLib.CapExceeded();

        BIGGI.safeTransferFrom(msg.sender, address(this), amount);

        totalReceived += amount;
        availableTokens += amount;

        emit TopUp(msg.sender, amount);
    }

    /* ===== claim by DripLM ===== */
    function claim(uint256 amountRequested) external nonReentrant onlyDripLM whenNotPaused {
        if (amountRequested == 0) revert BiggiErrorsLib.AmountZero();

        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 toSend = amountRequested;

        if (toSend > availableTokens) toSend = availableTokens;
        if (toSend > bal) toSend = bal;

        if (toSend == 0) revert BiggiErrorsLib.NoneAvailable();

        availableTokens -= toSend;
        totalClaimed += toSend;

        BIGGI.safeTransfer(msg.sender, toSend);
        emit Claimed(msg.sender, toSend);
    }

    function claimTo(address to, uint256 amountRequested) external nonReentrant onlyDripLM whenNotPaused {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        if (amountRequested == 0) revert BiggiErrorsLib.AmountZero();

        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 toSend = amountRequested;

        if (toSend > availableTokens) toSend = availableTokens;
        if (toSend > bal) toSend = bal;

        if (toSend == 0) revert BiggiErrorsLib.NoneAvailable();

        availableTokens -= toSend;
        totalClaimed += toSend;

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
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native xfer fail");
        emit RescueNative(address(to), amount);
    }

    receive() external payable {}

    /* ===== view helpers ===== */

    function biggiBalance() public view returns (uint256) {
        return BIGGI.balanceOf(address(this));
    }

    function effectiveAvailable() public view returns (uint256) {
        uint256 bal = BIGGI.balanceOf(address(this));
        return availableTokens <= bal ? availableTokens : bal;
    }

    function getAvailable() external view returns (uint256) { return availableTokens; }
    function getTotalNotified() external view returns (uint256) { return totalNotified; }
    function getTotalClaimed() external view returns (uint256) { return totalClaimed; }
    function getTotalReceived() external view returns (uint256) { return totalReceived; }
    function isCollection(address a) external view returns (bool) { return collections[a]; }

    function capRemaining() external view returns (uint256) {
        if (totalReceived >= CAP) return 0;
        return CAP - totalReceived;
    }

    struct Snapshot {
        address token;
        address dripLM;
        address treasury;
        address operator;
        uint256 tokensPerMint;
        uint256 available;
        uint256 effectiveAvailable;
        uint256 totalReceived;
        uint256 totalClaimed;
        uint256 totalNotified;
        uint256 cap;
        uint256 capRemaining;
        uint256 balance;
        bool paused;
    }

    function snapshot() external view returns (Snapshot memory s) {
        s.token = address(BIGGI);
        s.dripLM = dripLM;
        s.treasury = treasury;
        s.operator = tokensPerMintOperator;
        s.tokensPerMint = tokensPerMint;

        s.available = availableTokens;

        uint256 bal = BIGGI.balanceOf(address(this));
        s.balance = bal;
        s.effectiveAvailable = availableTokens <= bal ? availableTokens : bal;

        s.totalReceived = totalReceived;
        s.totalClaimed = totalClaimed;
        s.totalNotified = totalNotified;

        s.cap = CAP;
        s.capRemaining = totalReceived >= CAP ? 0 : (CAP - totalReceived);
        s.paused = paused();
    }
}
