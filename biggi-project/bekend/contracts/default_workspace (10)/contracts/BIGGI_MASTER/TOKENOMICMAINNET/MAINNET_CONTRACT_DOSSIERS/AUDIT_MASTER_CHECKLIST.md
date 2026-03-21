# Mainnet Master Audit Checklist

Date: 2026-03-20

## 1. Governance and ownership
- [ ] Ownership transferred from deployer EOA to final multisig/timelock.
- [ ] No critical setter remains on temporary deployment wallets.
- [ ] Emergency pause guardians are assigned and documented.

## 2. Address wiring
- [ ] Tokenomics config points to final production addresses.
- [ ] DEX pair/router/factory/wNative addresses are final and verified.
- [ ] VRF coordinator/keyHash/subscription are final and funded.
- [ ] Reader contracts point to the same production addresses as write contracts.

## 3. Keeper topology
- [ ] Exactly one liquidity automation path is active.
- [ ] Supply controller upkeep registered and funded.
- [ ] Buyback upkeep registered and funded.
- [ ] DEX guard upkeep registered if guarded profile is selected.
- [ ] Keeper allowlists and caller restrictions are locked.

## 4. Supply and cap invariants
- [ ] Total cap invariant verified under all mint branches.
- [ ] Dex refill and rewards refill budgets are bounded and monitored.
- [ ] Circuit-breaker thresholds are explicitly set and tested.
- [ ] Guardian emergency paths are bounded and auditable.

## 5. Treasury and reserve flow
- [ ] Buyback split routes match tokenomics policy.
- [ ] Reserve bucket accounting matches token balances.
- [ ] Drip and rewards branches receive expected amounts in rehearsal.
- [ ] Native asset custody and transfer-out permissions are reviewed.

## 6. Core collection integration
- [ ] TicketHub integration tested for Main1 VRF and Main2 Public paths.
- [ ] SeriesRegistry and ChapterController mappings are coherent.
- [ ] CollectionRewards and TokenRewards cross-check passed.
- [ ] MultiCollectionDistributor split sums and recipients validated.

## 7. Verification and release control
- [ ] All contracts verified on explorer with exact constructor args.
- [ ] ABI packages frozen for backend/frontend release.
- [ ] Release tag created and deployment manifests archived.
- [ ] Incident runbook and alerting thresholds approved.

## 8. Final go-live gate
- [ ] Fork rehearsal with final parameters completed.
- [ ] Post-deploy smoke checks completed.
- [ ] Monitoring dashboards green for at least one full cycle.
- [ ] Business sign-off and security sign-off captured.
