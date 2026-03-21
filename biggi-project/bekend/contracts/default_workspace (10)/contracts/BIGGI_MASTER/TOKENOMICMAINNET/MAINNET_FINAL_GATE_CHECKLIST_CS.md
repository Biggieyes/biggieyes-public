# MAINNET_FINAL_GATE_CHECKLIST_CS

Cil: bezpecne nasadit cele BIGGI MAINNET portfolio (one-shot), s maximalni konzistenci a bez improvizace.

## 1. Freeze pravidla (T-24h az T-1h)

1. Zmrazit kod: po Gate A zadne funkcni zmeny kontraktu.
2. Uzamknout deployment commit hash a zaznamenat ho do release poznamek.
3. Pred deployem mit jeden jasny branch + jeden operator runbooku.
4. Potvrdit, ze je aktivni jen jedna liquidity cesta:
   - `keeper_proxy`, nebo
   - `automation`

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

Pokud pouzivate `automation` vettev, zmente `EXPECT_LIQUIDITY_PATH=automation`.

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
CHECK_STRICT=1 CHECK_REQUIRE_CODE=1 EXPECT_LIQUIDITY_PATH=keeper_proxy npm run check:master:polygon
```

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
14. `DEX_GUARD.pair == PAIR` a `DEX_GUARD.supplyController == SUPPLY_CONTROLLER`
15. `MASTER_CONFIG` bundle adresy odpovidaji realnym kontraktum

## 6. Keeper/automation aktivace

Pouzijte profil `Guarded (4 upkeep)` z `MAINNET_AUTOMATION_MATRIX.md`.

1. Supply upkeep
2. Buyback upkeep
3. Prave jedna liquidity cesta
4. Dex guard upkeep

Pozn.: `DripKeeperProxy` je fallback, ne povinna primarni cesta.

## 7. One-shot GO/NO-GO rozhodnuti

Deploy je `GO` pouze kdyz plati vse:

1. Test gate: pass.
2. Strict gate: pass bez mismatch.
3. Liquidity gate: jedna aktivni cesta.
4. Owner gate: final safe/timelock.
5. Automation gate: upkeeps registrovane a financovane.
6. Ops gate: monitoring + incident runbook pripraveny.

Jakykoliv fail = `NO-GO` a zastavit release.

## 8. Povinne artefakty po nasazeni

1. `addresses.master.json` (final)
2. Seznam tx hashu (deploy + wiring + ownership transfer)
3. Verifikace kontraktu na exploreru
4. Zmrazeny ABI balicek:
   - `contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE_ABI`
   - `contracts/default_workspace (10)/contracts/BIGGI_MASTER/TOKENOMICMAINNET/ABI`
5. Release tag + archiv runbooku

## 9. Navazne soubory

1. `MAINNET_AUTOMATION_MATRIX.md`
2. `MAINNET_GUARDED_WIRING_BATCH.md`
3. `MAINNET_COMPLETION_GAPS.md`
