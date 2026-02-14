# ZDROJE PRAVDY (Sources of Truth) - BiggiNFT Web

Tento dokument identifikuje všechny autoritativní zdroje konfigurace a dat v projektu BiggiNFT Web.

## 📋 Přehled

Projekt obsahuje několik klíčových zdrojů pravdy, které definují kritická data pro běh aplikace.

---

## 🔗 1. ADRESY SMART KONTRAKTŮ

### Primární zdroj: `src/shared/utils/addresses.js`

**Popis**: Hlavní autoritativní zdroj všech adres smart kontraktů na Polygon Amoy síti (Chain ID: 80002).

**Poznámka**: Konkrétní adresy se v dokumentaci neduplikují. Vždy čerpejte z
`src/shared/utils/addresses.js` (env-aware, jediný zdroj pravdy).

**Rychlý výpis adres**:
```bash
node -e "import('./src/shared/utils/addresses.js').then(m => console.log(m.ADDR))"
```

**Hierarchie importů**:
```
src/shared/utils/addresses.js (ZDROJOVÝ SOUBOR)
    ↓
src/config/addresses/amoy.js (re-export)
    ↓
src/config/addresses/index.js (agregace sítí)
    ↓
src/config/addresses.js (legacy re-export, bez logiky)
    ↓
src/addresses.js (entry point)
```

**Důležité poznámky**:
- ✅ Podporuje environment variable overrides (VITE_MAIN, VITE_BIGGI, atd.)
- ✅ Jediný zdroj pravdy - NIKDY neduplikovat adresy jinde v kódu
- ✅ Obsahuje aliasy pro zpětnou kompatibilitu
- ✅ Backend zrcadlo: `biggi-project/bekend/addresses.json` musí být v syncu (stejné hodnoty + aliasy)
- ✅ Canonical MCD reader: `MCD_READER_V2 = 0x1A1521465B4828726e2025C6f8351587A15903Cb`
- ✅ `src/shared/addresses.js` je pouze re-export (bez vlastních adres)
- ✅ Rewards readers (keys v addresses.js): `TOKEN_REWARDS_READER`, `NFT_REWARDS_READER`

---

## 📜 2. ABI DEFINICE (Application Binary Interface)

### Primární zdroj: `src/config/abi/index.js`

**Popis**: Centralizovaný export všech ABI souborů smart kontraktů.

**Poznámka**: Kompletní seznam ABI je veden v `ABI_INVENTORY.md`. V kódu se ABI
importují výhradně z `src/config/abi/index.js`.

**Umístění souborů**: `src/config/abi/*.json`

**Nově přidané ABI (readery)**:
- `BiggiTokenRewardsReader`
- `BiggiNftRewardsReader`

---

## 🗺️ 3. KONTRAKTOVÝ REGISTR

### Primární zdroj: `src/config/contracts/index.js`

**Popis**: Mapuje názvy kontraktů na jejich addressKey a abiName. Poskytuje funkci `getContractMeta()` pro získání kompletních metadat kontraktu.

**Struktura**:
```javascript
export const CONTRACTS = {
  MAIN: { addressKey: "MAIN", abiName: "BiggiMain" },
  MAIN2: { addressKey: "MAIN2", abiName: "BiggiMain2" },
  BIGGI: { addressKey: "BIGGI", abiName: "BiggiToken" },
  DISTRIBUTOR: { addressKey: "DISTRIBUTOR", abiName: "BiggiMultiCollectionDistributor" },
  // ... atd.
};
```

**API**:
```javascript
getContractMeta(chainKeyOrId, contractKey)
// Vrací: { chainKey, key, addressKey, abiName, address, abi }
```

---

## 🌐 4. KONFIGURACE SÍTÍ

### Primární zdroje:
- `src/config/chains.js` — chain metadata (chainId, hex, name, explorer, currency)
- `src/config/addresses/index.js` — mapování `chainKey → adresy`
- `src/shared/utils/rpcConfig.js` — výběr RPC + export `AMOY` (bere metadata z `chains.js`)

**DEFAULT_CHAIN_ID**: 80002 (Polygon Amoy) — definováno v `src/shared/utils/addresses.js`

**API funkce**:
- `resolveChainKey(chainKeyOrId)` - převádí chain ID na klíč (addresses)
- `getAddresses(chainKeyOrId)` - získá adresy pro danou síť (addresses)
- `chainNameFor(chainId)` / `explorerBaseFor(chainId)` - chain metadata (chains)

---

## 🗄️ 5. DATABÁZOVÁ SCHÉMATA

### Primární zdroj: `sql/migration_init.sql`

**Popis**: PostgreSQL/Supabase schéma pro live chat funkcionalitu.

**Tabulky**:

```sql
public.messages           // Chat zprávy
public.nonces             // Wallet authentication nonces
public.rules              // Chat pravidla
public.chat_config        // Konfigurace chatu (owner address)
public.moderation_log     // Moderační akce
```

**Row Level Security**: ✅ Povoleno pro všechny tabulky

**Výchozí vlastník chatu**: `0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0`

---

## 🔌 6. API ENDPOINTY (Netlify Functions)

### Primární zdroj: `netlify.toml`

**Serverless funkce**:

```
/api/nonce              → /.netlify/functions/nonce
/api/message            → /.netlify/functions/message
/api/admin/editMessage  → /.netlify/functions/admin-editMessage
/api/admin/updateRules  → /.netlify/functions/admin-updateRules
/functions/*            → /.netlify/functions/:splat
```

