# BIGGI Tokenomics Technical Whitepaper

- Version: 1.0
- Language: English
- Network: Polygon PoS mainnet (`chainId 137`)
- State snapshot: 2026-08-27, verified through Polygon block `92774843`

## 1. Scope and interpretation

This document specifies the deployed BIGGI tokenomic system and its connection
to NFT mint revenue. It covers BIGGI supply, native and token payment routes,
Collection Rewards, weekly Token Rewards, Reserve, buyback, drip, liquidity,
supply defense, community and moderator allocation, Chainlink CRE automation,
governance controls, and the current prelaunch state.

This is a technical description, not financial advice or a promise of price,
profit, liquidity, buyback execution, reward availability, or marketplace demand.
"Current" values are owner-adjustable configuration read from Polygon at the
snapshot date. Contract code and later on-chain transactions take precedence.

## 2. Economic architecture

Native NFT mint revenue feeds six first-order destinations:

```text
TicketHub / Public mint
          |
          +-- 40% -> Dev wallet
          |
          +-- 60% -> MultiCollectionDistributor
                         |
                         +-- 25% -> Collection Rewards
                         +-- 35% -> Reserve
                         +-- 20% -> Buyback Agent
                         +-- 10% -> Treasury
                         +-- 10% -> Community Center
```

Payment in BIGGI follows a separate token route:

```text
TicketHub / Public mint
          |
          +-- 100% BIGGI -> Treasury
                              |
                              +-- 34% -> Token Rewards
                              +-- 33% -> Reserve
                              +-- 33% -> DripDistributor
```

These two flows must not be conflated. In particular, BIGGI-paid mints do not
fund the native POL Collection Rewards budgets.

## 3. BIGGI token supply

`BiggiToken` is an 18-decimal ERC-20 with permit, burn, pause, and a global hard
cap of `2,200,000,000 BIGGI`.

### 3.1 Completed initial distribution

The one-time initial distribution minted `1,200,000,000 BIGGI`:

| Destination | Initial BIGGI | Share of initial supply | Share of hard cap |
| --- | ---: | ---: | ---: |
| Reserve | 600,000,000 | 50.00% | 27.27% |
| DripDistributor | 200,000,000 | 16.67% | 9.09% |
| Token Rewards | 200,000,000 | 16.67% | 9.09% |
| Marketing Support | 200,000,000 | 16.67% | 9.09% |
| **Total** | **1,200,000,000** | **100.00%** | **54.55%** |

At this snapshot, the live balances still include `600,000,000 BIGGI` in
Reserve, `200,000,000 BIGGI` in DripDistributor, and `200,000,000 BIGGI` in
Token Rewards. Total supply is `1.2B BIGGI`.

### 3.2 Controlled refill envelopes

The remaining one-billion-token difference to the cap is represented by two
branch limits:

| Refill branch | Maximum additional BIGGI | Intended recipient |
| --- | ---: | --- |
| Guardian DEX/drip refill | 500,000,000 | DripDistributor |
| Guardian Token Rewards refill | 500,000,000 | Token Rewards |

Both branch counters are zero at the snapshot. Their dedicated mint functions
enforce branch caps and the global cap.

### 3.3 Material owner authority

The token also exposes an owner-only generic `mint(to, amount)` function that is
limited by the `2.2B` global cap but does not consume the two guardian branch
counters. The owner can also pause transfers and move tokens from the locked
Reserve address with `transferFromReserveTo`. "Reserve locked" prevents changing
the configured Reserve address after initial distribution; it does not make the
Reserve balance immovable.

Because the token is burnable, a holder can reduce current total supply. Burning
does not reduce the immutable cap: `remainingMintable = CAP - totalSupply`, so a
burn increases the amount that could later be minted up to the same cap. BIGGI
must therefore be described as cap-bounded, not as permanently deflationary.

## 4. Native NFT mint allocation

The effective allocation of a complete native mint payment is:

| Destination | Effective share |
| --- | ---: |
| Dev wallet | 40% |
| Collection Rewards | 15% |
| Reserve | 21% |
| Buyback Agent | 12% |
| Treasury | 6% |
| Community Center | 6% |
| **Total** | **100%** |

