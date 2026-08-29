# BIGGI CORE Technical Whitepaper

- Version: 1.0
- Language: English
- Network: Polygon PoS mainnet (`chainId 137`)
- State snapshot: 2026-08-27, verified through Polygon block `92774843`

## 1. Scope and status

This document specifies the deployed BIGGI NFT CORE: chapters, tickets, VRF
reveal, the paired Public collections, eye-color and background pricing,
Collection Rewards, Token Rewards, NFT rewards, metadata invariants, payment
routing, and administrative controls.

It is a technical description, not an offer, valuation, investment promise, or
guarantee of rewards. Marketplace prices are determined by market participants.
Several parameters described below are owner-adjustable. The current owner is
`0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`; a future Safe/multisig handoff is
an operational objective, not a completed fact at this snapshot.

## 2. System model

BIGGI is a scalable chapter system. A chapter consists of:

1. one 550-item VRF collection (`BiggiMain`),
2. one 100-item selectable Public collection (`BiggiMain2`),
3. a chapter record in `BiggiSeriesRegistry`,
4. launch and pricing links in `BiggiChapterController`, and
5. the shared, chapter-aware `BiggiTicketHub`.

The Registry allows additional series and chapters to be registered. Scaling is
not automatic: every new pair must be deployed, registered, configured, seeded,
verified, funded where applicable, and activated through the launch gate.

### 2.1 Registered chapters

