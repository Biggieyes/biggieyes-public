# Frontend Architecture

Last verified: 2026-08-17

This document describes the current frontend architecture in this repository. It reflects the Polygon mainnet deployment and the validation runs performed after the mainnet migration.

## Verified State

- Active chain: Polygon mainnet, `chainId 137`.
- Unsupported chain IDs are rejected; they never fall back to Polygon contract addresses.
- Canonical frontend registry: `src/shared/utils/addresses.js`.
- `CORE_CHAPTERS` exposes all five deployed VRF/Public pairs; `useChapterSeriesReader` reads all five chapters and enriches them with the live `TicketHub.chapterActive(chapterId)` state.
- Deployed/registered does not mean available. Ticket minting fails closed unless exactly one chapter is active, then calls `TicketHub.mintTicketForChapter(chapterId)`.
- Wallet assets read tickets from the central Hub and NFT balances from all ten chapter collection contracts. Asset identity is always `contractAddress + tokenId`.
- VRF diagnostics, redeem pending state, collection statistics, and LiveStats follow the single live active chapter; previously minted NFT remain visible after the next chapter opens.
- Backend address mirror: `biggi-project/bekend/addresses.json`.
- ABI exports: `src/config/abi/index.js`.
- ABI inventory check: `npm run check:abis` reports 58 ABI files and 801 functions.
- Address mirror check: `npm run check:contracts` reports 161 runtime frontend/backend keys plus five chapter/CORE ABI comparisons. Backend-only `OLD_TICKET_HUB` is intentionally excluded from runtime.
- Runtime smoke: `npm run smoke:runtime` passes gallery, LiveStats, and Rewards panel flows.

## Stack

| Layer | Current technology |
| --- | --- |
| UI | React 19 |
| Build | Vite |
| Web3 | ethers v6 |
| Wallets | injected wallets and WalletConnect |
| Serverless | Netlify functions |
| Chain data | Polygon mainnet readers and direct contract fallbacks |

## Application Shape

The app is a dashboard-style DApp. The shell and panel orchestration live in `src/app/AppCore.jsx`.

Primary user and transparency areas:

- mint and redeem controls
- gallery
- LiveStats
- Rewards panel
- VRF panel
- tokenomics and ecosystem panels
- community center
- user wallet panel
- admin/moderator panels

## Contract Registry

Do not hardcode addresses inside components. Read addresses from `ADDR` in `src/shared/utils/addresses.js`.

Selected live mainnet values at the last verification:

| Key | Address |
| --- | --- |
| `MAIN` / `COLLECTION_VRF` | `0x6786491Ffc82d80E3ee627aFE81cc7168FF00De4` |
| `MAIN2` / `COLLECTION_PUBLIC` | `0xF82Eb16aFFEae270F808E4bFF1C43f1BB04E4634` |
| `TICKET_HUB` | `0x7b7e561173f498C8274b821090Da64E8ee653f6A` |
| `VRF_ROUTER` | `0x1386d42C11dA3D6cd08C4B7141A7cE67A082da9F` |
| `BIGGI` | `0xD73152845Bc5a9b8253ea0100BB10388CC5c0EeD` |
| `DISTRIBUTOR` | `0xCE892698159D8D799D5eF7f0dF0111487511fD22` |
| `RESERVE` | `0x2786e46e01a5d229118fEdC102267217C7e94574` |
| `TREASURY` | `0x35EE9523D20fFfe47c62dCcF01fA0136424A05e7` |
| `BUYBACK_AGENT` | `0x5A77E90c467576C82B8d0E74eD112B829C625BB4` |
| `PAIR` | `0x59C7B17B3ACD48979B25215a0c477dF6FFFF3e90` |

## Reader Layer

The frontend is reader-first for dashboards and transparency views. It uses direct contract fallbacks only when needed.

Current mainnet readers:

