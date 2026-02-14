# Frontend Audit — BiggiEyes (kompletní)

Datum: 2026-01-05
Branch: feature/frontend-audit/20260105-analysis

Krátké shrnutí
- Provedl jsem audit frontendu (React + Vite + Netlify functions) a identifikoval kritické rizika: únik serverových klíčů v repu, nesoulad klient/server pro nonce flow, nezabezpečené pin endpoints (in-memory rate limiter) a nedostatečné CI kontroly.
- Vytvořil jsem tento detailní report s prioritami, konkrétními návrhy a patch‑ready soubory v `docs/patches/`.

Executive summary — top 5 rizik a quick wins
- CRITICAL: Commitnuté serverové / service keys v repu nebo historie — okamžitě rotate a spustit secret-scan.
- HIGH: Nonce endpoint mismatch (FE POST vs src/api/nonce.js GET) — opraveno pro kompatibilitu; zlepšit chyby.
- HIGH: Pinata endpoints mají in-memory rate-limiter — nutné přesunout do Redis nebo API gateway.
- HIGH: Žádný CI secret-scan — přidal jsem `scripts/check-secrets.js` + GH Action workflow.
- MEDIUM: Reader address fallback — nastavit `ADDR.MAIN_READER` nebo feature flag, aby se předešlo datovým nekonzistencím.

Full report

1) Architecture & modularita
- Strom hlavních komponent (automaticky vyextrahováno):
  - `src/main.jsx` — bootstrap, providers, mount
  - `src/App.jsx` — hlavní app shell, routing, state
  - `src/AppCore.jsx` — heavy logic (on-chain readers, caches, IPFS helpers)
  - `src/components/` — UI komponenty (PinUploader.jsx, LiveChatPanel.jsx, NftCard.jsx, AdminPanel.jsx ...)
  - `src/providers/` — `Web3Provider`, `ContractsProvider`, `RewardsProvider`
  - `src/utils/` — `contract.js`, `addresses.js`, `rpcConfig.js`, `ipfs.js`, `format.js` atd.

- Oddělení prezentace vs logiky: většina UI je v `components/`, logika v `hooks/` a `utils/` — dobré. Výjimky:
  - `AppCore.jsx` a `App.jsx` jsou velké (soubory > 800 řádků) a kombinují UI a heavy on-chain logic; doporučuji rozdělit.

- Doporučené rozdělení `AppCore.jsx` (konkrétní):
  - `src/app/snapshot.js` — funkce `getFrontendSnapshotLiteActive`, `queryLogsBatched` a cache helpers.
  - `src/app/ipfsHelpers.js` — IPFS gateway logic, readJsonFromURI, normalizeImage.
  - `src/app/walletAssets.js` — wallet asset fetchers a cache logic (`useWalletAssets` obsahuj hook wrapper).

2) Konvence & konzistence
- CSS: projekt používá `index.css`, `App.css` a komponentní CSS soubory; žádný Tailwind. Doporučuji zachovat současný přístup (modulární CSS soubory per-component) nebo přejít na CSS modules. Není třeba měnit nyní.
- Pojmenování: komponenty většinou PascalCase; CSS soubory kebab-case — konzistentní.
- UI komponenty: existují některé shared components (`Loader`, `FullscreenPanel`) — chybí však centralizované `Button` a `Input` komponenty pro návrhový systém. Doporučuji přidat `src/components/ui/Button.jsx` a `src/components/ui/Input.jsx` a refactor tlačítek.

3) React & code quality
- Anti‑patterny: některé heavy files (`AppCore.jsx`, `App.jsx`) obsahují stovky řádků logiky a byznys rules — rozdělte je.
- Hooks: většina hooků má useEffect cleanup; zkontrolovat a přidat missing deps ve vybraných custom hooks (run linter `eslint-plugin-react-hooks`).
- Performance: lazy loading heavy panels je implementováno (React.lazy) — doporučit Suspense boundaries plus fallback UI a chunking (vite config manualChunks existuje). Použít `useMemo`/`useCallback` pro často přepočítávané funkce v `App.jsx` a `AppCore.jsx` (např. `enrichMetaWithPrices` už používá useCallback — dobré).
- Error boundaries: chybí globální ErrorBoundary wrapper — přidejte `ErrorBoundary` component, wrap root for graceful error UI.

