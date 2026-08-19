# MAINNET_DEPLOY_REQUIREMENTS_CS

Tento dokument rika, co musi byt doplneno pred realnym `BIGGI_MASTER` deployem na Polygon.

## 1. Povinne env promene pro realny deploy

Bez techto hodnot deploy nema jit:

1. `PRIVATE_KEY`
2. `POLYGON_RPC_URL`
3. `PAIR`
4. `QUOTE_TOKEN`

Poznamka:

1. `PRIVATE_KEY` musi byt `0x` + 64 hex znaku
2. `PAIR` a `QUOTE_TOKEN` musi byt non-zero produkcni adresy
3. `PAIR` musi byt realny V2-compatible pair obsahujici `BIGGI_TOKEN` a `QUOTE_TOKEN`
4. pro planovany full tokenomics deploy musi mit `PAIR` pocatecni likviditu pred spustenim deploye

## 2. Povinne env promene pri aktivnim VRF deployi

Pokud chcete, aby deploy script rovnou nasadil a napojil `BiggiVRFRouter`, musite doplnit:

1. `VRF_COORDINATOR`
2. `VRF_KEY_HASH`
3. `VRF_SUB_ID`

Bez techto hodnot deploy script VRF router preskoci.

## 3. Povinne env promene pri liquidity branch deployi na realne siti

Pokud bude aktivni `DEPLOY_LIQUIDITY_BRANCH=1`, jsou povinne:

1. `ROUTER`
2. `FACTORY`
3. `WETH`
4. `LIQUIDITY_PATH`

Bez nich script na non-local siti liquidity branch nenasadi.

## 4. Povinne env promene pri zapnutem price checku guardu

Pokud nastavite:

```bash
DEX_GUARD_PRICE_CHECK_ENABLED=1
```

pak musite mit aspon jeden bezpecny price reference postup:

1. `DEX_GUARD_QUOTE_ORACLE` + `DEX_GUARD_REQUIRE_QUOTE_ORACLE=1`
2. nebo `DEX_GUARD_REFRESH_PRICE_ANCHOR=1` a pocatecni likviditu v paru pri deployi

Pokud nastavite `DEX_GUARD_REQUIRE_QUOTE_ORACLE=1`, musi byt `DEX_GUARD_QUOTE_ORACLE` validni feed. Guard podporuje:

1. Chainlink-like `latestRoundData()` + `decimals()`
2. legacy `latestAnswer()`

Pro Chainlink-like feed nastavte take `DEX_GUARD_MAX_ORACLE_STALENESS_SEC`.

## 5. Doporucene env promene, ktere je lepsi vyplnit explicitne

Tyto hodnoty maji defaulty, ale pro mainnet je lepsi je zmrazit explicitne:

1. `SALE_CAP`
2. `MARKETING_CAP`
3. `CB_DEX_CRITICAL_FLOOR`
4. `CB_REWARDS_CRITICAL_FLOOR`
5. `SUPPLY_DEX_RESERVE_DROP_BPS`
6. `SUPPLY_DEX_REFILL_AMOUNT`
7. `SUPPLY_DEX_COOLDOWN_SEC`
8. `SUPPLY_MIN_RESERVE_FLOOR`
9. `SUPPLY_AUTO_REFRESH_BASELINE`
10. `SUPPLY_REWARDS_THRESHOLD`
11. `SUPPLY_REWARDS_REFILL_AMOUNT`
12. `SUPPLY_REWARDS_COOLDOWN_SEC`
13. `DEX_GUARD_MIN_RESERVE_RATIO_BPS`
14. `DEX_GUARD_REFILL_AMOUNT`
15. `DEX_GUARD_COOLDOWN_SEC`
16. `DEX_GUARD_AUTO_REFRESH_BASELINE`
17. `DEX_GUARD_MAX_DEVIATION_BPS`
18. `DEX_GUARD_MAX_ORACLE_STALENESS_SEC`
19. `DEX_GUARD_REQUIRE_QUOTE_ORACLE`
20. `DEX_GUARD_REFRESH_PRICE_ANCHOR`
21. `POLICY_SWAP_SLIPPAGE_BPS`
22. `POLICY_TX_DEADLINE_SEC`
23. `POLICY_MIN_BUYBACK_INTERVAL_SEC`
24. `POLICY_MAX_DAILY_BUYBACK_NATIVE`
25. `BUYBACK_FALLBACK_SLIPPAGE_BPS`
26. `BUYBACK_FALLBACK_DEADLINE_SEC`
27. `BUYBACK_FALLBACK_COOLDOWN_SEC`

