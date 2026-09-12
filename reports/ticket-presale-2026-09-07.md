# Ticket presale audit - 2026-09-07

## Scope and conclusion

Read-only Polygon mainnet checks plus local Hardhat tests of TicketHub transfers,
approvals and redemption after resale. No transactions, approvals, signatures,
chapter activation, metadata updates, Git pushes or Netlify deployments were made.
Public Originals artwork and metadata remain deferred.

The tested TicketHub transfer and redemption paths are consistent. A contract
redeployment is not indicated by these findings. This is a focused audit, not a
guarantee that every marketplace order or every protocol branch is correct.

The current seller cannot complete the approval transaction with the observed POL
balance. The canonical OpenSea Conduit is not approved, and OpenSea reports no
active public listings. All five chapters are inactive, so paid minting and
redemption are separately gated; inactivity does not block ERC721 transfers.

## Mainnet evidence

State snapshot: Polygon chain ID **137**, block **93402341**, timestamp
**2026-09-07 19:15:45 UTC**. Gas quotes and subsequent simulations were taken near
that block, not guaranteed at the identical block.

- TicketHub: `0x7b7e561173f498C8274b821090Da64E8ee653f6A`.
- Seller: `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`.
- Deployed TicketHub runtime exactly matches the local `artifacts-master` runtime.
- Runtime keccak256: `0x22f2b1ad462a9cfec1db17dd85f5fe1d44fb1527731bc23ce651492e92db951b`.
- TicketHub is not paused. Paid-ticket price is 500 POL; the multiplier is 10033/10000.
- All 250 minted tickets were individually checked for live status, owner, chapter
  and price snapshot. None is burned, no chapter mismatch was found, and every
  snapshot is 1 POL. That snapshot is not an OpenSea resale price.
- All three holders' ERC721 balances, global ticket counts and per-chapter ticket
  counts agree with the individual token records.

| Chapter | Ticket IDs | Marketing minted | Paid minted | Active | Seller holds |
| --- | --- | ---: | ---: | --- | ---: |
| 1 / Originals | 1-50 | 50 | 0 | No | 48 |
| 2 / Universe | 551-600 | 50 | 0 | No | 50 |
| 3 / Mutant | 1101-1150 | 50 | 0 | No | 50 |
| 4 / Apocalipse | 1651-1700 | 50 | 0 | No | 50 |
| 5 / Super Hero | 2201-2250 | 50 | 0 | No | 50 |

The other two holders each hold one Originals ticket. The seller holds 248 tickets
in total, not 250.

## OpenSea and wallet prerequisites