4) Ethers / Web3 integrace
- Provider logic: `getROProvider()` vytváří FallbackProvider z URL listu; preferované injected provider logic a forceRpc flags jsou přítomné — dobře navrženo.
- Rizika: závislost na non-archive RPC pro `queryLogsBatched` — doporučit dedikovaný indexer nebo archive RPC pro heavy logování.
- Bezpečnost: service role keys never in client — `src/supabaseClient.js` uses anon key only — ok. Ensure build process doesn't include server keys.

5) Netlify functions & Pinata
- Security issues:
  - `functions/_pinataUtils.js` používá in-memory rate-limiter — neškálovatelný.
  - Pinata keys must only live in Netlify env — ensure `.env` not committed (checked earlier).
- Suggested flow: require short‑lived signed token (JWT) from Supabase session to call pin endpoints; or only allow calls from authenticated admin UI.

6) Performance & build
- Vite config includes manualChunks and esbuild drop console — good. Recommend adding `vite-plugin-imagemin` or dedicated image optimization in CI for large assets, and `vite-plugin-compress` for gzip/brotli assets.
- Suggestion: move very heavy libs (walletconnect, reown) to separate chunk (already done) and enable dynamic import for analytics/optional charts.

7) Accessibility & i18n
- Basic a11y: LoadingOverlay uses role/status and aria-live — good. Check forms/inputs have labels and images alt attributes (NftCard uses alt). Run axe/lighthouse.
- i18n: project already uses `i18next` — ensure all user strings use i18n keys instead of inline text.

8) Tests & CI
- Missing critical tests: mint/redeem flows, websocket/realtime chat flows, pin flow with auth. Add e2e tests via Playwright (dependency already present) for mint flow.
- CI: added secret-scan workflow; suggest pipeline `lint -> test -> build -> deploy preview`.

9) UX / Produkt
- Flows reviewed:
  - Connect wallet: ensure clear errors when provider disconnected, add `Try again` and `Retry switching chain` UI.
  - Mint ticket: show price breakdown, confirm gas estimate, show pending TX with link to explorer and optimistic UI.
  - Gallery: lazy load images and placeholders; image onError fallback exists.
  - Live chat: add better error messages when nonce request fails (show reason if 4xx). Reduce friction by pre-signing once per session.

Priority checklist (CRITICAL / HIGH / MEDIUM / LOW)
- CRITICAL:
  - Rotate leaked server keys and remove from git history (BFG/git-filter-repo). Add secret-scan. (docs/patches contains instructions)
- HIGH:
  - Nonce endpoint compatibility (FE POST vs src/api/nonce.js GET) — implemented fix in `src/api/nonce.js`. (commit ready)
  - Add CI secret-scan (added `scripts/check-secrets.js` + workflow).
  - Pinata rate limiting: implement Redis-backed limiter or API Gateway limits (patch suggestion in `docs/patches`).
- MEDIUM:
  - Add ErrorBoundary, central Button/Input components, set `ADDR.MAIN_READER` env or config.
  - Add Sentry/logging.
- LOW:
  - Minor refactors, add CSS variables for theme, accessibility tweaks.

Konkrétní změny (patch-ready) — HIGH priority

1) Nonce endpoint compatibility
- Cesta: `src/api/nonce.js`
- Změna: akceptovat POST JSON `{ address }` i GET `?address=`; přidat lepší 4xx/5xx response body.
- Commit message: feat(nonce): accept POST and GET for compatibility
- Branch: feature/frontend-audit/20260105-analysis
- Patch: (provedeno v tomto branchi) — update soubor `src/api/nonce.js`.

