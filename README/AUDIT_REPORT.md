# Audit Report — BIGGINFTWEB

Datum: 2026-01-04
Repo: Biggieyes/a-gamified-on-chain-NFT-lottery-with-dynamic-pricing-and-integrated-DeFi-tokenomics
Branch: feature/pinata-integration/20260104-pin
Default branch: main

POZNÁMKA: Commit hash nebyl předán. Doporučuji uvést přesný commit SHA (příkaz `git rev-parse HEAD`) pro audit reproducibility.

--------------------------------------------------------------------------------
1) Základní informace (scope & vstupy)

- Rozsah auditu:
  - Frontend: React + Vite aplikace v `src/`.
  - Backend (serverless): Netlify Functions v `functions/` (`nonce`, `message`, `pinFile`, `pinJson`, `admin/*`, `_pinataUtils.js`).
  - Off‑chain služby: Supabase (DB/auth), Pinata (IPFS pinning), nft.storage (fallback), PublicNode/Infura (RPC), WalletConnect (wallet auth).
  - Smart contracts: frontend čte a zapisuje přes kontrakty definované v `src/shared/utils/addresses.js` a ABI v `src/config/abi`. (Audit kontraktů samotných vyžaduje repozitář se Solidity kódem; v tomto auditu kontroluji FE/ops + adresy/rozhraní a bezpečnost integrací.)

- Síť(y): Polygon Amoy (chainId 80002) primárně; RPC fallbacky podporují Infura/other providers.

- Relevantní repozitáře / commity / nasazené adresy:
  - Tento repo: Biggieyes/a-gamified-on-chain-NFT-lottery-with-dynamic-pricing-and-integrated-DeFi-tokenomics (branch viz výše).
  - Nasazené adresy (z `src/shared/utils/addresses.js` / `ALLOWED_ADDRS`) — vybrané:
    - MAIN / COLLECTION_VRF: 0x304C08cdC4511649D97469E0F7A1f71270BC91E6
    - MAIN2 / COLLECTION_PUBLIC: 0x1703EA074C72F550ecacb955ECE1aac1c5100Be5
    - VRF_ROUTER: 0x3a20072256B686C8B4E96886Df925f3d0934aAD0
    - BIGGI (token): 0x45C6cC46dcBf54E97bDf89e9F739F29Ce4ED0dB7
    - DISTRIBUTOR: 0xF29D65834e344bd229311686FccA4AAf451612e5
    - RESERVE: 0xbF694e346D69acCEb578eA7C52642C521178e385
    - TREASURY: 0xA1C5b749EDb98B5000DCaf30d4244AbB099BCEFb
    - BUYBACK_AGENT: 0xCF3D72254b913e7a1311Be3Ec11a21Bd298e2728
    - TOKEN_REWARDS: 0xbFAE50A44b1C6559750e1EBCb03B878C1828945D
    - NFT_REWARDS: 0x5952FB309cbC8919a554702A1Fb937F2e8943F39
    - BIGGI_TOKENOMICS_READER: 0xC044eBBc9E1303f1C12a5C47e1137C3EFC57F92a
  - Poznámka: `ADDR.READER` a některé reader adresy jsou v `addresses.js` prázdné — frontend pak fallbackuje na `MAIN` a loguje varování.

- Požadované testovací účty, data a env proměnné (bez citlivých klíčů):
  - Testovací peněženka (wallet) s ETH/AMOY testnet prostředky.
  - Testovací Supabase publikovatelný klíč: `VITE_SUPABASE_ANON_KEY` (frontend) — již nastaven v `.env.local` jako publishable key.
  - Pro serverless funkce (test): `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` (NEVYSTAVOVAT/NEKOMITOVAT).
  - Pinata: `PINATA_API_KEY` (public), `PINATA_SECRET_API_KEY` (secret) nebo `PINATA_JWT` (doporučeno) — použít testovací Pinata účet.
  - WalletConnect Project ID: `VITE_WC_PROJECT_ID`.
  - RPC URL: `VITE_JSON_RPC_URL` nebo `VITE_AMOY_RPC_URL` (např. https://polygon-amoy-bor.publicnode.com).

- Požadované SLA a časový rámec auditu (příklad návrhu):
  - Scope 1 (FE + serverless): 3 pracovní dny.
  - Scope 2 (kontrakty — statická/dynamická): 5–10 pracovních dnů dle velikosti Solidity repozitáře.
  - SLA pro kritické opravy: 24–72 hodin po identifikaci kritické chyby.

--------------------------------------------------------------------------------
2) Smart-contract security (shrnutí auditního procesu / doporučení)

