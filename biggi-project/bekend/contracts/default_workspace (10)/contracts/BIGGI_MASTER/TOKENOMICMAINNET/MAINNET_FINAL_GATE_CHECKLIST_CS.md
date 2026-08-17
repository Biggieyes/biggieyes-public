# MAINNET_FINAL_GATE_CHECKLIST_CS

Cil: bezpecne nasadit cele BIGGI MAINNET portfolio (one-shot), s maximalni konzistenci a bez improvizace.

## 1. Freeze pravidla (T-24h az T-1h)

1. Zmrazit kod: po Gate A zadne funkcni zmeny kontraktu.
2. Uzamknout deployment commit hash a zaznamenat ho do release poznamek.
3. Pred deployem mit jeden jasny branch + jeden operator runbooku.
4. Potvrdit, ze je aktivni jen jedna liquidity cesta:
   - doporuceno `keeper_proxy`, nebo
   - `automation`
5. Potvrdit, ze `LIQUIDITY_PATH` a `EXPECT_LIQUIDITY_PATH` jsou stejne.

## 2. Povinne preflight testy (lokal)

Spustit presne v tomto poradi:

```bash
npm run compile:master
npm run test:master
```

```bash
# terminal 1
npx hardhat node --config hardhat.biggi-master.cjs

# terminal 2
npm run deploy:master:local
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:local
```

Pokud pouzivate `automation` vettev, zmente `LIQUIDITY_PATH=automation` a `EXPECT_LIQUIDITY_PATH=automation`.

Go kriterium:
1. `test:master` = 100% pass.
2. `Consistency checks: OK`.
3. Zadny warning o dvojite liquidity ceste.

Alternativa (jeden prikaz):

```bash
npm run gate:master:local
```

## 3. Pred-mainnet konfiguracni gate

Nejdrive validace `.env`:

```bash
npm run validate:master:polygon
```

1. Vyplnit finalni adresy (router/factory/wNative/pair/VRF/keepery/safe).
2. Potvrdit finalni parametry:
   - `BiggiSupplyController` (DEX/rewards thresholdy, refill, cooldown)
   - `BiggiDexReserveGuard` (ratio, cooldown, price-check)
   - `BiggiPolicy` (slippage, deadline, interval, quota)
3. Overit notify allowlist v `BiggiReserveV4` (strict mode).
4. Potvrdit registry eligibility pro budouci VRF/public kolekce.

## 4. Mainnet dry check (pred aktivaci keeperu)

```bash
npm run deploy:master:polygon
npm run configure:master:polygon
npm run configure:master:polygon:execute
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

`configure:master:polygon` je defaultne dry-run. `--execute` pouzit az po kontrole planovanych zmen, protoze skript aplikuje realne settery na write kontraktech.

Po ownership transferu doplnit i owner gate:

```bash
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_OWNER=0xYOUR_SAFE EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

Go kriterium:
1. `Consistency checks: OK`.
2. `EXPECT_OWNER` sedi na multisig/timelock.
3. Cely core wiring je bez mismatch.

## 5. Kriticke wiring body (musi sedet)

1. `MAIN.ticketHub == TICKET_HUB`
2. `MAIN.compute == COMPUTE`
3. `MAIN2.distributor == DISTRIBUTOR`
4. `TOKEN.reserveAddr == RESERVE`
5. `TOKEN.dripDistributorAddr == DRIP_DISTRIBUTOR`
6. `TOKEN.tokenRewardsAddr == TOKEN_REWARDS`
7. `TOKEN.supplyController == SUPPLY_CONTROLLER`
8. `TOKEN.supplyGuardian == SUPPLY_GUARDIAN`
9. `TREASURY.{tokenRewards,reserveAddr,dripDistributor,buybackAgent}`
10. `DISTRIBUTOR.{collectionRewards,reserve,buybackAgent,treasury,communityCenter,registry}`
11. `COLLECTION_REWARDS.registry == REGISTRY`
12. `TOKEN_REWARDS.registryMode == true` a allowed kolekce odpovidaji registry
13. `SUPPLY_CONTROLLER.pair == PAIR`
14. `DEX_GUARD.pair == PAIR`, `DEX_GUARD.quoteToken == QUOTE_TOKEN` a `DEX_GUARD.supplyController == SUPPLY_CONTROLLER`
15. `POLICY.buybackAgent == BUYBACK_AGENT`
16. pokud je VRF aktivni, `VRF_ROUTER.approvedRewardConsumers[NFT_REWARDS] == true`
17. `MASTER_CONFIG` bundle adresy odpovidaji realnym kontraktum
18. pokud je plna buyback/drip vetev aktivni:
   - `DRIP_DISTRIBUTOR.dripLM == DRIP_LM`
   - `DRIP_DISTRIBUTOR.tokensPerMintOperator == DRIP_LM`
   - `DRIP_DISTRIBUTOR.collections(MAIN) == true`
   - `DRIP_DISTRIBUTOR.collections(MAIN2) == true`
   - `BUYBACK_AGENT.dripLM == DRIP_LM`
   - `DRIP_LM.router == BUYBACK_ROUTER || ROUTER`
   - `DRIP_LM.dripDistributor == DRIP_DISTRIBUTOR`
   - `DRIP_LM.reserve == RESERVE`
   - `DRIP_LM.buybackAgent == BUYBACK_AGENT`
   - `DRIP_LM.moderatorCenter == MODERATOR_CENTER`
   - `MODERATOR_CENTER.multiCollection == DRIP_LM`
   - `DRIP_KEEPER_PROXY.dripLM == DRIP_LM` pokud je proxy nasazena
