# MAINNET_ONE_SHOT_RUNBOOK_CS

Tento runbook je pripraveny pro jeden ostry deploy `BIGGI_MASTER` na Polygon.

## 1. Co pripravit predem

1. vyplnit `.env.mainnet.polygon.fillme`
2. zkopirovat vyplneny obsah do lokalniho `.env`
3. potvrdit jednu liquidity cestu:
   - doporucena produkcni volba: `LIQUIDITY_PATH=keeper_proxy`
   - checker musi mit stejnou hodnotu: `EXPECT_LIQUIDITY_PATH=keeper_proxy`
   - `automation` pouzit jen pokud to je vedome finalni rozhodnuti
4. potvrdit finalni owner adresu pro multisig nebo timelock
5. pro plnou tokenomiku potvrdit `DEPLOY_BUYBACK_BRANCH=1`
6. pro plnou drip/moderator vetev potvrdit jednu z variant:
   - `DEPLOY_DRIP_LM=1` a `DEPLOY_MODERATOR_CENTER=1`, nebo
   - predem nasazene adresy `DRIP_LM` a `MODERATOR_CENTER`
7. potvrdit realny `BUYBACK_ROUTER` nebo `ROUTER`, protoze `BiggiDripLMToModerator` ho potrebuje uz v konstruktoru

## 2. Povinne preflight prikazy

Spustit v tomto poradi:

```bash
npm run validate:master:polygon
npm run test:master
```

Pokud mate archive RPC, spustit jeste:

```bash
FORK_URL=<archive_rpc> FORK_BLOCK_NUMBER=<fixed_block> npm run test:master:fork
```

Pravidlo:

1. pokud `validate:master:polygon` neprojde, deploy se nezacina
2. pokud `test:master` neprojde, deploy se nezacina
3. pokud fork test neni mozny kvuli RPC limitu, nespoustejte realny deploy bez lepsiho RPC

## 3. Ostry deploy

Deploy:

```bash
npm run deploy:master:polygon
```

Po deployi okamzite strict check:

```bash
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

Pokud pouzivate automation cestu:

```bash
LIQUIDITY_PATH=automation \
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=automation npm run check:master:polygon
```

## 4. Ownership transfer batch

Po uspesnem strict checku vygenerovat batch:

```bash
npm run batch:ownership -- --to 0xYOUR_MULTISIG_OR_TIMELOCK
```

Pak provest ownership transfer a znovu overit:

```bash
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_OWNER=0xYOUR_MULTISIG_OR_TIMELOCK EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

Pokud pouzivate automation cestu, opet zmente `keeper_proxy` na `automation`.

## 5. Finalni aktivace po ownership transferu

1. zaregistrovat keepery / upkeeps
2. financovat keepery / upkeeps
3. verifikovat kontrakty na exploreru
4. ulozit finalni `addresses.master.json`
5. ulozit vsechny deploy a wiring tx hashe

## 6. Minimalni GO/NO-GO pravidla

Deploy je `GO` jen kdyz plati vse:

1. `validate:master:polygon` = OK
2. `test:master` = OK
3. `test:master:fork` = OK nebo vedome nahrazeno overenym archive dry-runem
4. `deploy:master:polygon` = OK
5. `check:master:polygon` strict = OK
6. owner check s `EXPECT_OWNER` = OK
7. aktivni je jen jedna liquidity cesta

## 7. Co si pohlidat manualne

1. `MARKETING_SUPPORT` jestli ma jit do specialni wallet nebo fallback do treasury
2. `VRF_*` hodnoty, pokud ma byt VRF branch produkcne aktivni hned pri deployi
3. `PAIR`, `QUOTE_TOKEN`, `ROUTER`, `FACTORY`, `WETH` musi byt finalni produkcni adresy
4. `PRIVATE_KEY` musi patrit deploy wallet s dostatkem POL
5. finalni owner nesmi zustat deploy EOA
6. `LIQUIDITY_PATH` a `EXPECT_LIQUIDITY_PATH` nesmi byt v rozporu
7. plna tokenomika bez `DRIP_LM`/`MODERATOR_CENTER` neni plna produkcni konfigurace
