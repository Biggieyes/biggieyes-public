# LiquidityVault Mainnet Dossier

## Source of truth

- Source file: `../../BiggiLiquidityVault.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.
- Solidity contract name: `LiquidityVault`
- Dossier folder alias: `BiggiLiquidityVault`

## Constructor

`constructor(address initialOwner)`

## Runtime role

`LiquidityVault` is the LP custody branch for the tokenomic liquidity system.

It is designed to hold LP tokens produced by `BiggiLiquidityManager`, maintain synchronized accounting per pair, and restrict LP deposit or withdrawal flow to the configured liquidity manager.

Primary runtime path: the router mints LP directly to the vault through `BiggiLiquidityManager._addLiquidityAndFinalize(...)`; the manager then calls `syncPairBalance(pair)` so the vault's internal LP accounting matches the real ERC20 LP balance.

## Owner/admin surface

- `setLiquidityManager(address)`
- `addWhitelistedPair(address)`
- `removeWhitelistedPair(address)`
- `rescueERC20(address,address,uint256)`
- `rescueNative(address,uint256)`

## Main write paths

- `depositLP(address,uint256)`
- `withdrawToLM(address,uint256)`
- `syncPairBalance(address)`

## Integration map

- `BiggiLiquidityManager` is the intended runtime depositor
- downstream readers consume LP accounting from this vault

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `LIQUIDITY_VAULT` | `0xFe234394845B601B2c671c0dD631fA6290c02bb9` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
