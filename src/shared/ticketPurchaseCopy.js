export const TICKET_PURCHASE_COPY = {
  howItWorks:
    "For the VRF collection, mint a ticket when its chapter is active, or buy an existing ticket listed on OpenSea. The current owner can redeem it when the chapter is active and redemption is available. Redemption burns the ticket and requests Chainlink VRF; the revealed NFT is minted to that owner when the request is fulfilled.",
  presale:
    "Existing tickets can be transferred and listed on OpenSea before their chapter opens. Buying a ticket does not activate its chapter or immediately reveal an NFT. The seller sets the resale price; the ticket keeps its original on-chain price snapshot. A resale does not increase the paid-mint price or use the primary mint revenue split. Only an active listing can be purchased.",
  walletLimit:
    "The 10-ticket limit applies to paid minting per chapter: you must hold fewer than 10 tickets from that chapter to mint another. Marketing allocations and secondary-market transfers can take your holdings above 10. Transferring or redeeming tickets reduces your current holdings; this is not a lifetime purchase limit.",
};
