# BIGGI initial liquidity runbook

Stav overen 2026-08-25. Tento postup je urceny pro prvni BIGGI/WPOL likviditu na Polygon mainnetu.

## Finalni parametry

| Hodnota | Nastaveni |
| --- | --- |
| BIGGI | `8 000 000` |
| POL | `5 000` |
| Pocatecni cena | `0.000625 POL / BIGGI` |
| Obraceny kurz | `1 600 BIGGI / POL` |
| Slippage limit | `50 bps` (`0.5 %`) |
| Deadline | `900 s` |
| Zdroj BIGGI | `BiggiReserveV4` |
| LP recipient | `BiggiLiquidityVault` |
| Pair | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |
| Router | `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` |

## Bezpecnostni model

- Bez explicitniho `EXECUTE_INITIAL_LIQUIDITY=1` se neposle zadna transakce.
- Execution navic vyzaduje `I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE=1`.
- Pair musi mit nulove reserves i nulovy LP total supply.
- Factory, router WETH, pair tokeny, token owner, Reserve, LiquidityManager a Vault musi odpovidat manifestu.
- Router dostane pouze presny allowance a zbytek allowance se po pokusu zrusi.
- LP tokeny se mintuji primo do LiquidityVaultu.

## Overeni bez mainnet zapisu

```powershell
cd C:\dev\BIGGINFTWEB\biggi-project\bekend
npm.cmd run prepare:initial-liquidity:polygon
npm.cmd run rehearse:initial-liquidity:fork
```

Prvni prikaz pouze cte Polygon. Druhy provede celou sekvenci na lokalnim mainnet forku s testovacim POL zustatkem.

Aktualni dry-run je blokovan pouze chybejicim zustatkem na owner wallet. Zjisteny zustatek je `1.824440220558510091 POL`; potreba je `5000 POL + 1 POL post-seed sync + gas`. Fork rehearsal z 2026-08-25 prosel:

- pair zacal prazdny;
- 8 milionu BIGGI bylo odecteno z Reserve, nikoli z marketing alokace;
- LP bylo mintnuto primo do Vaultu;
- allowance routeru bylo vynulovano;
- nasledny LM pairing `1 POL + 1 600 BIGGI` synchronizoval `accounted == real LP`.

## Finalni execution

Execution provest tesne pred public launchem. Wallet musi mit vice nez `5 001 POL`; rozdil proti aktualnimu zustatku je `4 999.175559779441489909 POL` plus gas rezerva.

```powershell
$env:LIQUIDITY_OWNER="0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2"
$env:EXECUTE_INITIAL_LIQUIDITY="1"
$env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE="1"
$env:LIQ_DEADLINE_SEC="900"
npm.cmd run prepare:initial-liquidity:polygon
Remove-Item Env:LIQUIDITY_OWNER
Remove-Item Env:EXECUTE_INITIAL_LIQUIDITY
Remove-Item Env:I_UNDERSTAND_INITIAL_LIQUIDITY_IS_IRREVERSIBLE
Remove-Item Env:LIQ_DEADLINE_SEC
```

Pokud probehne Reserve transfer, ale pozdejsi approve nebo add-liquidity krok selze, prikaz nespoustet znovu se `TRANSFER_FROM_RESERVE=1`. Nejdrive overit wallet BIGGI balance a pripravit recovery plan, aby se z Reserve nepresunulo dalsich 8 milionu.

## Bezprostredne po seed transakci

1. Overit reserves `8 000 000 BIGGI / 5 000 WPOL` a LP balance Vaultu.
2. Poslat `1 POL` do Reserve a nastavit `1 600 BIGGI` do DEX refill bucketu.
3. Jako owner zavolat `LiquidityManager.executePairing(1 POL)`.
4. Overit Vault snapshot `accounted == realBal`.
5. Snapshotovat SupplyController a DexReserveGuard baseline.
6. Teprve potom pokracovat v CRE wiring a finalni aktivaci.

Jakakoli odchylka pair reserves, adres, ownera nebo Vault ucetnictvi znamena `NO-GO`.
