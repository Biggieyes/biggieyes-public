# Chainlink Hackathon Demo Script (CZ)

Tento dokument je pripraveny jako teleprompter + shotlist.
Pouzij ho pro 3-5 minutove demo video.

## 1) Doporuceny format videa

- Delka: 3:30 az 4:30
- Styl: obrazovka + tvuj voiceover
- Rozliseni: 1920x1080, 30 fps
- Strih: bez slozitych efektu, hlavne citelnost a jasne kroky

---

## 2) Kratky run-of-show (casovy plan)

1. `00:00-00:20` Hook: problem + co projekt resi  
2. `00:20-00:50` Architektura: kde je Chainlink (VRF + workflow)  
3. `00:50-02:10` Live flow: mint/redeem -> VRF pending -> fulfillment  
4. `02:10-03:10` VRF Panel: Requests, History, Post-Redeem, CRE/CRR Engine, Proof Log  
5. `03:10-03:50` Transparentnost + explorer dukazy  
6. `03:50-04:20` Zaver: proc je to relevantni pro Chainlink hackathon

---

## 3) Presny mluveny skript (co rikat)

## `00:00-00:20` Intro

```
Ahoj, jsem [Tvoje jmeno] a tohle je BiggiEyes.
Resime fair on-chain NFT assignment, kde uzivatel po redeemu dostane vysledek pouze z verifikovatelne nahody.
Klicova cast je Chainlink VRF a auditovatelny post-redeem workflow.
```

## `00:20-00:50` Chainlink cast

```
V tomto flow uzivatel nejdriv redeemne ticket.
Kontrakt vytvori VRF request, Chainlink VRF coordinator doruci callback
a my pak ulozime a zobrazime request, tx hash, random words a proof konzistenci.
Frontend to sklada do VRF panelu a zobrazuje cely audit trail.
```

## `00:50-02:10` Live demo flow

```
Ted ukazu realny uzivatelsky flow.
Jdu do Gallery a vyberu ticket nebo NFT stav po redeemu.
Po redeemu je videt stav VRF pending.
Po fulfillmentu se request prepne na fulfilled a mame navazany tx hash i random words.
Tohle je presne bod, kde je videt, ze vysledek neni lokalni random, ale verifikovatelny on-chain callback.
```

## `02:10-03:10` VRF panel + CRR/CRE segment

```
Ted oteviram VRF Dashboard.
V Requests vidim posledni request, status a posledni result.
V History vidim kompletni historii requestu s confirmations.
Post-Redeem ukazuje orchestration kroky od requestu po proof sync.

A tohle je CRE, pripadne CRR sekce - read-only engine signaly.
Slouzi jako kontrolni vrstva nad stavy Reserve, Buyback a DRIP navazanymi na VRF data.
Nespousti transakce, je to auditni monitor, ktery jasne oddeluje read-path od write-path.

Nakonec Proof Log:
kontroluje konzistenci requestId, tx hash a random words.
Jakakoli nekonzistence je okamzite videt.
```

## `03:10-03:50` Dukazy

```
Kazdy klicovy krok jde otevrit v exploreru:
request transakce, fulfillment transakce i navazane eventy.
To znamena, ze porota vidi reprodukovatelny dukaz mimo frontend.
```

## `03:50-04:20` Zaver

```
Shrnuti:
Chainlink VRF je jadro fair assignmentu,
VRF panel je auditni vrstva s dokazatelnym lifecyclem
a CRE/CRR monitoring drzi transparentni post-redeem stav.
Diky.
```

---

## 4) Shotlist (co presne ukazat na obrazovce)

1. Homepage / dashboard overview
- Kratke najeti na sekce, at je videt kontext produktu.

2. Redeem flow
- Ukaz ticket -> redeem -> stav "VRF pending".

3. VRF Dashboard -> `Requests`
- Last Request ID, Status, Random words, Fulfilled Tx.

4. VRF Dashboard -> `History`
- Tabulka requestu, confirmations, tx linky.

5. VRF Dashboard -> `Post-Redeem`
- Pipeline kroky a jejich stav.

6. VRF Dashboard -> `CRE Engine` (CRR cast)
- Read-only signaly + jasne rict "monitor, ne write action".

7. VRF Dashboard -> `Proof Log`
- Kontrola konzistence a audit sloupec.

8. Explorer
- Otevri aspon 1 request tx a 1 fulfill tx.

---

## 5) Co zduraznit pro porotu (1 veta kazdy bod)

- Fairness: nahoda jde z Chainlink VRF, ne z lokalni logiky.
- Traceability: request -> callback -> proof je videt v UI i exploreru.
- Reliability: panel ma samostatne read-only kontroly (CRE/CRR monitoring).
- UX: uzivatel rozumi stavu okamzite (pending/fulfilled/proof).

---

## 6) Plan B kdyz live tx nestihne potvrdit

Pouzij pre-pripraveny wallet stav s uz existujicimi requesty.
V komentarich rekni:

```
Pro casovy limit videa prepinam na pripraveny wallet snapshot,
kde je videt stejny lifecycle na realnych on-chain datech.
```

To je pro hackathon demo naprosto v poradku.

