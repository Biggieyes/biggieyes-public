export function prettyError(err) {
  const name = err?.errorName || "";
  const reason =
    err?.reason || err?.data?.message || err?.message || "Unknown error";
  const map = {
    InsufficientPayment: "Sent value is lower than the ticket price.",
    MaxPerWallet: "Per-wallet limit (10 tickets) exceeded.",
    AllTicketsMinted: "All tickets are sold out.",
    NoTicketToRedeem: "You don't have any ticket to redeem.",
    NotTicket: "Selected token is not a ticket.",
    NotTicketOwner: "You are not the owner of this ticket.",
    AlreadyPending: "You already have a pending VRF draw.",
    PresaleNotActive: "Presale is turned off.",
    Paused: "Contract is paused.",
    NoEligibleTokens: "No eligible NFTs to claim this week.",
    CapExceeded: "Token cap would be exceeded.",
    NotFullyConfigured:
      "Contract metadata is not fully configured (owner must finish batch setup).",
    BiggiTokenNotSet: "BIGGI token is not configured yet.",
  };
  return map[name] || reason;
}
