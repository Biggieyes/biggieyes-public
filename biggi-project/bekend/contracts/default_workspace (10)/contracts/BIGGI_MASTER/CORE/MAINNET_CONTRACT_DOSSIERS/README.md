# Core Mainnet Contract Dossiers

Current deployment status: CORE is live on Polygon mainnet as of 2026-06-16.

This package contains per-contract dossiers for BIGGI core contracts and core readers under `../`. The Solidity source and ABI files remain the source of truth for interfaces; the address table below is generated from the current Polygon manifests.

## Included Dossiers

- [BiggiMain](./BiggiMain/README.md)
- [BiggiMain2](./BiggiMain2/README.md)
- [BiggiTicketHub](./BiggiTicketHub/README.md)
- [BiggiSeriesRegistry](./BiggiSeriesRegistry/README.md)
- [BiggiChapterController](./BiggiChapterController/README.md)
- [BiggiCollectionRewards](./BiggiCollectionRewards/README.md)
- [BiggiTokenRewards](./BiggiTokenRewards/README.md)
- [BiggiVrfRouter](./BiggiVrfRouter/README.md)
- [BiggiMultiCollectionDistributor](./BiggiMultiCollectionDistributor/README.md)
- [BiggiMainReader](./BiggiMainReader/README.md)

## Canonical Polygon Addresses

| Dossier | Canonical address |
| --- | --- |
| [BiggiMain](./BiggiMain/README.md) | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| [BiggiMain2](./BiggiMain2/README.md) | `0xF82Eb16aFFEae270F808E4bFF1C43f1BB04E4634` |
| [BiggiTicketHub](./BiggiTicketHub/README.md) | `0xe6d742D7DC66fA63434E6794C69798A5272e9873` |
| [BiggiSeriesRegistry](./BiggiSeriesRegistry/README.md) | `0x5CFe3ed77386e71cd89EA3f5d0a8906F78785013` |
| [BiggiChapterController](./BiggiChapterController/README.md) | `0x6bf341647C9592eFEadE43a3f396DB616B11f7E7` |
| [BiggiCollectionRewards](./BiggiCollectionRewards/README.md) | `0x5d1273070c9133381C570009768621762F024FB8` |
| [BiggiTokenRewards](./BiggiTokenRewards/README.md) | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| [BiggiVrfRouter](./BiggiVrfRouter/README.md) | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| [BiggiMultiCollectionDistributor](./BiggiMultiCollectionDistributor/README.md) | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| [BiggiMainReader](./BiggiMainReader/README.md) | `0x5B5b422D0Db094550B626749EE4F982A301F8471` |

## Canonical Manifest Policy

Do not use old local or staging addresses from historical docs. Current production addresses come from:

- `addresses.master.json`
- `addresses.visibility.polygon.json`
- `addresses.json`
- `MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`

Launch readiness is still gated by operational state: token initial distribution, initial liquidity, TicketHub sale activation, VRF consumer funding, and metadata readiness.
