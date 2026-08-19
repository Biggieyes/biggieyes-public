# Developer Guide

## Repository Layout

| Path | Purpose |
| --- | --- |
| `src/` | frontend application and Web3 integration |
| `src/shared/utils` | addresses, contract factories, RPC configuration, helpers |
| `src/hooks` | protocol-specific data access hooks |
| `functions/` | Netlify serverless functions |
| `biggi-project/bekend/contracts` | Solidity source tree |
| `biggi-project/bekend/artifacts` | compiled contract artifacts |
| `biggi-project/bekend/scripts` | deployment and wiring scripts |
| `__tests__/` | frontend and utility tests |

## Local Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Optional commands:

```bash
npm run build
npm run test
npm run lint
npm run check:rpc
```

## Contract Access Pattern

The frontend centralizes chain access in `src/shared/utils/contract.js`.

### Read path

- use `getROProvider()` for read-only provider access
- use reader factories like `getReaderRO()` or `getBiggiTokenomicsReaderRO()`
- prefer aggregated readers before making multiple point calls

### Write path

- use injected or WalletConnect signer providers
- enforce Polygon mainnet before transaction submission
- use retry helpers for write paths that may hit RPC throttling

## Address And ABI Discipline

### Address sources

- frontend canonical registry: `src/shared/utils/addresses.js`
- backend mirror: `biggi-project/bekend/addresses.json`

### ABI sources

- frontend ABI exports are centralized through the config ABI index
- keep ABI inventory aligned with deployed artifact versions

When contract addresses or interfaces change, update both the address registry and the relevant read/write helpers.

## Reader-First UI Development

If you are adding a new panel:

1. check whether a reader contract already exposes the needed snapshot
2. if not, add a small read-only helper or service rather than scattered RPC calls
3. encapsulate the fetch logic in a hook
4. keep write flows separate from polling and display logic

This keeps panel logic stable even when the underlying protocol spans many contracts.

## Common Development Tasks

### Add a new contract integration

1. add the address key to the registry
2. export the ABI
3. add a contract factory helper
4. create or extend a hook or service
5. add tests for normalization or read-path fallbacks

### Add a new dashboard panel

1. add a lazy import to `AppCore.jsx`
2. create a focused hook for the data domain
3. use reader snapshots where possible
4. handle loading, RPC degradation, and missing-address states explicitly

### Add new deployment targets

1. update backend and frontend address registries
2. add environment templates
3. verify chain metadata in RPC config and wallet helpers

## Testing Guidance

The current repo includes tests for:

- wallet connection behaviors
- VRF polling utilities
- reward readers and snapshots
- tokenomics normalization
- RPC error handling

For new protocol-facing code, prefer tests that validate:

- address selection
- ABI compatibility
- snapshot normalization
- failure fallback behavior

## Coding Guidelines

- keep contract interactions centralized
- avoid duplicating address literals in components
- prefer reader aggregation to repeated `Promise.all` fan-out
- treat wallet and RPC errors as first-class UI states
- keep tokenomics formatting logic separate from raw BigInt snapshots

## Documentation Maintenance

When contract behavior changes, update:

- `SMART_CONTRACTS.md`
- `TOKENOMICS.md`
- `ARCHITECTURE.md`
- relevant user flows or whitepaper sections if the change is user-facing

BIGGIEYES is a multi-contract protocol. Documentation drift becomes a real operational risk if it is not maintained alongside code changes.
