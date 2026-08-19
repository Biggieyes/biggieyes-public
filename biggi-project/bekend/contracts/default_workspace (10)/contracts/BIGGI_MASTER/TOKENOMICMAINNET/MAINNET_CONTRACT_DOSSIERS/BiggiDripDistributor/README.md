# BiggiDripDistributor Mainnet Dossier

## Source of truth

- Source file: `../../BiggiDripDistributor.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address token_, address initialOwner)`

## Runtime role

`BiggiDripDistributor` is the BIGGI drip branch tied to collection mint activity and a downstream drip LM claimant.

It tracks:

- allowed collection contracts for `notifyMint(uint256)`
- BIGGI balances deposited by treasury through `depositTokens(uint256)`
- configured drip emission size through `tokensPerMint`

Main claim path:

- collections report mint activity
- treasury deposits BIGGI inventory
- `dripLM` claims BIGGI via `claim(uint256)` or `claimTo(address,uint256)`

## Owner/admin surface

- `setCollection(address,bool)`
- `setDripLM(address)`
- `setTreasury(address)`
- `setTokensPerMintOperator(address)`
- `setTokensPerMint(uint256)`
- `pause()`
- `unpause()`

Operator surface:

- `setTokensPerMintFromOperator(uint256)`

## Integration map

- `BiggiToken` calls `notifyTokenMint(uint256)` on drip-side mint paths
- `BiggiTreasury` feeds BIGGI inventory through `depositTokens(uint256)`
- allowed collection contracts feed mint counts
- `dripLM` is the only intended runtime claimer

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `DRIP_DISTRIBUTOR` | `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
