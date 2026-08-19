# BiggiDexReserveGuard
Decision layer for DEX reserve depletion protection. Reads pair reserves and triggers the bounded refill path through SupplyController. It does not mint directly into the DEX pair; current SupplyController code mints the DEX refill branch into BiggiDripDistributor via BiggiToken.mintToDripDistributor(). Any pair-side replenishment is therefore indirect through downstream drip/sell or liquidity flows. Do not add direct mint authority here.

Mainnet hardening notes:

- constructor/setPair validates that the pair contains BIGGI token and quote token
- `quoteOracleStatus()` supports Chainlink-like `latestRoundData()` and legacy `latestAnswer()`
- `setQuoteOracleConfig(maxStalenessSec, requireOracle)` controls stale oracle rejection and required-oracle mode
- `refreshPriceAnchor()` stores the local DEX price anchor after real liquidity exists
- if `priceCheckEnabled` is true and a quote oracle is configured, DEX price must stay within `maxPriceDeviationBps` of the oracle answer
- if `lastGoodDexPriceE18` is set, DEX price must also stay within `maxPriceDeviationBps` of that anchor

Verify pair/token alignment, nonzero baseline, price anchor/oracle readiness, cooldowns, and keeper wiring before edits.
