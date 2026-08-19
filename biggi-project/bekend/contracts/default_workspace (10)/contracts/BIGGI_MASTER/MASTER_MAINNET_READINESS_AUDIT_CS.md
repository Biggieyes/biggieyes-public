# MASTER_MAINNET_READINESS_AUDIT_CS

Datum auditu: 2026-06-07

Scope:
- cela slozka `BIGGI_MASTER`
- CORE kontrakty, CORE knihovny, CORE readery, CORE ABI
- TOKENOMICMAINNET kontrakty, knihovny, readery, ABI, dossiers
- master deploy/config/check skripty

## Verdikt

Kodova cast master stacku je po dnesni kontrole lokalne `GO`.

Ostry Polygon mainnet deploy je stale `NO-GO`, dokud nejsou doplneny finalni externi hodnoty v `.env` a/nebo finalnim address manifestu:

1. `POLYGON_RPC_URL`
2. `QUOTE_TOKEN`
3. produkcni `PAIR`
4. produkcni `ROUTER`, `FACTORY`, `WETH`
5. `PRIVATE_KEY` deploy walletu
6. `DEV_WALLET`
7. `EXPECT_OWNER` finalni Safe/timelock
8. VRF hodnoty, pokud ma byt VRF branch aktivni pri deployi
9. upkeep/keeper rozhodnuti a funding plan

## Overene vysledky

Spustene kontroly:

1. `npm run compile:master`
   - vysledek: OK
   - Hardhat: `Nothing to compile`
2. `npm run test:master`
   - vysledek: OK
   - `64 passing`
3. `node scripts/tools/compareAbiToSource.js`
   - vysledek: OK
   - CORE ABI/source: `25` kontraktu, `0` issues
4. `node scripts/tools/compareTokenomicAbi.js`
   - vysledek: OK
   - TOKENOMIC ABI/source: `44` kontraktu, `0` issues, `0` processing errors
5. `node scripts/master/runFinalGateLocal.js --skip-tests --expect-liquidity-path keeper_proxy`
   - vysledek: OK
   - local deploy + strict consistency check: `Consistency checks: OK`
6. `npm run configure:master:local`
   - vysledek: OK
   - dry-run po cistem local deployi: `actions=0`, `warnings=0`, `blockers=0`, `errors=0`
7. `npm run validate:master:polygon`
   - vysledek: ocekavany NO-GO kvuli finalnim hodnotam
   - chybi `POLYGON_RPC_URL`
   - chybi `QUOTE_TOKEN`
   - info: VRF neni zatim nastavene
   - warning: `DEV_WALLET` a `EXPECT_OWNER` maji byt pro Polygon nastaveny explicitne

## Provedene upravy

### Plna drip/moderator vetev v deploy skriptu

`scripts/master/deployMasterStack.js` ted umi pri master deployi nasadit a zapojit i plnou drip/moderator vetev:

1. `ModeratorCenter`
2. `BiggiDripLMToModerator`
3. `DripDistributor.setDripLM(dripLm)`
4. `DripDistributor.setTokensPerMintOperator(dripLm)`
5. `DripDistributor.setCollection(main, true)`
6. `DripDistributor.setCollection(main2, true)`
7. `DripLM.setRouter(buybackRouter || router)`
8. `DripLM.setDripDistributor(dripDistributor)`
9. `DripLM.setReserve(reserve)`
10. `DripLM.setBuybackAgent(buybackAgent)`
11. `DripLM.setModeratorCenter(moderatorCenter)`
12. `ModeratorCenter.setMultiCollection(dripLm)`
13. `DripKeeperProxy.setDripLM(dripLm)`
14. `BuybackAgent.setKeeper(buybackUpkeepProxy)`
15. `MasterConfig.setPumpBranch(buybackAgent, dripLm, dripDistributor, policy)`

Nove env volby:

1. `DEPLOY_DRIP_LM`
2. `DEPLOY_MODERATOR_CENTER`
3. `MODERATOR_CENTER`
4. `DRIP_LM_SELL_PCT`
5. `DRIP_LM_SLIPPAGE_BPS`
6. `DRIP_LM_TX_DEADLINE_SEC`
7. `DRIP_LM_RESERVE_SHARE_BPS`
8. `DRIP_LM_MODERATOR_SHARE_BPS`

Default:
- `DEPLOY_DRIP_LM` nasleduje `DEPLOY_BUYBACK_BRANCH`
- `DEPLOY_MODERATOR_CENTER` nasleduje `DEPLOY_BUYBACK_BRANCH`
- `DRIP_LM_RESERVE_SHARE_BPS/DRIP_LM_MODERATOR_SHARE_BPS = 5000/5000`
- `DRIP_LM_SELL_PCT = 70`
- `DRIP_LM_SLIPPAGE_BPS` nasleduje `LIQ_SLIPPAGE_BPS`, default `300`

### Mainnet validator

`scripts/master/validateMainnetEnv.js` ted hlida:

1. ze pri `DEPLOY_DRIP_LM=1` existuje realny `BUYBACK_ROUTER` nebo `ROUTER`
2. ze `MODERATOR_CENTER` se pri explicitnim nastaveni znovu nenasazuje
3. ze Polygon mainnet nema skoncit s neaktivni drip vetvi bez vedomeho rozhodnuti

### Dokumentace

Aktualizovane dokumenty:

1. `scripts/master/README.md`
2. `TOKENOMICMAINNET/MAINNET_DEPLOY_ORDER_CS.md`
3. `TOKENOMICMAINNET/MAINNET_FINAL_GATE_CHECKLIST_CS.md`
4. `TOKENOMICMAINNET/MAINNET_PREDEPLOY_CHECKLIST_CS.md`
5. `TOKENOMICMAINNET/MAINNET_ONE_SHOT_RUNBOOK_CS.md`

## Ne-blokujici nalezy

1. Vyreseno 2026-06-07: `BiggiCollectionRewards_UPDATED.sol` byl odstranen z CORE produkcniho source tree, aby nebyl soucasti deployovatelneho povrchu.

2. `addresses.master.json` byl pri lokalnich gate testech prepsan lokalnimi Hardhat adresami.
   - nepouzivat jako mainnet manifest
   - po ostrym deployi ulozit novy finalni `addresses.master.json`

## GO podminka pro mainnet

Mainnet deploy spustit az po splneni vsech bodu:

1. `npm run validate:master:polygon` = OK
2. `npm run test:master` = OK
3. `npm run gate:master:local` = OK
4. `npm run preflight:master:polygon -- --expect-liquidity-path keeper_proxy --expect-owner <SAFE>` = OK
5. pokud je k dispozici archive RPC, projde fork test
6. `DEPLOY_BUYBACK_BRANCH=1`, pokud chces plnou tokenomiku
7. `DEPLOY_DRIP_LM=1` a `DEPLOY_MODERATOR_CENTER=1`, pokud nejsou dodane predeploy adresy `DRIP_LM` a `MODERATOR_CENTER`
8. po deployi `npm run configure:master:polygon` ukaze ocekavany dry-run plan
9. po `configure:master:polygon:execute` strict check vrati `Consistency checks: OK`
10. po ownership transferu strict check s `EXPECT_OWNER=<SAFE>` vrati `Consistency checks: OK`
