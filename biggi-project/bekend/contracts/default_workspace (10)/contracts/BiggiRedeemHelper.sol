// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BiggiRedeemHelper
/// @dev Utility knihovna pro bezpečné a přehledné zpracování redeem ticketu a VRF mintu v BiggiEyesLottery

library BiggiRedeemHelper {
    /// Ověř, že daný ticket je platný a uživatel má aspoň jednu vstupenku
    function validateTicket(
        mapping(uint256 => bool) storage isTicket,
        mapping(address => uint256) storage ticketCount,
        uint256 ticketId,
        address user
    ) internal view {
        require(isTicket[ticketId], "Not a ticket");
        require(ticketCount[user] > 0, "User does not own any ticket");
    }

    /// Smaž ticket po redeemu, zabrání zneužití (odečte 1 vstupenku)
    function burnTicket(
        mapping(uint256 => bool) storage isTicket,
        mapping(address => uint256) storage ticketCount,
        uint256 ticketId,
        address user
    ) internal {
        isTicket[ticketId] = false;
        require(ticketCount[user] > 0, "Nothing to burn");
        ticketCount[user]--;
    }

    /// Zapiš pending request pro VRF (pouze pokud žádný request ještě nečeká)
    function setPendingRequest(
        mapping(address => uint256) storage pendingMintRequest,
        mapping(uint256 => address) storage pendingMinters,
        address user,
        uint256 requestId
    ) internal {
        require(pendingMintRequest[user] == 0, "Already pending");
        pendingMintRequest[user] = requestId;
        pendingMinters[requestId] = user;
    }

    /// Vymaž requesty po fulfillnutí
    function clearPendingRequest(
        mapping(address => uint256) storage pendingMintRequest,
        mapping(uint256 => address) storage pendingMinters,
        address user,
        uint256 requestId
    ) internal {
        delete pendingMintRequest[user];
        delete pendingMinters[requestId];
    }
}
