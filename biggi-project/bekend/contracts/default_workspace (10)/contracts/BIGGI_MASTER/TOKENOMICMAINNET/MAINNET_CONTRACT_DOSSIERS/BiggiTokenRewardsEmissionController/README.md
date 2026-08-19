# BiggiTokenRewardsEmissionController - Mainnet Prep Dossier

Deployment status: live on Polygon mainnet as of 2026-06-16.

## Purpose

Optional dynamic emission controller for `BiggiTokenRewards`.

`BiggiTokenRewards` remains responsible for NFT ownership checks, collection eligibility, weekly claim tracking, and rarity units. This controller only converts those units into a bounded weekly BIGGI amount.

## Constructor

```solidity
constructor(address tokenRewards_, address treasury_, address biggi_, address owner_)
```

## Runtime Policy

- weekly budget is initialized lazily on first claim or manually through `rollCurrentWeek()` / `rollWeek(uint64)`
- observed inflow is based on `BiggiTreasury.totalBiggiReceived()` plus `totalEcosystemBiggiReceived()`
- budget tier is selected from min / weak / normal / strong / emergency settings
- optional `balanceBudgetBps` caps weekly budget as a percentage of current `TokenRewards` BIGGI balance
- weekly unit reward is `budget / targetWeeklyUnits`
- claim amount is `units * weeklyUnitReward`, capped at legacy `units * BiggiTokenRewards.unitReward`
- claims that exceed remaining weekly budget revert instead of partially paying

## Main Setters

```solidity
setTokenRewards(address tokenRewards_)
setTreasury(address treasury_)
setKeeper(address keeper, bool allowed)
setEmergencyMode(bool enabled)
setTargetWeeklyUnits(uint256 units)
setBudgetConfig(uint256 min, uint256 weak, uint256 normal, uint256 strong, uint256 emergency, uint256 max, uint256 balanceBps)
setInflowThresholds(uint256 weak, uint256 strong)
seedObservedTotals(uint256 totalBiggi, uint256 totalEcosystemBiggi)
```

## Required Wiring

1. Deploy after `BiggiTokenRewards`, `BiggiTreasury`, and `BiggiToken`.
2. Set controller targets to final `TOKEN_REWARDS` and `TREASURY`.
3. Configure weekly units and budget tiers from final launch economics.
4. Call `BiggiTokenRewards.setEmissionController(controller, true)`.
5. Confirm `previewWeek(currentWeek)` returns nonzero `budget` and `unitReward`.

## Mainnet Notes

Default deployment flow enables this controller unless `DEPLOY_TOKEN_REWARDS_EMISSION_CONTROLLER=0` or `TOKEN_REWARDS_EMISSION_ENABLED=0`.

The controller is not a token source. It does not mint, pull, or transfer BIGGI. Actual payout still happens inside `BiggiTokenRewards`.

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `TOKEN_REWARDS_EMISSION_CONTROLLER` | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