TicketHub uses chapter-aware Distributor calls; Public collections are attributed
through Registry resolution. The Distributor records totals per source,
chapter, and series.

All five downstream recipients must be configured. A failed downstream forward
is stored as a recipient-specific pending balance and can be retried. Integer
rounding remainder is assigned to Treasury. Owner withdrawals can use only the
Distributor's free balance after protected pending liabilities.

## 5. BIGGI payment allocation

TicketHub and Public contracts currently route `10000` basis points of BIGGI
payments to Treasury in deposit mode. Treasury requires an allowlisted ecosystem
caller, pulls the tokens, and requires all three split recipients to exist.

| Treasury destination | Share of BIGGI payment |
| --- | ---: |
| Token Rewards | 34% |
| Reserve | 33% |
| DripDistributor | 33% |

The last share receives integer remainder. Reserve is notified into its DEX
refill accounting, while DripDistributor records the deposited inventory.

The NFT contracts convert the POL-denominated mint price through the owner-set
`biggiPerEth` parameter. This parameter is not a DEX or oracle quote. Its current
value is `1e18`, which makes the numerical BIGGI amount equal the POL-denominated
price but does not imply market parity.

## 6. Collection Rewards as a market-composition incentive

Collection Rewards use native POL and apply only to each chapter's 550-item VRF
collection. Public collections receive weekly Token Rewards but are deliberately
excluded from Collection Rewards.

| Set objective | Number of globally payable objectives per VRF chapter | Reward per objective | Maximum branch liability |
| --- | ---: | ---: | ---: |
| Own all 10 backgrounds for one Orange `mainId` | 10 | 1,000 POL | 10,000 POL |
| Own all 10 `mainId` values in one block `1-9` | 9 | 3,000 POL | 27,000 POL |
| Own all 10 `mainId` values in Rainbow block 10 | 1 | 10,000 POL | 10,000 POL |
| **Total per chapter** | **20 objectives** |  | **47,000 POL** |

Eligibility is based on current ownership at claim time. Collectors can acquire
missing pieces by mint, transfer, or secondary-market purchase. The mechanic is
designed to motivate trading and set completion because backgrounds and main IDs
have utility in combination, not only in isolation.

It does not promise a return. Each objective pays only once globally in that VRF
chapter, the first valid claim wins, the budget must be enabled, the claimant
pays gas, and set acquisition may cost more than the reward.

Each chapter has an isolated `47,000 POL` budget and claims auto-enable only at
full coverage. Native mints contribute an effective 15% while their chapter is
the selected `fundingCollection`; explicit funding is also allowed. BIGGI-paid
mints contribute no POL.

Under the narrow projection of 500 native paid-ticket mints starting at `500 POL`
with `0.33%` recurring growth and no configuration change, one chapter reaches
`47,000 POL` after 341 native mints and finishes with approximately
`95,292.139316239340579355 POL` attributed to Collection Rewards. Actual timing
changes with BIGGI payments, sales mix, owner configuration, and chapter routing.

At Polygon block `92774712`, all five chapter budgets were configured but each
was `0/47,000 POL`; all claims were correctly locked.

## 7. Weekly BIGGI Token Rewards

Token Rewards apply to both registered VRF and Public collections. TicketHub
tickets are not eligible. The eye-block units are:

| Eye block | Units per NFT per eligible week |
| ---: | ---: |
| 1-10 | `10, 20, 30, 40, 50, 60, 70, 80, 90, 100` |

The contract checks current ownership and stores the last claimed EVM week for
each collection and token ID. Transferring an NFT does not reset that token's
weekly claim state.

Token Rewards pays from its BIGGI balance first. The deployed Supply Controller
is the preventive funding path: below the configured balance threshold it can
call `BiggiToken.mintToTokenRewards` within the Guardian Rewards and global caps.
The Supply Guardian is an authorized owner-operated helper for this Controller.
The direct shortfall fallback inside Token Rewards instead calls the owner-only
`BiggiToken.mint`; because Token Rewards is not the current token owner, that
fallback is not operational. A claim therefore reverts if the balance is
exhausted before preventive maintenance executes. The legacy default is
`1 BIGGI` per unit, but the enabled emission controller can only reduce that
amount to fit a weekly budget.

