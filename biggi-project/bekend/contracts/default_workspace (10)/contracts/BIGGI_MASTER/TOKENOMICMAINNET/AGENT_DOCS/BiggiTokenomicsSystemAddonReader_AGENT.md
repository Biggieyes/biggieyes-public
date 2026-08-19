# BiggiTokenomicsSystemAddonReader
Addon snapshot for master config addresses and guardian/controller status. Keep in sync with BiggiMasterTokenomicsConfig fields.

## Current output
`getStatus()` returns:

- master config and token addresses
- core bundle: BIGGI, reserve, treasury, distributor
- rewards bundle: collection rewards, token rewards, NFT rewards, community center
- pump bundle: buyback agent, drip LM, drip distributor, policy
- liquidity bundle: liquidity manager, vault, router, factory, WETH
- collections bundle: main collection, public collection, rewards reader/token rewards reference, distributor
- supply controller, supply guardian, DEX reserve guard state
- compact DEX guard readiness: paused flag, baseline reserve, current token reserve, price-check flag, quote oracle, oracle configured/stale/valid flags

This reader is the preferred frontend source for canonical tokenomics address bundles after deployment.
