# Hluboká technická analýza — BIGGINFTWEB

Datum: 2026-01-04
Autor: automatizovaný analyzátor (Copilot)

Cíl: poskytnout podrobný přehled architektury, datových toků, externích závislostí, bezpečnostních rizik, slabých míst, návrhů na vylepšení a praktické kroky pro nasazení a debug.

---

## 1) Architektura — přehled

- Frontend: React + Vite (ESM). Kód v `src/` obsahuje komponenty, hooky a util funkce pro web3.
- Serverless API: Netlify Functions v `functions/` (esbuild bundling). Endpoints: `nonce`, `message`, `pinFile`, `pinJson`, admin functions (`functions/admin/*`).
- Blockchain interakce: `ethers.js` + provider-fallback logika (`src/utils/rpcConfig.js`, `src/utils/contract.js`). Primární síť: Polygon Amoy (testnet-like environment).
- Pinning/IPFS: Primárně Pinata (server-side pinning flow), záložně nft.storage.
- DB/Auth: Supabase — použit pro nonce + messages tabulky, další server-side čtení/zápis.
- Wallet connect: WalletConnect provider (projectId v env) + injected providers (Metamask) podporovány.

## 2) Hlavní datové toky

1. Auth / chat flow
   - Klient získá nonce z `/.netlify/functions/nonce?address=0x...`.
   - Uživatelem je podepsaná zpráva (`nonce|message|timestamp`) a odeslána na `/.netlify/functions/message`.
   - Server ověří nonce, ověří podpis pomocí `ethers.verifyMessage` (kompatibilita v5/v6), označí nonce jako použité a vloží `messages` do Supabase.

2. Pinning flow
   - Klient odešle soubor/metadat k Netlify function `pinFile`/`pinJson`.
   - Funkce volá Pinata API s API key + secret nebo PINATA_JWT. Vrací CID (ipfs://CID).
   - `pinFile` má backup upload do `nft.storage` (pokud `NFT_STORAGE_KEY` je nastaven).

3. Read-only blockchain data
   - Frontend čte snapshoty přes `reader` kontrakt (`getReaderRO`) nebo padá zpět na `MAIN` read-only kontrakt, volá `getFrontendSnapshotLiteActive()`.
   - RPC endpoints jsou řízeny `getRpcUrls()` s prioritou a fallbacky (config z `.env` nebo `PUBLIC_AMOY_RPCS`).

## 3) Externí služby / závislosti (konkrétní)

- Supabase (DB/auth): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (functions), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend publ. klíč)
- Netlify Functions (serverless)
- Pinata (pinning): `PINATA_API_KEY`, `PINATA_SECRET_API_KEY`, `PINATA_JWT`
- nft.storage (fallback): `NFT_STORAGE_KEY`
- PublicNode (Polygon Amoy): `https://polygon-amoy-bor.publicnode.com` (VITE_JSON_RPC_URL / VITE_AMOY_RPC_URL)
- Infura (fallback): `VITE_INFURA_PROJECT_ID` (kód podporuje Infura providers)
- WalletConnect: `VITE_WC_PROJECT_ID`
- Ethers (library)

## 4) Env proměnné z projektu (komplexní seznam)
(Sestaveno z `.env.local`, `.env` a grep hledání)

- VITE_JSON_RPC_URL
- VITE_AMOY_RPC_URL
- VITE_ADDITIONAL_RPC_URLS
- VITE_IGNORE_RPC_PREFERENCE
- VITE_DEFAULT_CHAIN_ID
- VITE_PREFER_INJECTED
- VITE_FORCE_RPC
- VITE_WC_PROJECT_ID
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
- VITE_INFURA_PROJECT_ID
- VITE_INFURA_NETWORK
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_CHAT_API_BASE
- SUPABASE_URL (server-only for functions)
- SUPABASE_SERVICE_ROLE_KEY (server-only, critical)
- PINATA_API_KEY
- PINATA_SECRET_API_KEY
- PINATA_JWT
- NFT_STORAGE_KEY
- ALLOWED_ORIGIN
- VITE_READER / VITE_MAIN_READER (optionally to silence reader fallback warnings)

