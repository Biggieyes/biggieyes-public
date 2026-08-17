# Frontend Audit - Current Mainnet State

Last verified: 2026-08-17

This document replaces the old January frontend audit. It reflects the current Polygon mainnet frontend wiring, ABI inventory, reader configuration, and runtime validation.

## Scope

- React/Vite frontend in `src/`.
- Public frontend mirror in `public-repo/`.
- Address registry and ABI exports used by frontend components.
- Runtime read flows for Gallery, LiveStats, Rewards, and tokenomics panels.
- Netlify function integration at documentation level.

This is not a formal smart-contract security audit.

## Current Status

- Active chain: Polygon mainnet, `chainId 137`.
- Canonical frontend address registry: `src/shared/utils/addresses.js`.
- Backend address mirror: `biggi-project/bekend/addresses.json`.
- ABI exports: `src/config/abi/index.js`.
- ABI inventory: 58 JSON ABI files plus the central export index.
- Address mirror: 161 runtime frontend/backend keys; historical `OLD_TICKET_HUB` remains backend-only.
- CORE mirror: five chapter pairs and seven critical CORE ABIs are checked byte-for-byte against backend canonical sources.
- Reader contracts are configured for mainnet; the old `MAIN_READER` missing warning is no longer current.

## Verified Commands

The latest frontend verification passed:

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run check:contracts
npm run check:abis
npm run check:rpc
npm run smoke:runtime
```

Runtime smoke verified Gallery, LiveStats, and Rewards panel flows against the configured mainnet readers/RPCs.

## Mainnet Readers

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

## RPC State

Active public fallbacks:

- `https://polygon.drpc.org`
- `https://polygon-bor-rpc.publicnode.com`

`https://polygon-rpc.com` is intentionally filtered in runtime config because smoke checks observed HTTP 401 behavior from that endpoint.

## Findings

- Runtime network configuration supports Polygon mainnet only and rejects every unsupported chain ID.
- Mainnet readers are configured and consumed by dashboard components.
- Contract addresses and ABI exports are centralized; components should not duplicate addresses.
- Cache keys include chain/contract context, so payloads from unsupported or obsolete deployments are ignored.
- `public-repo` documentation now describes Polygon mainnet as active, not planned.

## Residual Risks

- Public RPCs can rate-limit or return incomplete history. Use a private or paid RPC for production traffic.
- Netlify/server secrets must remain server-only and out of committed files.
- Heavy historical reads may require an archive RPC or indexer.
- Independent third-party smart-contract audit is still separate from this frontend integration review.

## Operating Rule

After changing addresses, ABIs, or reader usage, run:

```bash
npm run check:contracts
npm run check:abis
npm run build
npm run smoke:runtime
```
