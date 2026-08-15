# BiggiDexReserveGuard Mainnet Dossier

## Source of truth

- Source file: `../../BiggiDexReserveGuard.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner, address pair_, address token_, address quoteToken_, address supplyController_)`

## Runtime role

`BiggiDexReserveGuard` is a reserve-ratio guard around the DEX pair and supply control branch.

It tracks:

- the target pair
- BIGGI token side
- quote token side
- reserve ratio threshold
- refill amount and cooldown
- optional quote-oracle price deviation checks with freshness validation

The contract is intended to detect when DEX-side reserve conditions fall below configured bounds and to coordinate a refill request path through the configured supply controller branch.

It does not mint directly into the DEX pair. In the current source, `BiggiDexReserveGuard` calls `BiggiSupplyController.refillDex(amount)`, and `BiggiSupplyController` mints the bounded DEX refill branch into `BiggiDripDistributor` through `BiggiToken.mintToDripDistributor(amount)`. Pair-side replenishment is therefore indirect through downstream drip/sell or liquidity flows.

Mainnet deploy path:

- normal production deploy should pass a real `PAIR` and real `QUOTE_TOKEN`
- constructor validates that the pair contains both `BIGGI` and `QUOTE_TOKEN`
- pending-pair deploy is supported only if `pair_ == address(0)`; this is an explicit fallback and is not the default production path
- `setPair(address)` also validates the final pair against `token` and `quoteToken`

## Owner/admin surface

- `setKeeper(address,bool)`
- `setPair(address)`
- `setQuoteToken(address)`
- `setQuoteOracle(address)`
- `setQuoteOracleConfig(uint256,bool)`
- `setReserveRatioBps(uint256)`
- `setRefillAmount(uint256)`
- `setCooldown(uint256)`
- `setAutoRefreshBaselineOnRefill(bool)`
- `setPriceCheckConfig(bool,uint256)`
- `refreshPriceAnchor()`
- `pause()`
- `unpause()`

## Integration map

- reads the configured DEX pair
- depends on a supply controller branch for refill execution
- optional oracle path supports both Chainlink-like `latestRoundData()` and legacy `latestAnswer()`
- `quoteOracleStatus()` exposes oracle compatibility, answer, freshness, and validity for readers/frontend
- when `requireQuoteOracleForPriceCheck=true`, price checks revert unless a valid configured oracle exists
- when an oracle is configured, DEX price must stay within `maxPriceDeviationBps` of the oracle answer
- if `lastGoodDexPriceE18` is set, DEX price must also stay within `maxPriceDeviationBps` of the local price anchor

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `DEX_RESERVE_GUARD` | `0x350370c248495758b80Ea1C564Df1290cA76588B` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