19. tokenomic readery, pokud jsou nasazene, miri na finalni write kontrakty:
   - `RESERVE_TREASURY_READER -> RESERVE/TREASURY`
   - `SUPPLY_CONTROLLER_READER -> SUPPLY_CONTROLLER`
   - `SUPPLY_GUARDIAN_READER -> SUPPLY_GUARDIAN`
   - `DEX_RESERVE_GUARD_READER -> DEX_RESERVE_GUARD`
   - `SYSTEM_READER -> BIGGI_TOKEN/SUPPLY_CONTROLLER/SUPPLY_GUARDIAN`
   - `TOKENOMICS_SYSTEM_ADDON_READER -> MASTER_CONFIG/BIGGI_TOKEN`
   - `BIGGI_TOKENOMICS_READER -> BIGGI_TOKEN/ROUTER/PAIR/DISTRIBUTOR/BUYBACK_AGENT_EFFECTIVE/RESERVE/LIQUIDITY_MANAGER/LIQUIDITY_VAULT/DRIP_DISTRIBUTOR/TOKEN_REWARDS`
   - `TOKEN_REWARDS_READER -> TOKEN_REWARDS`
20. DEX baseline/oracle stav:
   - `SUPPLY_CONTROLLER.baselineReserve > 0`
   - `DEX_GUARD.baselineReserve > 0`
   - pokud `DEX_GUARD_PRICE_CHECK_ENABLED=1`, `DEX_GUARD.lastGoodDexPriceE18 > 0` nebo validni `quoteOracleStatus()`
   - pokud `DEX_GUARD_REQUIRE_QUOTE_ORACLE=1`, `quoteOracleStatus().valid == true` a `quoteOracleStatus().stale == false`

## 6. CRE / keeper aktivace

Pred CRE aktivaci musi byt dokoncena initial liquidity podle `INITIAL_LIQUIDITY_RUNBOOK_CS.md`:

1. Pair reserves odpovidaji kurzu `8 000 000 BIGGI / 5 000 POL` plus pripadnemu zdokumentovanemu LM sync pairingu.
2. LP tokeny jsou realne ve `LiquidityVault`.
3. Vault `accounted LP == real LP`.
4. Router allowance owner wallet je `0`.
5. SupplyController a DexReserveGuard maji nenulovy baseline.

Pouzijte profil `Guarded (4 CRE tasks)` z `MAINNET_AUTOMATION_MATRIX.md`.

1. Supply task
2. Buyback task
3. Prave jedna liquidity cesta
4. Dex guard task

Pozn.: `DripKeeperProxy` je fallback, ne povinna primarni cesta.

Povinne pred GO:

1. `CRE_AUTOMATION_RECEIVER` deployed and unpaused.
2. `CRE_KEYSTONE_FORWARDER` odpovida cilove siti.
3. Receiver allowlist obsahuje pouze povolene `(target, performUpkeep(bytes))`.
4. Receiver je nastaven jako keeper/allowed caller tam, kde target kontroluje `msg.sender`.
5. CRE workflow je uspesne simulovany a aktivovany.
6. Stare Automation/Gelato registrace pro stejne vetve jsou vypnute nebo odstranene.

## 7. One-shot GO/NO-GO rozhodnuti

Deploy je `GO` pouze kdyz plati vse:

1. Test gate: pass.
2. Strict gate: pass bez mismatch.
3. Liquidity gate: jedna aktivni cesta.
4. Owner gate: final safe/timelock.
5. CRE gate: workflow aktivni, receiver wired, zadne duplicitni stare upkeepy.
6. Ops gate: monitoring + incident runbook pripraveny.

Jakykoliv fail = `NO-GO` a zastavit release.

## 8. Povinne artefakty po nasazeni

1. `addresses.master.json` (final)
2. Seznam tx hashu (deploy + wiring + ownership transfer)
3. Verifikace kontraktu na exploreru
   - aktualni audit 2026-08-17: `58/58` unikatnich projektovych deploymentu ma bytecode a verifikovany source
   - canonical vystup: `../MAINNET_DEPLOYMENT_MANIFEST_POLYGON.json`
4. Zmrazeny ABI balicek:
   - `contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/CORE_ABI`
   - `contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/ABI`
   - tokenomics ABI package aktualne obsahuje 46 kontraktovych ABI souboru plus `index.json`, vcetne 5 knihovnich ABI snapshotu
5. Release tag + archiv runbooku

## 9. Navazne soubory

1. `MAINNET_AUTOMATION_MATRIX.md`
2. `MAINNET_GUARDED_WIRING_BATCH.md`
3. `MAINNET_COMPLETION_GAPS.md`
