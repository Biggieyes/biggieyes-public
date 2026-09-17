# NFT Rewards consistency check - 2026-09-09 (historical V1 snapshot)

> Historical pre-V2 evidence. The V1 addresses below are retained for audit traceability and are not the current mainnet deployment. See `nft-rewards-v2-migration-2026-09-09.md` for the current V2 state.

## Scope and outcome

Checked the NFT Rewards tab, its read service and hooks, claim submission,
frontend ABI, canonical backend addresses, deployed V1 bytecode, reader and VRF
wiring. Fixed frontend inconsistencies locally. No Netlify deployment, blockchain
transaction, metadata modification, contract change or environment change.

This is a focused consistency check, not a formal security audit or proof that
every future reward event can be fulfilled within its gas budget.

## Read-only Polygon mainnet evidence

Initial snapshot: block 93474754, `eth_chainId = 0x89` (137).

| Item | Result |
| --- | --- |
| NFT Rewards | `0x939Df533b80943298E15ad4c8F188102954f34FF` |
| NFT Rewards reader | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` |
| Reader target | Matches NFT Rewards |
| Owner | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` |
| Core main | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| Registry | `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` |
| VRF router | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| Approved reward consumer | true |
| Mystery retry delay | 900 seconds |
| Next event / reward IDs | 1 / 1: no created events or rewards |
| Frontend ABI selectors absent from V1 artifact | none |

Follow-up at block 93475030: deployed runtime bytecode exactly matches the local
`BiggiNFTRewards` V1 artifact (11,248 bytes). Keccak256:
`0xd573a8c9d699838f8c02b6fe5c7baff3650469aebc639b69eb941e2513483126`.
Core main has deployed code and is approved in the registry.

The frontend reader ABI successfully decoded `getStatus()` with matching
addresses and counters. The router is a consumer of its configured subscription.
Subscription balances at the follow-up read: 2 POL native, 0 LINK; the router
requests native payment. Callback gas limit: 300,000. This is not a guarantee of
sufficient gas or funding for an arbitrarily large mystery event.

An attempt to reread the earlier block after it aged out was rejected by the
public RPC as historical state unavailable; fresh reads succeeded. Frontend
errors remain explicit and do not silently fall back to mixed-block counters.

## Actual mechanics

- Owner-created manual rewards immediately assign a reward ID and metadata URI.
  No ERC-721 exists until the assignee calls `claim(rewardId)`.
- V1 manual/character events keep `finished=false`; this does not mean they are
  unassigned or blocked. `finished` is meaningful for the mystery drawing.
- Mystery events have a deduplicated eligible pool. The approved VRF router
  delivers randomness and the contract assigns distinct winners. Completing the
  draw does not claim/mint their NFTs.
- `claim` requires the assigned address, rejects repeat claims and safe-mints an
  ERC-721 with the reward ID. It does not request `setApprovalForAll` or charge a
  reward price; the caller pays transaction gas.
- `assignedTo` is the original beneficiary, not the current ERC-721 owner after
  transfers. The panel displays assignments/claim history, not NFT holdings.
- Current BiggiMain character completion rewards are minted by BiggiMain itself
  when a block completes. They are not pending claims in this NFT Rewards tab.
- These claims are not gated by DEX liquidity, a collection POL reward budget,
  or CRE activation. Mystery assignment additionally depends on functioning VRF.

## Frontend fixes

1. RPC/loading errors no longer appear as zero totals or definitive statements
   that a wallet has no rewards. Claims are disabled when data is unavailable.
2. Added bounded reward and event pagination. Rewards older than the latest 500
   and events older than the latest 100 can now be reached. Per-wallet and claimed
   counts are explicitly scoped to loaded records when history is paginated.
3. A refresh reads at one Polygon block. Responses for an old account, provider,
   page or superseded request cannot overwrite the current snapshot.
4. Removed reader-overrides of snapshot totals/addresses. A reader target
   mismatch is surfaced and disables claims.
5. Claim checks the signing provider's chain ID, signer address, current on-chain
   assignee and claimed flag. Failed gas estimation aborts submission. A lock
   prevents overlapping claim submissions; all claim controls disable while busy.
6. Manual event status is derived from contract semantics, not the presence of
   its reward on the displayed page. Mystery completion is labeled as a completed
   draw. An event outside the loaded page is shown as unknown rather than inventing
   a type. Another wallet's stale assignments are not rendered as claimable.

## V1 versus prepared V2

V2 source and deployment preparation exist but the canonical live address still
contains V1. The historical V2 report is a dry run, not a deployment record.

V2 keeps manual assignment, mystery drawing and assignee-only claim, but removes
owner-selected emergency randomness, makes the router immutable, rejects empty
URIs and zero/reused VRF request IDs, adds two-step ownership and rejects ordinary
native transfers. Legacy main/registry/character-creation APIs are removed;
BiggiMain's own character-completion mint remains separate.

V1 therefore still has its existing privileged emergency resolution/router
configuration powers and accepts POL without a withdrawal method. These are not
changed by the frontend fixes. Do not send funds directly to NFT Rewards.

A V2 migration needs explicit approval, fresh deployment/reader, router consumer
approval, consistent canonical addresses and a fresh old-contract state check
before retiring anything. No migration was performed here.

## Verification

- 29 frontend tests passed across NFT service, section, hook and rewards panel
  consistency suites. Coverage includes a reward older than 500 records, older
  events, RPC failures, wrong chain, wrong signer, stale account response,
  repeated claim prevention and gas-estimation failure.
- 8 local Hardhat tests passed: 2 new V1/reader/VRF claim integration tests and 6
  existing V2 tests. Explicit local network, no fork or mainnet writes.
- `npm run typecheck` passed.
- `npm run build` passed; security headers generated.
- Playwright checked the built application against mainnet read data at widths
  1440, 768, 390 and 320: expected zero event/reward counts, matching wiring,
  15-minute retry delay, no page errors and no panel/control horizontal overflow.
- Screenshots: local ignored `tmp-nft-rewards-{width}.png`.
- Preview: `http://127.0.0.1:5181/app/` -> Rewards -> NFT REWARDS.

No successful mainnet claim was broadcast. There is currently no real assigned
reward to use for that end-to-end production transaction. Full frontend suite
was not rerun; verification was focused on affected rewards modules.
