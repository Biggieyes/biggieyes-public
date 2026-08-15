const INVALID_CONSUMER_SELECTOR = "0x79bfd401";

function extractRevertData(err) {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.error?.data?.data,
    err?.info?.error?.data,
  ];
  for (const cand of candidates) {
    if (typeof cand === "string" && cand.startsWith("0x")) return cand;
  }
  return null;
}

function decodeInvalidConsumer(err) {
  const data = extractRevertData(err);
  if (!data || !data.startsWith(INVALID_CONSUMER_SELECTOR)) return null;
  const body = data.slice(10);
  if (body.length < 128) return null;
  const subHex = body.slice(0, 64);
  const consumerHex = body.slice(64, 128);
  let subId = "";
  try {
    subId = BigInt(`0x${subHex}`).toString();
  } catch {
    subId = "";
  }
  const consumer = `0x${consumerHex.slice(24)}`;
  return { subId, consumer };
}

export function prettyError(err) {
  const name = err?.errorName || "";
  const reason =
    err?.reason || err?.data?.message || err?.message || "Unknown error";

  const invalidConsumer = decodeInvalidConsumer(err);
  if (invalidConsumer) {
    const sub = invalidConsumer.subId || "unknown";
    const consumer = invalidConsumer.consumer || "unknown";
    return `VRF subscription invalid: VRF Router ${consumer} is not a consumer of subscription ${sub}. Add it in Chainlink VRF or update the subId.`;
  }
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