### 7.1 Weekly emission controller

Current configuration:

| Parameter | Value |
| --- | ---: |
| Target weekly units | 100,000 |
| Minimum budget, zero inflow | 50,000 BIGGI |
| Weak budget, positive inflow below 10,000 | 100,000 BIGGI |
| Normal budget, inflow at least 10,000 | 500,000 BIGGI |
| Strong budget, inflow at least 200,000 | 1,000,000 BIGGI |
| Emergency-mode budget | 25,000 BIGGI |
| Maximum weekly budget | 1,000,000 BIGGI |
| Balance cap | 1% of Token Rewards balance |

The controller observes the weekly increase in Treasury's buyback and ecosystem
BIGGI accounting. It chooses the tier, caps it by the maximum and by 1% of the
Token Rewards balance, then sets:

```text
weekly unit reward = weekly budget / 100,000 target units
claim amount        = min(units * weekly unit reward,
                          units * legacy unit reward)
```

If a claim would exceed the remaining weekly budget, it reverts rather than
partially consuming token claim state. At the snapshot, week `2956` had zero
observed inflow, a `200M BIGGI` Token Rewards balance, a `50,000 BIGGI` budget,
zero paid, and `0.5 BIGGI` per unit.

## 8. Buyback branch

The Buyback Agent receives 20% of Distributor inflow, equal to 12% of a native
mint. Its configured route is QuickSwap V2:

```text
POL -> WPOL -> BIGGI
```

Current policy parameters are:

| Parameter | Value |
| --- | ---: |
| Swap slippage limit | 5% (`500 bps`) |
| Transaction deadline | 600 seconds |
| Minimum interval | 300 seconds |
| Daily native quota | `0` (unlimited by this setting) |
| Buyback upkeep threshold | 0.5 POL |

On a successful swap, all acquired BIGGI is approved to Treasury and split
`34% / 33% / 33%` to Token Rewards, Reserve, and DripDistributor. It is not
burned. Therefore buyback is a recirculation mechanism, not a permanent supply
reduction or a price guarantee.

If the automatic quote or swap cannot complete, the native amount is forwarded
to Treasury as an explicitly recorded fallback. After a successful buyback, the
Agent notifies Drip. A Drip failure is intentionally non-blocking and does not
undo the completed buyback.

At the snapshot, the Agent itself is not paused, but automatic buyback is
disabled and `BuybackUpkeepProxy` is paused. No native has been spent and no
BIGGI has been acquired.

## 9. Drip feedback loop

Drip is the counter-flow triggered by a successful buyback. It does not run as a
separate mandatory periodic CRE task.

```text
successful buyback acquires X BIGGI
          |
          +-- Treasury recirculates all X BIGGI (34/33/33)
          |
          +-- Buyback Agent reports X to DripLM
                         |
                         +-- target sale = 70% of X
                         +-- source inventory from DripDistributor as needed
                         +-- sell BIGGI -> POL on QuickSwap
                         +-- 50% POL -> Reserve
                         +-- 50% POL -> Moderator Center
```

The sold BIGGI comes from Drip inventory; it is not a direct reversal of the
exact token units just purchased. Actual sale can be smaller than the 70% target
when inventory, quoting, or swap execution is unavailable.

DripDistributor started with `200M BIGGI` and has a historical receipt cap of
`700M BIGGI`, consisting of the initial 200M plus the 500M Guardian DEX envelope.
It tracks total received, total claimed, and available inventory. Only the
configured DripLM can claim inventory.

Current swap settings are 70% target sale, 2% slippage, 600-second deadline, and
a 50/50 Reserve/Moderator split.

### 9.1 Live V1 and staged V2

The canonical live wiring still points to:

