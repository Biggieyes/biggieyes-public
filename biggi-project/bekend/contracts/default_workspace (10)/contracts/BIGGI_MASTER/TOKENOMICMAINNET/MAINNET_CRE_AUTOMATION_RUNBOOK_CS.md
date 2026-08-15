# BIGGI mainnet CRE automation runbook

Stav k 2026-07-05. CRE nahrazuje orchestrace starych Chainlink Automation upkeepu. Nasazene tokenomicke kontrakty zustavaji execution vrstvou; novy CRE workflow cte jejich stav a zapisuje pres zabezpeceny receiver.

## Overene hodnoty

| Hodnota | Polygon mainnet |
| --- | --- |
| CRE chain name | `polygon-mainnet` |
| Chain ID | `137` |
| RPC pro CRE | `https://polygon-bor-rpc.publicnode.com` |
| KeystoneForwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |
| BiggiCREAutomationReceiver | `0xF1a21E04DA73580eD2D1311412e3639C40D47Fe6` |
| CRE CLI | `v1.23.0` |
| Bun | `1.3.14` |
| Workflow | `bekend/cre-workflows/biggi-cre/my-workflow` |
| Deployment registry | `private` |

Receiver je nasazeny, ma plny bytecode match na Sourcify, vlastni jej `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` a zustava zamerne paused. Workflow identity, call allowlist a cilove keeper role se nastavi az po CRE workflow deployi.

Source code je overeny pres Etherscan V2 na PolygonScan i jako Sourcify full match. Pouziva se `ETHERSCAN_API_KEY`; stary `POLYGONSCAN_API_KEY` se nepouziva.

## Receiver

`BiggiCREAutomationReceiver`:

- implementuje `IReceiver.onReport(bytes,bytes)` a ERC-165;
- prijima report pouze od `KeystoneForwarder`;
- volitelne kontroluje workflow ID a workflow ownera z CRE metadat;
- povoluje pouze ownerem nastavene kombinace target + selector;
- dekoduje report jako `abi.encode(address target, bytes callData)`;
- ma pause, reentrancy guard a limity velikosti payloadu.
- po deployi startuje automaticky jako paused.

Workflow identity nastav az po deployi workflow pomoci:

```text
CRE_EXPECTED_WORKFLOW_ID=0x...
CRE_EXPECTED_WORKFLOW_OWNER=0x...
```

Pak znovu spust `npm.cmd run wire:master:cre-receiver:polygon`.

## Automatizovane vetve

| Vetev | Target | Receiver selector | Opravneni receiveru |
| --- | --- | --- | --- |
| Supply | `SUPPLY_CONTROLLER` | `performUpkeep(bytes)` | `setAllowedCaller(receiver,true)` |
| Buyback | `BUYBACK_UPKEEP_PROXY` | `performUpkeep(bytes)` | proxy nema caller allowlist; agent keeper zustava proxy |
| Liquidity | `LIQUIDITY_KEEPER_PROXY` | `performUpkeep(bytes)` | `setAllowedCaller(receiver)` |
| DEX guard | `DEX_RESERVE_GUARD` | `performUpkeep(bytes)` | `setKeeper(receiver,true)` |
| Rewards week | `TOKEN_REWARDS_EMISSION_CONTROLLER` | `rollCurrentWeek()` | `setKeeper(receiver,true)` |

Workflow bezi kazdych pet minut. Kazda vetev je izolovana, aby chyba jedne nezastavila ostatni. Rewards write se vytvori pouze tehdy, kdyz `weekState(currentWeek).initialized == false`.

Drip neni samostatny CRE target. `BiggiBuybackAgent` po uspesnem buybacku vola `dripOnBuy(acquired)` se skutecnym poctem nakoupenych BIGGI. `DRIP_KEEPER_PROXY.checkUpkeep("0x")` by vratil true, ale nasledne `performUpkeep("0x")` revertuje kvuli chybejicimu `uint256`; proto tato cesta nesmi byt periodicky spoustena.

