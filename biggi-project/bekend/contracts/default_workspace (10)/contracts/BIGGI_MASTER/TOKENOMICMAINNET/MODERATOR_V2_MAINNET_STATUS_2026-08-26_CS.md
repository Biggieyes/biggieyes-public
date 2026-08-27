# Moderator V2 - Polygon mainnet status

Datum: 2026-08-26
Sit: Polygon PoS mainnet (`chainId = 137`)

## Nasazene a overene kontrakty

| Klic | Kontrakt | Adresa | Deploy blok | Stav |
| --- | --- | --- | ---: | --- |
| `MODERATOR_CENTER_V2` | `ModeratorCenterV2` | `0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8` | `92715374` | verified, paused |
| `DRIP_LM_V2` | `BiggiDripLMToModeratorV2` | `0x1d2B3d3224dE553ff3138caeA45d162c62305d1A` | `92716040` | verified, paused |

PolygonScan:

- `https://polygonscan.com/address/0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8#code`
- `https://polygonscan.com/address/0x1d2B3d3224dE553ff3138caeA45d162c62305d1A#code`

Kanonicky strojovy deployment report:

```text
biggi-project/bekend/reports/moderator-v2-deployment-polygon.json
```

## Overeny stav po deployi

- owner obou V2 kontraktu: `0x402CE2Ff958ab47eDaFC42296d2682CC8F9D92b2`
- oba kontrakty jsou `paused=true`
- `BiggiDripLMToModeratorV2.wiringReady()=true`
- `ModeratorCenterV2.milestoneConfigLocked()=true`
- allocator Moderatoru je novy `DRIP_LM_V2`
- vsech pet chapteru je registrovano
- placene rozsahy jsou `51-550`, `601-1100`, `1151-1650`, `1701-2200` a `2251-2750`
- zachovane vahy: leader `100`, moderator `30`, ticket boost `10`
- zachovane DRIP parametry: sell `70 %`, Reserve/Moderator `5000/5000` bps,
  slippage `200` bps a deadline `600 s`
- zustatek obou V2 kontraktu je `0 POL`
- `operationallyReady=false`, protoze moderatorske sloty zatim nejsou nakonfigurovane

## Co nasazeni nezmenilo

- V2 nebyla aktivovana.
- Zive kontrakty nebyly prepojeny.
- `DRIP_DISTRIBUTOR`, `BUYBACK_AGENT` a dalsi produkcni kontrakty stale pouzivaji
  puvodni V1 vetev.
- Puvodni `ModeratorCenter` a `DRIP_LM` zustavaji v adresnich manifestech jako
  aktualni legacy adresy az do samostatneho aktivacniho kroku.

## Zbyvajici kroky pred aktivaci

1. Nakonfigurovat aktivni sloty: payout, referral hash/kod a prave jeden leader.
2. Overit `ModeratorCenterV2.operationallyReady()=true` pri stale paused kontraktu.
3. Dokoncit liquidity a globalni production launch gate.
4. Spustit pouze auditovany aktivacni skript, ktery prepoji zivou vetev.
5. Overit udalosti, adresy, ownership, paused stavy a nulove pending balances.

Aktivace nesmi byt provedena pouze na zaklade tohoto deploymentu.

## Test evidence

- cilene V2 adversarial testy: `11 passing`
- cely `BIGGI_MASTER` suite: `102 passing`
- fork deployment rehearsal: uspesny
- mainnet post-deploy read audit: uspesny

Toto neni externi audit ani formalni verifikace.
