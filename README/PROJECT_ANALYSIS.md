# Analýza projektu — BIGGINFTWEB

Tento dokument shrnuje architekturu, externí služby, požadované proměnné prostředí, postupy pro lokální vývoj, běžné chybové stavy a doporučené další kroky.

**Stručný popis**
- Frontendová aplikace React/Vite pro on‑chain NFT loterii & tokenomics dashboard. Používá Netlify Functions pro server‑side operace (pinování na Pinata, nonce/auth endpoints, admin API) a komunikuje s blockchainem přes `ethers.js` a jiné RPC providery.

**Hlavní složky (vybrané)**
- `src/` – React app, komponenty, hooky, utils (web3, ipfs, services).
- `functions/` – Netlify Functions (např. `nonce.js`, `pinFile`, `pinJson`, `message`, admin handlers).
- `src/shared/utils/addresses.js` – centrální seznam adres kontraktů a env override logika.
- `src/utils/contract.js` – factory pro read/write kontrakty, `getReaderRO()` fallbacky a RPC logika.
- `src/utils/rpcConfig.js` – konfigurace RPC endpointů a preference.
- `src/utils/ipfs.js`, `src/components/PinUploader.jsx`, `docs/README_PINNING.md` – pinování na Pinata + fallbacky.

Externí služby a providery
- Supabase
  - Používá se pro ukládání nonce (auth flow) a další backend state.
  - Klíče: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (funkce), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (frontend).
- Netlify Functions
  - Server‑side API `/.netlify/functions/*`. `netlify.toml` definuje redirecty. Lokální dev přes `npx netlify dev` nebo Vite proxy.
- Pinata (IPFS)
  - Hlavní pin provider pro NFT metadata/media. Env klíče: `PINATA_API_KEY`, `PINATA_SECRET_API_KEY` nebo `PINATA_JWT`.
  - IPFS čtení využívá seznam gatewayů (`ipfs.io`, `cloudflare-ipfs.com`, `gateway.pinata.cloud`, `nftstorage.link`, atd.).
- RPC providery / blockchain
  - Primární: PublicNode `https://polygon-amoy-bor.publicnode.com` (konfig v `VITE_JSON_RPC_URL`, `VITE_AMOY_RPC_URL`).
  - Podpora Infura přes `VITE_INFURA_PROJECT_ID`. Kód volí nejlepší RPC přes `getRpcUrls()`.
  - Poznámka: "RPC history pruned" log znamená, že provider není archive node; pro plnou historii potřebujete archive RPC.
- WalletConnect
  - `VITE_WC_PROJECT_ID` a `@walletconnect/ethereum-provider` pro připojení uživatele.
- NFT.storage (volitelný záložní pin)
  - Fallback pro pinning pokud Pinata selže (dokumentováno v `README_PINNING.md`).
- Hosting / monitoring
  - Netlify hosting + esbuild bundling pro functions. `VITE_CHAT_API_BASE` ukazuje na `https://biggieyes.com/.netlify/functions`.

Požadované proměnné prostředí (checklist)
- Pro lokální dev (frontend):
  - `VITE_JSON_RPC_URL` nebo `VITE_AMOY_RPC_URL` (např. https://polygon-amoy-bor.publicnode.com)
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend anon/public keys)
  - `VITE_WC_PROJECT_ID` (WalletConnect)
  - `VITE_INFURA_PROJECT_ID` (pokud používáte Infura fallback)
  - `VITE_CHAT_API_BASE` (pokud chcete používat chat/admin přes remote functions)
- Pro Netlify Functions (server-side):
  - `SUPABASE_URL` (service URL)
  - `SUPABASE_SERVICE_ROLE_KEY` (service role key — důvěrné)
  - `PINATA_API_KEY`, `PINATA_SECRET_API_KEY` nebo `PINATA_JWT` (pro pinFile/pinJson functions)
  - `NFT_STORAGE_KEY` (pokud je používán jako fallback)

Jak spustit lokálně (dev)
1. Vytvořte `.env.local` podle projektu s hodnotami (viz níže sekce příkladů).
2. Spustit Vite dev server:

```bash
npm install
npm run dev
# nebo pro Netlify dev (pokud chcete emulovat functions):
npx netlify dev
```

3. Test Netlify function nonce (po nastavení env):

