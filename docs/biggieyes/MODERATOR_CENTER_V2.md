# Moderator Center V2 - Polygon Mainnet

Last live read: 2026-10-01, Polygon block `94786081` (`chainId=137`). The read was pinned to one block. No transaction was sent during this check.

## Current Status

Moderator V2 is the canonical contract for all new application integrations. Moderator V1 is deprecated and historical; its remaining production references are migration debt. V2 is deployed and internally wired to Drip V2, but it is **not active in the production flow**.

| Component | Address | Verified state |
| --- | --- | --- |
| Deprecated `ModeratorCenter` V1 | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` | Historical; residual production references still need migration |
| `ModeratorCenterV2` | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` | Paused; not operationally ready |
| Legacy `BiggiDripLMToModerator` V1 | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` | Still referenced by production upstream contracts |
| `BiggiDripLMToModeratorV2` | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` | Paused; internal wiring is ready |

At the verified block:

- Moderator V2 had all five chapters registered, but zero enabled moderator slots and zero leaders. `operationallyReady()` was `false`.
- Drip V2 had `wiringReady() == true`, pointed to Moderator V2, and had no pending native balance.
- `DripDistributor.dripLM`, `DripDistributor.tokensPerMintOperator`, and `BuybackAgent.dripLM` still pointed to Drip V1.
- Both V2 contracts were paused.
- The configured BIGGI/WPOL pair had no reserves.
- Moderator weights were leader `100`, moderator `30`, ticket boost `10`; global weekly uniqueness was enabled. Milestones were locked and set to zero.
- Drip V2 parameters were sell `70%`, Reserve/Moderator split `5000/5000` bps, slippage `200` bps, and deadline `600` seconds.

The Moderator Tools UI can read V2 data, but UI/read support is not proof that production payments are routed to V2. The live upstream references above are the authoritative routing check.

## Reward Flow

When connected and unpaused, the buyback branch calls Drip V2 after a BIGGI buy. Drip V2 sells its configured BIGGI amount through the DEX, then routes the resulting native POL between Reserve and Moderator V2. Moderator V2 records its allocation in the current weekly epoch.

Moderator V2 has ten slots. Each enabled slot needs a payout address and a unique referral hash, and exactly one enabled slot must be designated leader. Weekly weights use eligible unique referrals, the role coefficient, and the ticket activity boost. Anyone may settle a closed week after its settlement delay; rewards are credited to payout addresses, which can claim them. If a week has no eligible weight, its allocation rolls over rather than being paid out.

This is a POL payout flow, not a BIGGI token claim. Milestone payouts are separate and currently configured to zero.

## Why V2 Is Not Activated

Two production gates are currently unmet:

1. No moderator slots are configured. At least one complete slot and exactly one leader are required for `operationallyReady()`.
2. The configured BIGGI/WPOL pair has no liquidity. The activation preflight explicitly refuses an empty pair.

Do not bypass these checks or point production callers at the paused V2 contracts. Doing so could interrupt existing Drip processing. The frontend contract registry now treats Moderator V2 as canonical for new UI integrations, and its legacy V1 helper is read-only. Backend deployment manifests still preserve V1 under the historical `MODERATOR_CENTER` key because that is what the deployed upstream contracts currently reference; this source-level change does not alter the deployed chain. The existing activation script unpauses both V2 contracts and changes three upstream references in separate transactions; it is not an atomic migration.

## Activation Sequence

1. Collect the real moderator payout address and referral identity for every slot to enable. Select exactly one leader. Do not invent these values.
2. Run `npm run prepare:configure-moderator-v2:polygon`; review the proposed slots. Configure them only while Moderator V2 remains paused.
3. Add explicitly approved BIGGI/WPOL liquidity and verify that the pair has non-zero reserves. The initial token amounts and price require a separate decision.
4. Run `npm run prepare:activate-moderator-v2:polygon`. Review every preflight result and the complete transaction sequence.
5. Only after explicit owner approval, execute `npm run activate:moderator-v2:polygon`. Verify receipts, pause states, and all upstream references after each transaction. If execution stops partway through, take a fresh read-only snapshot before retrying.
6. Synchronize the deployment manifests and application configuration to the confirmed live state, then test Moderator reads, weekly settlement, claims, and Drip delivery.

## Source References

- V2 implementation: `biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/ModeratorCenterV2.sol`
- Paired Drip implementation: `biggi-project/bekend/contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/BiggiDripLMToModeratorV2.sol`
- Canonical addresses: `biggi-project/bekend/addresses.master.json` and `biggi-project/bekend/reports/moderator-v2-deployment-polygon.json`
- Configuration and activation checks: `biggi-project/bekend/scripts/master/configureModeratorV2.js` and `biggi-project/bekend/scripts/master/activateModeratorV2.js`
- Prior dated readiness evidence: `reports/moderator-v2-readiness-2026-09-09.md`
- Moderator Tools UI read-path evidence: `reports/moderator-tools-2026-09-09.md`
