# NFT Rewards consistency audit - Polygon mainnet

Datum kontroly: 2026-08-28
Snapshot: Polygon PoS, chain ID `137`, blok `92784902`, čas `2026-08-28T01:59:40Z`

## Ověřený deployment

| Role | Adresa | Stav |
|---|---|---|
| `BiggiNFTRewards` | `0x939Df533b80943298E15ad4c8F188102954f34FF` | bytecode přítomen, 11 248 bytes |
| `BiggiNftRewardsReader` | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` | bytecode přítomen, 3 177 bytes |
| Owner | `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2` | odpovídá mainnet konfiguraci |
| Main | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` | správně zapojen |
| VRF router | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` | správně zapojen, reward consumer povolen |
| Series registry | `0x09f3728e8607e1B951A6396DcEE4EC134C5e4058` | správně zapojen |

Reader vrací stejný NFT Rewards kontrakt, Main, VRF router, Registry i ownera.
Všechny VRF a Public adresy kapitol 1-5 jsou v NFT Rewards efektivně povolené;
VRF kolekce také procházejí přes Registry. Mystery retry delay je `900 s`.

## Aktuální stav

- `nextEventId == 1`
- `nextRewardId == 1`
- vytvořené eventy: `0`
- vytvořené reward záznamy: `0`
- zůstatek kontraktu: `0 POL`
- žádný uživatel nyní nemá NFT reward k claimu

## Funkční větve

1. Owner může vytvořit manuální reward a přiřadit jej konkrétní adrese.
2. Owner může vytvořit mystery event s unikátním seznamem způsobilých adres.
3. Povolený VRF router přiřadí mystery rewards unikátním vítězům.
4. Přiřazený uživatel volá `claim(rewardId)`; stav se nastaví a ERC-721 se mintne
   atomicky. Revert bezpečně vrátí změnu stavu.
5. Opakovaný claim, claim cizí odměny a neplatný VRF callback revertují.

## Zjištěná omezení nasazené verze

### 1. Character větev není dosažitelná

`createCharacterReward` smí volat pouze povolená kolekce. Aktuální `BiggiMain` a
`BiggiMain2` tuto funkci nevolají a nemají obecný forward/execute vstup. Tato větev
proto dnes není produkčně dosažitelná. Character NFT za dokončení bloků jsou
mintována přímo v `BiggiMain` a fungují jako oddělená mechanika.

### 2. Nouzové mystery dokončení je owner-trust boundary

`emergencyResolveMystery(eventId, random)` nevynucuje předchozí VRF request ani
uplynutí `mysteryRetryDelay`. Owner může zvolit vstupní random. Pro veřejně
deklarovanou VRF férovost se tato funkce nesmí používat jako běžná produkční cesta.

### 3. Stav immediate eventů

Manual a Character event se při vytvoření uloží s `finished == false`, přestože je
reward okamžitě přiřazen. Reader je přesný, ale UI nesmí pro tyto dva typy odvozovat
stav pouze z `finished`.

### 4. Nechtěný POL nelze vybrat

Kontrakt má `receive()`, ale nemá withdrawal/rescue funkci. POL se do něj nemá
posílat; odměnou je ERC-721, nikoli nativní měna.

## Provedená frontend náprava

- odstraněna stará statická tabulka `10 Character + 30 Leaderboard + 10 Mystery`,
  kterou nasazené ABI neposkytuje;
- eventy a rewards se načítají z reálných ID `1..N`, nikoli z neexistujícího ID `0`;
- opravena pole `rewardStartId` a `vrfRequestId`;
- opraven ethers v6 gas estimate pro `claim`;
- uživatel vidí pouze skutečně přiřazené odměny a před transakcí se znovu ověří
  assignee, claim stav a aktivní signer;
- prázdný mainnet stav se zobrazuje jako prázdný, nikoli jako fiktivní reward matrix.

## Doporučení před prvním NFT reward eventem

Protože zatím neexistuje žádný event ani reward NFT, je nyní nejlevnější okamžik
pro případný V2 redeploy. V2 má buď odstranit nedosažitelnou Character větev, nebo
pro ni zavést explicitní bezpečný caller; nouzové mystery dokončení má vyžadovat
pending VRF request, timeout a governance ochranu. Immediate eventy mají být
označeny jako dokončené a kontrakt nemá přijímat nevyzvednutelný POL.

Redeploy nebyl součástí tohoto auditu a nebyla odeslána žádná transakce.

## Navazující V2 hardening

V repozitáři je připravený samostatný `BiggiNftRewardsV2.sol`, aby se nezměnil
source ověřeného V1 deploymentu. V2 odstraňuje nedosažitelnou Character větev a
ownerem volený emergency random, dokončuje Manual event okamžitě, chrání VRF
request ID proti opakovanému použití, odmítá přímý POL a používá dvoukrokové
vlastnictví bez možnosti renounce. VRF router je immutable, takže owner nemůže
později nahradit Chainlink callback vlastní randomness cestou.

V2 prošla kontraktovými testy, ale není nasazená. Mainnet dry-run byl zastaven
kvůli nedostatečnému POL na deployer a owner wallet; nebyla odeslána transakce.
Přesný postup a aktuální gas report jsou v
`NFT_REWARDS_V2_DEPLOYMENT_RUNBOOK_CS.md`.