- DripLM V1: `0xE258843bca54803a366413571b3B4d6a28eAF2eC`;
- Moderator V1: `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D`.

Hardened replacements are deployed and source-verified but not activated:

- `BiggiDripLMToModeratorV2`:
  `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A`, paused;
- `ModeratorCenterV2`:
  `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8`, paused.

V2 preserves failed Reserve and Moderator deliveries as separate pending
liabilities. Its wiring is ready, but Moderator V2 is not operationally ready
because moderator slots are not configured. Deployment alone did not switch the
live branch.

## 10. Reserve, liquidity manager, and LP vault

Reserve holds native POL and BIGGI and maintains accounting buckets `WAITING`
and `DEX_REFILL`. Strict notify-caller checking is enabled. The invariant is that
accounted bucket totals must not exceed the real BIGGI balance.

Reserve receives:

- 21% of a native NFT mint;
- 33% of ecosystem BIGGI payments routed through Treasury;
- 33% of BIGGI acquired by buyback and routed through Treasury;
- 50% of native proceeds from a successful Drip sale.

The liquidity path is:

```text
Reserve -> LiquidityManager -> QuickSwap addLiquidityETH -> LiquidityVault
```

After initial liquidity exists, LiquidityManager quotes the BIGGI amount from
the pool ratio, pulls both assets from Reserve, applies minimum amounts, adds
liquidity, returns unused assets, and synchronizes LP accounting. LP tokens are
minted directly to the Vault.

Current parameters:

| Component | Parameter | Value |
| --- | --- | ---: |
| LiquidityManager | token percentage | 100% |
| LiquidityManager | slippage | 3% |
| LiquidityManager | deadline | 600 seconds |
| LiquidityManager | automatic top-up | disabled |
| Orchestrator | POL per action | 0.5-50 POL |
| Orchestrator | cooldown | 3,600 seconds |
| Orchestrator | daily quota | `0` (unlimited by this setting) |
| KeeperProxy | amount mode | 5% of Reserve POL |
| KeeperProxy | minimum interval | 900 seconds |
| KeeperProxy | minimum Reserve | 1 POL |
| KeeperProxy | maximum action | 20 POL |

Only `LiquidityKeeperProxy` is the intended CRE liquidity path. A legacy
`LiquidityAutomation` path must not run in parallel.

The LP Vault is governance custody, not an immutable lock. LiquidityManager can
sync and withdraw according to its role; the owner can whitelist pairs, release
LP, and rescue assets. This authority must be protected by final governance.

The planned initial pair seed is `8,000,000 BIGGI + 5,000 POL`. At the snapshot,
the QuickSwap BIGGI/WPOL pair exists but has `0/0` reserves and zero LP supply.
No buyback, drip swap, reserve baseline, or ratio-based liquidity automation can
operate meaningfully before this seed.

## 11. Supply defense and DEX guard

`BiggiSupplyController` can use the bounded guardian token functions for two
branches:

| Branch | Trigger/configuration | Refill | Cooldown |
| --- | --- | ---: | ---: |
| DEX/Drip | pair BIGGI reserve below 50% of baseline | 20,000,000 BIGGI | 30 minutes |
| Token Rewards | balance below 5,000,000 BIGGI | 200,000,000 BIGGI | 12 hours |

The circuit breaker is enabled with `500 BIGGI` critical floors for both DEX and
Token Rewards observations. The DEX baseline is currently zero because initial
liquidity has not been seeded and snapshotted.

At the snapshot, `BiggiToken.supplyController` is
`0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` and
`BiggiToken.supplyGuardian` is
`0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49`. The Controller is unpaused. The
Guardian points to that Controller and is an allowed caller on it. The current
Token Rewards balance is `200,000,000 BIGGI`, so no refill is presently needed.

`BiggiDexReserveGuard` independently uses a 50% baseline ratio, 20M refill, and
30-minute cooldown. Its optional price-deviation check is currently disabled;
the maximum configured deviation is 20%, no quote oracle is set, and oracle
enforcement is not required.

