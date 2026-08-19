# Mainnet external values required

Tento dokument je jen seznam hodnot, ktere musis dodat zvenku pred mainnet deployem. Nejsou zde adresy kontraktu, ktere vzniknou deployem.

## 1. Sit a deploy

- `POLYGON_RPC_URL`
- `PRIVATE_KEY`
- deployer adresa s dostatkem POL na gas
- `DEPLOY_NETWORK=polygon`
- `OUTPUT_FILE`, napr. `./addresses.core.polygon.json`

Poznamka: `PRIVATE_KEY` nikdy neukladat do dokumentace ani commitu. Jen do lokalniho `.env` nebo bezpecneho secret manageru.

## 2. Owner a provozni adresy

- `DEV_WALLET`
- `EXPECT_OWNER`
- `TARGET_OWNER`

Aktualne zvolena mainnet owner/provozni wallet:

- `DEV_WALLET=0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`
- `EXPECT_OWNER=0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`
- `TARGET_OWNER=0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`
- historicky deployer nasazenych kontraktu zustava `0x8fa5C9545B2eEF1ca3c6533951C286e05928f27B`; nesmi se prepisovat v deployment manifestech.
- podpisovy klic pouzity pro owner-only operace musi odpovidat nove owner wallet. Privatni klic se nesmi zapisovat do repozitare.

Vyklad:

- `DEV_WALLET` prijima dev cast mint revenue.
- `EXPECT_OWNER` je finalni Safe/multisig/timelock owner pro kontrolu po deployi.
- `TARGET_OWNER` se pouzije pro ownership transfer batch, pokud se owner prevadi po deployi.

## 3. Chainlink VRF

Bud pouzij existujici router:

- `VRF_ROUTER`

Nebo nasad novy router pres Chainlink VRF hodnoty:

- `VRF_COORDINATOR`
- `VRF_KEY_HASH`
- `VRF_SUB_ID`

Aktualni Polygon mainnet VRF v2.5 hodnoty pro pripravovany core deploy:

- `VRF_COORDINATOR=0xec0Ed46f36576541C75739E915ADbCb3DE24bD77`
- `VRF_SUB_ID=81201946401186585545741412524989119977867721966007705722641563343499481545614`
- doporucena gas lane pro launch: 500 gwei
- `VRF_KEY_HASH=0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86`

Polygon VRF v2.5 alternativy:

- 200 gwei: `0x0ffbbd0c1c18c0263dd778dadd1d64240d7bc338d95fec1cf0473928ca7eaf9e`
- 500 gwei: `0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86`
- 1000 gwei: `0x192234a5cda4cc07c0b66dfbcfbb785341cc790edc50032e842667dbb506cada`

Volitelne VRF parametry:

- `VRF_CALLBACK_GAS_LIMIT`
- `VRF_REQUEST_CONFIRMATIONS`
- `VRF_NUM_WORDS`

Mimo env musi byt hotove:

- VRF subscription funded
- `BiggiVRFRouter` pridany jako consumer v Chainlink subscription
- kontrola `BiggiVRFRouter.approvedMains(MAIN) == true`

## 4. Metadata a URI

Aktualni core deploy profil:

- `DEPLOY_PUBLIC_BRANCH=1`
- `DEPLOY_COLLECTION_REWARDS=1`
- `DEPLOY_NFT_REWARDS=1`
- `DEPLOY_CORE_READERS=1`
- `DEPLOY_MAIN_READER=1`
- `DEPLOY_CHAPTER_SERIES_READER=1`
- `DEPLOY_MULTI_COLLECTION_READER=0` zatim bez tokenomickeho distributoru
- `DEPLOY_NFT_REWARDS_READER=1`

`BiggiNFTRewards` je soucast core vrstvy. V prvni core fazi se nasadi a napoji na `BiggiVRFRouter`, `BiggiMain`, `BiggiMain2` a `BiggiSeriesRegistry`; tokenomika k nemu neni potreba.

CORE Main:

- `MAIN_METADATA_FILE`
- `TICKET_BASE_URI`
- `MAIN_REWARDS_BASE_URI`
- `MAIN_CHARACTERS_BASE_URI`
- `MAIN_BLOCK_URI_1`
- `MAIN_BLOCK_URI_2`
- `MAIN_BLOCK_URI_3`
- `MAIN_BLOCK_URI_4`
- `MAIN_BLOCK_URI_5`
- `MAIN_BLOCK_URI_6`
- `MAIN_BLOCK_URI_7`
- `MAIN_BLOCK_URI_8`
- `MAIN_BLOCK_URI_9`
- `MAIN_BLOCK_URI_10`

Public branch, pokud se nasazuje `Main2`:

- `PUBLIC_METADATA_FILE`
- `PUBLIC_REWARDS_BASE_URI`
- `PUBLIC_CHARACTERS_BASE_URI`
- `PUBLIC_BLOCK_URI_1`
- `PUBLIC_BLOCK_URI_2`
- `PUBLIC_BLOCK_URI_3`
- `PUBLIC_BLOCK_URI_4`
- `PUBLIC_BLOCK_URI_5`
- `PUBLIC_BLOCK_URI_6`
- `PUBLIC_BLOCK_URI_7`
- `PUBLIC_BLOCK_URI_8`
- `PUBLIC_BLOCK_URI_9`
- `PUBLIC_BLOCK_URI_10`

