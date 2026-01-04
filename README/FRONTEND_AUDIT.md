# Frontend Deep Audit — BIGGINFTWEB

Datum: 2026-01-04
Repo: Biggieyes/a-gamified-on-chain-NFT-lottery-with-dynamic-pricing-and-integrated-DeFi-tokenomics
Branch: feature/pinata-integration/20260104-pin
Commit SHA: (doporučeno spustit `git rev-parse HEAD` a doplnit sem)

Tento dokument sumarizuje hloubkovou analýzu celého frontendu, klient→server toků a provozních rizik.

---
1) Základní informace (scope & vstupy)

- Rozsah auditu:
  - Frontend: `src/` (React/Preact + Vite) — hlavní entry: `src/main.jsx`, `src/App.jsx`, `src/AppCore.jsx`.
  - Integrace serverless: Netlify Functions v `functions/` a klientské `src/api/*` handlery.
  - Off‑chain služby: Supabase (nonces/messages), Pinata + nft.storage (pinning), RPC providers (PublicNode/Infura), WalletConnect.

- Nasazené adresy a ABI: definované v `src/utils/addresses.js` a `src/utils/abi/index.js`. Pokud je potřeba audit kontraktů, dodat Solidity sources a compiler config.

- Požadované testovací účty a env proměnné (bez hodnot):
  - Frontend (public): `VITE_SUPABASE_ANON_KEY`, `VITE_JSON_RPC_URL`, `VITE_WC_PROJECT_ID`, `VITE_AMOY_RPC_URL`.
  - Serverless (server-only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PINATA_API_KEY`, `PINATA_SECRET_API_KEY` / `PINATA_JWT`, `NFT_STORAGE_KEY`.

- Doporučený SLA a časový rámec auditu:
  - FE + Functions: 2–4 pracovních dnů. Kontrakty + dynamické fuzzing: navíc 5–10 dní dle rozsahu.

---
2) Frontend — hlavní zjištění, bezpečnost a chyby

- Nonce / message endpoint mismatch (High):
  - `src/components/LiveChatPanel.jsx` dělá POST JSON na `/api/nonce`, zatímco serverní handler v `src/api/nonce.js` (Vercel style) očekává GET query `address`. Tato neshoda vede k chybám 4xx/5xx při odeslání zprávy.
  - Repro: spustit `npx netlify dev` a povolat endpoint (viz sekce "Reprodukce" níže).

- Secrets exposure (Critical):
  - V repozitáři byla zmínka, že `.env` obsahoval `SUPABASE_SERVICE_ROLE_KEY`. Jestli je v git historii, považujte to za únik a okamžitě rotujte klíče.

- Pinata / pin endpoints (High):
  - `PinUploader` volá `/.netlify/functions/pinFile` a server používá in-memory rate-limiter (functions/_pinataUtils.js). Není škálovatelný ani účinný proti botům.
  - Doporučení: přidat autentizaci (short-lived token) a přesunout rate-limiter do Redis / Cloudflare / API Gateway.

- Reader fallback (Medium):
  - `getReaderRO()` vrací fallback na `MAIN` pokud `ADDR.READER`/`MAIN_READER` není nakonfigurován — FE loguje výstrahu a může dostat nekompletní snapshot dat.

- Input sanitization / XSS (Medium):
  - `LiveChatPanel` ukládá a zobrazuje `content` z DB. React auto-escape je OK, ale pokud někde používáte `react-markdown` nebo raw HTML, nutná sanitizace.

- Upload validation (OK):
  - `PinUploader` kontroluje MIME a velikost klient-side; server-side také kontroluje — doplnit kontrolu magic-bytes a scanning pokud je vyžadováno.

---
3) Klient→server toky a detaily

- Nonce flow: FE získá nonce (nonce endpoint), vytvoří payload `${nonce}|${content}|${timestamp}` a EOA signMessage, pošle na `/api/message`.
  - Server musí atomicky ověřit, že nonce nevyužitý a označit ho jako used v jedné transakci.

- Pinning flow: FE volá `pinFile` (POST base64) → server pošle request do Pinata s API klíčem. Fallback na nft.storage pokud je nastaven `NFT_STORAGE_KEY`.

---
4) Tests & QA

- Aktuální testy: existuje `__tests__/pinFunctions.test.js`. Vitest je k dispozici v repo.
- Doporučení: přidat unit/integration testy pro `nonce`/`message` (mock Supabase), pin flow (mock Pinata), a reader fallback scénáře. Cílová coverage >=90% pro kritické toky.

---
5) Dependencie & supply-chain

- `package.json` obsahuje mix caret verzí; spustit `npm audit` a přidat automatické SCA (Dependabot/renovate) a CI check.

---
6) Infra & ops doporučení

- RPC: pro historické `eth_getLogs` použít archive node nebo dedikovaný indexer; FE používá batched log reader (`queryLogsBatched`) ale stále závisí na dostupnosti history.
- Secrets: nepouštět `SUPABASE_SERVICE_ROLE_KEY` do repo; používat Netlify env nebo Vault. Přidat CI secret scanning.
- Observability: přidat Sentry / Log aggregation pro FE a functions.

---
7) Reprodukce a krátké kroky

- Spuštění lokálně (dev):
```bash
npm install
npm run dev:netlify
# otevřít http://localhost:5173
```

- Nonce test (pokud je `SUPABASE_SERVICE_ROLE_KEY` nastaven v Netlify dev prostředí):
```bash
curl -X POST http://localhost:8888/.netlify/functions/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0xYourTestAddress"}'
```
Poznámka: serverní `src/api/nonce.js` může akceptovat GET; sjednotit metodiku.

---
8) Prioritizace oprav (rychlé vítězství)

1. Rotate & remove jakékoliv úniky `SUPABASE_SERVICE_ROLE_KEY` z historie (Critical).
2. Sjednotit `nonce` API (POST vs GET) a přidat jasné 4xx error body (High).
3. Zabezpečit `pinFile`/`pinJson` (auth + Redis/Cloudflare rate-limit) (High).
4. Přidat CI secret-scan a pre-commit hook (`detect-secrets`/`git-secrets`) (High).
5. Doplňte `ADDR.MAIN_READER` nebo nasadit reader kontrakt a nastavit env pro FE (Medium).

---
9) Co mohu připravit dál (volba další akce)

- Hotfix PR: `nonce` endpoint kompatibilní s POST JSON + lepší chybové body.
- CI PR: GitHub Action + pre-commit hook pro detekci tajných klíčů.
- Demo PR: Redis-based rate limiter wrapper pro `functions/pinFile.js` (příklad + README instrukce).

---
10) Dodatečné poznámky

- Tento audit je frontend‑centric. Pro kompletní smart contract audit jsou potřeba zdrojové Solidity soubory, kompilátor nastavení a deployed bytecode.

---
11) Kontakt & další kroky

Vyberte jednu z možností pro pokračování: A (nonce hotfix), B (CI secret scan), C (rate-limit demo), D (spustit lokální reprodukci). Po výběru připravím PR nebo instrukce.
