# CORE Mainnet Real Data

Last documentation sync: 2026-08-18.

## Deployment Status

The BIGGI core stack is deployed on Polygon mainnet. These addresses are canonical for the current production deployment and are mirrored in `addresses.master.json`, `addresses.visibility.polygon.json`, and frontend-facing `addresses.json`.

Public mint is not open yet. Launch blockers are operational configuration items, not missing deployments:

- QuickSwap V2 BIGGI/WPOL pair exists, but initial liquidity is still `0/0`.
- `BIGGI_TOKEN.initialDistribute()` is complete and total supply is `1.2B BIGGI`.
- TicketHub wiring and caps are complete (`500/50`); all chapters remain inactive.
- Chapter 1 Public metadata are launch-ready. Chapter 2-5 Public image URIs, CRE identity/wiring, liquidity automation, and chapter activation remain final go-live steps.

## Live Core Addresses

| Key | Address |
| --- | --- |
| `BIGGI_NAMES_LIB` | `0xFEfB6Cd04879715bb63E8a51811e68EC85D9dB78` |
| `BIGGI_NAMES_LIB2` | `0xBd3C8f5A8A936071585e909d9ab5c1Df3D7EB78a` |
| `REGISTRY` | `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` |
| `CHAPTER_CONTROLLER` | `0x9c084D89c0CB6c8424652d1fa82E83aD9c098288` |
| `COMPUTE` | `0x0A09261631496B4aad9A5c2A82b62666249d773f` |
| `VRF_ROUTER` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| `MAIN` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `MAIN2` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` |
| `TICKET_HUB` | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| `DISTRIBUTOR` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `COLLECTION_REWARDS` | `0x5d1273070c9133381C570009768621762F024FB8` |
| `NFT_REWARDS` | `0x939Df533b80943298E15ad4c8F188102954f34FF` |
| `MAIN_READER` | `0x4937CdcF1668255Cb46c78E19547ea96C94391Ef` |
| `MULTI_COLLECTION_READER` | `0xa65B4e88E37F085B9009295eA0AcF05e18a82884` |
| `CHAPTER_SERIES_READER` | `0x421c8ed70fC893517481315aC62f4c95331e647f` |
| `NFT_REWARDS_READER` | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` |

## Registered Chapters

| Chapter | VRF collection | Public collection | Marketing tickets | Status |
| --- | --- | --- | ---: | --- |
| 1 - Original BIGGI | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` | `0xe56cC0657A89daf10994204eD745985a61b0E36F` | 50 | inactive |
| 2 - Universe | `0x5Bec5aeE4Ff8b1B5e7CBddcEEC61555354002036` | `0x7EaB23497085cfF00Cb2E9809b2Af0e717187356` | 50 | inactive |
| 3 - Mutant | `0x72e6DE66f340E0243DAF45917E7Ce8057Faeedc2` | `0xda6A6f45053796d0f5edB965fe3FA47B9a35460c` | 50 | inactive |
| 4 - Apocalipse | `0x8E862D9071120D69517D3F7Db0c101175E911115` | `0xecE7D61AB3FB2229C39B48380D704183532fE960` | 50 | inactive |
| 5 - Super Hero | `0xCA09F0b1f06AD3aA2302ED40Cb12013B84b52B38` | `0x99f049279BC545469F989d8f06CD915ef4B6f1d4` | 50 | inactive |

All VRF chapters share Chapter 1's 550-position block-color, tier, rarity, and game-logic matrix. Each Public collection has 100 unique NFTs, ten per block, no background clones, and reads block prices from its paired VRF collection through the ChapterController.

TokenRewards applies to both the VRF and Public collection in every registered chapter. CollectionRewards applies only to the VRF collection; Public collections are intentionally excluded from CollectionRewards.

The latest production verification passed `219/219` on-chain checks and `14/14` PolygonScan source verifications. Chapter 1 Public metadata are `100/100` and fully configured; chapters 2-5 are `100/100` structurally valid but intentionally lack final image URIs. Redemption remains locked until explicit chapter activation.

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
| current `TicketHub.ticketPrice()` | `500000000000000000000` (500 POL public start; configured) |
| `MARKETING_TICKET_PRICE_WEI` | `1000000000000000000` (1 POL snapshot) |
| `PUBLIC_TICKET_PRICE_WEI` | `500000000000000000000` (500 POL before first paid mint) |
| `PRICE_INCREASE_PER_MINT_BPS` | `10033` (+0.33% after each paid mint) |
| `SALE_CAP` | `500` |
| `MARKETING_CAP` | `50` |

Marketing minting stores the 1 POL snapshot and does not advance the public curve. Before a chapter is exposed in the application, the global TicketHub price must be switched to 500 POL. For Chapter 1, token IDs 1-50 are marketing tickets and token ID 51 is the first possible paid ticket; the paid allocation is 500 tickets.

The public price transition was confirmed in Polygon block `92226673`, transaction `0x1fb1165f4a67416c25f3d0c4c7ae7600e35466fc2b3ba8913d60554a5d1db63b`.

Live read-only preflight on 2026-08-18 returned `okForDeployOnly=true`, `okForPublicLaunch=false`, 7 blockers and 0 warnings. The remaining blockers are empty initial DEX liquidity, the intentionally paused Chapter 1 Public collection, paused/unlocked CRE receiver identity, and the paused liquidity orchestrator/keeper proxy. Chapter 1 Public metadata are complete; missing final image URIs for chapters 2-5 block only those future chapters.

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