```bash
curl "http://localhost:8888/.netlify/functions/nonce?address=0x1234567890abcdef1234567890abcdef12345678"
# nebo pokud používáte Vite proxy (port 5173 dev):
curl "http://localhost:5173/.netlify/functions/nonce?address=0x..."
```
Očekávaná odpověď: JSON s polem `nonce` a `expiresInMs`.

Hlavní běžné chyby a jak je řešit
- 500 z `/.netlify/functions/nonce`:
  - Důvod: chybějící `SUPABASE_URL` nebo `SUPABASE_SERVICE_ROLE_KEY` v prostředí functions.
  - Řešení: nastavit tyto proměnné v Netlify Site settings → Build & deploy → Environment variables, nebo lokálně pro `netlify dev` v `.env`.
- `getReaderRO: reader address not configured; falling back to MAIN` (console warn):
  - Důvod: v `src/shared/utils/addresses.js` je `ADDR.READER` nebo `ADDR.MAIN_READER` prázdné.
  - Řešení: nastavit správnou adresu reader kontraktu v `ADDR` (přímo v souboru nebo pomocí env `VITE_READER` / `VITE_MAIN_READER`). Varování je informativní (kód použije `MAIN`), ale některé reader‑specific funkce mohou chybovat.
- RPC historie oříznutá: pro deep historical queries použijte archive RPC poskytovatele.

Důležité soubory pro troubleshooting
- `functions/nonce.js` — Netlify function generující nonce (supabase insert). Pokud vrací 500, zkontrolovat error log v Netlify nebo v konzoli `netlify dev`.
- `src/utils/contract.js` + `src/shared/utils/addresses.js` — contract factories, reader fallbacky a adresy.
- `src/components/PinUploader.jsx`, `functions/pinFile`, `functions/pinJson` a `docs/README_PINNING.md` — pinning flow.
- `src/utils/rpcConfig.js` — výběr RPC endpointů a relevantní env klíče.

Bezpečnostní upozornění
- Nikdy nesdílejte `SUPABASE_SERVICE_ROLE_KEY` veřejně. V Netlify jej uložte v prostředí (Site settings) — nesmí být commitován do repo.
- Pinata secret/API keys a NFT.storage key držte také v env proměnných.

Doporučené další kroky / vylepšení
- Přidat validaci a čitelnější logging do funkcí — při 500 vracejte detailnější chybovou zprávu do serverových logů (ne do klienta).
- Dokumentovat kompletní env checklist v repo root README (mohu ho vygenerovat automaticky).
- Zvážit možnost přepnutí Netlify Functions na bezpečnější tajné úložiště a rotation policy pro klíče.
- Pokud potřebujete full‑history on‑chain data, nasadit archive RPC (Alchemy/Infura/Podmíněné řešení u poskytovatele s historií).

Příklady `.env.local` (lokální výchozí) — NEKOMITOVAT DO VCS

```
# RPC
VITE_JSON_RPC_URL=https://polygon-amoy-bor.publicnode.com
VITE_AMOY_RPC_URL=https://polygon-amoy-bor.publicnode.com

# Supabase (frontend safe keys)
VITE_SUPABASE_URL=https://kjwbcfevadkexohspuey.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_x86muUVvzlG4ECeD5kLDyA_LuwFtnsT

# WalletConnect
VITE_WC_PROJECT_ID=d018c04da68f3dba4c604d056be6d716

# Chat / backend base
VITE_CHAT_API_BASE=https://biggieyes.com/.netlify/functions

# Server-side (Netlify functions) — store these in Netlify env, not in public .env
# SUPABASE_URL=https://kjwbcfevadkexohspuey.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
# PINATA_API_KEY=<key>
# PINATA_SECRET_API_KEY=<secret>
# PINATA_JWT=<jwt optional>
# NFT_STORAGE_KEY=<optional fallback>
```

Kontakt a další pomoc
- Pokud chceš, mohu: (A) vygenerovat root `README.md` s kratším env‑checklistem, (B) otestovat `nonce` funkci lokálně (potřebuji service role key) nebo (C) zapsat `ADDR.READER` do `src/shared/utils/addresses.js` pokud poskytneš reader address.

---
Vytvořeno: krátká projektová analýza; pokud chceš, doplním specifika (např. přesný seznam všech env proměnných s popisem, diagram závislostí nebo bezpečnostní postupy).