# BIGGI_MASTER Mainnet Contract Address Records

Last documentation sync: 2026-06-16.

## Canonical Polygon Mainnet Deployment

Status:

- CORE deployment is live on Polygon mainnet.
- TOKENOMICMAINNET phase 1 is live and verified.
- TOKENOMICMAINNET phase 2 is live and verified.
- QuickSwap V2 BIGGI/WPOL pair exists, but initial liquidity is not added yet. Current pair reserves are `0/0`.
- Automation-sensitive flows remain intentionally disabled/paused until initial liquidity and final go-live activation.

Canonical manifests:

- `biggi-project/bekend/addresses.master.json`
- `biggi-project/bekend/addresses.visibility.polygon.json`
- `biggi-project/bekend/addresses.tokenomics.phase1.polygon.json`
- `biggi-project/bekend/addresses.tokenomics.phase2.polygon.json`
- `biggi-project/bekend/addresses.json`
- `contracts/default_workspace (10)/contracts/BIGGI_MASTER/MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`

## Live Core

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

## Live Tokenomics Write Contracts

| Key | Address |
| --- | --- |
| `BIGGI_TOKEN` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `RESERVE` | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| `TREASURY` | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| `DRIP_DISTRIBUTOR` | `0x2E4677729cb8a02aDd752Bcbd2637809C20CBAf3` |
| `TOKEN_REWARDS` | `0xA455775BBe0BC863f644516147b95Ef5103b29FA` |
| `TOKEN_REWARDS_EMISSION_CONTROLLER` | `0xA7B71DFEBF89481b37d803dD0765E3612f29Ffb9` |
| `MASTER_CONFIG` | `0x4125DA806c7B0AaD6c443b7BD368e45ed123687C` |
| `POLICY` | `0x50485231A0602DE7a7b64e2760EF21133c77a43C` |
| `COMMUNITY_CENTER` | `0x81C6E90a991d7D210c43B00B7EB1a5450cc372Ae` |
| `BUYBACK_AGENT` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| `MODERATOR_CENTER` | `0xda07a5fDee4d6d491cF31368F00e2aD584bB033D` |
| `SUPPLY_CONTROLLER` | `0x810ba27C98aAB09737e3988a3C1b10D6CadaB8E8` |
| `SUPPLY_GUARDIAN` | `0xdCA0bEda4c96eCE2E23e30f6Aa95697106d99B49` |
| `DEX_RESERVE_GUARD` | `0x350370c248495758b80Ea1C564Df1290cA76588B` |
| `LIQUIDITY_VAULT` | `0xFe234394845B601B2c671c0dD631fA6290c02bb9` |
| `LIQUIDITY_MANAGER` | `0xfb770C5A5AC6e41C85f076DB7C3434eAcd8e0F19` |
| `LIQUIDITY_ORCHESTRATOR` | `0xC72DB11941d8Ab76baF84B1af9dB43E09060b681` |
| `LIQUIDITY_KEEPER_PROXY` | `0x4fC6EaD8CC6451e1A5EA7Ceaf6a072e18f91F04c` |
| `DRIP_LM` | `0xE258843bca54803a366413571b3B4d6a28eAF2eC` |
| `DRIP_KEEPER_PROXY` | `0xf71b3B9E64bf48E1EC8F9195c3420464fe767cCc` |
| `BUYBACK_UPKEEP_PROXY` | `0x3C260f987d1aD7cA3dC8D61a3B731b2068c38875` |

## Live Tokenomics Readers / Helpers

| Key | Address |
| --- | --- |
| `RESERVE_TREASURY_READER` | `0xb379bB928f3B683528C209C28A95F4D2854EC407` |
| `BUYBACK_READER` | `0x8eD6c94e5Fb336096E6C28480f3C514c9bddFa89` |
| `LIQUIDITY_BRANCH_READER` | `0xC04FC52560fe5A8fcEf16a3ADE7126e83Da0D4f5` |
| `LIQUIDITY_HELPER_READER` | `0x1879b76c3a923d58970a90e3D004bD067c272a22` |
| `SUPPLY_CONTROLLER_READER` | `0x3deE7089badc481BA91edF0023Bd0E6039BA1E3F` |
| `SUPPLY_GUARDIAN_READER` | `0x970432CEB6279eA3585372457FF610F03A5f07Ca` |
| `DEX_RESERVE_GUARD_READER` | `0xE70C056f0dD1Fb8c175E6CDf92F0767611fDd672` |
| `SYSTEM_READER` | `0x5C918B2E610BAF3E9f77B0b7dE456D63B7F8bD55` |
| `TOKENOMICS_SYSTEM_ADDON_READER` | `0x28D73361F9E7778362cac9fEBe1c8E0a2B1121ea` |
| `BIGGI_TOKENOMICS_READER` | `0x868640D9fd873AE3ecFCAbCbB458413A70D6f468` |
| `TOKEN_REWARDS_READER` | `0xB558137Ce8a2e065de09f7ef7cF24911E49A9972` |
| `MULTICALL` | `0x70bc315E4E5548e54F358Abf4515C1bB1551687b` |

## Live DEX Values

| Key | Address |
| --- | --- |
| `ROUTER` | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |
| `BUYBACK_ROUTER` | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |
| `FACTORY` | `0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32` |
| `WETH/WPOL/QUOTE_TOKEN` | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| `PAIR` | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |

## Current Safety State

| Check | Current value |
| --- | --- |
| Pair reserves | `0/0` until initial liquidity |
| `BiggiToken.totalSupply` | `0` until `initialDistribute()` |
| `BiggiToken.distributed` | `false` |
| `TicketHub.saleCap` | `0` until public launch activation |
| `TicketHub.ticketPrice` | `1 POL` |
| `BiggiLiquidityManager.autoTopUpEnabled` | `false` |
| `BiggiLiquidityKeeperProxy.paused` | `true` |
| `BiggiLiquidityOrchestrator.paused` | `true` |
| `BiggiBuybackAgent.autoBuybackEnabled` | `false` |
| `BiggiBuybackUpkeepProxy.paused` | `true` |
| `DripKeeperProxy.paused` | `true` |

Historical/local addresses were removed from this file to avoid accidental use. Use git history only if old reconciliation data is needed.
