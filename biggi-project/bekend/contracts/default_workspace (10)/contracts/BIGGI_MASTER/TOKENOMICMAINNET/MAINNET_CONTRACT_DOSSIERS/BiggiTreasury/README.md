# BiggiTreasury Mainnet Dossier

## Source of truth

- Source file: `../../BiggiTreasury.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address biggiToken, address initialOwner)`

## Runtime role

`BiggiTreasury` is the BIGGI split and POL holding branch for tokenomics.

It receives:

- POL from the distributor through `depositPolFromDistributor()` or `receiveMintShare()`
- BIGGI from `BiggiBuybackAgent` through `buybackDepositAndSplit(uint256)`
- BIGGI from allowlisted ecosystem callers through `receiveEcosystemBiggi(uint256)`

When BIGGI arrives from the buyback path or the ecosystem BIGGI path, the contract splits it:

- `34%` to `tokenRewards`
- `33%` to `reserveAddr`
- `33%` to `dripDistributor`

If destination addresses are not set, tokens remain in treasury balance.

The ecosystem BIGGI path is intended for NFT purchases paid in BIGGI from `BiggiTicketHub` and `BiggiMain2`. Callers must be enabled through `setEcosystemBiggiCaller(address,bool)`. Plain ERC20 transfers to treasury do not trigger the split.

## Main write paths

- `depositPolFromDistributor()`
- `receiveMintShare()`
- `receiveBuybackFallback()`
- `buybackDepositAndSplit(uint256)`
- `ownerDepositAndSplit(uint256)`
- `receiveEcosystemBiggi(uint256)`
- `seedHistoricalTotals(uint256,uint256)`

## Owner/admin surface

- `setDistributor(address)`
- `setBuybackAgent(address)`
- `setTokenRewards(address)`
- `setReserve(address)`
- `setDripDistributor(address)`
- `setEcosystemBiggiCaller(address,bool)`
- `seedHistoricalTotals(uint256,uint256)`
- `rescueERC20(address,address,uint256)`
- `rescueETH(address,uint256)`

## Integration map

- `BiggiBuybackAgent` sends BIGGI and may forward fallback POL
- `BiggiTicketHub` and `BiggiMain2` may send NFT-payment BIGGI through `receiveEcosystemBiggi`
- `BiggiReserveV4` receives reserve branch BIGGI and is notified via `notifyBiggiReceived`
- `BiggiDripDistributor` receives drip branch BIGGI through `depositTokens`
- `BiggiTokenRewards` receives rewards branch BIGGI directly

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `TREASURY` | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