When both SupplyController and DEX Guard are available, automation must define a
single responsibility boundary or cooldown/order that prevents duplicate
refills. `BiggiSupplyGuardian` is an owner-operated operations helper: it can
request maintenance and manual refills through the Controller, but it neither
monitors continuously nor mints by itself. Autonomous execution requires an
authorized keeper or CRE caller. The CRE Receiver is not yet authorized for the
Supply Controller at this snapshot, consistently with the paused prelaunch
state.

## 12. Community and moderator branches

`BiggiCommunityCenter` receives an effective 6% of native mint revenue. It
supports owner-created events and grants with claimable winner allocations.
Amounts committed to active events are tracked as locked liabilities and cannot
be withdrawn as free surplus.

Moderator allocation is different: it receives 50% of native POL produced by a
successful Drip sale, not the Community Center's 6% mint share.

The staged Moderator V2 model has ten slots, exactly one enabled leader, unique
referral hashes, on-chain paid-ticket attribution, weekly accounting, a one-day
settlement delay, and pull-based claims. Default relative coefficients are:

```text
leader base coefficient    = 100
moderator base coefficient = 30
ticket boost               = 10 per attributed paid ticket
slot weekly weight         = unique buyers * (base + 10 * ticket count)
```

Paid ticket IDs can be attributed once. Chapter ranges are registered from the
live TicketHub, ownership is verified, marketing tickets are excluded, and
configuration is versioned so an opened week keeps its historical version.
Milestones have a separate funded budget. V2 remains paused until payout slots,
referral hashes, and exactly one leader are configured.

## 13. Chainlink CRE automation

The intended production workflow has five branches:

| Branch | On-chain target |
| --- | --- |
| Supply | `SupplyController.performUpkeep(bytes)` |
| Buyback | `BuybackUpkeepProxy.performUpkeep(bytes)` |
| Liquidity | `LiquidityKeeperProxy.performUpkeep(bytes)` |
| DEX Guard | `DexReserveGuard.performUpkeep(bytes)` |
| Rewards Week | `TokenRewardsEmissionController.rollCurrentWeek()` |

For upkeep targets, the workflow first reads `checkUpkeep("0x")`. When action is
required, it submits the authorized report through `BiggiCREAutomationReceiver`.
The Receiver verifies the Keystone Forwarder, expected workflow ID and owner,
target/selector allowlist, and payload limits before forwarding the call.

Drip is not a sixth periodic branch. A successful buyback invokes
`dripOnBuy(acquired)` directly. The legacy Drip keeper remains paused.

Current on-chain state:

- Receiver `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` is paused;
- production Keystone Forwarder is
  `0x76c9cf548b4179F8901cda1f8623568b58215E62`;
- expected workflow ID and workflow owner are zero/unlocked;
- five call allowlist entries and target roles are not fully wired;
- LiquidityKeeperProxy and BuybackUpkeepProxy are paused;
- CRE simulation of the five-branch dry-run can pass without activating mainnet.

No workflow should be activated before initial liquidity, baseline snapshots,
final role wiring, workflow identity lock, and strict launch preflight.

## 14. Activation order

The production dependency order is:

1. confirm canonical Polygon router, factory, WPOL, pair, owner, and manifests;
2. seed `8M BIGGI + 5,000 POL` initial liquidity;
3. snapshot DEX baselines and verify pair reserves and LP custody;
4. complete post-liquidity tokenomic configuration;
5. configure exactly one liquidity automation path;
6. configure CRE workflow ID, owner, Receiver calls, and target roles;
7. run the strict Polygon gate and archive evidence;
8. configure Moderator/Drip V2 separately if it is to replace V1;
9. transfer sensitive ownership to the intended Safe/multisig;
10. activate only Originals first; leave future chapters inactive.

Public Originals mint remains independently locked until all 550 Originals
tickets have been minted.

## 15. Governance, risks, and non-guarantees

The current owner can change many economic settings, including generic token
minting up to the hard cap, token pause state, ticket and block prices, payment
conversion, recipient wiring, buyback/slippage limits, supply thresholds,
emission budgets, Reserve movements, LP release, and rescue functions. The
current owner is an EOA, not the final Safe.

