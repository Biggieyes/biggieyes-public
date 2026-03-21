# Mainnet Guarded Wiring Batch

This batch configures the recommended **Guarded (4-upkeep)** profile.
Replace placeholders with final deployed addresses.

## Address placeholders

- `TOKEN`: BIGGI token
- `SUPPLY_CONTROLLER`: BiggiSupplyController
- `DEX_GUARD`: BiggiDexReserveGuard
- `BUYBACK_AGENT`: BiggiBuybackAgent
- `BUYBACK_UPKEEP_PROXY`: BiggiBuybackUpkeepProxy
- `LIQUIDITY_ORCHESTRATOR`: BiggiLiquidityOrchestrator
- `LIQUIDITY_KEEPER_PROXY`: BiggiLiquidityKeeperProxy (if this path is used)
- `CHAINLINK_REGISTRY`: Chainlink Automation registry/executor address (optional allowlist mode)
- `RESERVE_V4`: BiggiReserveV4
- `LIQUIDITY_MANAGER`: BiggiLiquidityManager
- `PAIR_BIGGI_NATIVE`: DEX pair BIGGI/WNATIVE
- `KEEPER_SUPPLY`: keeper address for supply upkeep
- `KEEPER_DEX_GUARD`: keeper address for dex guard upkeep
- `KEEPER_LIQUIDITY`: keeper address for liquidity orchestrator

## Transaction order

1. `SUPPLY_CONTROLLER.setPair(PAIR_BIGGI_NATIVE)`
2. `SUPPLY_CONTROLLER.snapshotBaseline()`
3. `DEX_GUARD.setPair(PAIR_BIGGI_NATIVE)`
4. `DEX_GUARD.snapshotBaseline()`

5. `SUPPLY_CONTROLLER.setKeeper(KEEPER_SUPPLY, true)`
6. `SUPPLY_CONTROLLER.setAllowedCaller(DEX_GUARD, true)`
7. `DEX_GUARD.setKeeper(KEEPER_DEX_GUARD, true)`
8. `LIQUIDITY_ORCHESTRATOR.setKeeper(KEEPER_LIQUIDITY)`
9. `BUYBACK_AGENT.setKeeper(BUYBACK_UPKEEP_PROXY)`

10. If `BiggiLiquidityKeeperProxy` is used:
   - `LIQUIDITY_KEEPER_PROXY.setAllowedCaller(CHAINLINK_REGISTRY)`
11. If `LiquidityAutomation` is used:
   - do not keep `LIQUIDITY_KEEPER_PROXY` active at the same time

12. `RESERVE_V4.setNotifyCallerCheck(true)`
13. `RESERVE_V4.setNotifyCaller(LIQUIDITY_MANAGER, true)`

## Optional hardening

1. `SUPPLY_CONTROLLER.setCircuitBreakerConfig(true, 500e18, 500e18)`
2. `DEX_GUARD.setPriceCheckConfig(true, <maxDeviationBps>)`
3. `SUPPLY_CONTROLLER.setRewardsConfig(<threshold>, <refill>, <cooldown>)`
4. `SUPPLY_CONTROLLER.setDexConfig(<dropBps>, <refill>, <cooldown>, <floor>, <autoRefresh>)`

## Keepers to register (Guarded profile)

1. `SUPPLY_CONTROLLER.checkUpkeep/performUpkeep`
2. `BUYBACK_UPKEEP_PROXY.checkUpkeep/performUpkeep`
3. One liquidity path only:
   - `LIQUIDITY_KEEPER_PROXY.checkUpkeep/performUpkeep`, or
   - `LiquidityAutomation.checkUpkeep/performUpkeep`
4. `DEX_GUARD.checkUpkeep/performUpkeep`

