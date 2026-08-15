# BiggiMain2 - Mainnet Prep Dossier

## Source of truth
- Source file: `BiggiMain2.sol`
- Frozen ABI: `./ABI.json`
- External linked library: `CORE_LIBRARY/BiggiNamesLib2.sol`
- Deployment status: live on Polygon mainnet as of 2026-06-16.
- Canonical manifest: `biggi-project/bekend/addresses.master.json` plus phase-specific Polygon manifests.

## Constructor
```solidity
constructor(address initialOwner)
```

## Main role
- public chapter collection with explicit index minting
- reads public-mint unlock state from `BiggiChapterController`
- can read pricing from a chapter VRF-side price provider
- supports native and BIGGI payment routing
- supports treasury deposit mode for BIGGI paid public mints

## Owner/admin surface
```solidity
setDistributor(address dist)
setDevWallet(address wallet_)
setPriceProvider(address provider_)
clearPriceProvider()
setChapterController(address controller_, uint256 chapterId_)
clearChapterController()
setBiggiToken(address token)
setBiggiRate(uint256 _biggiPerEth)
setTokenSink(address sink, uint256 bps)
setTokenSinkDepositMode(bool enabled)
setReserveAddress(address _reserve)
setBlockCurrentPrice(uint16 blockIdx, uint256 newPrice)
setURI(uint8 category, uint16 idx, string calldata uri)
setContractURI(string calldata newUri)
batchSetNFTBackgroundAndBlock(...)
metadataConfiguredCount()
isMetadataFullyConfigured()
isRewardMatrixConsistent()
metadataConsistency()
assertMetadataConsistency()
pause()
unpause()
```

## Metadata rules
- `setURI(1, 0, charactersBaseURI)` sets public character metadata base.
- `setURI(2, blockIdx, blockBaseURI)` sets block metadata bases for block indexes `1..10`.
- `metadataConsistency()` must report `configuredCount=550`, `fullyConfigured=true`, and `rewardMatrixConsistent=true` before public mint is opened.
- `assertMetadataConsistency()` is the strict preflight check used by launch tooling.

## Runtime invariant
If a chapter controller is set, `getChapterCollections(chapterId)` must resolve this contract as the public collection.
Mainnet-prep BIGGI payment routing uses `tokenSink = BiggiTreasury`, `tokenSinkBps = 10000`, `tokenSinkDepositMode = true`.
Treasury deposit mode requires `BiggiTreasury.setEcosystemBiggiCaller(BiggiMain2, true)`.
If deposit mode is disabled, `tokenSink` receives a plain BIGGI transfer and does not split through treasury.
`setBiggiRate(...)` rejects zero and BIGGI minting rejects a zero computed token payment.

## Canonical Polygon Mainnet Address

| Key | Address |
| --- | --- |
| `MAIN2` | `0xF82Eb16aFFEae270F808E4bFF1C43f1BB04E4634` |

Canonical manifests: `addresses.master.json`, phase-specific Polygon manifests, and `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`.