## 5. CORE mint hodnoty

- `SALE_CAP`
- `MARKETING_CAP`
- `MARKETING_TICKET_PRICE` (`1` POL; `TICKET_PRICE` zustava legacy fallback)
- `PUBLIC_TICKET_PRICE` (`500` POL)
- `PUBLIC_TICKET_PRICE_WEI` (`500000000000000000000`)
- `PRICE_INCREASE_PER_MINT_BPS`
- `PENDING_RETRY_DELAY_SEC`
- `SERIES_NAME`

Pravidlo:

- `SALE_CAP + MARKETING_CAP = 550`

## 6. DEX / Uniswap V2-compatible hodnoty

Tyto hodnoty jsou potreba az pro liquidity/tokenomics aktivaci.

- `ROUTER`
- `FACTORY`
- `WETH`
- `PAIR`
- `QUOTE_TOKEN`
- `BUYBACK_ROUTER`

Vyklad:

- `ROUTER` je UniswapV2-compatible router.
- `FACTORY` je UniswapV2-compatible factory.
- `WETH` je wrapped native token na cilove siti, na Polygonu typicky WMATIC.
- `PAIR` je LP pair, napr. BIGGI/WMATIC nebo BIGGI/USDC.
- `QUOTE_TOKEN` je druha strana pairu.
- `BUYBACK_ROUTER` muze byt stejny jako `ROUTER`, pokud nechces oddeleny buyback router.

## 7. Oracle

Pouze pokud bude zapnuta DEX price kontrola:

- `DEX_GUARD_QUOTE_ORACLE`

Pouziva se kdyz:

- `DEX_GUARD_PRICE_CHECK_ENABLED=1`

## 8. CRE / keeper orchestration adresy

Keeper kontrakty zustavaji jako execution targets, ale orchestrace se presouva na Chainlink CRE.

Povinne pro CRE:

- `CRE_CHAIN_NAME` - na Polygonu `polygon-mainnet`
- `CRE_KEYSTONE_FORWARDER` - na Polygon mainnet aktualne `0x76c9cf548b4179F8901cda1f8623568b58215E62`
- `CRE_AUTOMATION_RECEIVER` - adresa noveho `BiggiCREAutomationReceiver`
- `CRE_WORKFLOW_ID` - doplnit po deployi workflow v CRE
- `CRE_WORKFLOW_NAME` - doplnit po finalnim pojmenovani workflow

Execution targets podle aktivovaneho profilu:

- `SUPPLY_KEEPER`
- `DEX_GUARD_KEEPER`
- `LIQUIDITY_KEEPER_PROXY`
- `LIQUIDITY_AUTOMATION`
- `DRIP_KEEPER_PROXY`
- `BUYBACK_UPKEEP_PROXY`

Mimo env musi byt hotove:

- CRE account a Early Access pro deploy workflow
- CRE workflow deploy + aktivace
- `BiggiCREAutomationReceiver.setCallAllowed(target, performUpkeep(bytes), true)` pro kazdy target
- receiver nastaveny jako keeper/allowed caller tam, kde target kontroluje `msg.sender`
- stare Automation/Gelato upkeepy vypnute, aby se stejne vetve nespoustely dvakrat

## 9. Explorer / verification

- `POLYGONSCAN_API_KEY`

Pouziti:

- verifikace kontraktu na Polygonscanu
- jednodussi verejna kontrola bytecode/source

## 10. Rezimu deploye podle dostupnych hodnot

### CORE-first

Minimalne doplnit:

- `POLYGON_RPC_URL`
- `PRIVATE_KEY`
- `DEV_WALLET`
- `EXPECT_OWNER`
- `VRF_COORDINATOR` / `VRF_KEY_HASH` / `VRF_SUB_ID` nebo `VRF_ROUTER`
- metadata a URI hodnoty
- `SALE_CAP`
- `MARKETING_CAP`
- `MARKETING_TICKET_PRICE`
- `PUBLIC_TICKET_PRICE`
- `PUBLIC_TICKET_PRICE_WEI`

### Tokenomics base bez liquidity

Doplnit navic:

- owner/provozni adresy
- pripadne `MARKETING_SUPPORT`

Nastaveni rezimu:

- `LIQUIDITY_PATH=none`
- `EXPECT_LIQUIDITY_PATH=none`
- `DEPLOY_LIQUIDITY_BRANCH=0`
- `DEPLOY_DRIP_LM=0`
- `POLICY_BUYBACKS_PAUSED=true`

### Full tokenomics with liquidity

Doplnit navic:

- `ROUTER`
- `FACTORY`
- `WETH`
- `PAIR`
- `QUOTE_TOKEN`
- `BUYBACK_ROUTER`
- keeper/automation adresy
- volitelne oracle adresu

## 11. Pred GO kontrola

CORE:

```bash
node scripts/master/runCheckCoreRelationships.js --network polygon --addresses ./addresses.core.polygon.json --require-code --strict
```

Full paid native mint:

```bash
node scripts/master/runCheckCoreRelationships.js --network polygon --addresses ./addresses.core.polygon.json --require-code --strict --expect-paid-native
```

Full master/tokenomics:

```bash
npm run validate:master:polygon:strict
npm run test:master
```
