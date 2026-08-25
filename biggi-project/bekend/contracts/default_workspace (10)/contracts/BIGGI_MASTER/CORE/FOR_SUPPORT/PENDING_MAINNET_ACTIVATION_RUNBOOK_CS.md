# Pending Mainnet Activation Runbook

Datum: 2026-08-25

CollectionRewards migrace popsana v sekci 0 je dokoncena. Liquidity a finalni
aktivacni kroky v dalsich sekcich zustavaji pending.

## Kanonicky unsigned plan

Pred jakymkoli write krokem vzdy znovu spustit:

```powershell
npm run plan:production-activation:polygon
npm run rehearse:production-activation:fork
```

Plan ma pet oddelenych fazi `00`, `10`, `20`, `30`, `40`. Zdroj hodnot je
`config/production-activation.polygon.json`; podrobnosti jsou v
`PRODUCTION_ACTIVATION_PLAN_CS.md`. Vystup nema podpisy ani nic neodesila.

## 0. CollectionRewards budget gate - completed

Nasazeno a verified na Polygon mainnetu 2026-08-24:

- `BiggiCollectionRewards`: `0xDfD29350EA1237D39Ff2F2453cE496eE2eba7F43`
- `BiggiMainReader`: `0xde05be77024eABf37E4eA4fbBD58F161081be2f3`
- 5 VRF budgetu je nakonfigurovano
- Chapter 1 je aktualni `fundingCollection`
- Distributor a MasterConfig smeruji na novy CollectionRewards
- Distributor je po migraci unpaused
- pending pro stary i novy CollectionRewards byl pri post-checku `0 POL`
- maximum je `47 000 POL` pro kazdou VRF kolekci

Potvrzene kontroly:

```powershell
npm run audit:collection-rewards:polygon
npm run check:master:core:polygon
npm run preflight:launch:polygon
```

Vysledek: claim audit `65/65`, CORE relationship check bez issue a source
verification `15/15`. Preflight zustava zamerne `okForPublicLaunch=false`
kvuli liquidity a dalsim aktivacnim blockerum, ne kvuli CollectionRewards.

Native mint tok je `60 % do Distributoru * 25 % do CollectionRewards`, tedy
15 % ceny mintu. Castka se pripise rozpoctu aktivni VRF kolekce po kazdem
mintu. Claim se automaticky odemkne az pri plnem kryti 47 000 POL. BIGGI mint
neposila do tohoto native budgetu zadny POL.

Pri prechodu na dalsi chapter dodrzet poradi:

1. deaktivovat predchozi chapter
2. overit `Distributor.pending(CollectionRewards) == 0`
3. `CollectionRewards.setFundingCollection(nextVrfCollection)`
4. aktivovat pouze novy chapter

## 1. Initial Liquidity

Plan:

- `8,000,000 BIGGI`
- `5,000 POL`
- LP recipient: `0xFe234394845B601B2c671c0dD631fA6290c02bb9` (`LIQUIDITY_VAULT`)
- `TRANSFER_FROM_RESERVE=1`
- `LIQ_POST_SEED_SYNC_POL=1`

Dry-run:

```powershell
$env:LIQUIDITY_OWNER='0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2'
$env:LIQ_TOKEN_AMOUNT='8000000'
$env:LIQ_NATIVE_AMOUNT='5000'
$env:LIQ_LP_RECIPIENT='0xFe234394845B601B2c671c0dD631fA6290c02bb9'
$env:TRANSFER_FROM_RESERVE='1'
$env:ALLOW_UNSYNCED_VAULT_LP='1'
npm run prepare:initial-liquidity:polygon
```

Current dry-run blocker:

- Owner wallet currently has `1.824440220558510091 POL`, not enough for `5000 POL + 1 POL + gas`.
- Transaction deadline je dynamicky `latest block timestamp + 900 s`; plan se musi regenerovat tesne pred liquidity krokem.

Execution must not be run until the owner wallet has enough POL and the irreversible flag is set intentionally:

```powershell
$env:EXECUTE_INITIAL_LIQUIDITY='1'
$env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE='1'
npm run prepare:initial-liquidity:polygon
```

## 2. Post-Liquidity Checks

```powershell
npm run preflight:launch:polygon
npm run check:master:core:polygon
```

The pair must have non-zero reserves and non-zero LP supply.

## 3. Tokenomics Activation

DripKeeper must remain paused. Drip is triggered by BuybackAgent through DripLM.

Dry-run:

```powershell
$env:ENABLE_LIQUIDITY_ORCHESTRATOR='1'
$env:ENABLE_LIQUIDITY_KEEPER='1'
$env:ENABLE_BUYBACK_UPKEEP='1'
$env:ENABLE_AUTO_BUYBACK='1'
$env:ENABLE_DRIP_KEEPER='0'
$env:BUYBACK_MIN_NATIVE_WEI='500000000000000000'
npm run activate:tokenomics:polygon
```

Execution, only after liquidity passes:

```powershell
$env:EXECUTE_TOKENOMICS_ACTIVATION='1'
$env:I_UNDERSTAND_KEEPERS_GO_LIVE='1'
npm run activate:tokenomics:polygon
```

Mainnet proxy ma aktualne chybne `minNativeThresholdWei=1`. Aktivacni skript musi nejdrive provest `setThreshold(500000000000000000)` (`0.5 POL`) a teprve potom `setPaused(false)`. Hodnotu pod `0.001 POL` skript odmitne. Dry-run po doplneni liquidity musi tento plan zobrazit pred jakymkoli podpisem; execute prikazy se spousteji ve stejnem PowerShell okne, aby zustaly nastavene parametry z dry-runu.

Pred liquidity se take opravi ulozene LM hodnoty z `5 wei / 5 wei` na
`5 POL / 5 POL` pres `setAutoTopUpConfig(false, ...)`. LM zustava vypnuty,
`tokenPct=100` a `slippageBps=300`.

## 4. CRE

CRE is still blocked by account access:

- `cre whoami` reports `Deploy Access: Not enabled`.
- `cre account access --non-interactive` unexpectedly reported a submitted request without collecting a description; do not repeat it before Chainlink confirms the active request.

Until Chainlink enables deploy access, do not run production deploy/activate.

After deploy access is enabled:

```powershell
cre workflow list --target production-settings
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive
```

Deployment/activation must wait for explicit confirmation and for workflow ID/owner values to be known.

Required receiver steps after production workflow identity is known:

- set expected workflow ID
- set expected workflow owner
- allowlist five target/selector pairs
- set receiver keeper/allowed-caller roles
- unpause receiver last

## 5. Originals launch

Az po finalnim strict gate se odpause Chapter 1 Public a aktivuje pouze
`TicketHub.setChapterActive(1, true)`. Chapters 2-5 zustavaji `false`.