Poznámka: Tento repozitář obsahuje pouze frontend tooling a ABI; pro plnohodnotný SC audit je třeba dodat Solidity repozitář (sources + compiler settings + deployed bytecode). Níže popisuji metodiku a zjištění vycházející z dostupných ABI/adres a běžných patternů v tomto projektu.

- Statická analýza (Slither, MythX):
  - Doporučené kroky: spustit Slither/ MythX proti solidity sources; kontrolovat:
    - reentrancy (unprotected external calls), unsafe delegatecall, tx.origin usage, insecure randomness, unchecked-send patterns.
    - nevyužité veřejné funkce, funkce bez access control.
    - storage layout mismatch (pokud používáte proxy pattern) — zkontrolovat inicializery a storage gaps.
  - Zjištění (na FE úrovni): front-end očekává reader kontrakt; pokud reader není nasazen, FE fallbackuje na `MAIN` — je potřeba ověřit, že reader měl být nasazen a že provozní kontrakty odpovídají očekávanému ABI.

- Dynamické testy / fuzzing:
  - Doporučit: Foundry fuzz tests + Echidna pro invariants (např. celková supply <= cap, žádné neočekávané minty) a Manticore pro symbolical execution pokud je dostupný bytecode.
  - Testovat invariants: no negative balances, totalSupply monotonicity (kde relevantní), per-wallet caps.

- Unit/integration test coverage:
  - Doporučeno: >=90% pro kritické moduly (token, vaults, distribution, buyback).
  - Pokud coverage nižší, napsat další tests pomocí Hardhat/Foundry.

- Role & access control review:
  - Zkontrolovat, jaké funkce mají onlyOwner / role-based checks.
  - Doporučeno: administrativní akce (setRates, mintTo, emergencyDrain) vázat na multisig + timelock.

- Upgradability:
  - Pokud je použit proxy (Transparent/UUPS), audit storage layout a initializer pattern.
  - Doporučení: explicitní storage gaps, inicializer modifiers, upgrade delay, governance multisig.

- Pausable / emergency stop:
  - Zkontrolovat existenci `pause`/`unpause` a testy pro emergency mode.

- External calls & try/catch:
  - Použít Checks-Effects-Interactions pattern a ReentrancyGuard tam, kde voláte externí kontrakty.

- Gas & DoS:
  - Ověřit, že žádné on-chain smyčky nescanují dynamické poli bez limitu; použít page/offset pattern pro heavy loops.

- Oracle/VRF flow:
  - Kontrola: VRF callback validation, případné replay/duplicate prevention.

- Economic checks:
  - Validace mint pricing, rounding, mint caps, reward emission schedule.

- Events & revert reasons:
  - Doporučení: emisní eventy pro každý state change a smysluplné revert messages.

--------------------------------------------------------------------------------
3) Tokenomika & ekonomická analýza

- Zkontrolovat supply rozdělení (vesting, treasury, liquidity, rewards). Pokud kód tokenomiky není v tomto repu, vyžádat Solidity sources a vesting schedule.

- Simulace finančních toků: doporučeno spustit integrační simulace (script) přes hardhat/foundry, nasimulovat buy/sell a buyback toky a ověřit, že buyback mechanism nemůže být zneužit pomocí flash loan.

- Attack vectors: oracle manipulation (závisí na oracle provider); sandwich/MEV risk na mint/purchase transakcích — zvažte off-chain pricing nebo slippage ochrany.

- Stress tests: nasimulovat vysokou aktivitu, velké nákupy a masivní buyback, ověřit limity a fail-safe.

--------------------------------------------------------------------------------
4) Backend / Off-chain components — zjištění a doporučení

- Serverless functions (Pinata, Netlify):
  - Auth: pin endpoints jsou momentálně veřejné (bez per-user auth). To je riziko (API abuse/ cost).
  - Rate-limiting: implementováno per-instance (in-memory) limiter v `functions/_pinataUtils.js`. Není škálovatelný.
  - Secret handling: `.env.local` a `.env` v repo musí být vyčištěny; citlivé klíče uložit v Netlify Site environment.

- Indexery & logs: FE volá reader/getFrontendSnapshot; některé RPC poskytovatele nejsou archive — hláška "RPC history pruned" se objevuje. Pokud indexer provádí eth_getLogs na rozsáhlé oblasti, je potřeba archive node.