| Chapter | Series | VRF collection | Public collection | State |
| ---: | --- | --- | --- | --- |
| 1 | Original BIGGI / `BIGGI MASTER Core Launch` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` | inactive |
| 2 | Universe | `0x5Bec5aeE4Ff8b1B5e7CBddcEEC61555354002036` | `0x7EaB23497085cfF00Cb2E9809b2Af0e717187356` | inactive |
| 3 | Mutant | `0x72e6DE66f340E0243DAF45917E7Ce8057Faeedc2` | `0xda6A6f45053796d0f5edB965fe3FA47B9a35460c` | inactive |
| 4 | Apocalipse | `0x8E862D9071120D69517D3F7Db0c101175E911115` | `0xecE7D61AB3FB2229C39B48380D704183532fE960` | inactive |
| 5 | Super Hero | `0xCA09F0b1f06AD3aA2302ED40Cb12013B84b52B38` | `0x99f049279BC545469F989d8f06CD915ef4B6f1d4` | inactive |

The on-chain Registry currently reports five series and five chapters. Each
chapter has 50 marketing tickets already minted, for 250 marketing tickets in
total. A marketing ticket is transferable while its chapter is inactive, but it
cannot be redeemed until that chapter is explicitly active.

## 3. Ticket lifecycle

Each chapter has exactly 550 tickets:

- 50 marketing tickets,
- 500 paid tickets,
- a direct paid mint is allowed only while the sender currently holds fewer
  than 10 tickets from that chapter. Marketing and paid tickets both count
  toward this balance; secondary transfers update the balance but do not cap
  how many tickets a receiving wallet may hold.

The shared TicketHub assigns non-overlapping token ranges:

| Chapter | Marketing ticket IDs | Paid ticket IDs | Total range |
| ---: | --- | --- | --- |
| 1 | `1-50` | `51-550` | `1-550` |
| 2 | `551-600` | `601-1100` | `551-1100` |
| 3 | `1101-1150` | `1151-1650` | `1101-1650` |
| 4 | `1651-1700` | `1701-2200` | `1651-2200` |
| 5 | `2201-2250` | `2251-2750` | `2201-2750` |

The normal lifecycle is:

1. a user mints or acquires a chapter ticket;
2. the ticket stores its chapter and ticket-price snapshot;
3. after chapter activation, the owner burns the ticket through `redeemTicket`;
4. TicketHub calls that chapter's VRF collection;
5. `BiggiVrfRouter` requests Chainlink VRF randomness;
6. the callback resolves one still-unminted position from the 550-item matrix;
7. the final NFT is minted to the redeemer.

The ticket is burned before the VRF request. A user may have only one pending
VRF mint in the same VRF collection. A failed or delayed request can be retried
after the configured delay, currently 15 minutes.

## 4. Paid ticket price curve

The current price before the first paid mint is `500 POL`. Marketing tickets
were recorded with a `1 POL` snapshot and did not move the paid curve.

After every paid ticket mint, whether paid in native POL or BIGGI, TicketHub
updates the price using integer arithmetic:

```text
P(0)   = current TicketHub ticketPrice
P(n+1) = floor(P(n) * 10033 / 10000)
```

`10033 / 10000` means a `0.33%` increase after each paid mint. The buyer pays
`P(n)` and the next buyer sees `P(n+1)`. All arithmetic is performed in the
smallest unit, so each recurrence rounds down.

### 4.1 Global, not chapter-local

`ticketPrice` and `priceIncreasePerMint` are single global TicketHub variables.
They do not reset automatically when a new chapter opens. Therefore:

- paid mints in any chapter advance the same global curve;
- a later chapter inherits the then-current global price unless the owner
  explicitly changes it;
- the owner can change both the current ticket price and the multiplier.

Under the non-binding assumption that all 500 Chapter 1 paid tickets are bought
natively, no owner change occurs, and the curve begins at `500 POL`, the current
audit script calculates approximately:

- gross paid-ticket volume: `635,280.928774928937197257 POL`;
- next global ticket price after 500 paid mints:
  `2,596.427064957265492499 POL`.

These are deterministic curve projections, not revenue, demand, or resale-value
guarantees.

BIGGI payment uses the owner-set `biggiPerEth` conversion parameter. It is not a
price oracle. At the current value `1e18`, the numerical BIGGI amount equals the
POL-denominated price, but this does not establish market parity between BIGGI
and POL.

## 5. The 550-item eye-color matrix

Every VRF chapter uses the same structural matrix. It has ten eye-color blocks,
ten `mainId` values per block, and a decreasing number of allowed backgrounds.

For eye block `e` in `1..10`:

```text
mainId range             = 10 * (e - 1) + 1  through  10 * e
backgrounds per mainId   = 11 - e
NFT count in eye block   = 10 * (11 - e)
```

The 550 matrix positions map to main NFT token IDs `1001-1550`. A `mainId` is
intentionally repeated once for every allowed background; global `mainId`
uniqueness is not an invariant.

| Eye block | Eye color | Main IDs | Allowed background codes | NFT count | Initial/current price before reveals | Token Reward units | Completion character |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | Orange | `1-10` | `1-10` | 100 | `100 POL` | 10 | Cosmonaut (`2001`) |
| 2 | Black | `11-20` | `1-9` | 90 | `200 POL` | 20 | Snowman (`2002`) |
| 3 | White | `21-30` | `1-8` | 80 | `300 POL` | 30 | Bugs (`2003`) |
| 4 | Brown | `31-40` | `1-7` | 70 | `400 POL` | 40 | Pig (`2004`) |
| 5 | Blue | `41-50` | `1-6` | 60 | `500 POL` | 50 | Mickey (`2005`) |
| 6 | Green | `51-60` | `1-5` | 50 | `600 POL` | 60 | Santa (`2006`) |
| 7 | Violet | `61-70` | `1-4` | 40 | `700 POL` | 70 | Woody (`2007`) |
| 8 | Red | `71-80` | `1-3` | 30 | `800 POL` | 80 | Buzz (`2008`) |
| 9 | Pink | `81-90` | `1-2` | 20 | `900 POL` | 90 | Bart (`2009`) |
| 10 | Rainbow | `91-100` | `1` | 10 | `1,000 POL` | 100 | Homer (`2010`) |

The initial values above are also the live Chapter 1 values at this snapshot,
because no VRF NFT has been revealed. They are not immutable: each VRF
collection owner can set a block's current price.

The minter who completes the final still-missing NFT in an eye block receives
that block's one completion-character NFT. This depends on reveal order and is
awarded once per block.

## 6. Exact background and block-price mechanics

Background codes use the same color index as eye blocks:

| Code | Background | Permanent increase to the same-colored eye block | One-time bonus to the revealed NFT | Occurrences in a complete 550 matrix |
| ---: | --- | ---: | ---: | ---: |
| 1 | Orange (`O`) | 5% | 5% | 100 |
| 2 | Black (`B`) | 2% | 10% | 90 |
| 3 | White (`W`) | 2% | 15% | 80 |
| 4 | Brown (`BR`) | 3% | 20% | 70 |
| 5 | Blue (`BL`) | 3% | 25% | 60 |
| 6 | Green (`G`) | 4% | 30% | 50 |
| 7 | Violet (`V`) | 4% | 35% | 40 |
| 8 | Red (`R`) | 5% | 40% | 30 |
| 9 | Pink (`P`) | 5% | 45% | 20 |
| 10 | Rainbow (`RB`) | 10% | 50% | 10 |

### 6.1 Rule enforced on every VRF reveal

Let `e` be the revealed NFT's eye block and `b` its background color. Let `C[j]`
be the current price of eye-color block `j`, `I[b]` the permanent background
increase, and `F[b]` the one-time final-price bonus.

```text
C[b] := C[b] + floor(C[b] * I[b] / 100)
B     := C[e]                       // read after the update above
V     := B + floor(B * F[b] / 100)
```

The central rule is:

> A background color appearing anywhere in one VRF collection increases the
> current price of the eye block with the same color, always by that
> background's configured percentage.

For example, a Red background on a White-eye NFT increases the Red eye-block
price, not the White eye-block price. Price states are independent per VRF
chapter; a reveal in Universe does not change prices in Originals.

If `e == b`, the block is increased first and the revealed NFT's value is then
calculated from that increased price. If `e != b`, the background's matching
block increases while the NFT uses its own eye block's unchanged current price.

`B` is stored as `blockPrice` and `V` as `finalPrice`. `finalPrice` is an
on-chain computed snapshot for the revealed NFT. It is not charged during
redemption, is not a marketplace floor, and is not a guaranteed valuation.

### 6.2 Valid examples from the matrix

**White eyes + Red background, at initial prices**

```text
Red block:     800 -> 840 POL          (5% permanent Red increase)
White block:   remains 300 POL
finalPrice:    300 + 40% = 420 POL     (Red background bonus)
```

White eyes allow background codes `1-8`, so this combination is valid.

**Blue eyes + Blue background, at initial prices**

```text
Blue block:    500 -> 515 POL          (3% permanent Blue increase)
finalPrice:    515 + 25% = 643.75 POL  (calculated after the increase)
```

### 6.3 Theoretical terminal block prices

Because every matrix position is unique and the number of each background is
fixed, full revelation produces the following terminal current prices if the
owner never overrides a price. Values include contract-equivalent rounding at
each multiplication:

| Eye-color block | Number of matching-background increases | Terminal current price |
| --- | ---: | ---: |
| Orange | 100 x 5% | `13,150.125784630345501716 POL` |
| Black | 90 x 2% | `1,188.626625261089334182 POL` |
| White | 80 x 2% | `1,462.631746828916894557 POL` |
| Brown | 70 x 3% | `3,167.128764848694588592 POL` |
| Blue | 60 x 3% | `2,945.801552022868342684 POL` |
| Green | 50 x 4% | `4,264.010007766983247771 POL` |
| Violet | 40 x 4% | `3,360.714439555655191651 POL` |
| Red | 30 x 5% | `3,457.553900120529607314 POL` |
| Pink | 20 x 5% | `2,387.967934629978120546 POL` |
| Rainbow | 10 x 10% | `2,593.742460100000000000 POL` |

These are protocol-state projections, not predicted market prices. An owner
price override changes the subsequent path.

## 7. Random selection and recovery

The standard reveal index is:

```text
requestedIndex = (randomWord mod 550) + 1
```

If that position is already minted or invalid, the contract walks forward
cyclically until it finds the next valid unminted position. This prevents a
duplicate mint but means later reveals are sampling from the remaining set by a
deterministic fallback after the initial VRF result.

The contract also exposes an owner-only `emergencyResolvePendingMint(user,
preferredIndex)` path. It requires an existing pending mint, but the owner can
provide a preferred matrix index and the function does not enforce the normal
retry delay. This is a material trust assumption: the current contract cannot
be described as preventing all administrative influence over a pending outcome.
Production governance should protect this authority with a Safe/multisig and a
published emergency policy; removing or timelocking it would require a new
deployment because the current collection is not upgradeable.

## 8. Paired Public collection

Each Public collection contains 100 selectable NFTs:

- ten unique `mainId` values in each eye-color block;
- no background clones;
- one shared `PUBLIC` background label;
- token IDs `1001-1100` inside that Public ERC-721 contract.

Public mint has no independent `100-1000 POL` base-price schedule. For the
selected NFT's eye block, `BiggiMain2` reads the current price directly from its
paired VRF collection through `BiggiChapterController`.

```text
Public mint price = paired VRF collection's current eye-block price
Public blockPrice = Public finalPrice = that price
```

A Public mint does not trigger a background increase and does not alter the
paired VRF block prices.

Public mint unlocks only when the same chapter reports all of the following:

- `saleMinted == 500`,
- `marketingMinted == 50`,
- `totalMinted == 550`,
- the registered VRF/Public/TicketHub stack and caps are consistent.

The Public collection must also be unpaused. At this snapshot, Originals Public
metadata are `100/100` and consistent, but the contract is paused and the chapter
is inactive, so Public mint is locked.

## 9. Payment routing

### 9.1 Native POL mint

TicketHub and Public mint forward exactly the charged price and refund native
overpayment. The charged price is split:

| First-level destination | Share of mint price |
| --- | ---: |
| MultiCollectionDistributor | 60% |
| Dev wallet | 40% |

The Distributor splits its 60% share:

| Distributor destination | Share of Distributor inflow | Effective share of full mint |
| --- | ---: | ---: |
| Collection Rewards | 25% | 15% |
| Reserve | 35% | 21% |
| Buyback Agent | 20% | 12% |
| Treasury | 10% | 6% |
| Community Center | 10% | 6% |

Integer rounding remainder is assigned to Treasury. If a downstream call fails,
the Distributor records a protected pending balance that can be retried; it does
not silently classify that amount as free funds.

### 9.2 BIGGI mint payment

The current token sink is Treasury with `tokenSinkBps = 10000` and deposit mode
enabled. Therefore 100% of BIGGI paid for TicketHub or Public mint goes to
Treasury and is split fail-closed:

| Destination | BIGGI share |
| --- | ---: |
| Token Rewards | 34% |
| Reserve | 33% |
| DripDistributor | 33% |

All three targets must be configured or the payment reverts. BIGGI-paid mints do
not contribute native POL to Collection Rewards.

## 10. Collection Rewards and trading incentive

Collection Rewards apply only to registered VRF collections. Public collections
are intentionally excluded. The schedule is locked after collection budgets are
configured:

| Challenge | Ownership required at claim time | Global winners per VRF chapter | Reward |
| --- | --- | ---: | ---: |
| Orange set | all 10 backgrounds for one Orange-block `mainId` (`1-10`) | one per `mainId`, max 10 | `1,000 POL` |
| Block set | all ten distinct `mainId` values in one block `1-9`, any backgrounds | one per block, max 9 | `3,000 POL` |
| Rainbow set | all ten distinct `mainId` values in block 10 | one | `10,000 POL` |

Maximum native liability per VRF chapter is:

```text
10 * 1,000 + 9 * 3,000 + 1 * 10,000 = 47,000 POL
```

Each chapter has an isolated budget. Claims auto-enable only when that chapter's
funded amount reaches `47,000 POL`. Funding comes from the 15% effective share of
native mints attributed to the selected `fundingCollection`, or from an explicit
`fundCollectionBudget` payment. Before another chapter receives native mint
funding, operations must switch `fundingCollection` to its VRF collection.

At claim time, the contract reads current ERC-721 ownership. A collector may
mint, receive, or buy missing pieces on a secondary market. This intentionally
creates demand to assemble sets and gives otherwise separate backgrounds and
main IDs compositional utility. It does not guarantee liquidity or profit:

- each target can pay only once globally for that VRF chapter;
- the first valid claim consumes that target's reward;
- the chapter budget must already be enabled;
- the claimant pays gas;
- acquiring a set can cost more than its reward;
- marketplace availability and prices are external to the protocol.

At Polygon block `92774712`, all five budgets were configured but each had
`0 POL` funded, `47,000 POL` required, and claims disabled. The combined maximum
outstanding liability was `235,000 POL`; it is not currently funded debt because
claims remain locked separately for each chapter.

## 11. Token Rewards and NFT Rewards

### 11.1 Weekly BIGGI Token Rewards

Both VRF and Public collections in every registered chapter are eligible.
TicketHub tickets are not eligible.

- one claim state is tracked per collection, token ID, and EVM week;
- ownership is checked at claim time;
- transfer does not permit the same token to claim twice in one week;
- eye blocks carry units `10, 20, ..., 100` for blocks `1-10`;
- payout comes from the Token Rewards BIGGI balance first;
- the preventive funding path is the deployed `BiggiSupplyController`. It
  monitors the Token Rewards balance and, below `5,000,000 BIGGI`, can mint a
  `200,000,000 BIGGI` refill through `BiggiToken.mintToTokenRewards`, subject to
  a 12-hour cooldown, the `500,000,000 BIGGI` Guardian Rewards envelope, and
  the global token cap;
- the deployed `BiggiSupplyGuardian` is registered on the token, points to the
  Supply Controller, and is an authorized controller caller. Its owner can
  invoke manual maintenance or a manual rewards refill; automatic refill
  execution still requires an authorized keeper or CRE execution;
- the contract contains a direct shortfall fallback that calls
  `BiggiToken.mint`, but that token function is owner-only and Token Rewards is
  not the current token owner. Therefore this fallback is not currently
  operational. A claim would revert only if the balance were exhausted before
  the preventive refill transaction executed;
- the enabled emission controller may reduce the legacy `1 BIGGI per unit`
  default to fit the initialized weekly budget, but cannot increase it above
  that default.

At the snapshot, the initialized week had a `50,000 BIGGI` budget and
`0.5 BIGGI` per unit. These values are dynamic weekly state, not permanent rates.

### 11.2 NFT Rewards

`BiggiNftRewards` is a separate ERC-721 reward system. Its currently reachable
production paths are owner-created manual rewards and VRF-selected mystery-event
winners from a unique eligibility list. Assigned users mint the reward NFT by
calling `claim(rewardId)`.

The deployed contract also contains `createCharacterReward`, but that function
can be called only by an approved collection and the current `BiggiMain` and
`BiggiMain2` contracts do not call it. The ten block-completion character NFTs
are instead minted directly by each `BiggiMain` and are a separate mechanism.
The owner-only emergency mystery resolver can select a result without an
on-chain timeout requirement; this remains an explicit owner-trust boundary
until a hardened NFT Rewards version is deployed.

## 12. Metadata and game-state integrity

The game-critical fields are stored on-chain for every matrix position:

- `blockIdx` (eye color),
- `background`,
- `mainId`,
- minted state,
- ticket-price snapshot,
- block-price snapshot,
- final-price snapshot.

Images and JSON presentation are referenced through contract URIs/IPFS. An image
or marketplace trait does not override on-chain game state. Before activation,
each chapter must pass the complete metadata matrix checks:

- VRF: `configuredCount == 550`, `fullyConfigured == true`, and
  `rewardMatrixConsistent == true`;
- Public: `configuredCount == 100`, `fullyConfigured == true`, and the public
  reward matrix is consistent;
- final image/JSON URIs must be pinned and tested for that chapter.

Originals VRF currently passes `550/550`; Originals Public passes `100/100`.
Future chapters preserve the same structural rules but must not be activated
until their final media and URI checks pass.

## 13. Security and governance boundaries

Implemented controls include reentrancy guards on value-sensitive paths,
chapter-bound TicketHub checks, cap consistency checks, pause controls, VRF
consumer allowlisting, metadata validation, isolated Collection Rewards budgets,
and pending accounting for failed Distributor forwards.

Material owner powers include:

- pause/unpause contracts and activate chapters;
- change TicketHub price and growth multiplier;
- change current VRF block prices;
- change BIGGI conversion rates, payment recipients, and routing modules;
- change URIs and seed metadata before mint;
- change registry eligibility and Collection Rewards funding target;
- resolve a pending VRF mint through the emergency path described above;
- rescue assets where a contract exposes a rescue function.

These powers are not hypothetical because the contracts are not upgradeable
proxies: configuration changes act on the deployed contracts, while code changes
require redeployment and migration. Source verification and passing tests improve
transparency but are not an external security audit or formal verification.

## 14. Current launch state

Read-only checks at this snapshot show:

- CORE relationship check: passed with no mismatches;
- Chapter 1 VRF minted: `0/550`;
- Chapter 1 tickets: `50` marketing, `0` paid;
- all ten Chapter 1 block prices remain `100-1000 POL`;
- TicketHub unpaused, but all chapters inactive;
- Originals Public paused and locked;
- VRF subscription has `2 POL` native balance, Router is an authorized consumer,
  and request count is zero;
- all five Collection Rewards budgets are configured and locked at `0/47,000 POL`;
- launch preflight: `okForDeployOnly = true`, `okForPublicLaunch = false`, with
  11 expected prelaunch blockers and 2 warnings.

The inactive state is deliberate. A deployed contract or pre-minted marketing
ticket does not mean public sale or redemption is enabled.

## 15. Canonical CORE addresses

| Component | Address |
| --- | --- |
| Series Registry | `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` |
| Chapter Controller | `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` |
| Shared TicketHub | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| Compute | `0x0A09261631496B4aad9A5c2A82b62666249d773f` |
| VRF Router | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| Originals VRF | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| Originals Public | `0xe56cC0657A89daf10994204eD745985a61b0E36F` |
| MultiCollectionDistributor | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| Collection Rewards | `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43` |
| Token Rewards | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| NFT Rewards | `0x939Df533b80943298E15ad4c8F188102954f34FF` |

Canonical address data remain in `biggi-project/bekend/addresses.master.json`.

## 16. Reproducible verification

From `biggi-project/bekend`:

```bash
npm run check:master:core:polygon
npm run audit:collection-rewards:polygon
npm run preflight:launch:polygon
npm run check:master:polygon
```

Primary source contracts:

- `CORE/BiggiTicketHub.sol`
- `CORE/BiggiMain.sol`
- `CORE/BiggiMain2.sol`
- `CORE/BiggiCompute.sol`
- `CORE/BiggiSeriesRegistry.sol`
- `CORE/BiggiChapterController.sol`
- `CORE/BiggiCollectionRewards.sol`
- `CORE/BiggiTokenRewards.sol`
- `CORE/BiggiNftRewards.sol`
- `CORE/BiggiMultiCollectionDistributor.sol`

Any later configuration or deployment must update this document's version and
state snapshot.
