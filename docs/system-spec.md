# BiggiNFT System Spec (one-page)

Goal: keep the system understandable and safe across 10+ contracts by defining
roles, critical flows, invariants, and operational expectations outside code.

## 1) Roles and boundaries (contracts)
- Main / Main2: mint + game/lottery entry, emits core events.
- Distributor / CollectionRewards / TokenRewards / NftRewards: rewards rails.
- Reserve / Treasury / BuybackAgent / DripLM / LiquidityVault: tokenomics rails.
- Readers: read-only aggregation (frontend should prefer readers).
- VRF Router / Keeper Proxies: external infra edges.

## 2) Source of truth
- Addresses: `src/shared/utils/addresses.js` (frontend) + backend mirror
  `biggi-project/bekend/addresses.json`.
- ABI: `src/config/abi/index.js` (frontend) + `ABI_INVENTORY.md`.
- Contract registry: `src/config/contracts/index.js` (addressKey + ABI name).

## 3) Critical flows (happy path)
- Mint -> Distributor split -> Reserve/Treasury/Buyback/Drip -> LM/Vault.
- Weekly claims -> TokenRewards/CollectionRewards -> user payout.
- NFT rewards -> event creation -> VRF -> assign -> claim.

## 4) Invariants (must always hold)
- No free mint: reward minting respects `rewardsCap` and token cap.
- Accounting: bucket totals never exceed contract balances (or are reconciled).
- Split rules: BPS sums are valid and enforced at runtime.
- Access control: only allowed roles can call admin methods.
- Weekly rules: one claim per token per week (no double-claim).
- Readers never mutate state; only view.

## 5) Threat model (expected failure modes)
- VRF fails or stalls: mystery events remain pending, no unsafe fallback.
- DEX router revert / low liquidity: buyback/drip skips or throttles safely.
- Keeper/RPC outage: scheduled jobs stop; system remains safe (not stuck).
- Reorg: indexer/analytics must re-validate last N blocks.

## 6) Monitoring + alerting (prod ops)
- Alerts: stalled keeper, VRF request older than X, buyback revert rate spike.
- Balances: reserve/treasury low, VRF subscription low.
- Slippage events: repeated swap failure or max slippage hit.
- Event watchers: Discord/Telegram notify on incident thresholds.

## 7) Indexing / data layer (FE)
- Define read models: what comes from RPC vs indexer.
- Indexer handles history, leaderboards, aggregated stats.
- Reorg handling: rollback last N blocks and re-apply.

## 8) Key management + governance
- Use multisig for owner/admin roles (Gnosis Safe).
- Document who can pause/unpause, update caps/slippage, rotate keepers.
- Incident runbook with clear steps and owners.

## 9) Release engineering
- Deployment manifest: contract address + params + tx hashes.
- Verified contracts on explorer; export `addresses.json` as artifact.
- ABI versioning tied to commit/tag to avoid mismatched FE/BE.

## 10) Economic testing
- Scenario tests: low liquidity, high sell pressure, swap fail, RPC down.
- Parameter sweeps: slippageBps, sellPct, cooldown, quotas.
- Guardrails: min LP, min reserve, stop conditions.

## 11) MEV risk (swaps + liquidity)
- Use max slippage + price sanity checks if available.
- Consider private relay/bundles for sensitive operations.

## 12) IPFS + metadata integrity
- Pinning strategy (primary + fallback).
- Gateway fallback + timeouts.
- Policy: when metadata is frozen and how fixes happen.

## 13) Frontend ops (non-UI)
- Error monitoring (Sentry or equivalent).
- CSP/security headers and dependency audits.
- Offline/poor-network mode with cached snapshots.

## 14) Legal/product minimum
- Terms + Privacy + rewards rules + disclaimers.
- Moderation/abuse policy for community features.

## 15) Bug bounty / disclosure
- Responsible disclosure email + SLA.
- Reward tiers by severity.

## Quick wins (doable now)
- Add reader addresses to FE and show them in the rewards panel.
- Keep `ABI_INVENTORY.md` synced when new ABIs are added.
- Publish a deployment manifest per release (even a simple markdown table).