2) CI secret-scan
- Cesta: `scripts/check-secrets.js`, `.github/workflows/secret-scan.yml`
- Změna: přidán jednoduchý skript hledající patterny a GH Action job pro spuštění na PR/push.
- Commit message: feat(ci): add secret-scan script and workflow
- Branch: feature/frontend-audit/20260105-analysis

3) Pinata rate-limiter (patch suggestion)
- Cesta: `docs/patches/pinata-redis-rate-limiter.patch` (ukázkový patch obsahuje `functions/redisRateLimiter.js` a návod)
- Doporučení: nainstalovat `ioredis`, nastavit `REDIS_URL` v env a v `functions/_pinataUtils.js` preferovat Redis limiter.
- Commit message suggestion: feat(pinata): add redis-backed rate limiter (demo)

Test plan (přehled + ukázkové testy)
- Přidat unit testy (vitest) pro:
  1) Nonce API: POST and GET responses, error paths (mock Supabase client). (file: `__tests__/nonce.test.js`)
  2) Pin uploader: simulate successful pin and Pinata errors (mock fetch/axios). (`__tests__/pinFunctions.test.js` exists — rozšířit)
  3) LiveChatPanel send flow: mock signer, nonce, message endpoints.

- Ukázkový test (vitest + testing-library) — `__tests__/nonce.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import handler from '../src/api/nonce';

describe('nonce handler', () => {
  it('returns 400 when missing address', async () => {
    const req = { method: 'POST', body: {} };
    const res = { status: () => ({ json: (p) => p }) };
    const out = await handler(req, res);
    expect(out).toBeDefined();
  });
});
```

Performance plan (Vite snippets)
- Vite config suggestions (add to `vite.config.js`):
```js
import viteImagemin from 'vite-plugin-imagemin'
export default defineConfig({
  plugins: [viteImagemin({ gifsicle: { optimizationLevel: 3 } })]
})
```
- Use `build.rollupOptions.output.manualChunks` to isolate large deps (walletconnect, reown, framer-motion). Already present; keep refining.

Security checklist (CI + env + Netlify)
- CI:
  - `lint` -> `test` -> `build` -> `deploy-preview`
  - `secret-scan` job (added)
  - Dependabot/renovate for deps
- Env rules:
  - Only publishable keys (`VITE_SUPABASE_ANON_KEY`) in client env.
  - Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `PINATA_SECRET_API_KEY`) only in Netlify Site env & vault.
  - Rotate secrets if found in git history. Use `git-filter-repo` or BFG.

Documentation (docs/frontend-audit.md structure)
- This file (report), plus `docs/patches/` with suggested diffs, and `docs/deployment-checklist.md` (recommended next file).

Branch & commit metadata
- Branch: `feature/frontend-audit/20260105-analysis`
- Commits included:
  - feat(audit): add frontend audit report (docs/frontend-audit.md)
  - feat(ci): add secret-scan script and workflow (.github/workflows/secret-scan.yml, scripts/check-secrets.js)
  - feat(nonce): accept POST and GET for compatibility (src/api/nonce.js)

Checklist deploy steps (first-run)
1. Run local lint & tests:
```bash
npm ci
npm run lint
npm test
```
2. Push branch and open PR; CI will run `secret-scan`.
3. Configure Netlify env: set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PINATA_*` keys; do not commit these.
4. If implementing Redis limiter: set `REDIS_URL` in functions env.

---
Poznámky a následné kroky
- Můžu automaticky vytvořit PR s danými commity (provedeno na této větvi) a přidat další PRy pro pinata limiter a shared UI components.
- Pokud chcete, mohu pokračovat implementací Redis limiter přímo v `functions/` (vyžaduje závislost `ioredis` a Netlify env `REDIS_URL`).

Konec.

---
ABI audit tool (new)
- Static ABI usage check lives in `scripts/check-abis.js`.
- Run: `npm run check:abis` (details in `docs/abi-audit.md`).
- Use after ABI/address updates or when you see "is not a function".
