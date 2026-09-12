# NFT Rewards V2 - Polygon deployment runbook

Stav k `2026-09-09`: V2 a reader jsou nasazené a verifikované na Polygonscanu.
VRF consumer approval i odkaz v MasterConfig byly potvrzené na Polygonu (137).
Frontend je publikovaný na `biggieyes.com`, deploy `6aa0ca18a06d42d1aaafcda8`.
Po kontrole veřejného panelu bylo odebrané V1 oprávnění; V2 zůstává schválená.

- V2: `0xd1cefDf3b4ce4c174291F8eB0729980c50D293b9`
- Reader: `0x789873e6b1d944b207D2E76a71D95135be4e33c6`
- Transakce a původní V1 adresy: `bekend/reports/nft-rewards-v2-deployment-polygon.json`.
- Deployment neopakovat. `completeNftRewardsV2.js` dokončuje pouze approval již nasazené V2.
- `syncNftRewardsV2Config.js` mění pouze NFT slot v MasterConfig a zachovává zbytek bundle.
- V1 approval je vypnutý od bloku `93478300`. Transakce:
  `0x28115b8e0516aeae24df6eff0fd92c11f50bff473202b298041b9562c62be96f`.
- `retireNftRewardsV1.js` ověřuje publikovaný build, V2 wiring a prázdnou V1 před odebráním oprávnění.

## 1. Rozsah V2

- `createManualReward` vytvoří okamžitě dokončený event a přiřadí jeden reward.
- Mystery event vybírá unikátní vítěze výhradně přes schválený `BiggiVRFRouter`.
- VRF router je immutable a owner jej po deploymentu nemůže nahradit.
- Retry je možný pouze pro skutečně pending request po `mysteryRetryDelay`.
- VRF request ID je jednorázové a nelze jej znovu použít ani po dokončení eventu.
- Ownerem zvolený emergency random byl odstraněn.
- Character NFT zůstávají v `BiggiMain`, kde se mintují při dokončení bloku.
- Přímý příjem POL je zakázán.
- Ownership používá `Ownable2Step`; renounce je zakázaný.

Reader zachovává společné V1/V2 metody. Frontend používá ABI V2 a již nevolá
V1-only pole `mainContract` a `registry` ani jejich settery.

## 2. Ochrany migrace

Deployment skript před transakcí fail-closed ověřuje:

- Polygon chain ID `137`;
- signer odpovídá kanonickému deployerovi;
- final owner odpovídá ownerovi V1 i VRF routeru;
- V1 má `nextEventId == 1`, `nextRewardId == 1` a `0 POL`;
- V1 reader ukazuje na správnou V1 adresu;
- V1 je schválený VRF reward consumer;
- všechny závislosti mají bytecode;
- deployer i owner mají dost POL podle aktuálního gas odhadu.

V1 se během deploymentu nemění. V2 se pouze nasadí, dostane nový immutable reader
a owner ji schválí na VRF routeru. Přepnutí produkčních adres je samostatný krok.

## 3. Historický preflight blokátor (vyřešeno 2026-09-09)

Report z bloku `92787561` naměřil:

| Wallet | Zůstatek | Požadavek s 25% rezervou |
|---|---:|---:|
| deployer `0x8fa5...f27B` | `0.320764160595805697 POL` | `1.070346987910375668 POL` |
| owner `0x402C...92b2` | `0.001702373944068 POL` | `0.019022737102170245 POL` |

Gas price je proměnlivý. Po doplnění POL se musí preflight spustit znovu; hodnoty
v této tabulce nejsou trvalý deployment rozpočet.

## 4. Příkazy z repository root

Preflight bez transakce:

```powershell
npm --prefix biggi-project/bekend run prepare:nft-rewards-v2:polygon
```

Pokračovat lze pouze při prázdném `blockers` v reportu
`biggi-project/bekend/reports/nft-rewards-v2-preflight-polygon.json`.

Deployment po výslovném schválení:

```powershell
$env:NFT_REWARDS_V2_DEPLOY_CONFIRM="DEPLOY_NFT_REWARDS_V2"
npm --prefix biggi-project/bekend run deploy:nft-rewards-v2:polygon
Remove-Item Env:\NFT_REWARDS_V2_DEPLOY_CONFIRM
```

Skript používá `DEPLOYER_PRIVATE_KEY` pro oba deploymenty a `OWNER_PRIVATE_KEY`
jen pro `BiggiVRFRouter.setRewardConsumerApproval(V2, true)`. Klíče se nelogují.

Source verification po úspěšném deploymentu:

```powershell
npm --prefix biggi-project/bekend run verify:nft-rewards-v2:polygon
```

## 5. Produkční přepnutí

Až po kontrole deployment reportu a source verification:

1. nahradit `NFT_REWARDS` a `NFT_REWARDS_READER` v kanonických adresách;
2. synchronizovat frontend a Netlify production environment;
3. spustit ABI check, frontend testy, build a mainnet smoke test;
4. ověřit reader target, ownera, VRF router a consumer approval;
5. teprve potom odebrat V1 z `approvedRewardConsumers`.

Před přepnutím se nesmí na V2 vytvořit žádný event. V1 zůstává rollback cesta,
dokud není nový frontend veřejně ověřený.
