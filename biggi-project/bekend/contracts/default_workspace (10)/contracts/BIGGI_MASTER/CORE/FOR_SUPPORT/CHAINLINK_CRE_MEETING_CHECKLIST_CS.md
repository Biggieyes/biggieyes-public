# Chainlink CRE Meeting Checklist

Datum: 2026-08-19

## Cil schuzky

Potvrdit cestu k CRE Early Access deployi pro BIGGI tokenomics workflow na Polygon mainnetu a potvrdit presne hodnoty, ktere se musi zapsat do `BiggiCREAutomationReceiver`.

## Stav

- MNDA: podepsana, neni ulozena v gitu.
- Organizace: `org_d09xtsv4XAgGOXMi`
- Deploy access: `Not enabled`
- Produkcni workflow: zatim zadny.
- Receiver: nasazeny, source verified, paused.
- PolygonScan: 58/58 kontraktu source verified.

## Co ukazat Chainlinku

- `CHAINLINK_CRE_SUPPORT_BRIEF.md`
- `CHAINLINK_CRE_TECHNICAL_SPEC.md`
- `EVIDENCE/cre-preflight-polygon.json`
- `EVIDENCE/launch-readiness-polygon.json`
- `EVIDENCE/deployment-manifest-polygon.json`

## Otazky

1. Proc je deploy access stale `Not enabled` a co presne chybi k povoleni?
2. Je pro organizaci povolen Polygon mainnet EVM write?
3. Jak ziskat produkcni workflow ID a workflow owner po deployi?
4. Jaky presny metadata layout posila CRE do `onReport(bytes metadata, bytes report)`?
5. Je `deployment-registry: private` spravna volba pro tento produkcni workflow?
6. Je bezpecne posilat vice reportu z jednoho cron ticku, pokud vice vetvi potrebuje akci?
7. Jakou kombinaci receiver ochran doporucuji: workflow ID, owner, metadata hash allowlist?
8. Jak nastavit billing/limity pro 5min cron a max 5 zapisovych vetvi?

## Co nedelat pred potvrzenim

- Neunpauseovat CRE receiver.
- Neotevirat allowlist target/selector paru.
- Neaktivovat paralelni legacy liquidity automation.
- Neposilat do gitu MNDA, private key, API keys ani `.env`.