**Pinning funkce** (Pinata/IPFS):
- `functions/pinFile.js` - Nahrává soubory na IPFS
- `functions/pinJson.js` - Nahrává JSON metadata na IPFS
- `functions/_pinataUtils.js` - Utility pro Pinata API

**Bezpečnost**:
- ⚠️ API klíče jsou uloženy POUZE na serveru (environment variables)
- ⚠️ NIKDY nevystavovat Pinata/NFT.Storage klíče na frontendu

---

## 🔐 7. ENVIRONMENT PROMĚNNÉ

### Doporučené environment proměnné:

```bash
# Blockchain RPC
VITE_RPC_URL_AMOY="https://rpc-amoy.polygon.technology"

# Supabase (Chat)
VITE_SUPABASE_URL="..."
VITE_SUPABASE_ANON_KEY="..."

# Pinata (pouze server-side)
PINATA_API_KEY="..."
PINATA_API_SECRET="..."
PINATA_JWT="..."

# NFT.Storage (pouze server-side)
NFT_STORAGE_API_KEY="..."

# Redis (Rate limiting - volitelné)
REDIS_URL="redis://..."

# Monitoring (volitelné)
SENTRY_DSN="..."

# Contract overrides (volitelné)
VITE_MAIN="0x..."
VITE_BIGGI="0x..."
```

**⚠️ BEZPEČNOSTNÍ UPOZORNĚNÍ**:
- Prefixované `VITE_` jsou přístupné na frontendu
- Neprefixované proměnné jsou přístupné POUZE v serverless funkcích
- NIKDY neukládat privátní klíče do .env souborů

---

## 📦 8. BUILD KONFIGURACE

### Primární zdroj: `package.json`

**Hlavní závislosti**:
- React 19.2.3
- ethers.js 6.16.0
- @supabase/supabase-js 2.89.0
- framer-motion 12.24.0

**Build nástroje**:
- Vite 7.3.0
- Vitest 4.0.16
- ESLint 9.39.2

**Skripty**:
```json
"dev": "vite",
"build": "vite build",
"test": "vitest run",
"check:abis": "node scripts/check-abis.js"
```

---

## 📝 9. DOKUMENTACE

**Klíčové dokumenty**:
- `ABI_INVENTORY.md` - Kompletní seznam ABI kontraktů
- `README_SECRET_ROTATION.md` - Bezpečnostní postupy
- `REFACTORING_SUMMARY.md` - Historie refaktoringu
- `docs/README_PINNING.md` - Dokumentace IPFS pinování
- `docs/system-spec.md` - System spec + invariants + threat model + ops checklist
- `docs/testing-strategy.md` - Integration/fork/fuzz test plan
- `docs/abi-audit.md` - Audit ABI
- `docs/frontend-audit.md` - Audit frontendu

---

## 🎯 SUMMARY - Hierarchie zdrojů pravdy

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SMART CONTRACT ADDRESSES                                 │
│    src/shared/utils/addresses.js                            │
│    ↓ Single Source of Truth pro všechny adresy kontraktů   │
├─────────────────────────────────────────────────────────────┤
│ 2. ABI DEFINITIONS                                           │
│    src/config/abi/index.js                                  │
│    ↓ Exportuje všechny ABI JSON soubory                    │
├─────────────────────────────────────────────────────────────┤
│ 3. CONTRACT REGISTRY                                         │
│    src/config/contracts/index.js                            │
│    ↓ Mapuje contractKey → address + ABI                    │
├─────────────────────────────────────────────────────────────┤
│ 4. NETWORK CONFIG                                            │
│    src/config/chains.js + src/config/addresses/index.js     │
│    ↓ chain metadata + adresy pro sítě                       │
├─────────────────────────────────────────────────────────────┤
│ 5. DATABASE SCHEMA                                           │
│    sql/migration_init.sql                                   │
│    ↓ Supabase chat tables + RLS                            │
├─────────────────────────────────────────────────────────────┤
│ 6. API ENDPOINTS                                             │
│    netlify.toml                                             │
│    ↓ Serverless functions routing                           │
├─────────────────────────────────────────────────────────────┤
│ 7. ENVIRONMENT CONFIG                                        │
│    .env (gitignored)                                        │
│    ↓ RPC URLs, API keys, feature flags                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ BEST PRACTICES

### Při práci se zdroji pravdy:

1. **NIKDY neduplikovat adresy kontraktů** - vždy importovat z `src/shared/utils/addresses.js`

2. **NIKDY neměnit ABI ručně** - vždy generovat ze smart kontraktů pomocí:
   ```bash
   npm run check:abis
   ```

3. **Environment overrides** - použít VITE_ prefix pro override adres:
   ```bash
   VITE_MAIN=0x... npm run dev
   ```

4. **Database migrace** - vždy aktualizovat `sql/migration_init.sql` při změnách schématu

5. **API bezpečnost** - citlivé klíče POUZE v serverless funkcích, ne na frontendu

6. **Dokumentace** - při změnách zdrojů pravdy aktualizovat tento dokument

---

## 🔍 VERIFIKACE

Pro ověření integrity zdrojů pravdy spusťte:

```bash
# Ověření ABI
npm run check:abis

# Ověření adres
node -e "import('./src/shared/utils/addresses.js').then(m => console.log(m.ADDR))"

# Build test
npm run build
```

---

**Poslední aktualizace**: 31.1.2026
**Verze projektu**: 0.0.0
**Chain ID**: 80002 (Polygon Amoy)
