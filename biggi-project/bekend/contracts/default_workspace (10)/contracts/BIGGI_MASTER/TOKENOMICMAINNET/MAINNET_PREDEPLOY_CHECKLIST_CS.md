# MAINNET_PREDEPLOY_CHECKLIST_CS

Toto je finalni checklist pred jedinym realnym deploy pokusem `BIGGI_MASTER`.

## 1. Kod a lokalni audit

Musi byt splneno vse:

1. `npm run test:master` = OK
2. `npm run gate:master:local` = OK
3. `reports/master-final-gate-local.json` bez failu
4. working tree zkontrolovany a release commit zmrazeny
5. `TOKENOMICMAINNET/ABI` zkontrolovany proti `artifacts-master` bez mismatchu

## 2. Env konzistence

Musi byt vyplneno:

1. `PRIVATE_KEY`
2. `POLYGON_RPC_URL`
3. `PAIR`
4. `QUOTE_TOKEN`
5. `ROUTER`
6. `FACTORY`
7. `WETH`
8. `LIQUIDITY_PATH`
9. `EXPECT_LIQUIDITY_PATH`
10. pro ostrou DEX ochranu doporucene `DEX_GUARD_PRICE_CHECK_ENABLED=1`
11. pokud ma byt oracle povinny: `DEX_GUARD_QUOTE_ORACLE`, `DEX_GUARD_REQUIRE_QUOTE_ORACLE=1`, `DEX_GUARD_MAX_ORACLE_STALENESS_SEC`
12. pro plnou tokenomiku `DEPLOY_BUYBACK_BRANCH=1`
13. pro plnou drip/moderator vetev bud `DEPLOY_DRIP_LM=1` a `DEPLOY_MODERATOR_CENTER=1`, nebo hotove adresy `DRIP_LM` a `MODERATOR_CENTER`

Pravidla:

1. `LIQUIDITY_PATH` a `EXPECT_LIQUIDITY_PATH` musi byt stejne
2. doporucena hodnota je `keeper_proxy`
3. `SALE_CAP + MARKETING_CAP = 550`
4. `STRICT_NOTIFY_CALLERS=1`
5. pokud `DEPLOY_DRIP_LM=1`, musi byt znamy realny `BUYBACK_ROUTER` nebo `ROUTER`
6. `PAIR` musi byt realny V2-compatible pair obsahujici `BIGGI_TOKEN` a `QUOTE_TOKEN`
7. pocatecni likvidita musi byt v paru uz pred ostrym full tokenomics deployem, pokud ma deploy zalozit baseline a price anchor
8. `ALLOW_PENDING_PAIR` nechavat `0`; pouzit jen jako explicitni nouzovy rezim, ne jako planovanou produkcni cestu

## 3. VRF rozhodnuti

Vyberte jednu variantu:

1. VRF branch aktivni hned:
   - vyplnit `VRF_COORDINATOR`
   - vyplnit `VRF_KEY_HASH`
   - vyplnit `VRF_SUB_ID`
2. VRF branch zatim nedeployovat:
   - nechat VRF env prazdne
   - pocitat s tim, ze deploy script `BiggiVRFRouter` preskoci

## 4. Owner a provoz

Pred deployem musi byt urceno:

1. finalni multisig nebo timelock
2. kdo registruje upkeepy
3. kdo financuje upkeepy
4. kdo verifieruje kontrakty na exploreru
5. kde budou ulozene finalni tx hashe a release manifest
6. jestli tokenomic readery nasadit v master flow pres `DEPLOY_TOKENOMIC_READERS=1`, nebo samostatne po write vrstve

## 5. Povinne prikazy pred GO

```bash
npm run validate:master:polygon
npm run test:master
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

Pokud mate archive RPC:

```bash
FORK_URL=<archive_rpc> FORK_BLOCK_NUMBER=<fixed_block> npm run test:master:fork
```

## 6. GO podminka

Mainnet deploy je povolen jen kdyz plati vse:

1. env validator = OK
2. test suite = OK
3. strict check = OK
4. jedna liquidity cesta = OK
5. finalni owner plan = hotovy
6. deploy wallet ma dost POL
7. tokenomic reader adresy, pokud jsou nasazene, prochazi strict checkem

## 7. NO-GO podminka

Deploy se nesmi spustit, pokud plati cokoliv z tohoto:

1. chybi `QUOTE_TOKEN`
2. chybi `POLYGON_RPC_URL`
3. `LIQUIDITY_PATH` a `EXPECT_LIQUIDITY_PATH` se lisi
4. soucasne chcete aktivni `LIQUIDITY_KEEPER_PROXY` i `LIQUIDITY_AUTOMATION`
5. finalni owner je stale deploy EOA
6. VRF ma byt aktivni, ale chybi nektera `VRF_*` hodnota
7. plna tokenomika ma byt aktivni, ale chybi `DRIP_LM`/`MODERATOR_CENTER` a soucasne nejsou zapnute `DEPLOY_DRIP_LM`/`DEPLOY_MODERATOR_CENTER`
8. `DEX_GUARD_PRICE_CHECK_ENABLED=1` a neni nastaven ani validni oracle, ani price anchor plan
9. `PAIR` existuje, ale nema likviditu; `snapshotBaseline()` a `refreshPriceAnchor()` by pak nebyly spolehlive
