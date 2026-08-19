# Mainnet Completion Gaps

This checklist captures remaining work to reach full production readiness.

## Current final-audit blockers (2026-06-04)

Strict Polygon env validation is not yet deploy-ready.

Hard blockers:

1. `POLYGON_RPC_URL` is missing or still a placeholder.
2. `QUOTE_TOKEN` must be a non-zero production address.

Warnings to resolve before a real mainnet deploy:

1. Only one liquidity path may be active; current strict audit expected `keeper_proxy`, but `LIQUIDITY_AUTOMATION` is also configured.
2. `DEV_WALLET` must be explicitly set for Polygon mainnet.
3. `EXPECT_OWNER` must be set to the final Safe / timelock before post-deploy owner verification.
4. VRF production values are not provided yet, so `BiggiVRFRouter` would be skipped unless final VRF env is added.

## 1) Final addresses and ownership

1. Fill all production addresses in setup/config layers:
   - `BiggiMasterTokenomicsConfig`
   - `BiggiBuybackDripSetup` outputs
   - liquidity branch wiring (`router`, `factory`, `wNative`, `pair`)
2. Transfer owner roles from deployer to final multisig/timelock for all critical contracts.
3. Verify no privileged setter remains on EOA-only owner by mistake.

## 2) Keeper activation plan

1. Execute `MAINNET_GUARDED_WIRING_BATCH.md` with final addresses.
2. Register upkeeps for exactly one liquidity automation path:
   - `BiggiLiquidityKeeperProxy`, or
   - `LiquidityAutomation`
3. Fund and monitor keeper jobs (LINK/native depending on automation network).
4. Confirm allowlists:
   - `setKeeper`
   - `setAllowedCaller`
   - `setNotifyCaller` with strict mode enabled.

## 3) Parameter finalization

1. Lock final production values for:
   - `BiggiSupplyController` (`dex/rewards thresholds, refill sizes, cooldowns`)
   - `BiggiDexReserveGuard` (`ratio, cooldown, optional price-check params`)
   - `BiggiPolicy` (`buyback interval/slippage/deadline/quota`)
   - liquidity limits (`min/max/cooldown/quota` in orchestrator/proxy)
2. Re-run dry simulation with final parameters on fork.

## 4) DEX and liquidity launch readiness

1. Ensure `PAIR_BIGGI_NATIVE` is created and consistent in:
   - `BiggiSupplyController`
   - `BiggiDexReserveGuard`
   - liquidity manager/orchestrator branch
2. Verify one-shot initial liquidity procedure and LP custody policy.
3. Confirm reserve buckets (`waitingBiggi`, `dexRefillBiggi`) after launch actions.

## 5) VRF production readiness

1. Set final VRF coordinator, keyHash, subscription id, callback gas limits.
2. Add all production VRF consumer contracts to subscription.
3. Execute mint/redeem/finalize end-to-end with live VRF on target chain.

## 6) Operational safety and monitoring

1. Enable/confirm circuit-breaker settings and incident runbook.
2. Add alerts for:
   - low reserve floors
   - low token rewards balance
   - paused controller/guard
   - failed upkeep runs
3. Add periodic checks using readers:
   - `BiggiSystemReader`
   - `BiggiSupplyControllerReader`
   - `BiggiBuybackReader`
   - `BiggiReserveTreasuryReader`
   - `BiggiTokenomikReader`
   - remaining tokenomics readers captured in `TOKENOMIC_READERS/README.md`.

## 7) Release and verification

1. Verify source code and constructor args on explorer for all deployed contracts.
2. Freeze exact ABI package used by backend/frontend (including `CORE/CORE_ABI` and `TOKENOMICMAINNET/ABI`; current tokenomics package has 46 contract ABI files plus `index.json`, including 5 library snapshots).
3. Tag release commit and archive deployment manifests with tx hashes.
