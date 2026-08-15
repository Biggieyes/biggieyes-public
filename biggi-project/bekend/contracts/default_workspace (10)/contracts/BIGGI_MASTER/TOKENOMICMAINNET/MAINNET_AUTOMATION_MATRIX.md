# Mainnet CRE Automation Matrix

This file defines recommended keeper/upkeep topology for the BIGGI mainnet tokenomics branch after migrating orchestration from Chainlink Automation to Chainlink CRE.

CRE workflow execution path:

1. CRE workflow calls each target `checkUpkeep("0x")` through EVM read.
2. If the target returns `(true, performData)`, the workflow writes a signed report to `BiggiCREAutomationReceiver`.
3. `BiggiCREAutomationReceiver` verifies `msg.sender == KeystoneForwarder`, checks `(target, selector)` allowlist, and forwards `performUpkeep(performData)`.

Polygon CRE defaults:

- chain name: `polygon-mainnet`
- production `KeystoneForwarder`: `0x76c9cf548b4179F8901cda1f8623568b58215E62`
- receiver env/address key: `CRE_AUTOMATION_RECEIVER`

## Profiles

### Profile A: Lean (3 CRE tasks)
1. `BiggiSupplyController.checkUpkeep/performUpkeep`
2. `BiggiBuybackUpkeepProxy.checkUpkeep/performUpkeep`
3. One liquidity automation path only:
   - `BiggiLiquidityKeeperProxy`, or
   - `LiquidityAutomation`

### Profile B: Guarded (4 CRE tasks, recommended)
1. `BiggiSupplyController.checkUpkeep/performUpkeep`
2. `BiggiBuybackUpkeepProxy.checkUpkeep/performUpkeep`
3. One liquidity automation path only:
   - `BiggiLiquidityKeeperProxy`, or
   - `LiquidityAutomation`
4. `BiggiDexReserveGuard.checkUpkeep/performUpkeep`

### Profile C: Redundant (5 CRE tasks, optional)
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
2. Deploy and configure `BiggiCREAutomationReceiver`:
   - `BiggiCREAutomationReceiver.setKeystoneForwarder(CRE_KEYSTONE_FORWARDER)`
   - `BiggiCREAutomationReceiver.setCallAllowed(<target>, performUpkeep(bytes), true)`
3. Configure receiver as keeper/allowed caller where targets enforce `msg.sender`:
   - `BiggiSupplyController.setAllowedCaller(CRE_AUTOMATION_RECEIVER, true)`
   - `BiggiDexReserveGuard.setKeeper(CRE_AUTOMATION_RECEIVER, true)`
   - `BiggiLiquidityOrchestrator.setKeeper()`
   - `BiggiLiquidityKeeperProxy.setAllowedCaller(CRE_AUTOMATION_RECEIVER)` when using this path
   - `DripKeeperProxy.setKeeper(CRE_AUTOMATION_RECEIVER, true)` when using drip fallback
   - `BiggiBuybackAgent.setKeeper()`
4. Enable strict reserve notify mode and whitelist only expected senders:
   - `BiggiReserveV4.setNotifyCallerCheck(true)`
   - `BiggiReserveV4.setNotifyCaller(<trusted>, true)`
5. Validate all wiring before activation:
   - `BiggiMasterTokenomicsConfig` bundles
   - `BiggiSystemReader`, `BiggiSupplyControllerReader`, `BiggiBuybackReader`

## Commands

Deploy receiver only:

```bash
npm run deploy:master:cre-receiver:polygon
```

Deploy/attach and wire all known keeper targets:

```bash
npm run wire:master:cre-receiver:polygon
```

Detailed operational guide: `MAINNET_CRE_AUTOMATION_RUNBOOK_CS.md`.