The canonical OpenSea approval operator is
`0x1E0049783F008A0085193E00003D00cd54003c71`, distinct from the TicketHub transaction
target. This matches [OpenSea's approval documentation](https://support.opensea.io/en/articles/8867119-what-does-a-typed-signature-request-look-like).

The Polygon ConduitController at
`0x00000000F9490004C11Cef243f5400493c00Ad63` returns that deployed conduit for the
documented conduit key. Its channel for Seaport 1.6 at
`0x0000000000000068F116a894984e2DB1123eB395` is open. The deployment addresses are
also listed in the [official Seaport repository](https://github.com/ProjectOpenSea/seaport).

Read-only simulations for ticket 3:

| Call | Result |
| --- | --- |
| Seller `setApprovalForAll(Conduit, true)` | Succeeds in simulation |
| Seller `transferFrom(seller, buyer, 3)` | Succeeds in simulation |
| Conduit `transferFrom(seller, buyer, 3)` | `ERC721InsufficientApproval` |
| Seller `redeemTicket(3)` | `ChapterInactive` |

No simulated approval or transfer was broadcast or persisted.

Seller balance: **0.001702373944068 POL**. Estimated approval gas: **50,891**.
At the sampled gas quote, the expected fee was approximately **0.01321 POL** and
the `maxFeePerGas` calculation approximately **0.01861 POL**. Both exceed the
balance. These are changing estimates, not a fixed fee or required deposit amount.

OpenSea API checks at **19:16:45-46 UTC** returned HTTP 200:

- Ticket 3 belongs to `biggi-ticket-339884819`, standard ERC721, `is_disabled=false`,
  `is_suspicious=false`.
- The collection-wide public listings response contains **0 listings** and no next
  page. Private listings and unsigned drafts are outside this check.
- OpenSea's flags do not establish MetaMask/Blockaid's current classification. Any
  wallet security warning must still be inspected, not bypassed.

Methods: [Get NFT](https://docs.opensea.io/reference/get_nft) and
[Get collection listings](https://docs.opensea.io/reference/list_listings_collection_all).
No API key or private RPC URL is included in this report.

## Preserved mechanics

- Marketing allocation, transfer and resale are not paid TicketHub mints and do
  not advance its price curve. An ERC721 transfer does not route mint revenue into
  CollectionRewards or the distributor. Marketplace fees, if any, are separate.
- The 10-ticket guard checks current holdings in the chapter before a paid mint.
  It is not a lifetime limit, nor a secondary-market holding cap. Transfers and
  marketing allocations may take a wallet above 10.
- Approval authorizes an operator to transfer the owner's tickets from this
  TicketHub, including other chapters and future holdings while approval remains
  enabled. It does not transfer ownership itself or authorize redeeming on behalf
  of the owner. After a transfer, the seller's approval does not apply to the buyer.
- Transfers preserve the chapter and original price snapshot. Only the current
  owner can redeem. Successful redemption burns the ticket, uses that snapshot
  and requests VRF in the corresponding chapter collection for the new owner.
- If the linked collection rejects the redeem transaction, the burn and associated
  state changes revert atomically. Once a redeem transaction succeeds, VRF is
  asynchronous: the ticket is already burned while fulfillment is pending.
- `ticketRedeemable` checks ticket existence and chapter activation only. It is not
  proof that Main is unpaused, VRF is funded or the entire redeem path is ready.
- TicketHub pause blocks mint and redeem, but does not block ERC721 transfers or
  approvals. This existing behavior was tested and was not changed.

## Recommended listing steps

1. Use the official [ticket collection](https://opensea.io/collection/biggi-ticket-339884819)
   and the wallet that actually owns the selected token, on Polygon mainnet.
2. Ensure that wallet has enough native POL for a fresh wallet gas estimate, with
   a reasonable buffer. WETH or BIGGI cannot directly pay this transaction's gas.
3. Start with one ticket. Select its sale price, payment currency and expiration.
   A ticket snapshot of 1 POL does not dictate the listing price.
4. Inspect the approval: transaction target must be this TicketHub, operator must
   be the documented Conduit. Inspect any security alert before proceeding. Only
   the owner should confirm the approval after checking its collection-wide scope.
5. After approval confirms, inspect and sign the listing order: correct chain,
   token contract, token ID, price, proceeds recipient, fees and expiration.
6. Verify the active listing publicly and its order status. A complete sale has
   not been tested here; it requires a real signed order and buyer fulfillment.
7. Tell buyers that redemption remains unavailable until their chapter and its
   redeem path are ready. Do not activate chapters just to enable resale.

## Local changes and verification

- Shared ticket-purchase copy now distinguishes paid minting, resale, snapshot
  price and chapter activation. Footer FAQ, Info FAQ and chance modal reuse it.
- Removed the incorrect `no presale` and global 10-ticket holding claims from the
  affected modal copy. Existing CSS, artwork, metadata and Solidity are untouched.
- Added nine local-only Hardhat tests for approval, revocation, transfer counters,
  pause behavior, wallet limits, buyer redemption, atomic rollback and chapter 2
  routing. Together with the existing scaling suite: **12 passing**.
- Frontend suite: **225 tests passing in 60 files**, including three new purchase
  guidance tests. `lint:ci` and `typecheck` pass.
- `npm run build` and `npm run security:secrets` pass. This is a local build with
  local environment settings, not a new production deployment. Rebuild with the
  validated production environment before the combined release.
- Playwright verified the expanded footer purchase FAQ at widths 1440, 390 and
  768 px: no horizontal page overflow, no overflowing question labels and no
  uncaught JavaScript errors. On mobile the footer loads when scrolled into view.
- Local preview: `http://127.0.0.1:5181/app/`. Wallet transactions were not used
  during browser checks. A Vite preview does not run Netlify server functions.

Backend command (from `biggi-project/bekend`, with `FORK_URL`, `FORK_BLOCK_NUMBER`
and `PRIVATE_KEY` unset):

```text
npx hardhat test --config hardhat.biggi-master.cjs --network hardhat test/master/ticket-presale.smoke.test.js test/master/scaling-collections.smoke.test.js
```

The new suite refuses any network name other than `hardhat`. No mainnet signer
was used by the audit. Changes are intentionally local pending a combined release.