- DB & backups: Supabase tabulky `nonces` a `messages`. Doporučeno nastavit pravidelné zálohy a restore postupy.

- CI/CD security: zajistit, že CI nemá přístup k production secrets; použít branch protection a PR review.

--------------------------------------------------------------------------------
5) Frontend security & integrity

- Expozice proměnných: všechny citlivé klíče musí být bez prefixu `VITE_` nebo `NEXT_PUBLIC_`. Jen veřejné klíče (publishable) mohou být `NEXT_PUBLIC_`/`VITE_`.

- Input validation: `pinFile` provádí mime/type a size check; front-end by měl dále validovat vstup a zobrazovat uživatelsky přívětivé chyby.

- XSS: při vykreslování contentu (chat/messages) použít safe escaping. V `functions/message.js` obsah ukládán textově — front-end musí sanitize při renderu.

- RPC fallback: kód robustně volí RPC endpointy; upozornění při pruned history je očekávané.

- Signature flow: messages ověřeny server-side (good). Dbejte na replay protection (nonce TTL je 2 minuty) — ověřit usability vs. bezpečnost.

- IPFS fallback: více gatewayů je definováno; repin strategie: Pinata primárně + nft.storage fallback — dobré řešení.

--------------------------------------------------------------------------------
6) Infrastructure & ops

- RPC providers: PublicNode použit jako primární; pokud potřebujete full history, zvažte Infura/Alchemy archive plan.

- Third-party SLA: Pinata má rate limits — doporučit monitoring a rozpočet pro pinning.

- Secrets management: Netlify environment variables nebo Vault — nedovolit secrets v repo.

- Backups: exportovat Supabase tables (nonces/messages) a CID list pravidelně.

- Observability: nasadit Sentry nebo Logflare pro functions chybové logy.

--------------------------------------------------------------------------------
7) Tests & verification

- Aktuální repo obsahuje test `__tests__/pinFunctions.test.js` — rozumné unit testování Pinata flow.

- Doporučit coverage rozšířit na funkce message/nonce/reader integrace + e2e s mock Supabase a Pinata.

- Property tests: Foundry / Echidna pro invariants v SC.

--------------------------------------------------------------------------------
8) Dependency & supply-chain review

- Použité NPM balíčky jsou v `package.json` a `package-lock.json` (přítomné). Doporučit:
  - Audit závislostí (`npm audit`) a pinování verzí.
  - CI check pro vulnerable deps (dependabot/renovate + SCA scan).

- Build reproducibility: lockfile existuje; doporučit detach reproducible builds a podpis artefaktů.

--------------------------------------------------------------------------------
9) Operational security (OPSEC)

- Key management: administrativní klíče mimo CI; multisig pro on-chain admin akce; rotace klíčů.

- Admin UX: pokud jsou admin endpoints (functions/admin/*), omezit přístup a používat strong auth + audit trail.

--------------------------------------------------------------------------------
10) Deliverables (co auditor dodá)

- Executive summary s hlavními riziky a doporučenou prioritou oprav.
- Technický report: seznam chyb + repro kroky + severity.
- Patch suggestions: PR diffs / code snippets (mohu připravit konkrétní PRy pro FE/serverless fixes).
- Testcases: unit/integration tests k reprodukci chyb.
- Post-audit checklist + monitoring playbook.

--------------------------------------------------------------------------------
11) Prioritizace oprav (quick wins)

1. Zabezpečit secrets — odstranit `.env` obsahující citlivé hodnoty z repo, rotovat klíče.
2. Přidat škálovatelný rate-limiter pro `pinFile`/`pinJson` (Redis / Cloudflare rate limit / API gateway).
3. Omezit pin endpoints — vyžadovat per-user short-lived token nebo CAPTCHA.
4. Přidat ReentrancyGuard a checks-effects-interactions pattern v kritických SC (pokud chybí).
5. Rozšířit unit tests pro message/nonce flow + integrační testy s mock Supabase.

--------------------------------------------------------------------------------

Pokud chcete, provedu tyto konkrétní akce automaticky:
- Implementovat CI pre-commit hook, který skenuje commity na tajné klíče a zabraňuje commitům (`git-secrets` nebo `detect-secrets`).
- Vytvořit PR s drobnými serverless zlepšeními (vrátit srozumitelnější chybové zprávy, přidat per-request IP logging, omezit CORS).
- Přidat požadované unit tests a skripty pro lokální testování funkcí (`netlify dev` test script).

Dejte vědět, kterou akci chcete jako další krok.