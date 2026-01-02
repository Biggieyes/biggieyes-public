// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IBiggiEyesLottery {
    function mintPresaleTicket(address to) external payable returns (uint256);
    function presalePrice() external view returns (uint256);
    function presaleMinted() external view returns (uint256);
    function MAX_PRESALE_TICKETS() external view returns (uint256);
}

// -------- Custom errors (nižší bytecode než stringy) --------
error MainNotSet();
error PresaleOff();
error NotWhitelistedErr();
error MaxPerWalletErr();
error SoldOutErr();
error BadValue();
error TooMany();
error CountZero();

contract BiggiEyesPresaleDirect is Ownable, ReentrancyGuard {
    IBiggiEyesLottery public mainLottery;

    bool public presaleActive;
    bool public requireWhitelist;

    mapping(address => bool) public whitelist;
    mapping(address => uint256) public purchases; // limit 3 / wallet

    // Události
    event PresaleStatusChanged(bool active);
    event WhitelistRequired(bool required);
    event WhitelistAdded(address[] users);
    event MainLotterySet(address main);
    event TicketSold(address indexed buyer, uint256 indexed ticketId, uint256 price);

    constructor(address owner_) Ownable(owner_) {}

    // --- Admin ---
    function setMainLottery(address main) external onlyOwner {
        if (main == address(0)) revert MainNotSet();
        mainLottery = IBiggiEyesLottery(main);
        emit MainLotterySet(main);
    }

    function togglePresale(bool active) external onlyOwner {
        presaleActive = active;
        emit PresaleStatusChanged(active);
    }

    function setRequireWhitelist(bool required_) external onlyOwner {
        requireWhitelist = required_;
        emit WhitelistRequired(required_);
    }

    function addToWhitelist(address[] calldata users) external onlyOwner {
        if (users.length > 500) revert TooMany();
        for (uint256 i = 0; i < users.length; i++) {
            whitelist[users[i]] = true;
        }
        emit WhitelistAdded(users);
    }

    // --- Veřejný nákup 1 ticketu (mint přímo v hlavním) ---
    function buyTicket() external payable nonReentrant {
        if (address(mainLottery) == address(0)) revert MainNotSet();
        if (!presaleActive) revert PresaleOff();
        if (requireWhitelist && !whitelist[msg.sender]) revert NotWhitelistedErr();
        if (purchases[msg.sender] >= 3) revert MaxPerWalletErr();

        uint256 price = mainLottery.presalePrice();
        if (msg.value != price) revert BadValue();

        // cap kontrola (50 ks) – přečteno z hlavního
        if (mainLottery.presaleMinted() >= mainLottery.MAX_PRESALE_TICKETS()) revert SoldOutErr();

        uint256 ticketId = mainLottery.mintPresaleTicket{ value: msg.value }(msg.sender);
        purchases[msg.sender] += 1;

        emit TicketSold(msg.sender, ticketId, price);
    }

    // --- Owner hromadný nákup (např. 20 ks pro sebe, placeně → plní rewards/DEV) ---
    function ownerBuyTickets(address to, uint256 count) external payable onlyOwner nonReentrant {
        if (address(mainLottery) == address(0)) revert MainNotSet();
        if (count == 0) revert CountZero();

        uint256 price = mainLottery.presalePrice();
        if (msg.value != price * count) revert BadValue();

        // ověř, že se vejdeme pod presale cap v hlavním
        uint256 minted = mainLottery.presaleMinted();
        if (minted + count > mainLottery.MAX_PRESALE_TICKETS()) revert SoldOutErr();

        for (uint256 i = 0; i < count; ) {
            mainLottery.mintPresaleTicket{ value: price }(to);
            unchecked { ++i; }
        }
        // hlavní kontrakt emituje své eventy; tady žádné další kvůli bytecode
    }

    // Bezpečnost: nepřijímáme přímé ETH (mimo buy/ownerBuy)
    receive() external payable { revert BadValue(); }
    fallback() external payable { revert BadValue(); }
}