Doporučení: rozdělit na veřejné (`NEXT_PUBLIC_*` / `VITE_*` bez citlivých klíčů) a tajné (SUPABASE_SERVICE_ROLE_KEY, PINATA_SECRET_API_KEY, NFT_STORAGE_KEY) a ty uložit výhradně v Netlify/CI secret store.

## 5) Bezpečnostní zjištění & rizika

1. Citlivé klíče v repu
   - Ve složce repo existují `.env` a `.env.local` soubory; grep našel `SUPABASE_SERVICE_ROLE_KEY` v `.env` s hodnotou `sb_publishable_...` (v tomto případě publ. publishable key, ale pozor: pokud by service role key byl commitnut, je to kritické).
   - Doporučení: okamžitě zkontrolovat, že `SUPABASE_SERVICE_ROLE_KEY` neobsahuje skutečný service role key v commitech. Pokud ano, rotovat klíč a odstranit z repo historie.

2. Rate-limiting a DoS
   - `pinFile` a `pinJson` používají jednoduchý token-bucket rate limiter implementovaný v paměti přes `createRateLimiter()` — tento limiter je instance-scoped a NEUDEŘÍ mezi více instancemi (serverless může mít paralelní instance). Tedy útočník může obejít limit pomocí paralelních spojení nebo jiného hostingu.
   - Doporučení: přidat per-IP / global rate-limiter na externí úrovni (API gateway, Cloudflare, Netlify edge functions, nebo použití Redis-backed limiteru) a/nebo požadovat omezující auth/token pro pin endpoints.

3. Pin endpoints bez auth
   - `pinFile` a `pinJson` jsou veřejné — kdokoli může pinovat přes vaše funkce (náklady, quota, zneužití). Pokud to má být veřejné, přidejte stricter quotas; pokud ne, chraňte endpoint (captcha / authenticated user / short-lived upload token).

4. CORS a ALLOWED_ORIGIN
   - ALLOWED_ORIGIN defaultuje na `*` ve funkcích — pokud chcete omezit, nastavte specifický `ALLOWED_ORIGIN` v Netlify env.

5. Nonce race condition
   - Nonce je označen jako used pomocí `update().eq('nonce', nonce).eq('used', false)` — to je správné pro většinu případů, ale existuje malá závodní podmínka, pokud existují vícenásobné paralelní requesty téměř souběžně; první update proběhne a další selže, což kód ošetřuje.

6. Logging & Error disclosure
   - Funkce většinou logují chyby na serveru (console.error) a vracejí generické error texty klientovi; dobré. Doporučení: přidat strukturované telemetry (Sentry/Logflare) pro chyby a metriky.

## 6) Kvalita kódu a robustnost

- Kód má dobré kompatibilní záplaty pro ethers v5/v6 (bezpečné getAddress/verifyMessage). To je silné stránka.
- Existují explicitní sanity checks (mime types, file size) v `pinFile`.
- Dekódování requestů podporuje multipart i base64 payloady — flexibilní.
- README_PINNING.md existuje a popisuje proces — dobrá dokumentace.

Slabé stránky
- In-memory rate limiter (funkční, ale neškálovatelný).
- Některé citlivé env hodnoty mohou být ve vývojových `.env` — riziko úniku při commitu.
- Chybí centralizované telemetry a alerting.

## 7) Návrhy na zlepšení (prioritizované)

