# BiggiSupplyGuardian Mainnet Dossier

## Source of truth

- Source file: `../../BiggiSupplyGuardian.sol`
- Frozen ABI: `./ABI.json`
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor

`constructor(address initialOwner, address controller_)`

## Runtime role

`BiggiSupplyGuardian` is a narrow owner-controlled helper for `BiggiSupplyController`.

It does not mint by itself. Its purpose is to manage privileged controller wiring through explicit pass-through calls:

- `setController(address)`
- `setKeeperOnController(address,bool)`
- `setAllowedCallerOnController(address,bool)`

## Owner/admin surface

- `setController(address)`
- `setKeeperOnController(address,bool)`
- `setAllowedCallerOnController(address,bool)`

## Integration map

- `BiggiSupplyController` is the only managed downstream contract
- `BiggiToken` may recognize the guardian as supply authority for bounded mint paths

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `SUPPLY_GUARDIAN` | `0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
