# CORE Mainnet Real Data

Last documentation sync: 2026-06-16.

## Deployment Status

The BIGGI core stack is deployed on Polygon mainnet. These addresses are canonical for the current production deployment and are mirrored in `addresses.master.json`, `addresses.visibility.polygon.json`, and frontend-facing `addresses.json`.

Public mint is not open yet. Launch blockers are operational configuration items, not missing deployments:

- `BIGGI_TOKEN.initialDistribute()` is not executed yet.
- QuickSwap V2 BIGGI/WPOL pair exists, but initial liquidity is still `0/0`.
- `TicketHub.distributor` and final `saleCap` still need launch-time activation.
- metadata and public mint opening are intentionally final go-live steps.

## Live Core Addresses

| Key | Address |
| --- | --- |
| `BIGGI_NAMES_LIB` | `0xFEfB6Cd04879715bb63E8a51811e68EC85D9dB78` |
| `BIGGI_NAMES_LIB2` | `0xBd3C8f5A8A936071585e909d9ab5c1Df3D7EB78a` |
| `REGISTRY` | `0x5CFe3ed77386e71cd89EA3f5d0a8906F78785013` |
| `CHAPTER_CONTROLLER` | `0x6bf341647C9592eFEadE43a3f396DB616B11f7E7` |
| `COMPUTE` | `0x0A09261631496B4aad9A5c2A82b62666249d773f` |
| `VRF_ROUTER` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| `MAIN` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `MAIN2` | `0xF82Eb16aFFEae270F808E4bFF1C43f1BB04E4634` |
| `TICKET_HUB` | `0xe6d742D7DC66fA63434E6794C69798A5272e9873` |
| `DISTRIBUTOR` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `COLLECTION_REWARDS` | `0x5d1273070c9133381C570009768621762F024FB8` |
| `NFT_REWARDS` | `0x939Df533b80943298E15ad4c8F188102954f34FF` |
| `MAIN_READER` | `0x5B5b422D0Db094550B626749EE4F982A301F8471` |
| `MULTI_COLLECTION_READER` | `0xa65B4e88E37F085B9009295eA0AcF05e18a82884` |
| `CHAPTER_SERIES_READER` | `0x79f39f2344B51e292cfa346c264E549098728900` |
| `NFT_REWARDS_READER` | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` |

## External / Operational Values

| Key | Value |
| --- | --- |
| `network` | `polygon` |
| `chainId` | `137` |
| `historical deployer` | `0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B` |
| `current owner / dev wallet` | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` |
| `VRF_COORDINATOR` | `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77` |
| `VRF_KEY_HASH` | `0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86` |
| `VRF_SUB_ID` | `81201946401186585545741412524989119977867721966007705722641563343499481545614` |
| `TICKET_PRICE_WEI` | `1000000000000000000` |
| `SALE_CAP` | `0` |
| `MARKETING_CAP` | `550` |

## Canonical Manifest Files

- `biggi-project/bekend/addresses.master.json`
- `biggi-project/bekend/addresses.visibility.polygon.json`
- `biggi-project/bekend/addresses.tokenomics.phase1.polygon.json`
- `biggi-project/bekend/addresses.tokenomics.phase2.polygon.json`
- `biggi-project/bekend/addresses.json`
- `BIGGI_MASTER/MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`

## Launch Gate

Use the current read-only launch check before public mint:

```bash
npm run preflight:launch:polygon
LAUNCH_PREFLIGHT_STRICT=1 npm run preflight:launch:polygon
```

Strict mode is expected to fail until initial distribution, initial liquidity, TicketHub distributor/sale cap, and metadata readiness are complete.