Pravidlo:

1. `SALE_CAP + MARKETING_CAP` musi dat presne `550`

## 6. Doporucene adresy, ktere je lepsi vyplnit explicitne

1. `MARKETING_SUPPORT`
2. `NFT_REWARDS`
3. `BUYBACK_AGENT`
4. `BUYBACK_ROUTER`
5. `COMMUNITY_CENTER`
6. `POLICY`
7. `LIQUIDITY_MANAGER`
8. `LIQUIDITY_VAULT`
9. `LIQUIDITY_ORCHESTRATOR`
10. `LIQUIDITY_KEEPER_PROXY`
11. `LIQUIDITY_AUTOMATION`
12. `DRIP_KEEPER_PROXY`
13. `BUYBACK_UPKEEP_PROXY`
14. `MULTI_COLLECTION_READER`
15. `CHAPTER_SERIES_READER`
16. `MULTICALL`
17. `RESERVE_TREASURY_READER`
18. `BUYBACK_READER`
19. `LIQUIDITY_BRANCH_READER`
20. `LIQUIDITY_HELPER_READER`
21. `SUPPLY_CONTROLLER_READER`
22. `SUPPLY_GUARDIAN_READER`
23. `DEX_RESERVE_GUARD_READER`
24. `SYSTEM_READER`
25. `TOKENOMICS_SYSTEM_ADDON_READER`
26. `BIGGI_TOKENOMICS_READER`
27. `TOKEN_REWARDS_READER`

Poznamka:

1. Kdyz `MARKETING_SUPPORT` neni nastaven, 200M marketing support jde do `TREASURY`
2. Pokud se readery nenasazuji samostatne predem, `DEPLOY_TOKENOMIC_READERS=1` je umi nasadit v master deploy flow, pokud existuji jejich target kontrakty.

## 7. Povinne non-env rozhodnuti

Pred deployem musi byt hotovo:

1. finalni owner cil:
   - multisig
   - nebo timelock
2. finalni vyber jedne liquidity cesty:
   - doporuceno `keeper_proxy`
   - nebo `automation`
3. `LIQUIDITY_PATH` a `EXPECT_LIQUIDITY_PATH` musi byt stejne
4. finalni keeper/upkeep plan
5. finalni VRF subscription plan
6. finalni explorer verification plan
7. finalni runbook pro ownership transfer

## 8. Povinne externi infrastruktura

1. dostatek POL na deploy wallet
2. spolehlive RPC bez rate-limit problemu
3. archive RPC pro fork testy
4. explorer ucet / workflow pro source verification
5. monitoring a alerting pro upkeeps a pausy

## 9. Doporuceny preflight prikaz pred deployem

```bash
npm run validate:master:polygon
```

Pak:

```bash
npm run test:master
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

Pokud chcete pouzivat automation cestu, nahradte `keeper_proxy` za `automation`.

## 10. Aktualne chybejici hodnoty z tohoto auditu

V case tohoto finalniho auditu chybi:

1. `POLYGON_RPC_URL`
2. `QUOTE_TOKEN`

Aktualne take nejsou dodany:

1. `VRF_COORDINATOR`
2. `VRF_KEY_HASH`
3. `VRF_SUB_ID`
4. `MARKETING_SUPPORT`

## 11. Doporuceny fork preflight

Pred mainnet release pustit jeste:

```bash
FORK_URL=<archive_rpc> FORK_BLOCK_NUMBER=<fixed_block> npm run test:master:fork
```

Kdyz `FORK_URL` neni nastaven, helper pouziva `POLYGON_RPC_URL`.