| Reader key | Address |
| --- | --- |
| `MAIN_READER` | `0x4937CdcF1668255Cb46c78E19547ea96C94391Ef` |
| `MCD_READER_V2` | `0xa65B4e88E37F085B9009295eA0AcF05e18a82884` |
| `NFT_REWARDS_READER` | `0x430376b1f4F12ce2D641CC28f2968297aA2b0c12` |
| `TOKEN_REWARDS_READER` | `0xB558137Ce8a2e065de09f7ef7cF24911E49A9972` |
| `RESERVE_TREASURY_READER` | `0xb379bB928f3B683528C209C28A95F4D2854EC407` |
| `BUYBACK_READER` | `0x8eD6c94e5Fb336096E6C28480f3C514c9bddFa89` |
| `BIGGI_TOKENOMICS_READER` | `0x868640D9fd873AE3ecFCAbCbB458413A70D6f468` |
| `TOKENOMICS_SYSTEM_ADDON_READER` | `0x28D73361F9E7778362cac9fEBe1c8E0a2B1121ea` |
| `SYSTEM_READER` | `0x5C918B2E610BAF3E9f77B0b7dE456D63B7F8bD55` |
| `LM_READER` | `0x1879b76c3a923d58970a90e3D004bD067c272a22` |
| `LIQUIDITY_BRANCH_USER_READER` | `0xC04FC52560fe5A8fcEf16a3ADE7126e83Da0D4f5` |

Optional empty keys are allowed when the code has an explicit fallback. For example, `BIGGI_TOKEN_READER` currently falls back to liquidity/reserve readers, and DRIP snapshots read the deployed DRIP contracts directly.

## RPC Model

RPC configuration lives in `src/shared/utils/rpcConfig.js`.

Current policy:

- main public RPC: `https://polygon.drpc.org`
- public fallback: `https://polygon-bor-rpc.publicnode.com`
- `https://polygon-rpc.com` is filtered as a problematic public endpoint because it returned HTTP 401 during runtime smoke testing.
- ethers `FallbackProvider` is opt-in through `VITE_ENABLE_ETHERS_FALLBACK_PROVIDER=1`.
- archive RPC is optional and should be supplied through `VITE_ARCHIVE_RPC_URL` or `VITE_ARCHIVE_RPC_URLS` for heavy historical log reads.

## Cache And Data Freshness

Mainnet cache scoping is explicit:

- gallery metadata/image cache is scoped by chain ID and collection contract
- LiveStats last-minted/top-first cache is scoped by chain ID and active collection address
- cache payloads with a different chain/contract scope are ignored

This prevents data from any unsupported network or obsolete contract address from being displayed in the mainnet UI.

## Security Boundaries

- Write flows require a signer and explicit user action.
- Read paths prefer read-only providers.
- Wallet chain enforcement targets Polygon mainnet.
- Server-only secrets must not use `VITE_` or `NEXT_PUBLIC_` prefixes.
- Pinata, Supabase service-role, and private deployment keys must stay in local/server environment only.
- Missing optional public Supabase values must disable chat/moderator storage without crashing the application.

## Key Files

| File | Responsibility |
| --- | --- |
| `src/app/AppCore.jsx` | app shell, panel orchestration, main user flows |
| `src/shared/utils/addresses.js` | canonical mainnet address registry |
| `src/shared/utils/contract.js` | ethers providers and contract factories |
| `src/shared/utils/rpcConfig.js` | RPC list, health, filtering, active chain |
| `src/web3/rpcProviders.js` | shared static JSON-RPC provider helpers |
| `src/wallet/wc.js` | WalletConnect setup |
| `src/components/Gallery.jsx` | mainnet-scoped NFT gallery |
| `src/components/LiveStats.jsx` | mainnet live statistics and transparency view |
| `src/features/rewards/REWARDSPanel.jsx` | token, collection, and NFT rewards UI |

## Required Verification After Frontend Changes

Run these before publishing frontend changes:

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run check:contracts
npm run check:abis
npm run smoke:runtime
```
