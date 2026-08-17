# BiggiChapterController - Mainnet Dossier

## Source of truth
- Source file: `BiggiChapterController.sol`
- Frozen ABI: `./ABI.json`
- Deployment status: current five-chapter controller live and verified on Polygon mainnet as of 2026-08-17.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner, address registry_)
```

## Main role
- stores per-chapter cap configuration
- verifies registry, VRF collection, and ticket hub bindings
- exposes `isPublicMintUnlocked(chapterId)` for `BiggiMain2`
- exposes chapter price-provider routing

## Owner surface
```solidity
configureChapter(...)
```

## Runtime invariants
- registry chapter metadata must match the configured chapter stack
- VRF collection and `BiggiTicketHub` must point to each other
- ticket hub caps must match controller caps
- public mint unlock requires exact sale, marketing, and total exhaustion

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `CHAPTER_CONTROLLER` | `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