Pouziva se pouze `LIQUIDITY_KEEPER_PROXY`, nikoli paralelne `LIQUIDITY_AUTOMATION`.

## Aktualni overeni

- CRE TypeScript typecheck: OK.
- Solidity master compile: OK.
- keeper proxy smoke testy: 4/4 OK.
- tokenomic ABI porovnani: 46 kontraktu, 0 problemu.
- CRE dry-run nad Polygonem: OK, `submitted=0`, `failed=0`.
- Pri poslednim dry-run byly eligible vetve supply controller a rewards week; buyback, liquidity a DEX guard spravne vratily no action.

Dry-run nepouziva `--broadcast` a neodesila transakce.

## Postup nasazeni

1. Overit CRE ucet a registry:

```powershell
cre whoami
cre account access
cre registry list
```

`cre registry list` uspesne vratil `private` a `onchain:ethereum-mainnet`. BIGGI workflow je nastaven na `private`, aby sprava workflow nevyzadovala Ethereum mainnet gas.

`cre account access` je interaktivni terminalovy proces, nikoli webova stranka. V terminalu potvrdit `Yes` a zadat strucny popis BIGGI use case. Chainlink nasledne zadost rucne posoudi a odpovi e-mailem. Stav kontrolovat prikazem `cre whoami`.

2. V `cre-workflows/biggi-cre/my-workflow/workflow.yaml` je nastaveno:

```yaml
deployment-registry: "private"
```

3. Pred jakoukoli mainnet transakci vymenit deployer private key, ktery byl zobrazen v pracovnim vystupu, a doplnit novy pouze lokalne do ignorovaneho env souboru.

4. Nasadit receiver bez wiring a verifikovat ho:

```powershell
cd biggi-project/bekend
npm.cmd run deploy:master:cre-receiver:polygon
npm.cmd run verify:master:cre-receiver:polygon
```

Script zapise adresu do `addresses.master.json`, `.env.core.polygon` a CRE `config.production.json`.

5. Receiver ponechat paused. Zapojit role a selectory az po ziskani skutecne workflow identity:

```powershell
npm.cmd run wire:master:cre-receiver:polygon
```

6. Zopakovat simulaci:

```powershell
cd cre-workflows\biggi-cre
cre workflow simulate .\my-workflow --target test-settings --trigger-index 0 --non-interactive
```

7. Nasadit workflow, zkontrolovat jeho stav a pri `ACTIVE` ho ihned pozastavit:

```powershell
cre workflow deploy .\my-workflow --target production-settings
cre workflow get .\my-workflow --target production-settings
cre workflow pause .\my-workflow --target production-settings
```

8. Z deploy vystupu zjistit workflow ID a ownera, nastavit je na receiveru pres env promenne a spustit wiring script. Overit on-chain gettery `expectedWorkflowId` a `expectedWorkflowOwner`.

9. Az po finalnim tokenomics gate odblokovat receiver. Prikaz kontroluje workflow identity, selectory i cilove role:

```powershell
npm.cmd run activate:master:cre-receiver:polygon
```

10. Aktivovat workflow jako posledni automatizacni krok:

```powershell
cre workflow activate .\my-workflow --target production-settings
```

11. V CRE UI sledovat execution logy a na Polygonu eventy `ReportForwarded`. Stare Automation upkeeps nesmi soubezne spoustet stejne vetve.

## Blokace aktivace

Neaktivovat workflow, dokud neplati vsechny body:

- CRE Deploy Access je enabled;
- private key je vymeneny;
- receiver ma nenulovou adresu a spravny Polygon bytecode;
- receiver forwarder, workflow identity a allowlist jsou overene;
- vsechny target role ukazuji na receiver;
- `config.production.json` ma skutecnou receiver adresu;
- produkcni simulace probehla bez `failed` vetvi;
- stara Automation registrace je vypnuta nebo neexistuje.