External dependencies include Polygon, Chainlink VRF, CRE, QuickSwap, WPOL,
RPC/indexing providers, IPFS gateways, and user wallets. Risks include smart
contract defects, owner-key compromise, MEV, slippage, thin liquidity, oracle or
RPC failure, failed automation, governance error, metadata availability, and
marketplace behavior.

Specific non-guarantees:

- buyback does not guarantee appreciation and does not burn acquired BIGGI;
- drip can add BIGGI sell pressure and may fail or execute partially;
- liquidity automation cannot prevent all volatility or impermanent loss;
- Collection Rewards are competitive and budget-gated;
- Token Rewards rates can fall with weekly budgets and supply limits;
- test suites, source verification, and simulation are not external audits or
  formal verification.

## 16. Current mainnet snapshot

| State | Value |
| --- | --- |
| BIGGI total supply | `1,200,000,000 BIGGI` |
| Remaining to global cap | `1,000,000,000 BIGGI` |
| Guardian DEX minted | `0` |
| Guardian Rewards minted | `0` |
| Reserve BIGGI balance | `600,000,000 BIGGI` |
| Reserve POL balance | `0 POL` |
| Drip available inventory | `200,000,000 BIGGI` |
| Token Rewards BIGGI balance | `200,000,000 BIGGI` |
| Pair reserves / LP supply | `0 / 0 / 0` |
| Buyback native spent / BIGGI acquired | `0 / 0` |
| Collection Rewards funding | five times `0 / 47,000 POL` |
| Current owner | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` |
| Public launch preflight | not ready, 11 expected blockers |

The deployment and wiring checks pass. The remaining blockers are activation
conditions, led by initial liquidity, paused automation, missing CRE production
identity/roles, and chapter activation.

## 17. Canonical tokenomic addresses

| Component | Address / state |
| --- | --- |
| BIGGI token | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| Reserve V4 | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| Treasury | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| MultiCollectionDistributor | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| Collection Rewards | `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43` |
| Token Rewards | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| Emission Controller | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` |
| DripDistributor | `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3` |
| Buyback Agent | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| Buyback Policy | `0x50485231A0602DE7a7b64e2760EF21133c77a43C` |
| DripLM V1, live wiring | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` |
| Moderator V1, live wiring | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` |
| DripLM V2, staged/paused | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` |
| Moderator V2, staged/paused | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` |
| Community Center | `0x81C6E90a991d7D210c43B00B7EB1a5450cc372Ae` |
| Supply Controller | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` |
| Supply Guardian | `0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49` |
| DEX Reserve Guard | `0x350370c248495758b80Ea1C564Df1290cA76588B` |
| Liquidity Manager | `0xfb770C5A5AC6e41C85f076DB7C3434eAcd8e0F19` |
| Liquidity Vault | `0xFe234394845B601B2c671c0dD631fA6290c02bb9` |
| Liquidity Orchestrator | `0xC72DB11941d8Ab76baF84B1af9dB43E09060b681` |
| Liquidity Keeper Proxy | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` |
| CRE Receiver | `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` |
| QuickSwap V2 Router | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |
| QuickSwap V2 Factory | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` |
| WPOL | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| BIGGI/WPOL Pair | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |

Canonical address data remain in `biggi-project/bekend/addresses.master.json`.

## 18. Reproducible verification

From `biggi-project/bekend`:

```bash
npm run check:master:polygon
npm run check:master:core:polygon
npm run audit:collection-rewards:polygon
npm run preflight:launch:polygon
npm run preflight:master:cre:polygon
```

Primary source directories:

- `BIGGI_MASTER/TOKENOMICMAINNET`
- `BIGGI_MASTER/CORE`
- `BIGGI_MASTER/chainlink/biggi-cre-automation`

Operational activation must follow
`TOKENOMICMAINNET/MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`,
`TOKENOMICMAINNET/INITIAL_LIQUIDITY_RUNBOOK_CS.md`, and the strict launch gate.
Any later configuration or deployment must update this document's version and
state snapshot.