Vysoká priorita
- Zajistit, že žádný production `SUPABASE_SERVICE_ROLE_KEY` nebo jiné sekretní klíče nejsou v repo. Pokud ano, rotovat je a odstranit z historie (git filter-repo / BFG).
- Přesunout všechny citlivé klíče do Netlify site secrets a odstranit `.env` z repo; přidat `.env*.local` do `.gitignore`.
- Nahradit in-memory rate limiter řešením odolným proti škálování (Redis, Cloudflare rate limits, API Gateway rate limiting). To zabrání DoS a zneužití pin endpoints.
- Omezit `pinFile`/`pinJson` (autorizace) — minimálně per-IP limit a/nebo vyžadovat podepsaný krátkodobý token od přihlášeného uživatele.

Střední priorita
- Přidat Sentry + metriky (latence, error-rate, pin requests, RPC failure rate).
- Přidat e2e testy pro Netlify functions (mock Pinata + Supabase) a integrační testy.
- Přidat CI check, který scanne commity na přítomnost secret patterns (pre-commit hook + CI secret-scan).

Nízka priorita
- Zvážit migraci pinning endpoints na samostatnou microservice s persistentním úložištěm/queue (pro heavy workloads).
- Implementovat caching read snapshots (Redis/memcache) pro `getFrontendSnapshotLiteActive()` aby se snížila zátěž RPC a reader kontraktu.

## 8) Debugging checklist — konkrétní kroky

1. Pro 500 z `nonce` nebo `message`
   - Ověřte v Netlify Site → Environment že `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` jsou nastavené.
   - Spusťte `npx netlify dev` a sledujte konzoli. Pro rychlý test:

```bash
curl "http://localhost:8888/.netlify/functions/nonce?address=0x1234567890abcdef1234567890abcdef12345678"
```

2. Pro 401/403 z Pinata
   - Zkontrolujte `PINATA_API_KEY` + `PINATA_SECRET_API_KEY` nebo `PINATA_JWT` v Netlify env.
   - Ověřte, že klíč má právo pinovat (Pinata UI: permissions).

3. Pro RPC problémy ("RPC history pruned")
   - Pokud potřebujete historická data, použijte archive endpoint od Infura/Alchemy nebo specializovaného poskytovatele.

## 9) Návrh integračních testů

- Unit tests pro `functions/_pinataUtils.js` (mock axios) — ověřit buildPinataHeaders a pinataRequest chování.
- Integration test pro `pinFile` a `pinJson` s nahranými fixture soubory (mock Pinata API pomocí nock nebo msw).
- End-to-end test pro chat flow: simulovat získání nonce, podepsat payload lokálně (ethers), poslat `message` a ověřit insert do Supabase (mock DB nebo test schema).

## 10) Checklist pro nasazení / provoz

- [ ] Secrets: ukládat `SUPABASE_SERVICE_ROLE_KEY`, `PINATA_SECRET_API_KEY`, `PINATA_JWT`, `NFT_STORAGE_KEY` jako Netlify environment variables.
- [ ] Rotate keys, pokud byly v historii repo.
- [ ] Limitace pin endpoints (per‑IP, per‑user quotas).
- [ ] Monitoring: Sentry / Prometheus / Logflare pro chyby.
- [ ] Alerting pro vysokou chybovost functions nebo překročení rate limitu Pinata.

## 11) Závěrečné poznámky

Projekt má solidní architekturu, dobře promyšlené fallbacky (ethers v5/v6, reader/main fallback). Hlavním rizikem jsou citlivé klíče a škálovatelný rate‑limit u pin endpoints. Prioritně doporučuji zabezpečit secrets, přidat robustní rate limiting a telemetry.

---

Pokud chceš, mohu provést následující akce dál (vyber):
- A) Vygenerovat `README.md` v kořeni s krátkým env‑checklistem a postupem pro lokální běh.
- B) Spustit lokální test `nonce` (potřebuji platný `SUPABASE_SERVICE_ROLE_KEY`).
- C) Přidat pre-commit hook + CI secret scan script.
- D) Implementovat Redis-backed rate limiter (ukázková implementace + závislosti).

Kterou z možností chceš, abych udělal teď?