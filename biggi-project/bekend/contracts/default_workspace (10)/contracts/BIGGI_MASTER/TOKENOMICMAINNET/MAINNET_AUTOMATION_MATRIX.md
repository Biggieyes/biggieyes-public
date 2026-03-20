# Mainnet Automation Matrix

This file defines recommended keeper/upkeep topology for the BIGGI mainnet tokenomics branch.

## Profiles

### Profile A: Lean (3 upkeeps)
1. `BiggiSupplyController.checkUpkeep/performUpkeep`
2. `BiggiBuybackUpkeepProxy.checkUpkeep/performUpkeep`
3. One liquidity automation path only:
   - `BiggiLiquidityKeeperProxy`, or
   - `LiquidityAutomation`

### Profile B: Guarded (4 upkeeps, recommended)
1. `BiggiSupplyController.checkUpkeep/performUpkeep`
2. `BiggiBuybackUpkeepProxy.checkUpkeep/performUpkeep`
3. One liquidity automation path only:
   - `BiggiLiquidityKeeperProxy`, or
   - `LiquidityAutomation`
4. `BiggiDexReserveGuard.checkUpkeep/performUpkeep`

### Profile C: Redundant (5 upkeeps, optional)
Profile B plus:
1. `DripKeeperProxy.checkUpkeep/performUpkeep`

## Anti-duplication rules

1. Do not run `BiggiLiquidityKeeperProxy` and `LiquidityAutomation` at the same time.
2. If `BiggiDexReserveGuard` is enabled, keep clear responsibility boundaries with `BiggiSupplyController` DEX leg to avoid duplicate refills in the same interval.
3. If buyback auto-flow (`receiveMintShare`) is active and stable, treat `DripKeeperProxy` as optional fallback, not a mandatory primary path.

## Mainnet hardening checklist

1. Set and snapshot DEX pair on both controller and guard:
   - `BiggiSupplyController.setPair()`, `snapshotBaseline()`
   - `BiggiDexReserveGuard.setPair()`, `snapshotBaseline()`
2. Configure keeper/allowed caller gates:
   - `BiggiSupplyController.setKeeper()` and/or `setAllowedCaller()`
   - `BiggiDexReserveGuard.setKeeper()`
   - `BiggiLiquidityOrchestrator.setKeeper()`
   - `BiggiLiquidityKeeperProxy.setAllowedCaller()` when using allowlist mode
   - `BiggiBuybackAgent.setKeeper()`
3. Enable strict reserve notify mode and whitelist only expected senders:
   - `BiggiReserveV4.setNotifyCallerCheck(true)`
   - `BiggiReserveV4.setNotifyCaller(<trusted>, true)`
4. Validate all wiring before activation:
   - `BiggiMasterTokenomicsConfig` bundles
   - `BiggiSystemReader`, `BiggiSupplyControllerReader`, `BiggiBuybackReader`

